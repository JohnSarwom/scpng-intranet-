# AI Hub Features Documentation

## Overview
The AI Hub is an intelligent assistant interface that provides staff with access to AI-powered insights on SCPNG legislation and organizational knowledge.

## Key Features

### 1. Query Validation
The AI Hub includes smart query validation to improve user experience and prevent unnecessary API calls.

**How it works:**
- Detects common test queries like "test", "hello", "hi", "testing", "hey"
- Identifies overly short queries (less than 3 characters)
- Allows legitimate short acronyms like "CMA", "CDA", "SCA", "SA"
- Returns immediate clarifying responses instead of making API calls

**User Experience:**
- Test queries receive: *"Hello! I am ready to assist you. Please ask a specific question about the SCPNG Acts or intranet."*
- Short queries receive: *"I noticed your query is quite short. Could you please provide more context or ask a complete question so I can help you better?"*

**Implementation:** `src/pages/AIHub.tsx` - `handleSendChatMessage` function

---

### 2. Stop Generation Control
Users can stop AI responses at any time during generation or text animation.

**How it works:**
- The Send button transforms into a red Stop button when AI is generating
- Clicking Stop aborts the API request and halts text streaming
- Uses `AbortController` to cancel ongoing fetch requests
- Clears typing animation timeouts
- Immediately returns control to the user

**Visual Indicators:**
- **Normal state:** Blue Send button (paper plane icon)
- **Generating state:** Red Stop button (square icon)
- **Active during:** API request AND text typing animation

**Implementation Details:**
- `abortControllerRef`: Manages API request cancellation
- `typingTimeoutRef`: Manages text animation
- `isAiTyping`: Derived state tracking typing animation
- `handleStopGeneration`: Cleanup function for all generation states

**Code Location:** `src/pages/AIHub.tsx`

---

## AI Modes

The AI Hub supports multiple specialized modes:

1. **General Purpose AI** (disabled)
2. **SCPNG Document Analyst** (disabled)
3. **CMA 2015 Expert** - Capital Market Act 2015
4. **CDA 2015 Expert** - Central Depositories Act 2015
5. **SA 1997 Expert** - Securities Act 1997
6. **SCA 2015 Expert** - Securities Commission Act 2015
7. **All Acts Expert** - Combined knowledge of all acts

Each mode includes the full text of relevant legislation in its system prompt for accurate, citation-based responses.

---

## Configuration

### API Settings
- **Location:** Admin tab in AI Hub sidebar (System Admins only)
- **Priority Order:**
  1. `.env` file (`VITE_GEMINI_API_KEY`)
  2. SharePoint InternalAppSettings (`GeminiAPIKey`)
  3. Supabase `news_api_settings` table (legacy)

### Knowledge Base Toggle
- Enable/disable full act text in prompts
- Located in AI Configuration section
- Affects response accuracy and context length

---

## User Interface

### Chat Interface
- Real-time typing animation (25ms per character)
- Message history with user/AI distinction
- Follow-up question suggestions
- Copy message functionality
- Clear chat history option
- Full-screen mode toggle

### Question Library
- Pre-defined questions organized by AI mode
- Quick access to common queries
- Categorized by topic and complexity

---

## Technical Architecture

### State Management
- `chatMessages`: Array of ChatMessage objects
- `isSendingChatMessage`: API request in progress
- `isAiTyping`: Text animation in progress
- `abortControllerRef`: Request cancellation
- `typingTimeoutRef`: Animation control

### API Integration
- Direct integration with Google Gemini API
- Conversation history management
- System instruction injection
- Follow-up question parsing
- Error handling and user feedback

---

### 5. Smart Auto-Scroll with User Override

The chat container uses an intelligent scroll system that auto-scrolls during AI responses but allows users to freely scroll up to read earlier content at any time.

**Problem Solved:**
During AI response streaming, the typing animation updates the chat content every ~25ms (character-by-character). Previously, the auto-scroll fired on every character update, making it impossible for users to scroll up — the programmatic scroll would immediately override the user's scroll position, especially at the start of a response when the scrollbar first appears.

**How it works:**

1. **Programmatic Scroll Detection (`isProgrammaticScrollRef`):**
   - A ref flag distinguishes between programmatic scrolls (from the typing animation) and user-initiated scrolls.
   - When `scrollToBottom()` executes, it sets `isProgrammaticScrollRef = true` before scrolling and clears it after the browser processes the event via `requestAnimationFrame`.
   - The scroll event listener ignores events where this flag is `true`, so only genuine user scrolls update the `userScrolledUpRef` state.

2. **Throttled Scroll (~200ms):**
   - Instead of scrolling on every character (every ~25ms), `scrollToBottom()` is throttled to fire at most once every 200ms during typing animation.
   - This gives users an 8x larger window to initiate a scroll-up gesture before the next programmatic scroll fires.
   - Force scrolls (button click, typing finished) bypass the throttle and execute immediately.
   - Each throttled scroll re-checks `userScrolledUpRef` before executing, so if the user scrolled up during the delay, the pending scroll is cancelled.

3. **"Scroll to latest" Button:**
   - When the user scrolls up during a response, a floating button appears below the chat area: `"↓ Scroll to latest"`.
   - Clicking it resets `userScrolledUpRef`, hides the button, and force-scrolls to the bottom.
   - The button automatically hides when the user sends a new message (which also re-enables auto-scroll).

**Key Refs & State:**

| Name | Type | Purpose |
|---|---|---|
| `userScrolledUpRef` | `useRef(false)` | Tracks if user has manually scrolled up — pauses auto-scroll |
| `isProgrammaticScrollRef` | `useRef(false)` | Flag to ignore scroll events caused by `scrollToBottom()` |
| `lastScrollTimeRef` | `useRef(0)` | Timestamp of last programmatic scroll — used for throttling |
| `pendingScrollRef` | `useRef(null)` | Timeout ID for pending throttled scroll |
| `showScrollToBottom` | `useState(false)` | Controls visibility of the "Scroll to latest" button |

**Scroll Flow During Typing:**
```
typeNextChar() called every 25ms
  → setChatMessages() (update displayed text)
  → scrollToBottom() called
    → Is user scrolled up? YES → skip entirely
    → Is user scrolled up? NO → Has 200ms passed since last scroll?
      → YES → scroll now, set isProgrammaticScrollRef, record timestamp
      → NO  → schedule scroll for when throttle window expires
```

**User Scroll-Up Flow:**
```
User scrolls up
  → scroll event fires
  → isProgrammaticScrollRef is false → event is processed
  → isAtBottom = false → userScrolledUpRef = true, showScrollToBottom = true
  → All subsequent scrollToBottom() calls skip (userScrolledUpRef check)
  → "Scroll to latest" button appears
```

**Implementation:** `src/pages/AIHub.tsx` — lines 442–480 (scroll logic), line 746 (reset on send), lines 1454–1463 (scroll button JSX)

---

### 6. AI System Information Dialog

An interactive information dialog accessible via the info icon (ℹ) in the AI Assistant header bar. Provides users with a comprehensive, transparent explanation of how the AI Legal Expert constructs its prompts, processes queries, and structures its responses.

**How to access:**
- Click the **info icon** (ℹ) located between the AI Assistant title and the clear chat (trash) button in the chat header.
- Available in both normal and full-screen modes.

**Purpose:**
- Transparency: lets users understand exactly how the AI generates its legal analysis
- Trust: shows the rigorous analytical framework behind every response
- Education: documents the legal interpretation techniques (Hohfeldian analysis, canon warfare, etc.) so users can critically evaluate AI outputs

**Dialog Sections (9 total):**

#### Section 1: Current Configuration
Dynamically displays the active mode, Knowledge Base toggle status, and AI model name so users always know what configuration is producing their responses.

#### Section 2: Prompt Architecture
Explains the **3-layer prompt system** injected as a single system instruction:

| Layer | Description |
|---|---|
| **Layer 1: Mode Identity** | Expert persona + 5 mandatory search rules (thorough keyword search, section heading matching, unrelated section prohibition, redirect rules, primary-Act-first quoting) |
| **Layer 2: Full Act Text** | Complete word-for-word legislative text embedded directly into the prompt (not summaries) |
| **Layer 3: Elite Analysis Framework** | ~200 lines of structured legal analysis instructions (detailed in Phases I–V below) |

#### Section 3: Available Knowledge Bases
Lists all 4 legislative Acts with their source files, associated modes, and topic coverage:
- **Capital Market Act 2015** (`CMA2015.txt`) — stock exchange, derivatives, licensing, trading
- **Central Depositories Act 2015** (`CDA2015.txt`) — depository, computer systems, depositors, securities accounts
- **Securities Act 1997** (`SA1997.txt`) — pre-2015 securities framework, prospectus, expert liability
- **Securities Commission Act 2015** (`SCA2015.txt`) — Commission structure, Chairman, governance
- **All Acts Expert** — loads all four Acts simultaneously with a 4-step methodology

#### Section 4: Mandatory Search Methodology
Displays the 5-step search process the AI must execute before writing any response:
1. **Keyword Extraction** — extract key nouns and legal concepts from the question
2. **Section-by-Section Scan** — search every occurrence throughout the entire Act text
3. **Table of Contents Check** — match section headings to the question's subject matter
4. **Interpretation Section Scan** — check Section 2 of all loaded Acts for defined terms
5. **Don't Stop at First Match** — continue searching for all related sections

#### Section 5: Cross-Reference Resolution
Documents the 8-rule cross-reference protocol:
- Follow references to substantive provisions
- Quote both referencing and substantive provisions
- Search all loaded Acts
- Trace full reference chains
- Never defer when the referenced Act is loaded
- Subject-matter routing (CDA for depository, CMA for trading, SCA for governance, SA for pre-2015)
- Check all interpretation sections before declaring a term undefined
- **Anti-hallucination rule**: only cite verified section numbers

#### Section 6: Elite Legal Analysis Framework (5 Phases)

**Phase I — Syntactic & Lexical Forensics:**
- Modifier analysis using Last Antecedent Rule, Series-Qualifier Canon, Ejusdem Generis, Noscitur a Sociis
- Operative word hierarchy: shall (mandatory) > must (clearer mandatory) > may (discretionary) > will (ambiguous) > should (advisory)
- Covenant vs. Condition Precedent distinction
- Notwithstanding hierarchy mapping

**Phase II — Hohfeldian Analysis & Logical Structure:**
Uses Wesley Newcomb Hohfeld's framework of jural correlatives:

| Category | Party A Holds | Party B Holds | Triggers |
|---|---|---|---|
| Right / Duty | Right to performance | Strict Duty to perform | "shall," "is entitled to" |
| Privilege / No-Right | Freedom to act | No right to stop | "may" granting discretion |
| Power / Liability | Power to alter legal relation | Liability to alteration | approve, terminate, revoke |
| Immunity / Disability | Protection from legal action | Cannot assert a claim | "shall not be liable" |

Plus syllogistic reasoning (Major Premise → Minor Premise → Conclusion) and fallacy detection.

**Phase III — Canon Warfare (Llewellyn Defense):**
For every canon applied, identifies the counter-canon (Karl Llewellyn's "thrust and parry"):

| Thrust | Parry |
|---|---|
| Plain Meaning | Absurdity Doctrine |
| Expressio Unius | Contextualism |
| Specific Beats General | Document as a Whole |
| Ejusdem Generis | Noscitur a Sociis (broad) |
| Last Antecedent | Series-Qualifier |

**Phase IV — Jurisdictional Context (PNG Securities Law):**
- Governing framework: SCA 2015, CMA 2015, CDA 2015, SA 1997
- Regulatory hierarchy: Legislation → Regulatory Instruments → Market Rules → SCPNG Guidelines → Industry Practice
- Interpretation standards: PNG Interpretation Act + Commonwealth precedent (Australia, UK)
- Penalty provision identification (type, max fine/imprisonment, strict vs. mens rea)

**Phase V — Black Swan Stress Test:**
Stress-tests across 5 dimensions: Edge Cases, Interaction Effects, Enforcement Gaps, Definitional Gaps, Temporal Issues.

#### Section 7: Expected Response Structure
Documents the 7-part mandatory output format:
1. **Direct Statutory Quote** — word-for-word from the Act using formatted quote boxes
2. **Syntactic Analysis** — every operative word analyzed with modifier scope mapping
3. **Hohfeldian Mapping Table** — complete relationship table for all parties
4. **Practical Implications** — what the provision actually does
5. **Cross-References & Interactions** — all related sections across all loaded Acts
6. **Risk Flags (Minimum 3)** — specific risks citing exact statutory language
7. **Follow-Up Questions (3)** — contextually relevant next questions

#### Section 8: Quality Assurance — Master Analytical Checklist
The 9-point checklist every response is validated against:
1. Cross-reference resolution (follow all references, quote substantive provisions)
2. Identify every modifier and map its grammatical scope
3. Distinguish obligations as Covenant or Condition Precedent
4. Restate all relationships in Hohfeldian terms (complete table)
5. Build a syllogism for each core legal argument
6. Identify applicable canons AND their counter-canons
7. Apply PNG jurisdictional context and regulatory hierarchy
8. Stress-test for minimum 3 specific risks
9. Identify all related sections (referenced by, references to, appeals, enforcement, definitions)

#### Section 9: Accuracy Safeguards & Limitations

**Built-in Safeguards:**
- Anti-hallucination rule: only cites section numbers verified in loaded text
- Force-fit prohibition: cannot quote unrelated sections to fill gaps
- Redirect protocol: directs to correct Act mode when question is off-topic
- Definition verification: must check all Acts' Section 2 before declaring a term undefined
- Full-text embedding: quotes from the statute, not from memory or training data

**Known Limitations:**
- AI-generated analysis is not a substitute for professional legal advice
- Complex multi-clause provisions may occasionally be misinterpreted
- Cross-reference chains may not be followed to completion in rare edge cases
- Hohfeldian categorizations involve analytical judgment and may differ from expert opinion
- Always cross-check quoted text against the official gazetted Act

**State Management:**
- `isInfoDialogOpen`: Controls dialog visibility

**Implementation:** `src/pages/AIHub.tsx`
- Info button: rendered in the `CardHeader` alongside clear chat, KB toggle, mode selector, and fullscreen buttons
- Dialog: rendered as a `<Dialog>` component with `<ScrollArea>` for scrollable content
- Uses `Badge`, `Separator`, and grid layouts for structured presentation
- Dynamic content: reads `currentAiModeId`, `useKnowledgeBase`, and `modelName` state to show current configuration

---

## Future Enhancements
- Knowledge base document upload
- SharePoint integration for organizational documents
- Advanced search across knowledge areas
- Custom AI mode creation
- Response rating and feedback system
