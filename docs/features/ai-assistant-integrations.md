# AI Assistant Integrations

The SCPNG Intranet features context-aware AI assistants embedded into localized modules to provide specific operational and strategic intelligence. The system relies on the Gemini API via standard HTTPS POST integrations.

## 🏗 Core Pattern
All embedded AI chat systems on the intranet share a single consistent UX protocol, leveraging shared UI components:
- `AIChatPanel` (`src/components/shared/ai-chat/AIChatPanel.tsx`): Manages the message stream, user input, follow-up buttons, API status states, and auto-scrolling.
- `StaticQuestionLibrarySidebar` (`src/components/shared/ai-chat/StaticQuestionLibrarySidebar.tsx`): Standardized right-side panel categorizing suggested queries.

### Data Serialization Loop
Instead of building a massive LangChain or RAG backend, the application passes explicitly filtered **live user scope data** to the AI model's prompt on every single request.

1. **Context Fetch:** Local page or hook (e.g., `useDivisionData`, `useStrategySharePoint`, `useRegulatoryCases`) fetches arrays of data.
2. **Context Serialization:** A function local to the chat component (`serializeDivisionContext`, `serializeRegulatoryContext`, etc.) loops through the arrays and maps JSON objects into a highly dense markdown/string summary.
3. **Injection:** The literal string summary is injected into a static `SYSTEM_PROMPT` using string replacement `replace('{dataContext}', contextStr)`.
4. **Execution:** The concatenated chat history + system prompt is sent dynamically to the `/generateContent` endpoint.

---

## 🏛 Active Implementations

### 1. Division AI Analyst
**Component:** `src/components/division/analytics/DivisionAIChat.tsx`
- **Location:** Division Dashboard ➔ Analytics Tab (Bottom)
- **Data Hook Provided:** `useDivisionData(divisionId)`
- **Serialized Context Includes:**
  - Tasks (`Task[]`): Titles, RAG status, owners, completion status.
  - Projects (`Project[]`): Titles, progress %, statuses.
  - KRAs / KPIs: Aggregated risk mapping.
  - Staff Rosters: Roster arrays matching active workers to units.
- **Special Feature:** *Data Source Filtering*. Since division data is dense, users can select a dropdown to explicitly limit the AI's visibility to only "Tasks" or only "Staff Directory" to save token caps and reduce hallucination.

### 2. Strategy & Performance AI Analyst
**Component:** `src/components/strategy/analytics/StrategyAIChat.tsx`
- **Location:** Strategy Hub ➔ Analytics Tab (Bottom)
- **Data Hook Provided:** `useStrategySharePoint()` and `useSharePointObjectives()`
- **Serialized Context Includes:**
  - Annual Business Plans.
  - Five-Year Objectives.
  - Executive Outcomes.

### 3. Regulatory Intelligence AI Analyst
**Component:** `src/components/regulatory/components/RegulatoryAIChat.tsx`
- **Location:** Regulatory Hub ➔ Overview Tab (Bottom)
- **Data Hook Provided:** `useRegulatoryCases()` (or similar filtered case sets).
- **Serialized Context Includes:**
  - Specific categorized cases (Scams, Whistleblower reports, Compliance investigations).
  - Anonymity status flags for whistleblowers.
  - Global KPI statistics (e.g., Open cases, Critical alerts).

### 4. General AI Hub Analyst
**Component:** `src/pages/AIHub.tsx`
- **Location:** Dedicated `/ai` Page
- **Purpose:** A broader conversational analyst not explicitly bound to a specific component's serialized data. Often used as a fallback for general document analysis or structural questions.

---

## 🔑 Authentication / Token Management
Rather than exposing API keys directly, the key defaults to `import.meta.env.VITE_GEMINI_API_KEY`.
Using `useMicrosoftGraph()`, the system falls back to fetching a SharePoint Config List key, or falls back to Supabase `news_api_settings` to ensure that API keys can be rotated globally by IT without requiring a hard rebuild of the React artifacts.

> [!WARNING]
> When fetching the fallback key from Supabase `news_api_settings` (ID: `GLOBAL_SETTINGS`), ensure to destructure the response as `{ data, error }` built into the Supabase JS client. Do not use custom aliases like `{ appData }` directly in the destructure, as it will evaluate to undefined.

## ⚠️ Type Safety Considerations
When serializing context objects inside the `serialize*Context()` functions, ensure your mapped properties match the actual Typescript definitions (e.g., in `src/types/index.ts`). For example:
- `Project` names use `.name`, not `.title`.
- `Task` assignment units use `.unit_id` or `.assignee` where applicable depending on the populated state.
Failure to map these correctly will result in TypeScript build errors (`tsc --noEmit`).
