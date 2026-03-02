# AI Hub — Elite Legal Document Analysis Framework

## Comprehensive Implementation Documentation

**Date:** March 2026
**File Modified:** `src/pages/AIHub.tsx`
**Scope:** All legal expert AI chat modes in the AI Hub

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement — What We Were Solving](#2-problem-statement)
3. [Architecture — How the AI Hub Prompts Work](#3-architecture)
4. [The Elite Legal Analysis Framework (Shared Instructions)](#4-the-elite-legal-analysis-framework)
5. [Per-Mode Prompt Enhancements](#5-per-mode-prompt-enhancements)
6. [Test Results & Iterative Fixes](#6-test-results--iterative-fixes)
7. [Complete Prompt Reference](#7-complete-prompt-reference)
8. [Future Improvements](#8-future-improvements)

---

## 1. Overview

The AI Hub legal expert modes were enhanced with an **Elite Legal Document Analysis Framework** — a comprehensive system prompt that transforms the AI from a basic legal reference tool into an analytical engine capable of:

- **Syntactic & Lexical Forensics** (modifier analysis, covenant vs. condition precedent classification)
- **Hohfeldian Legal Analysis** (formal rights/duty/power/liability/immunity mapping)
- **Canon Warfare** (Llewellyn thrust-and-parry canon pairs)
- **Jurisdictional Context** (PNG securities law specifics)
- **Black Swan Stress Testing** (edge cases, enforcement gaps, definitional ambiguities)

The framework was iteratively tested and refined across three rounds of testing, fixing critical failures in cross-Act referencing, Act selection, search methodology, Hohfeldian accuracy, and section citation hallucination.

---

## 2. Problem Statement

### Initial State (Before Enhancement)

The original `SHARED_LEGAL_EXPERT_INSTRUCTIONS` constant (lines 47–73 of `AIHub.tsx`) contained only formatting instructions:

```
### MANDATORY RESPONSE INSTRUCTIONS (OFFICIAL LAYOUT):
1. AUTHENTICITY IS PARAMOUNT: You MUST provide a direct, word-for-word quote...
2. REQUIRED STRUCTURE (MANDATORY BLANK LINES)...
3. EXPERT ANALYSIS: Provide your interpretation below the quote box.
4. RICH FORMATTING...
5. INTERACTIVE FOLLOW-UPS (MANDATORY)...
```

**Problems identified:**
- No analytical framework — the AI provided surface-level "interpretations" with no structured methodology
- No cross-referencing rules — when one Act referenced another, the AI would stop at the definitional provision instead of following the reference
- No search methodology — the AI would grab the first loosely-related section instead of thoroughly searching for the correct one
- No Hohfeldian analysis — legal relationships were described informally
- No risk identification framework — edge cases and enforcement gaps were not flagged

### Failures Discovered During Testing

| Test | Mode | Failure |
|---|---|---|
| "What is the process for approval of a stock exchange under Section 9?" | SCA Expert | Quoted only SCA 2015 definition, said "one would also need to cite the Capital Market Act 2015" instead of quoting CMA Section 9 |
| "What is the definition of 'access' in the context of a depository's computer system?" | CMA Expert | Searched wrong Act (CMA instead of CDA), said "there is no explicit definition" when CDA 2015 Section 2(1) has an explicit definition |
| "Where must the notice of the Chairman's appointment be published?" | SCA Expert | Answered from CMA Section 12 (exchange directors) instead of SCA Section 9(2) (Chairman appointment via National Gazette) |
| "How is 'expert' defined?" | SA 1997 Expert | Quoted from SCA 2015 instead of SA 1997, despite SA 1997 having its own identical definition at line 344 |
| Cross-references in CDA test | CDA Expert | Cited fabricated section numbers (e.g., "Section 466 of the CMA") that don't exist in the loaded text |

---

## 3. Architecture

### How AI Hub Prompts Are Structured

```
AIHub.tsx
├── SHARED_LEGAL_EXPERT_INSTRUCTIONS (const, lines 47–242)
│   ├── Elite Legal Analysis Framework (6 phases)
│   ├── Cross-Reference Resolution Rules
│   ├── Mandatory Search Methodology
│   ├── Depth of Analysis Requirements
│   ├── Hohfeldian Accuracy Rules
│   ├── Anti-Hallucination Rules
│   ├── Master Analytical Checklist
│   └── Mandatory Response Format
│
├── getAiModes() function (lines 244–375)
│   ├── General Purpose AI (disabled, inline prompt)
│   ├── SCPNG Document Analyst (disabled, external prompt file)
│   ├── CMA 2015 Expert (mode-specific rules + Act text + SHARED instructions)
│   ├── CDA 2015 Expert (mode-specific rules + Act text + SHARED instructions)
│   ├── SA 1997 Expert (mode-specific rules + Act text + SHARED instructions)
│   ├── SCA 2015 Expert (mode-specific rules + Act text + SHARED instructions)
│   └── All Acts Expert (mode-specific rules + ALL Act texts + SHARED instructions)
│
└── Act text files loaded via imports:
    ├── /files/CMA2015.txt (Capital Market Act 2015)
    ├── /files/CDA2015.txt (Central Depositories Act 2015)
    ├── /files/SA1997.txt (Securities Act 1997)
    └── /files/SCA2015.txt (Securities Commission Act 2015)
```

### Prompt Assembly Per Mode

Each legal expert mode assembles its prompt as:

```
[Mode-specific identity + search rules]
+
[Full Act text(s)]
+
SHARED_LEGAL_EXPERT_INSTRUCTIONS
```

The shared instructions are appended at the end so they apply universally to all legal modes. Mode-specific rules come first to establish the AI's primary Act allegiance and search behavior.

### Where the Prompt Gets Injected

At runtime (around line 570+ in AIHub.tsx), the selected mode's prompt is injected as the first message in the conversation:

```typescript
if (currentMode?.prompt) {
  parts: [{ text: `System Instruction: ${currentMode.prompt}` }]
}
```

---

## 4. The Elite Legal Analysis Framework

### 4.1 Cross-Reference Resolution Rules (CRITICAL RULE)

**Location:** Lines 54–82 of `AIHub.tsx`

**Purpose:** Prevent the AI from stopping at a definitional provision when the user is asking about the substantive provision in another Act.

**Rules:**

| # | Rule | Purpose |
|---|---|---|
| 1 | Follow the cross-reference | Quote the SUBSTANTIVE provision, not just the definition |
| 2 | Quote BOTH provisions | Definitional first, then substantive in full |
| 3 | Search ALL loaded Acts | Don't stay in one Act when the answer is in another |
| 4 | Trace the full chain | Follow nested cross-references to the operative rule |
| 5 | Never say "one would also need to cite another Act" | If the Act is loaded, cite it directly |
| 6 | Search the CORRECT Act first | Subject-matter-to-Act routing table |
| 7 | Never say "there is no definition" without checking all Acts | Every Act has its own Section 2 |

**Subject-Matter Routing Table:**

| Keywords in Question | Primary Act |
|---|---|
| Depository, deposited securities, computer systems, depositors, securities accounts | Central Depositories Act 2015 |
| Stock exchange, derivatives exchange, licensing, capital market products, trading | Capital Market Act 2015 |
| Commission structure, powers, appointments, governance, Chairman | Securities Commission Act 2015 |
| Securities generally (pre-2015 framework), prospectus, expert liability | Securities Act 1997 |

**Worked Examples in the Prompt:**
- Example 1: Cross-reference resolution (SCA → CMA Section 9)
- Example 2: Correct Act selection ("access" in depository computer system → CDA)
- Example 3: Incorrect behavior pattern to avoid

### 4.2 Mandatory Search Methodology

**Location:** Lines 86–96 of `AIHub.tsx`

**Purpose:** Prevent the AI from missing obvious answers by enforcing a structured keyword search before writing any response.

**5-Step Search Process:**

1. **Keyword Extraction** — Pull key nouns and legal concepts from the question
2. **Section-by-Section Scan** — Search the ENTIRE Act text, not just the Interpretation section
3. **Table of Contents Check** — Match section headings/titles to the question's subject
4. **Interpretation Section Scan** — Always check Section 2 for defined terms
5. **Don't Stop at First Match** — Find ALL sections that address the topic

**Failsafe:** If no answer is found after thorough search, say "This topic does not appear to be addressed in [Act Name]. I recommend switching to [mode]." — never force-fit an unrelated section.

### 4.3 Depth of Analysis Requirements

**Location:** Lines 99–112 of `AIHub.tsx`

**Purpose:** Ensure every response is exhaustive, not surface-level.

**Category-Specific Depth Rules:**

| Category | Minimum Requirement |
|---|---|
| Syntactic Analysis | Analyze EVERY operative word (shall, may, must, if, subject to, provided that). Map modifier scope for every list/qualifier. |
| Hohfeldian Mapping | COMPLETE relationship table for ALL parties and ALL correlatives. Accuracy rules enforced (see below). |
| Cross-References | ALL related sections across ALL loaded Acts. Must include: referenced by, references to, appeals, revocation, enforcement, definitions. |
| Risk Flags | Minimum 3 SPECIFIC risks citing exact statutory language. No generic observations. |

**Hohfeldian Accuracy Rules:**

| Category | When to Use | What to Look For |
|---|---|---|
| Right/Duty | Direct entitlement paired with obligation | "shall," "is entitled to" |
| Privilege/No-Right | Freedom to act, no one can compel or prevent | "may" granting discretion |
| Power/Liability | One party can ALTER another's legal relationship | approve, terminate, revoke, amend |
| Immunity/Disability | ONLY when explicit shield from legal action | "shall not be liable," exculpatory clauses |

**Key Correction:** A procedural limitation on a Power (e.g., "with the concurrence of") is NOT an Immunity — it is a condition on the exercise of the Power. Omit categories that don't apply rather than force-fitting.

**Anti-Hallucination Rule for Cross-References:**
> Only cite section numbers you can VERIFY exist in the loaded text. Never invent or guess section numbers. If unsure, say: "A related provision likely exists regarding [topic] but could not be located in the available text."

### 4.4 Phase I: Syntactic & Lexical Forensics

**Location:** Lines 116–128 of `AIHub.tsx`

**Modifier Analysis Tools:**

| Canon | Rule |
|---|---|
| Last Antecedent Rule | A limiting clause modifies only the noun immediately preceding it |
| Series-Qualifier Canon | Modifier at start/end of parallel list — does it apply to whole list or nearest item? |
| Ejusdem Generis | General word after specific list is limited to same class |
| Noscitur a Sociis | Ambiguous word defined by surrounding words |

**Critical Distinctions:**

| Distinction | Covenant | Condition Precedent |
|---|---|---|
| Nature | Party's obligation to do something | Event that must occur before duty arises |
| Breach consequence | Damages lawsuit, contract survives | Duty discharged entirely, deal can die |
| Trigger words | — | "provided that," "if," "on the condition that," "subject to," "unless and until" |

**Notwithstanding Hierarchy:** Map every "Notwithstanding" clause to find the apex predator. "Notwithstanding anything to the contrary herein" defeats all specific cross-references.

**Shall/May/Must Hierarchy:**

| Term | Meaning |
|---|---|
| Shall | Mandatory obligation |
| Must | Clearer mandatory standard |
| May | Discretionary permission (Hohfeldian Privilege) |
| Will | Ambiguous — flag for analysis |
| Should | Precatory/advisory — nearly always unenforceable |

### 4.5 Phase II: Hohfeldian Analysis & Logical Structure

**Location:** Lines 132–150 of `AIHub.tsx`

**The Four Correlative Pairs:**

| Category | Party A Holds | Party B Holds | Significance |
|---|---|---|---|
| Rights / Duty | Right to performance | Strict Duty to perform | Directly enforceable |
| Privilege / No-Right | Freedom to act | No right to stop Party A | Cannot be restrained |
| Power / Liability | Power to alter legal relation | Liability to that alteration | Requires strict procedural compliance |
| Immunity / Disability | Protection from legal action | Cannot assert a claim | Examine for unconscionability |

**Syllogistic Reasoning:**
- Major Premise (Rule of Law) → from the governing Act provision
- Minor Premise (Facts/Document) → applied to the specific scenario
- Conclusion → inevitable legal result from both premises

**Fallacy Detection:** Flag circular reasoning, non sequitur, and equivocation.

### 4.6 Phase III: Canon Warfare (Llewellyn Defense)

**Location:** Lines 154–165 of `AIHub.tsx`

**Thrust & Parry Matrix:**

| Your Canon (Thrust) | Counter-Canon (Parry) |
|---|---|
| Plain Meaning: Apply text exactly as written | Absurdity Doctrine: Literal text leads to absurd results |
| Expressio Unius: Inclusion of one = exclusion of others | Contextualism: Non-exhaustive list of examples |
| Specific Beats General: Specific clause overrides preamble | Document as a Whole: No clause rendered meaningless |
| Ejusdem Generis: General words limited to same category | Noscitur a Sociis: General term deliberately broad |
| Last Antecedent: Modifier attaches to nearest noun | Series-Qualifier: Modifier applies to all list items |

**Instruction:** Always present both sides — state which canon governs the specific linguistic formulation and why.

### 4.7 Phase IV: Jurisdictional Context (PNG Securities Law)

**Location:** Lines 169–175 of `AIHub.tsx`

- **Governing Framework:** SCA 2015, CMA 2015, CDA 2015, SA 1997
- **Regulatory Hierarchy:** Legislation → Regulatory Instruments → Market Rules → SCPNG Guidelines → Industry Practice
- **Interpretation Standards:** PNG Interpretation Act; Commonwealth (Australia, UK) as persuasive authority
- **Efforts Clauses:** best efforts ≠ reasonable efforts ≠ commercially reasonable efforts
- **Penalty Provisions:** Always identify max fine, imprisonment term, strict vs. mens rea liability

### 4.8 Phase V: Black Swan Stress Test

**Location:** Lines 179–185 of `AIHub.tsx`

| Stress Test | What to Check |
|---|---|
| Edge Cases | What happens under extreme or unusual circumstances? |
| Interaction Effects | Could another section's "Notwithstanding" clause override this? |
| Enforcement Gaps | Is there a penalty? What if the provision is breached with no penalty specified? |
| Definitional Gaps | Are key terms defined in Section 2? If not, what's the likely judicial interpretation? |
| Temporal Issues | Time limits, sunset clauses, transitional provisions? |

### 4.9 Master Analytical Checklist

**Location:** Lines 189–198 of `AIHub.tsx`

Applied to every response:

1. CROSS-REFERENCE RESOLUTION — Follow all cross-references, quote substantive provisions in full
2. Identify every modifier and map grammatical scope (shall, may, must, if, subject to)
3. Distinguish obligations as Covenant or Condition Precedent
4. Restate ALL key obligations in Hohfeldian terms as complete relationship table
5. Build a syllogism for each core legal argument
6. Identify applicable canons of construction AND their counter-canons
7. Apply PNG jurisdictional context and regulatory hierarchy
8. Stress-test for edge cases, interaction effects, enforcement gaps (minimum 3 specific risks)
9. Identify ALL related sections: referenced by, references to, appeals, revocation, enforcement, definitions

### 4.10 Mandatory Response Format

**Location:** Lines 202–241 of `AIHub.tsx`

**Structure:**

1. **Authenticity** — Direct word-for-word quote from the Act
2. **Multi-Act Cross-Referencing** — Separate quote boxes per Act, labeled clearly, full provisions
3. **Required Quote Format** — `> [!NOTE]` syntax with mandatory blank lines between subsections
4. **Elite Analysis Section** — Structured as:
   - Syntactic Analysis (every operative word)
   - Hohfeldian Mapping (complete relationship table)
   - Practical Implications (what the provision DOES)
   - Cross-References & Interactions (all related sections with numbers and descriptions)
   - Risk Flags (minimum 3, citing exact language)
5. **Rich Formatting** — Bold section numbers, italicize obligations
6. **Follow-up Questions** — 3 mandatory follow-ups in `<followups>` tag format

---

## 5. Per-Mode Prompt Enhancements

### 5.1 Shared 5-Point Search Rules (All Single-Act Modes)

Every single-Act mode (CMA, CDA, SA, SCA) now has a `MANDATORY SEARCH RULES FOR THIS MODE` block prepended to its prompt. The 5 rules are:

| # | Rule | Purpose |
|---|---|---|
| 1 | SEARCH YOUR OWN ACT THOROUGHLY FIRST | Extract keywords, scan entire text, every Part/Division/Subdivision + Section 2 |
| 2 | CHECK SECTION HEADINGS | Match section titles to the question before reading body text |
| 3 | NEVER GRAB AN UNRELATED SECTION | If no match, say so clearly — don't force-fit |
| 4 | REDIRECT WHEN APPROPRIATE | State which Act governs the topic and recommend the correct mode |
| 5 | QUOTE FROM THIS ACT FIRST | Primary Act = primary source. Other Acts = supplementary only |

### 5.2 CMA 2015 Expert Mode

**Location:** Lines 258–277 of `AIHub.tsx`
**Mode ID:** `cma_2015_expert`

**Mode-Specific Rules:**
- 5-point search rules with CMA-specific redirect guidance
- Redirects depository topics → CDA Expert, Commission governance → SCA Expert
- Example: "If the user asks about minimum financial requirements, look for a section titled 'Minimum financial requirements' before anything else"

### 5.3 CDA 2015 Expert Mode

**Location:** Lines 278–297 of `AIHub.tsx`
**Mode ID:** `cda_2015_expert`

**Mode-Specific Rules:**
- 5-point search rules with CDA-specific redirect guidance
- Redirects exchange/licensing topics → CMA Expert, Commission governance → SCA Expert
- Example: "If the user asks about access to computer system, look for a section titled with those keywords before anything else"

### 5.4 SA 1997 Expert Mode

**Location:** Lines 298–317 of `AIHub.tsx`
**Mode ID:** `sa_1997_expert`

**Mode-Specific Rules:**
- 5-point search rules with SA-specific redirect guidance
- **Special rule:** "If a term like 'expert' is defined in THIS Act, quote THIS Act's definition — not a definition from a different Act"
- This was added after the SA 1997 test where the AI quoted the SCA 2015's "expert" definition instead of SA 1997's own identical definition

### 5.5 SCA 2015 Expert Mode

**Location:** Lines 318–344 of `AIHub.tsx`
**Mode ID:** `sca_2015_expert`

**Mode-Specific Rules:**
- 5-point search rules with SCA-specific redirect guidance
- **Extra Rule 6 — Key Section Cheat Sheet:**

| Topic | Section to Check |
|---|---|
| Chairman appointment & publication | Section 9 (Chairman) |
| Commission independence | Section 6 (Independence) |
| Term of office | Section 12 (Term of Office) |
| Commission powers & functions | Sections 4, 5, 7, 8 |
| Delegation | Section 11 (Delegation) |
| Appointment Committee | Section 18 |
| Definitions | Section 2 (Interpretation) |

This cheat sheet was added after the test where the AI failed to find SCA Section 9(2) for the Chairman appointment publication question.

### 5.6 All Acts Expert Mode

**Location:** Lines 346–374 of `AIHub.tsx`
**Mode ID:** `merged_acts_expert`

**Mode-Specific Rules — 4-Step Methodology:**

| Step | Instruction |
|---|---|
| STEP 1 | IDENTIFY THE PRIMARY ACT based on subject matter (routing table) |
| STEP 2 | THOROUGH KEYWORD SEARCH across ALL four Acts — section headings, Section 2 of all Acts, every Part/Division |
| STEP 3 | QUOTE FROM THE CORRECT ACT FIRST — primary Act = main answer, others = supplementary |
| STEP 4 | VERIFY BEFORE CITING — only cite section numbers confirmed in loaded text |

**Additional Rules:**
- Never say a term is undefined without checking all four Interpretation sections
- Never say "this is covered in another Act" without quoting it — all four Acts are loaded

---

## 6. Test Results & Iterative Fixes

### Round 1: Initial Tests (Pre-Enhancement)

| Test Question | Mode | Result | Issue |
|---|---|---|---|
| "What is the process for approval of a stock exchange under Section 9?" | SCA Expert | FAIL | Only quoted SCA definition, didn't follow cross-reference to CMA Section 9 |
| "What is the definition of 'access' in a depository's computer system?" | CMA Expert | FAIL | Searched wrong Act, said "no explicit definition" when CDA has it |

**Fixes Applied:**
- Added Cross-Reference Resolution Rules (7 rules)
- Added Subject-Matter-to-Act routing table
- Added "never say undefined without checking all Acts" rule
- Added worked examples of correct vs. incorrect behavior

### Round 2: Second Test Battery

| Test Question | Mode | Grade | Issue |
|---|---|---|---|
| Minister's power vs. Commission independence (CMA s.12 + SCA s.6) | All Acts | **A-** | Minor Hohfeldian imprecision (procedural limit misclassified as Immunity) |
| Thirteen core functions of CSD (CDA s.8) | CDA Expert | **B+** | Fabricated cross-ref section numbers; thin Hohfeldian mapping |
| Minimum financial requirements (CMA s.43) | CMA Expert | **A-** | Possible hallucinated section "445"; missing key cross-ref to s.48 |
| Chairman appointment notice publication | SCA Expert | **F** | Answered from CMA s.12 (wrong Act entirely), missed SCA s.9(2) |
| "Expert" definition | SA 1997 Expert | **B+** | Quoted SCA 2015 instead of SA 1997's own definition; missed SA's own s.11 and s.82 |

**Fixes Applied:**

1. **Mandatory Search Methodology** — 5-step keyword search process before writing any response
2. **Hohfeldian Accuracy Rules** — Strict definitions for each category; instruction to omit non-applicable categories
3. **Anti-Hallucination Rule** — Only cite verifiable section numbers; say "could not be located" if unsure
4. **Single-Act Mode Rewrites** — All 4 modes got 5-point search rules + redirect guidance
5. **SA 1997 "Quote Your Own Act" Rule** — Explicit instruction to prefer own Act's definitions
6. **SCA 2015 Section Cheat Sheet** — Key section lookup table for common topics
7. **All Acts 4-Step Methodology** — Structured approach: identify Act → keyword search → quote correct Act → verify citations
8. **Fixed duplicate numbering** — Response format had two items numbered "5."

---

## 7. Complete Prompt Reference

### File Location
`src/pages/AIHub.tsx`, lines 47–375

### Constants & Variables

| Name | Type | Lines | Purpose |
|---|---|---|---|
| `SHARED_LEGAL_EXPERT_INSTRUCTIONS` | `const string` (template literal) | 47–242 | Elite analysis framework + response format shared by all legal modes |
| `SHARED_LEGAL_EXPERT_INSTRUCTIONS` reference in `getAiModes()` | — | appended to each mode | Injected at end of every legal expert prompt |
| `getAiModes(useKnowledgeBase)` | `function` | 244–375 | Returns array of mode objects with id, title, prompt |
| `cma2015PromptText` | `import` | line 38 | Full text of CMA 2015 |
| `cda2015PromptText` | `import` | line 39 | Full text of CDA 2015 |
| `sa1997PromptText` | `import` | line 40 | Full text of SA 1997 |
| `sca2015PromptText` | `import` | line 41 | Full text of SCA 2015 |

### Mode IDs

| Mode ID | Title | Act(s) Loaded |
|---|---|---|
| `general` | General Purpose AI | None (disabled) |
| `doc_analyst` | SCPNG Document Analyst | External prompt file (disabled) |
| `cma_2015_expert` | CMA 2015 Expert | CMA 2015 |
| `cda_2015_expert` | CDA 2015 Expert | CDA 2015 |
| `sa_1997_expert` | SA 1997 Expert | SA 1997 |
| `sca_2015_expert` | SCA 2015 Expert | SCA 2015 |
| `merged_acts_expert` | All Acts Expert | CMA 2015 + CDA 2015 + SA 1997 + SCA 2015 |

---

## 8. Future Improvements

### Known Remaining Gaps

1. **Single-Act modes cannot cross-reference**: When using CMA Expert and the question requires CDA content, the AI can only redirect — it cannot quote the other Act. Consider always loading all Acts or implementing dynamic Act loading.

2. **Context window pressure**: Loading all four Act texts in "All Acts Expert" mode consumes significant context. If responses become truncated or the AI loses track of content deep in the Acts, consider chunking or retrieval-augmented generation (RAG).

3. **Hallucination persistence**: Despite the anti-hallucination rule, the AI may still occasionally cite section numbers that exist in its training data but differ from the loaded text. Consider adding a post-processing validation step.

4. **Canon Warfare depth**: The current prompt instructs the AI to identify canons and counter-canons but doesn't enforce citing PNG-specific case law. Future enhancement could include a PNG case law reference database.

5. **Penalty cross-reference table**: Many provisions reference general penalty sections. A pre-built penalty cross-reference table could be added to the prompt to prevent the AI from missing applicable penalties.

### Suggested Test Questions for Validation

| Question | Expected Primary Source | Key Sections |
|---|---|---|
| "What is the definition of 'access' in a depository's computer system?" | CDA 2015 | s.2(1) definition + s.55 |
| "Where must the Chairman's appointment notice be published?" | SCA 2015 | s.9(2) — National Gazette |
| "What is the process for approval of a stock exchange?" | CMA 2015 | s.9 (full, with all subsections) |
| "How is 'expert' defined in the Securities Act?" | SA 1997 | s.2 interpretation section |
| "Can the Minister revoke a public interest director AND does that undermine Commission independence?" | All Acts | CMA s.12 + SCA s.6 (multi-Act) |
| "What penalties apply for unauthorized access to a depository computer system?" | CDA 2015 | s.55(3) — K10M fine / 10 years |
| "What are the grounds for revoking a stock exchange's approval?" | CMA 2015 | s.14 |
