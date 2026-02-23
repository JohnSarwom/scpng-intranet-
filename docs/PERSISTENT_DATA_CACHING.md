# Persistent Data Caching Implementation

## Date: February 2026

## Overview

This document describes the persistent data caching system implemented across the SCPNG Intranet application. The caching layer eliminates redundant API calls to SharePoint (via Microsoft Graph), delivering **instant page loads** when navigating between pages or refreshing the browser.

**Before:** Every page navigation triggered full data re-fetches from SharePoint, taking 30–60 seconds per page.
**After:** Pages load instantly from cache. Background re-fetches keep data fresh without blocking the UI.

---

## Architecture

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Server-state cache | `@tanstack/react-query` v5 | In-memory cache with stale-while-revalidate |
| Cache persistence | `@tanstack/react-query-persist-client` | Automatic dehydration/rehydration to storage |
| Storage adapter | `@tanstack/query-sync-storage-persister` | Synchronous localStorage adapter |
| Storage backend | `window.localStorage` | Persists cache across browser refreshes |

### How It Works

```
User visits page
       │
       ▼
  React Query checks cache
       │
       ├─ Cache HIT + fresh (< 5 min) ──► Render immediately, no network request
       │
       ├─ Cache HIT + stale (> 5 min) ──► Render immediately + background refetch
       │
       └─ Cache MISS ──► Show loading state, fetch from SharePoint

After any fetch:
  React Query cache (in-memory) ──► PersistQueryClientProvider ──► localStorage

On browser refresh:
  localStorage ──► PersistQueryClientProvider ──► React Query cache ──► Render immediately
```

---

## Global Configuration

### File: `src/App.tsx`

#### QueryClient Configuration

```typescript
const CACHE_VERSION = 'v1'; // Bump when SharePoint data schema changes

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 minutes — data considered fresh
      gcTime: 1000 * 60 * 60 * 24,     // 24 hours — keep in memory/localStorage
      refetchOnWindowFocus: false,      // Don't refetch when user tabs back
      retry: 2,                         // Retry failed requests twice
    },
  },
});
```

**Configuration Explained:**

| Option | Value | Effect |
|--------|-------|--------|
| `staleTime` | 5 minutes | Data served from cache without any network request for 5 minutes after fetch |
| `gcTime` | 24 hours | Cached data retained in memory and localStorage for 24 hours before garbage collection |
| `refetchOnWindowFocus` | `false` | Prevents surprise refetches when user switches browser tabs |
| `retry` | 2 | Automatically retries failed SharePoint API calls twice before showing error |

#### Persistence Configuration

```typescript
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'SCPNG_INTRANET_QUERY_CACHE',
  throttleTime: 1000, // Debounce localStorage writes to max 1 per second
});
```

```tsx
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister,
    maxAge: 1000 * 60 * 60 * 24,  // 24 hours — discard persisted data after this
    buster: CACHE_VERSION,          // Change to force full cache invalidation
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => query.state.status === 'success',
    },
  }}
>
```

**Persistence Explained:**

| Option | Value | Effect |
|--------|-------|--------|
| `key` | `SCPNG_INTRANET_QUERY_CACHE` | localStorage key where the entire cache is stored |
| `throttleTime` | 1 second | Debounces writes to prevent excessive localStorage I/O |
| `maxAge` | 24 hours | Persisted cache auto-discarded after 24 hours |
| `buster` | `CACHE_VERSION` ('v1') | Changing this value forces a full cache clear on next app load |
| `shouldDehydrateQuery` | Only `status === 'success'` | Only successful query results are persisted (not errors or loading states) |

---

## Pages and Hooks Modified

### 1. Unit Page (`src/pages/Unit.tsx`)

**Problem:** A `useEffect` on mount explicitly called `.refresh()` on ALL data hooks (tasks, projects, KRAs, KPIs), forcing a full re-fetch every time the user navigated to the Unit page.

**Fix:** Removed the mount-refresh `useEffect`. React Query's `staleTime` now controls when data is refetched.

**Removed code:**
```typescript
// DELETED — was at lines 488-495
useEffect(() => {
    taskState.refresh?.();
    projectState.refresh?.();
    kraState.refresh?.();
    kpiState.refresh?.();
}, [taskState.refresh, projectState.refresh, kraState.refresh, kpiState.refresh]);
```

**Manual refresh preserved:** The `handleRefreshAllData` callback is still available for user-triggered refreshes from the KRAs tab.

**Hooks affected (all in `src/hooks/useSharePointOps.ts`):**

| Hook | queryKey | staleTime | Data Source |
|------|----------|-----------|-------------|
| `useSharePointTasks` | `['sharePoint', 'tasks', ...]` | 5 min (global) | SharePoint `Operations_Tasks` list |
| `useSharePointProjects` | `['sharePoint', 'projects', ...]` | 5 min (global) | SharePoint Projects list |
| `useSharePointKRAs` | `['sharePoint', 'kras', ...]` | 5 min (explicit) | SharePoint `Performance_KRAs` list |
| `useSharePointKPIs` | `['sharePoint', 'kpis', ...]` | 5 min (global) | SharePoint KPIs list |
| `useSharePointObjectives` | `['sharePoint', 'objectives', ...]` | 5 min (global) | SharePoint Objectives list |

---

### 2. Home Page (`src/pages/Index.tsx`)

The Home page itself required no changes — it's a lightweight orchestrator. However, several **child components** had hooks that bypassed React Query entirely, using raw `useState`/`useEffect` patterns that re-fetched on every mount.

#### 2a. Calendar Events (`src/hooks/useCalendarEvents.ts`)

**Hooks migrated to `useQuery`:**

- **`useTodaysCalendarEvents`** — Used by calendar widgets
- **`useUpcomingCalendarEvents`** — Used by `ScheduledEvents` component on Home page

**Before:**
```typescript
// Raw useState + useEffect — refetched on every mount
const [events, setEvents] = useState<CalendarEvent[]>([]);
const [loading, setLoading] = useState<boolean>(true);

useEffect(() => {
    fetchUpcoming();
}, [fetchUpcoming]);
```

**After:**
```typescript
const query = useQuery({
    queryKey: ['calendarEvents', 'upcoming', days, includeShared],
    queryFn: () => getUpcomingEvents(msalInstance, days, includeShared),
    staleTime: 1000 * 60 * 5,
});

return {
    events: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
};
```

**Return shape preserved:** Both hooks return the same `{ events, loading, error, refetch }` shape, so no changes were needed in consuming components.

**Note:** The general-purpose `useCalendarEvents` hook (with `autoFetch`, `refreshInterval` options) was left unchanged as it is more complex and not used on the Home page.

#### 2b. Internal News Slideshow (`src/hooks/useInternalNews.ts`)

**Used by:** `InternalNewsSlideshow` component on Home page

**Before:** Raw `useState`/`useEffect` fetching from `NewsSharePointService.getAllNews()` on every mount.

**After:** `useQuery` with key `['internalNews']` and 5-minute `staleTime`.

**Return shape preserved:** `{ news, isLoading, error, refetch }`

#### 2c. News Ticker (`src/components/dashboard/NewsTicker.tsx`)

**Used by:** Home page and News page header

**Before:** Raw `useState`/`useEffect` fetching from `NewsSharePointService.getAllNews()` on every mount, with in-component shuffle logic.

**After:** `useQuery` with key `['newsTicker']` and 5-minute `staleTime`. Shuffle logic moved to `useMemo` to prevent re-shuffling on every render.

---

### 3. Apps Page (`src/hooks/useApps.ts`)

**Used by:** `AppsSection` component on the Apps page

**Before:** Had its own manual localStorage cache (`scpng_apps_cache` key) with a 24-hour TTL, plus raw `useState`/`useEffect`. Despite the cache, it still re-ran the effect on every mount when `instance`/`accounts` changed.

**After:** `useQuery` with key `['sharePointApps', account?.username]` and **30-minute** `staleTime` (apps change rarely). The manual localStorage cache was removed — React Query's persistence layer handles this automatically.

**Return shape preserved:** `{ apps, categories, loading, error, refetch, getAppsByCategory, getAppById }`

---

### 4. News Page (`src/pages/News.tsx`)

**The most significant refactoring.** The News page previously used a complex `useState`/`useEffect` pattern with:
- A `newsData` state object tracking per-tab loading/error/hasFetched states
- A `fetchSharePointNews()` function that fetched, categorized, and distributed news into tabs
- A `loadNewsData()` function orchestrating fetches
- ~180 lines of dead AI-driven news code (`aiDrivenCategories` was empty)

**After:**
- Single `useQuery` with key `['sharePointNews']` fetches and maps all articles
- `useMemo` hooks derive per-tab data: `shuffledAllNews`, `scpngNewsArticles`, `nationalNewsArticles`, `globalNewsArticles`, `availableScpngYears`
- A `newsData` object is built via `useMemo` for backward compatibility with `renderNewsCards`
- Dead AI-driven category code removed
- `fetchSharePointNews()` now wraps `refetchNews()` for the upload success callback and Edge Function trigger

---

### 5. NoticeBoard Bug Fix (`src/components/dashboard/NoticeBoard.tsx`)

**Issue discovered:** When React Query restores data from localStorage, JavaScript `Date` objects are deserialized as strings (JSON has no native Date type). The `NoticeBoard` component called `.toLocaleDateString()` directly on `notice.createdDate`, which crashed when it was a string.

**Fix:**
```typescript
// Before — crashed on cache-restored data
const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// After — handles both Date objects and ISO strings
const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
```

**Important for future development:** When using `PersistQueryClientProvider`, always assume cached data may have `Date` objects as strings. Use `new Date(value)` instead of calling Date methods directly.

---

## Cache Behavior Summary

### Per-Query staleTime

| Query Key | staleTime | Source Hook/Component |
|-----------|-----------|----------------------|
| `['sharePoint', 'tasks', ...]` | 5 min (global default) | `useSharePointTasks` |
| `['sharePoint', 'projects', ...]` | 5 min (global default) | `useSharePointProjects` |
| `['sharePoint', 'kras', ...]` | 5 min (explicit) | `useSharePointKRAs` |
| `['sharePoint', 'kpis', ...]` | 5 min (global default) | `useSharePointKPIs` |
| `['sharePoint', 'objectives', ...]` | 5 min (global default) | `useSharePointObjectives` |
| `['strategyData']` | 10 min (explicit) | `useStrategySharePoint` |
| `['unitRoster', unitName]` | 5 min (explicit) | `useUnitRoster` |
| `['calendarEvents', 'today', ...]` | 5 min | `useTodaysCalendarEvents` |
| `['calendarEvents', 'upcoming', ...]` | 5 min | `useUpcomingCalendarEvents` |
| `['internalNews']` | 5 min | `useInternalNews` |
| `['newsTicker']` | 5 min | `NewsTicker` component |
| `['sharePointApps', email]` | 30 min | `useApps` |
| `['sharePointNews']` | 5 min | `News` page |
| `['announcements']` | 5 min (explicit) | `useNoticeBoard` |

### User Experience by Scenario

| Scenario | Before | After |
|----------|--------|-------|
| Navigate to Unit page | 30–60s loading spinner | Instant (from memory cache) |
| Navigate away and back to Unit | 30–60s loading spinner | Instant (data still in cache) |
| Browser refresh | 30–60s loading spinner | Instant (from localStorage), background refetch |
| Add/edit/delete a task | Works, refetches after | Works, refetches after, cache auto-updates |
| Data older than 5 min | N/A (always refetched) | Show cached data + silent background refetch |
| First visit ever (no cache) | 30–60s loading spinner | 30–60s loading spinner (unchanged) |
| After 24 hours | 30–60s loading spinner | Full refetch (cache expired) |

---

## CRUD Operations Compatibility

All existing mutation patterns continue to work correctly:

1. **`query.refetch()` pattern** (used by most hooks in `useSharePointOps.ts`):
   - After add/update/delete, `refetch()` bypasses `staleTime` and always hits the network
   - React Query updates the in-memory cache with fresh data
   - `PersistQueryClientProvider` auto-saves the updated cache to localStorage (within ~1 second)

2. **`queryClient.invalidateQueries()` pattern** (used by `useStrategySharePoint`):
   - Marks queries as stale, triggering refetch for any mounted components
   - Works identically with persistence

3. **No optimistic update conflicts**: The codebase uses "mutate then refetch" (not optimistic `onMutate`), so there's no risk of persisting an optimistic state that gets rolled back.

---

## Cache Invalidation Strategies

### Automatic
- **staleTime expiry**: After 5 minutes, data is considered stale. Next access shows cached data + triggers background refetch.
- **maxAge expiry**: After 24 hours, persisted localStorage data is discarded entirely.
- **CRUD mutations**: `query.refetch()` after mutations forces fresh data from the server.

### Manual
- **User-triggered refresh**: The "Refresh" button on the KRAs tab calls `handleRefreshAllData`, which explicitly refetches all hooks.
- **News upload**: After uploading SCPNG news, `fetchSharePointNews()` (which wraps `refetchNews()`) updates the cache.
- **Edge Function trigger**: After invoking the news Edge Function, the cache is refetched.

### Schema Changes (Deployments)
When the SharePoint list schema changes (new columns, renamed fields, removed fields):
1. Open `src/App.tsx`
2. Change `CACHE_VERSION` from `'v1'` to `'v2'` (or increment)
3. On next app load, all users' persisted caches are automatically discarded and data is refetched fresh

---

## localStorage Details

### Key: `SCPNG_INTRANET_QUERY_CACHE`

This single key stores the entire dehydrated React Query cache as a JSON blob.

**Typical size**: 100–500 KB (depending on number of tasks, KRAs, news articles, etc.)
**localStorage limit**: 5–10 MB per origin (well within budget)

### Monitoring Cache Size

In browser DevTools console:
```javascript
// Check cache size
const size = localStorage.getItem('SCPNG_INTRANET_QUERY_CACHE')?.length || 0;
console.log(`Cache size: ${(size / 1024).toFixed(1)} KB`);

// View cached query keys
const cache = JSON.parse(localStorage.getItem('SCPNG_INTRANET_QUERY_CACHE'));
console.log('Cached queries:', cache?.clientState?.queries?.map(q => q.queryKey));

// Clear cache manually (forces full refetch on next load)
localStorage.removeItem('SCPNG_INTRANET_QUERY_CACHE');
```

### Removed localStorage Keys

The following manual cache keys are no longer written to (replaced by the unified React Query cache):

| Key | Previously Used By | Status |
|-----|-------------------|--------|
| `scpng_apps_cache` | `useApps.ts` | No longer written. Can be cleaned up from existing users' browsers. |

---

## Files Modified

| File | Change Type | Description |
|------|------------|-------------|
| `package.json` | Dependencies | Added `@tanstack/react-query-persist-client`, `@tanstack/query-sync-storage-persister` |
| `src/App.tsx` | Core config | Configured QueryClient defaults, created persister, replaced `QueryClientProvider` with `PersistQueryClientProvider` |
| `src/pages/Unit.tsx` | Bug fix | Removed mount-refresh `useEffect` that forced re-fetch on every navigation |
| `src/pages/News.tsx` | Refactor | Replaced `useState`/`useEffect` data fetching with `useQuery` + `useMemo` derivations. Removed dead AI news code. |
| `src/hooks/useCalendarEvents.ts` | Migration | Migrated `useTodaysCalendarEvents` and `useUpcomingCalendarEvents` from `useState`/`useEffect` to `useQuery` |
| `src/hooks/useInternalNews.ts` | Migration | Migrated from `useState`/`useEffect` to `useQuery` |
| `src/hooks/useApps.ts` | Migration | Migrated from manual localStorage cache + `useState`/`useEffect` to `useQuery` |
| `src/components/dashboard/NewsTicker.tsx` | Migration | Migrated from `useState`/`useEffect` to `useQuery` + `useMemo` for shuffle |
| `src/components/dashboard/NoticeBoard.tsx` | Bug fix | Fixed `formatDate` to handle string dates from cache deserialization |

---

## Known Considerations

### Date Serialization
JSON serialization converts `Date` objects to ISO strings. Any component receiving cached data must handle dates as strings. Use `new Date(value)` instead of calling `.toLocaleDateString()` directly on the raw value.

### Cross-User Cache
If two users share the same browser profile, both users' data is stored under the same localStorage key. Query keys include user-specific parameters (email, role, department), so React Query treats them as separate cache entries. However, both users' data will be persisted. This is acceptable for an enterprise intranet environment.

### Large Data Volumes
If a division has hundreds of tasks/KRAs, the serialized cache could grow. The `shouldDehydrateQuery` filter ensures only successful queries are persisted. If size becomes an issue, add additional filtering in `dehydrateOptions` (e.g., only persist queries with keys starting with `'sharePoint'`).

### Stale Data After Schema Deployment
If a schema change is deployed but `CACHE_VERSION` is not bumped, users will see stale/broken data from localStorage until the 24-hour `maxAge` expires. **Always bump `CACHE_VERSION` when data shapes change.**

---

## Testing Checklist

1. **Navigation caching**: Visit Unit page → wait for load → navigate to Home → navigate back to Unit → data appears instantly (no spinner)
2. **Browser refresh**: Visit any page → wait for load → refresh browser → data appears instantly from localStorage
3. **CRUD persistence**: Add a task on Unit page → navigate away → navigate back → new task is visible
4. **Cache expiry**: Wait >5 minutes → navigate to a page → data appears instantly + network request visible in DevTools (background refetch)
5. **Manual refresh**: On KRAs tab, use refresh button → data updates from SharePoint
6. **News upload**: Upload SCPNG news → news list updates immediately
7. **Cache clear**: Run `localStorage.removeItem('SCPNG_INTRANET_QUERY_CACHE')` → refresh → all data fetches fresh
8. **Version buster**: Change `CACHE_VERSION` → refresh → all data fetches fresh
