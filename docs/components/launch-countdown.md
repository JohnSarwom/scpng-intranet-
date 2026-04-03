# Launch Countdown

Component that displays a live 48-hour countdown on the Welcome Banner, leading up to the SCPNG Intranet website launch. When the countdown expires it switches to a bold, pulsating "Website Officially Launched!" message.

A maintenance override flag allows the banner to be replaced with a technical warning at any time without touching the countdown logic.

---

## Files

| File | Purpose |
|------|---------|
| `src/hooks/useCountdown.ts` | Fetches real server time, computes remaining ms, ticks every second |
| `src/components/dashboard/LaunchCountdown.tsx` | UI — maintenance warning, countdown timer, or launched banner |
| `src/components/dashboard/WelcomeBanner.tsx` | Renders `<LaunchCountdown />` in the right column of the banner |

---

## Maintenance override (domain / technical issues)

A single constant at the top of `LaunchCountdown.tsx` controls whether the maintenance warning is shown instead of the countdown:

```ts
// src/components/dashboard/LaunchCountdown.tsx  ~line 9
const SHOW_MAINTENANCE_WARNING = true;   // shows warning
const SHOW_MAINTENANCE_WARNING = false;  // shows countdown (normal)
```

**To restore the countdown after the issue is resolved:** set the flag to `false` and redeploy.

### What the maintenance banner shows

- Amber pulsating `AlertTriangle` icon + "Technical Notice" label
- "Website temporarily unavailable" heading
- "We are experiencing a domain name issue. Our team is working to resolve this as quickly as possible."

The banner sits inside the same Welcome Banner slot as the countdown so no layout changes are needed.

---

## How the timer works

The countdown target is **April 4 2026 at 12:00 PM PNG time** — exactly 48 hours after the countdown started on **April 2 2026 at 12:00 PM PNG time**.

```
Start:   April 2 2026  12:00 PM  PNG (UTC+10)
+ 48h
Target:  April 4 2026  12:00 PM  PNG (UTC+10)
```

On mount `useCountdown` calls the **WorldTimeAPI** once to get the authoritative server time for the `Pacific/Port_Moresby` timezone:

```
GET https://worldtimeapi.org/api/timezone/Pacific/Port_Moresby
```

It computes an offset (`serverTime − deviceTime`) and applies it to every local `Date.now()` tick. This means:

- The timer is **immune to device clock manipulation** (can't be cheated by changing the system clock).
- The API is called **once per page load only** — every subsequent second uses a local `setInterval`, so there are no rate-limit concerns.
- If the API is unreachable the hook **falls back silently** to the device clock.

```
API fetch (once)
      ↓
offset = serverMs − Date.now()
      ↓
every 1 s:  remaining = TARGET_MS − (Date.now() + offset)
      ↓
setTimeLeft(remaining)
```

---

## States

The component resolves to one of four states in priority order:

| Priority | State | Condition | What renders |
|----------|-------|-----------|--------------|
| 1 | Maintenance | `SHOW_MAINTENANCE_WARNING === true` | Amber warning banner |
| 2 | Loading | `loading === true` | Spinner (`Loader2`) |
| 3 | Active | `timeLeft > 0` | HH : MM : SS countdown with Rocket label |
| 4 | Expired | `timeLeft === 0` | Pulsating launch message |

---

## Launched banner (expired state)

When `isExpired` is `true` the `LaunchedBanner` component renders:

- **"Website Officially Launched!"** — gold → orange → red gradient text, weight 900, pulsates in scale + glow every 1.6 s via framer-motion.
- **"SCPNG Intranet is LIVE"** — green → blue → purple gradient text, fades in/out in sync.

No user interaction or admin action is required — the banner appears automatically once `Date.now()` passes the target.

---

## Hardcoded target

The target timestamp is defined at the top of `useCountdown.ts`:

```ts
const TARGET_ISO = '2026-04-04T12:00:00+10:00';
const TARGET_MS  = new Date(TARGET_ISO).getTime();
```

To move the launch date, update `TARGET_ISO` and redeploy.

---

## Quick-reference: common actions

| Action | What to change |
|--------|---------------|
| Show maintenance warning | `SHOW_MAINTENANCE_WARNING = true` in `LaunchCountdown.tsx` |
| Restore countdown | `SHOW_MAINTENANCE_WARNING = false` in `LaunchCountdown.tsx` |
| Change launch deadline | `TARGET_ISO` in `useCountdown.ts` |
| Change warning message text | `MaintenanceBanner` component in `LaunchCountdown.tsx` |

---

## Dependencies

- `framer-motion` — animations
- `lucide-react` — `Rocket`, `Loader2`, `AlertTriangle` icons
- WorldTimeAPI — free, no API key required
