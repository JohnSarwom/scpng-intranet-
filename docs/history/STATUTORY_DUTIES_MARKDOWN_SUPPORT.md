# Statutory Duties - Markdown Rich Text Support

## 1. Objective
Upgrade the Statutory Duties tab in both `DivisionModal` and `UnitModal` from a simple array of plain-text strings to a single rich-text field supporting full Markdown formatting. This allows administrators to paste comprehensive statutory duty documents (with headings, bold text, bullet lists, numbered lists, and italics) directly into the modal and have them render beautifully in view mode.

## 2. What Changed

### 2.1. Data Type Change
The `statutoryDuties` field was changed from `string[]` (array of short strings) to `string` (single Markdown text block).

**Before:**
```typescript
statutoryDuties?: string[];
// e.g. ["Manage the financial affairs...", "Oversee human resource..."]
```

**After:**
```typescript
statutoryDuties?: string;
// e.g. "**Overarching Mandate:**\nWhile the frontline divisions..."
```

This change was applied across all interfaces:
- `MockDivisionData` in `src/components/strategy/DivisionModal.tsx`
- `MockUnitData` in `src/components/strategy/UnitModal.tsx`
- Both interfaces in `src/mockData/orgData.ts`

### 2.2. Edit Mode - Single Large Textarea
The old UI had multiple small textareas (one per duty) with add/remove buttons. This was replaced with a single large monospace textarea (400px minimum height, resizable) where admins paste the full Markdown content as-is.

A formatting hint is displayed above the textarea:
> Supports markdown formatting: \*\*bold\*\*, \*italic\*, #### headings, bullet lists, numbered lists.

### 2.3. View Mode - Markdown Rendering
Uses `react-markdown` (v10.1.0) with `remark-gfm` plugin to render the Markdown content. The styling matches the existing `OfficerProfileModal` statutory duty tab:

```jsx
<div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
    <div className="prose prose-sm prose-gray max-w-none prose-headings:text-[#800020] prose-a:text-[#800020] prose-strong:text-gray-900">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {currentData.statutoryDuties}
        </ReactMarkdown>
    </div>
</div>
```

Key styling:
- Headings render in maroon (`#800020`) matching the SCPNG brand
- Bold text renders in dark gray (`gray-900`)
- Content sits inside a light gray card with border
- Consistent with `OfficerProfileModal` statutory duty rendering

## 3. Files Modified

| File | Change |
|------|--------|
| `src/components/strategy/DivisionModal.tsx` | Interface updated, removed array handlers (`addDuty`, `removeDuty`, `handleDutyChange(index)`), added single `handleDutyChange(value)`, replaced edit/view UI with textarea + ReactMarkdown |
| `src/components/strategy/UnitModal.tsx` | Same changes as DivisionModal |
| `src/services/divisionService.ts` | `mapToSharePointItem`: stores as plain string instead of `JSON.stringify(array)`. `mapFromSharePointItem`: reads as plain string. Added `parseStatutoryDuties()` for backward compatibility |
| `src/services/unitService.ts` | Same changes as divisionService |
| `src/mockData/orgData.ts` | Both `MockDivisionData` and `MockUnitData` interfaces updated. All mock data converted from arrays to joined strings |
| `src/components/strategy/OrgChart.tsx` | Fallback data updated from arrays to strings |
| `src/services/sharePointListSetupService.ts` | Seeding logic updated to pass string directly instead of `JSON.stringify` |

## 4. SharePoint Storage

### 4.1. Field Configuration
The `StatutoryDuties` column in both `Strategy_Divisions` and `Strategy_Units` SharePoint lists is configured as a multi-line text field (`text: { allowMultipleLines: true }`). No schema change was needed - the field already supports long text.

### 4.2. Saving (Write)
The Markdown text is saved as a plain string directly to SharePoint:
```typescript
StatutoryDuties: division.statutoryDuties || ''
```

### 4.3. Reading (Backward Compatibility)
A `parseStatutoryDuties()` helper handles legacy data that was stored via the old `JSON.stringify(array)` format:

```typescript
private parseStatutoryDuties(raw: string | undefined): string {
    if (!raw) return '';
    // Handle legacy data stored via JSON.stringify (array or quoted string)
    if (raw.startsWith('[') || raw.startsWith('"')) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.join('\n\n');
            if (typeof parsed === 'string') return parsed;
        } catch { /* not valid JSON, use as-is */ }
    }
    return raw;
}
```

This ensures:
- Old `["duty1","duty2"]` arrays are joined with double newlines
- Old JSON-encoded strings (with `\n` escapes) are properly unescaped
- New plain Markdown strings pass through unchanged

## 5. Supported Markdown Syntax

When pasting content into the Statutory Duties editor, the following formatting is supported:

| Syntax | Renders As |
|--------|-----------|
| `**bold text**` | **bold text** |
| `*italic text*` | *italic text* |
| `#### Heading` | Level 4 heading (maroon colored) |
| `* bullet item` | Bulleted list |
| `1. numbered item` | Numbered list |
| `**Section 43**` | Bold legal references |

## 6. Example Content
The Corporate Services Division statutory duties content demonstrates the full capability:

```markdown
**Overarching Mandate:**
While the frontline divisions focus on policing the markets...

#### **Statutory Duties & Relevant Clauses:**

**1. Administration and Conservation of the Commission's Fund**
*   **Managing the Central Fund:** Under **Section 43** of the *Securities Commission Act 2015*...
*   **Duty to Conserve:** Under **Section 45** of the SCA 2015...

#### **Division Summary:**
The **Corporate Services Division** is the operational engine...
```

## 7. Dependencies
- `react-markdown` (v10.1.0) - already installed
- `remark-gfm` (GitHub Flavored Markdown plugin) - already installed
- Tailwind CSS `@tailwindcss/typography` plugin (prose classes) - already configured
