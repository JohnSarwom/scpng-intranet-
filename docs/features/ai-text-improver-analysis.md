# AI Text Improver - Research & Analysis

Date: 2026-09-02
Status: Phase 1 built on 2026-09-02 (`src/hooks/useGeminiApiKey.ts`, `src/services/aiTextService.ts`, `src/components/ai/AiImproveButton.tsx`, wired into `TaskDialog.tsx` title, description and comment). Phase 2 built the same day: `aiAssist` prop on `ui/input.tsx` and `ui/textarea.tsx`, used by TaskDialog and TicketDialog. Usage: `<Textarea aiAssist={{ mode: 'polish', context: 'task description', onApply: setDescription }} />`. Also on: KRA notes (`KraFormSection.tsx`), KPI name, description and comments (`KpiInputBlock.tsx`). Form builder textareas (`forms/FormField.tsx`) and the Add/Edit Task, Project and Risk modals (title/name, description, mitigation plan). Phase 3: admin toggle and model choice on Admin > API Management (stored as `prompts.text_improver_enabled` / `prompts.text_improver_model` in `news_api_settings`, read by `src/hooks/useAiTextAssistSettings.ts`). 429 handling is in the service. Key referrer restriction is a Google Cloud console task, not code. Phase 4 done: the four analytics/regulatory chats and AIHub read the key through `useGeminiApiKey`; the duplicated env/SharePoint/Supabase lookups were removed. AIHub keeps a local editable copy for its admin panel and invalidates the shared query after saving.

**Key management (2026-09-03):** the Gemini key now lives only in the SharePoint list `InternalAppSettings` (item Title `GeminiAPIKey`, column `Value`). The Supabase `news_api_settings.api_key` column is no longer read or written. Admin > API & Integrations is the only place in the app that edits the key (through `setAppSetting()` in `useMicrosoftGraph.tsx`); the AI Hub admin tab now just shows configured/not-configured status and links to the Admin page. The shared hook caches the key for 5 minutes and re-reads it when the Gemini API rejects it (400/401/403). `VITE_GEMINI_API_KEY` still overrides for local development.

**Model note (2026-09-03):** Google returns 404 for `gemini-2.5-flash-lite` on new keys ("no longer available to new users"). Default text-improver model is now `gemini-3.5-flash-lite`; `parseAiTextAssistSettings` maps retired model names saved in settings to their replacements. The Admin test button checks the selected improver model and `gemini-2.5-flash` and shows Google's error text.

Goal: reuse the Gemini integration already in the intranet to add an "Improve with AI" action to the Task Registry title, description and comment fields, and make the same action available on any other free-text field in the app.

---

## 1. What exists today

### 1.1 Provider and call pattern

| Item | Finding |
|---|---|
| Provider | Google Gemini, REST endpoint `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| Model | `gemini-2.5-flash` hard-coded in 6 places |
| SDK | None. Plain `fetch` with `?key=` query param. No `@google/generative-ai` dependency |
| Where called | `WebsiteAnalyticsAIChat.tsx:487`, `DivisionAIChat.tsx:369`, `StrategyAIChat.tsx:393`, `RegulatoryAIChat.tsx:362`, `AIHub.tsx:1465` |
| Request shape | `{ contents: [...], system_instruction?: {...}, generationConfig?: {...} }` (AIHub is the only one using `system_instruction` and `generationConfig`) |
| Response parsing | `data.candidates[0].content.parts[0].text` in every file |

### 1.2 API key resolution (duplicated in 6 files)

Every AI component repeats the same three-step chain:

1. `import.meta.env.VITE_GEMINI_API_KEY` (not set in `.env` today)
2. SharePoint list `InternalAppSettings`, item with `Title = 'GeminiAPIKey'`, via `useMicrosoftGraph().getAppSetting()` (`src/hooks/useMicrosoftGraph.tsx:457`)
3. Supabase table `news_api_settings`, row `GLOBAL_SETTINGS_ID`, column `api_key` (managed in `src/components/admin/ApiManagement.tsx`)

Observations:

- `getAppSetting` re-resolves the SharePoint site ID on every call and has no caching. Each AI component fetches the key again on mount.
- `src/components/admin/AIConfiguration.tsx` is a mock UI (OpenAI/Claude toggles, hard-coded units). It is not wired to anything and should not be confused with the real config in `ApiManagement.tsx`.
- `news_api_settings.prompts` is a JSON column that currently holds only `system_ticker_url`. It is a ready-made place to store editable prompt text or a feature toggle for the text improver.

### 1.3 There is no shared AI service

All five call sites re-implement key lookup, fetch, error handling and response parsing. Nothing under `src/services` or `src/hooks` wraps Gemini. This is the single biggest reason the feature is not yet "one line to add anywhere".

---

## 2. Where the improver should appear

### 2.1 Task Registry (the request)

`src/components/unit-tabs/TaskDialog.tsx`

| Field | Line | Component | State setter |
|---|---|---|---|
| Title | 525 | `Input` | `setTitle` |
| Description | 537 | `Textarea` | `setDescription` |
| New comment | ~801 | `Textarea` | `setNewCommentText` |
| Checklist item | 745 | `Input` | skip (short labels, no value) |

All three are plain controlled fields (`value` + `onChange`), so an "improve" action only needs the current value and the setter. The comment is persisted to SharePoint the moment the user presses send (`handleAddComment`, line 430), so the improver must run before send, on the draft text.

### 2.2 Same shape elsewhere (immediate wins)

| File | Fields |
|---|---|
| `src/components/ticketing/TicketDialog.tsx` | title (171), description (182), comment (301) |
| `src/components/kpi/KraFormSection.tsx` | KRA notes textarea (348) |
| `src/components/kpi/KpiInputBlock.tsx` | KPI description (345), comments (359) |
| `src/components/forms/FormField.tsx` | `case 'textarea'` (196) - one hook point covers every dynamic form built with the form builder |
| `src/components/unit-tabs/modals/Add/EditTaskModal.tsx`, `Add/EditProjectModal.tsx`, `Add/EditRiskModal.tsx` | description textareas |
| `src/components/meeting/MeetingMinutesForm.tsx` | 4 textareas |
| `src/components/admin/OrganizationalStrategy.tsx`, `strategy/*Modal.tsx` | objective/strategy text |

Scope numbers:

| Base component | Files using it |
|---|---|
| `Textarea` | 40 |
| `Input` | 100 |

Textareas are the natural targets. Most `Input` usages are search boxes, numbers, emails, dates and select triggers, so the improver should be opt-in per field rather than applied to every input automatically.

---

## 3. Design options considered

### Option A - Standalone button component (recommended for phase 1)

`<AiImproveButton value={title} onApply={setTitle} mode="title" />` rendered next to any field.

- Pros: zero coupling to the base UI components, works with `useState`, `react-hook-form`, or the form builder; easy to remove.
- Cons: each field needs one extra JSX line and a wrapper `div` for positioning.

### Option B - `aiAssist` prop on the shared `Textarea` / `Input` (phase 2)

Extend `src/components/ui/textarea.tsx` and `input.tsx` with an optional `aiAssist?: { mode, context }` prop. When set, the component wraps itself in a `relative` container and renders the button from Option A inside the field.

- Pros: turning the feature on anywhere becomes a single prop; consistent placement and styling app-wide.
- Cons: base shadcn components gain a dependency on the AI service and the auth hooks. Must stay optional so the 140 existing usages are untouched. Note the existing `Textarea` auto-grows on `props.value` change, which already handles the height jump after text is replaced.

### Option C - Automatic suggestions as the user types or on blur (Grammarly style)

Rejected. It multiplies API calls, adds latency to every keystroke, changes text without consent, and will hit Gemini rate limits with a whole organisation typing at once. The explicit button is the right fit for an intranet.

Recommendation: build A first, then fold it into B once the button is stable.

---

## 4. Proposed architecture

```
src/services/aiTextService.ts        improveText(text, options) -> Promise<string>
src/hooks/useGeminiApiKey.ts         one cached key resolver (env -> SharePoint -> Supabase)
src/components/ai/AiImproveButton.tsx  sparkle button + preview popover + apply/undo
src/components/ui/textarea.tsx       optional aiAssist prop (phase 2)
src/components/ui/input.tsx          optional aiAssist prop (phase 2)
```

### 4.1 `useGeminiApiKey`

- Wrap the existing three-step chain once, using React Query with a long `staleTime` so the SharePoint/Supabase lookup happens once per session, not once per component.
- Expose `{ apiKey, isReady, isConfigured }`. The button hides itself when `isConfigured` is false, so the feature degrades silently where no key exists.
- Later, migrate the five chat components to this hook and delete the duplicated code.

### 4.2 `aiTextService.improveText`

```ts
type ImproveMode = 'grammar' | 'polish' | 'title' | 'expand';

interface ImproveOptions {
  mode: ImproveMode;
  context?: string;      // e.g. "task title", "comment on task 'X'"
  apiKey: string;
  signal?: AbortSignal;
  model?: string;        // default gemini-2.5-flash-lite (see cost section)
}
```

Request:

```json
{
  "system_instruction": { "parts": [{ "text": "<rules for the selected mode>" }] },
  "contents": [{ "role": "user", "parts": [{ "text": "<user text>" }] }],
  "generationConfig": { "temperature": 0.2, "maxOutputTokens": 1024 }
}
```

Prompt rules (all modes):

- Return only the rewritten text. No preamble, no quotes, no markdown, no explanation.
- Preserve meaning. Do not add facts, names, dates or tasks that are not in the original.
- Keep the original language (English or Tok Pisin). Do not translate.
- Keep proper nouns, acronyms and system names as written (SCPNG, KRA, KPI, IPA, SharePoint).
- Keep roughly the same length unless the mode is `expand`.

Mode-specific rules:

| Mode | Behaviour | Best for |
|---|---|---|
| `grammar` | Fix spelling, grammar and punctuation only | comments |
| `polish` | Grammar plus clearer, professional wording | descriptions, notes |
| `title` | One line, sentence case, max 12 words, no trailing period | task/ticket titles |
| `expand` | Turn a short note into 2-4 full sentences | descriptions from a stub |

Response handling:

- Read `candidates[0].content.parts[0].text`, trim, strip surrounding quotes.
- If `candidates` is empty or `promptFeedback.blockReason` is set, show "AI could not improve this text" and leave the field untouched.
- If the result is identical to the input, show "Looks good already".
- Ignore empty input or input under 3 characters.

### 4.3 `AiImproveButton`

- Small ghost button with the lucide `Sparkles` icon, placed at the top-right inside the field wrapper (the same corner the screenshot marks).
- Click opens a tiny menu when more than one mode applies (Fix grammar / Polish / Make concise), or fires directly when `mode` is fixed.
- Shows a spinner while the request runs; `AbortController` cancels on unmount or dialog close.
- Result appears in a popover with the original and the improved text side by side and two actions: Apply and Discard. Apply calls `onApply(newText)` and remembers the previous value so an Undo toast (via `sonner` or `use-toast`, whichever the host component already imports) can restore it.
- Disabled state and tooltip when the key is not configured or the field is empty.
- Keyboard shortcut is optional; if added, use `Ctrl+Shift+E` scoped to the focused field only.

### 4.4 Rollout order

1. Service + hook + button, wired into TaskDialog title, description, comment.
2. TicketDialog (same three fields, copy-paste of step 1).
3. `aiAssist` prop on base `Textarea` / `Input`; then switch TaskDialog and TicketDialog to the prop and add KPI/KRA, FormField, Add/Edit Task/Project/Risk modals.
4. Migrate the five chat components to `useGeminiApiKey` and remove the duplicated key logic.

---

## 5. Cost, limits and performance

- A title improvement is roughly 150-250 tokens round trip. A description or comment is usually under 800 tokens. At Gemini Flash pricing this is a fraction of a cent per click. Check the current Google AI pricing page before finalising, as tiers change.
- Rate limits are the real constraint, not cost. On the free tier, requests per minute per project are low (single digits to low tens). If the whole organisation gets the button, keep the key on a paid project or expect "429 quota exceeded" at peak times. The service should surface 429 as "AI is busy, try again in a moment".
- `gemini-2.5-flash-lite` is cheaper and faster than `gemini-2.5-flash` and is more than capable of grammar fixes. Make the model configurable (env or `news_api_settings.prompts.text_improver_model`) with flash-lite as the default for this feature while the chat assistants keep flash.
- Typical latency for a short rewrite is 1-3 seconds. The button must show a spinner and must not block the rest of the form.

---

## 6. Security and privacy

- The Gemini key is delivered to the browser today. Anyone with access to the intranet can read it from the network tab. This is an existing exposure, not a new one, but adding the button to every form increases how often the key is sent. Mitigations, in order of effort:
  1. In Google Cloud console, restrict the key to HTTP referrers matching the intranet domain and to the Generative Language API only.
  2. Medium term: move the call behind a Supabase Edge Function or a small Azure Function so the key never leaves the server. The service layer proposed above makes this a one-file change later.
- Task and comment text will be sent to Google. Add an admin toggle (`AiTextAssistEnabled` in `InternalAppSettings`, or a key in `news_api_settings.prompts`) so the feature can be switched off org-wide, and show a short tooltip on the button ("Text is sent to the AI service for rewriting").
- Do not send extra context (assignees, emails, other comments) to the model. Only the field text and a one-line label such as "task title".
- Log nothing but the mode, elapsed time and status code. Never log the input text.

---

## 7. Edge cases to handle

- Dialog closes while a request is in flight: abort and drop the result.
- User keeps typing after clicking improve: compare the field value at apply time with the value that was sent; if it changed, show the preview but do not auto-apply.
- Very long descriptions: cap input at about 4,000 characters and tell the user if it was truncated.
- Mixed language or Tok Pisin comments: the "keep language" rule handles this; verify with a few real samples during UAT.
- Model returns quotes or a leading "Here is the improved text:": strip common wrappers in the service.
- Key missing: button hidden, no errors in console beyond one debug line.

---

## 8. Effort estimate

| Phase | Work | Estimate |
|---|---|---|
| 1 | Service, key hook, button, TaskDialog wiring, undo toast | 1 day |
| 2 | TicketDialog + base component `aiAssist` prop + KPI/KRA/FormField | 0.5 day |
| 3 | Admin toggle, model setting, key referrer restriction, 429 handling | 0.5 day |
| 4 | Migrate chat components to shared hook (cleanup, optional) | 0.5 day |

---

## 9. Decisions needed before building

1. ~~Preview-then-apply or replace immediately~~ — settled: the popover shows up to 3 alternatives and clicking one applies it, with an Undo toast.
2. Default model for this feature: `gemini-2.5-flash-lite` (recommended) or keep `gemini-2.5-flash`.
3. Which modes to expose on which fields. Suggested: title -> `title`; description -> `polish` + `expand`; comment -> `grammar`.
4. Whether an org-wide admin toggle is required for launch.

---

## 10. Multiple suggestions (2026-09-03)

`improveText` now returns `variants: string[]` (up to `IMPROVE_VARIANT_COUNT`, currently 3) instead of a single `text`.

- **Prompt**: the model is told to return exactly 3 meaningfully different rewrites separated by a line containing only `%%%`, and each mode's rules say how they should differ (register/structure/emphasis).
- **Sampling**: temperature 0.55 for polish/title/expand, 0.25 for grammar. `maxOutputTokens` raised to 1024 (2048 for expand) to fit three answers.
- **Parsing**: `parseVariants()` splits on the separator, strips list markers and "Option 2:"-style prefixes, drops blanks, de-duplicates case-insensitively, and drops any variant identical to the input. If the model ignores the separator the whole reply becomes one variant. `unchanged` is true when nothing survives.
- **UI**: the popover shows the original in a small strip, then each suggestion as a clickable card. One click applies it and raises the Undo toast. Footer has Regenerate, Discard, and Other options when the field allows several modes.

### Popover dismissal bug (fixed 2026-09-03)

Single-mode fields (task title) flashed their popover open and closed, while multi-mode fields (description) stayed open. Cause: single-mode fields start the request immediately, and the trigger button was `disabled` while `isLoading`. Disabling a focused button blurs it, Radix's DismissableLayer treats that as focus leaving the layer, and closes the popover. Multi-mode fields showed the mode menu first and never hit the loading state, so they were unaffected.

Fixes in `AiImproveButton.tsx`:
- The trigger is never disabled while the popover is open (`disabled={(disabled || tooShort) && !open}`), which also covers `disabled`/`tooShort` flipping mid-request.
- The request is started from `onOpenChange` instead of an `onClick` on the trigger. Radix's trigger already toggles the open state, so the old `onClick` was toggling it a second time.
- Clicking the trigger while a request is running now cancels it (the tooltip says so).

## 11. Meeting Minutes (2026-09-03)

`components/meeting/MeetingMinutesForm.tsx`

| Field | Section | Modes |
|---|---|---|
| Meeting Name | A) Particulars | title |
| Meeting Objective | A) Particulars | polish, grammar, expand |
| Opening Mentions | A) Particulars | polish, grammar |
| Discussion Topic Title | C) Discussion | title |
| Deliberations & Resolutions | C) Discussion | polish, grammar, expand |
| Action item / directive | D) Action Items | title, grammar |
| Closing Statements | E) Final Remarks | polish, grammar, expand |

Also `components/meeting/ShareMeetingModal.tsx`: the custom invitation message (polish, grammar).

Repeated rows (discussions, action items) close over their own `idx`, so each row's button writes back to that row only.

Not wired: meeting ID, date, times, venue, attendee position, and the action item "Area" column. These are identifiers or short labels, not prose.

**Prompt change this required:** deliberations are recorded one bullet per line and the docx generator relies on that. `COMMON_RULES` now tells the model to keep the original line structure and never merge separate lines into a paragraph.

## 12. KRA / KPI coverage completed (2026-09-03)

Wired earlier (phase 2): KRA notes, KPI name, KPI description, KPI comments.

Added now: **KRA Title** (`KraFormSection.tsx`), which is a Popover + Command combobox rather than a plain input, so it has no field interior to float the sparkle inside. The button sits beside the combobox in a flex row; the trigger changed from `w-full` to `flex-1 min-w-0` to make room. Applying writes both `onChange('title', v)` and `setInputValue(v)` so the combobox search text stays in sync with the form value.

Deliberately not wired in these forms:
- KRA Status and KPI Rejection Note - both `readOnly` (auto-calculated / written by a reviewer).
- KPI target, actual, cost, weight, dates - numeric or date inputs.
- KPI data source and review authority - short identifiers, not prose.
