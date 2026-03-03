# AI Hub — Legal Document Analysis Framework

## Comprehensive Implementation Documentation

**Date:** March 2026
**Last Updated:** 3 March 2026
**File Modified:** `src/pages/AIHub.tsx`
**Scope:** All legal expert AI chat modes in the AI Hub

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement — What We Were Solving](#2-problem-statement)
3. [Architecture — How the AI Hub Prompts Work](#3-architecture)
4. [The Legal Analysis Framework (Shared Instructions)](#4-the-legal-analysis-framework)
5. [Per-Mode Prompt Architecture](#5-per-mode-prompt-architecture)
6. [API Integration — v1beta with Native System Instructions](#6-api-integration)
7. [Test Results & Iterative Fixes](#7-test-results--iterative-fixes)
8. [Complete Prompt Reference](#8-complete-prompt-reference)
9. [Future Improvements](#9-future-improvements)

---

## 1. Overview

The AI Hub legal expert modes use a **Legal Document Analysis Framework** — a comprehensive system prompt that transforms the AI from a basic legal reference tool into an analytical engine capable of:

- **Syntactic & Lexical Forensics** (modifier analysis, covenant vs. condition precedent classification)
- **Hohfeldian Legal Analysis** (formal rights/duty/power/liability/immunity mapping)
- **Canon Warfare** (Llewellyn thrust-and-parry canon pairs)
- **Jurisdictional Context** (PNG securities law specifics)
- **Black Swan Stress Testing** (edge cases, enforcement gaps, definitional ambiguities)

The framework was iteratively tested and refined across multiple rounds, fixing critical failures in cross-Act referencing, Act selection, search methodology, Hohfeldian accuracy, and section citation hallucination.

### Key Technical Improvements (March 2026)

| Change | Impact |
|---|---|
| Switched from Gemini v1 to v1beta endpoint | Enables native `system_instruction` support |
| Native `system_instruction` field | System prompts treated as dedicated context, not fake conversation turns |
| `temperature: 0.1` generation config | Precise, deterministic legal analysis instead of creative responses |
| `maxOutputTokens: 8192` | Full-length analysis with Hohfeldian tables and cross-references |
| Strong identity anchors in all single-Act modes | Prevents self-redirect bug where AI redirected users to the mode they were already in |
| Follow-up regex fix (`[\s\S]*?`) | Correctly parses follow-up questions that span newlines |
| Error message filtering from conversation history | Prevents context pollution from error/system messages |
| Summary section added to response format | Plain-language distillation at the end of every analysis |

### Elite Framework Enhancements (3 March 2026)

| Enhancement | Priority | Impact |
|---|---|---|
| **Temporal/Repeal Tracking** | High | SA 1997 repeal status (SCA 2015 s.117) now flagged in every SA 1997 analysis with successor provision mapping and transitional provisions (ss.118-123) |
| **Cross-Act Quoting in Single Modes** | High | Each single-Act mode now includes a lightweight cross-reference index from other Acts, enabling direct quoting without mode switching |
| **Remedies & Enforcement Analysis** | Medium | New mandatory analysis section: penalty provisions, enforcement mechanisms (administrative/civil/criminal), remedial hierarchy, enforcement gap identification |
| **Response Format Tiering** | Medium | 3-tier adaptive response system — Tier 1 (Quick Reference), Tier 2 (Standard Analysis), Tier 3 (Full Elite Analysis) — prevents over-engineering simple queries |
| **Phase VI: Advanced Doctrines** | Medium | Added 4 advanced doctrine sections: implied duties/gap-filling, parol evidence in statutory context, third-party/accessorial liability, privilege & confidentiality |
| **PNG Case Law Database** | Low | Key case law reference embedded: PNG statutory interpretation principles (Gari Baki, Salamo Elema), PNG securities decisions (Oil Search v SCPNG), and Commonwealth persuasive authorities |
| **Post-Response Self-Verification** | Low | 5-point mandatory verification checklist: section number audit, quote accuracy, Act attribution, cross-reference verification, Hohfeldian category accuracy |
| **Context Window Optimization** | Low | Conversation history limiting (20 turns single-Act, 10 turns All Acts) with summarization markers to prevent token overflow in long sessions |

### Anti-Hallucination & Context Awareness Fixes (3 March 2026)

| Fix | Priority | Impact |
|---|---|---|
| **Act Boundary Markers** | Critical | All Act texts now delimited with `=== BEGIN/END ===` markers so the model can unambiguously identify which Acts are loaded and where each Act's text begins/ends |
| **LOADED ACTS MANIFEST** | Critical | All Acts Expert mode now opens with an explicit manifest listing all 4 loaded Acts with checkmarks, preventing the model from claiming an Act is "not loaded" |
| **Anti-Hallucination Rule (Shared)** | Critical | New section in `SHARED_LEGAL_EXPERT_INSTRUCTIONS`: explicit rule prohibiting the model from claiming any Act is "not loaded" without first scanning context for boundary markers |
| **Anti-Hallucination Warning (All Acts)** | Critical | Dedicated warning in All Acts Expert prompt: "NEVER say any Act is 'not loaded' — all four are present below" |
| **Act Reordering (Lost-in-Middle Fix)** | High | All Acts Expert now loads Acts in ascending size order: CDA (115KB) → SCA (123KB) → SA (253KB) → CMA (774KB). Prevents smaller Acts from being "lost in the middle" of the context window |
| **Cross-Act Conflict Analysis (STEP 5)** | Medium | New mandatory step in All Acts Expert: when questions ask about conflicts/tensions between Acts, the AI must quote both provisions, identify tension points, and apply statutory hierarchy |

**Root Cause — "SCA Not Loaded" Bug:**
In All Acts Expert mode, the AI falsely claimed "The Securities Commission Act 2015 is not loaded" when asked about SCA s. 7 vs CMA s. 13. The SCA text (123KB) was loaded but placed third in a sequence of four Acts totaling ~1.27 MB. The model exhibited the "lost in the middle" phenomenon — paying less attention to content buried in the middle of very long contexts. Fixed by: (1) boundary markers, (2) explicit manifest, (3) anti-hallucination rules, (4) reordering Acts so smaller ones appear first and last (avoiding the middle position).

---

## 2. Problem Statement

### Initial State (Before Enhancement)

The original `SHARED_LEGAL_EXPERT_INSTRUCTIONS` contained only formatting instructions with no analytical framework, no cross-referencing rules, no search methodology, and no Hohfeldian analysis.

### Failures Discovered During Testing

| Test | Mode | Failure |
|---|---|---|
| "What is the process for approval of a stock exchange under Section 9?" | SCA Expert | Quoted only SCA 2015 definition, said "one would also need to cite the Capital Market Act 2015" instead of quoting CMA Section 9 |
| "What is the definition of 'access' in the context of a depository's computer system?" | CMA Expert | Searched wrong Act (CMA instead of CDA), said "there is no explicit definition" when CDA 2015 Section 2(1) has an explicit definition |
| "Where must the notice of the Chairman's appointment be published?" | SCA Expert | Answered from CMA Section 12 (exchange directors) instead of SCA Section 9(2) (Chairman appointment via National Gazette) |
| "How is 'expert' defined?" | SA 1997 Expert | Quoted from SCA 2015 instead of SA 1997, despite SA 1997 having its own identical definition |
| Cross-references in CDA test | CDA Expert | Cited fabricated section numbers (e.g., "Section 466 of the CMA") that don't exist in the loaded text |

### Self-Redirect Bug (Fixed March 2026)

A critical bug was identified where the AI in **CMA 2015 Expert** mode would respond with "This topic is primarily governed by the Capital Market Act 2015. I recommend switching to the CMA 2015 Expert mode" — redirecting the user to the mode they were already using.

**Root cause:** The shared `SHARED_LEGAL_EXPERT_INSTRUCTIONS` contained multi-Act routing rules (rules 3, 5, 6) that assumed multiple Acts were loaded. In single-Act modes, the AI read these rules and incorrectly triggered redirects.

**Fix:** Strong identity anchors + "redirect only as last resort" protocol in all single-Act modes, plus single-Act context clarifications in shared instructions.

---

## 3. Architecture

### How AI Hub Prompts Are Structured

```
AIHub.tsx
+-- SHARED_LEGAL_EXPERT_INSTRUCTIONS (const, template literal)
|   +-- Cross-Reference Resolution Rules (single-Act aware)
|   +-- Anti-Hallucination Rule — Loaded Act Awareness (NEW)
|   +-- Mandatory Search Methodology
|   +-- Post-Response Self-Verification Checklist (5 points)
|   +-- Depth of Analysis Requirements
|   +-- Hohfeldian Accuracy Rules
|   +-- Anti-Hallucination Rules (section citation)
|   +-- Phase I: Syntactic & Lexical Forensics
|   +-- Phase II: Hohfeldian Analysis & Logical Structure
|   +-- Phase III: Canon Warfare (Llewellyn Defense)
|   +-- Phase IV: Jurisdictional Context (PNG Securities Law)
|   +-- Phase V: Black Swan Stress Test
|   +-- Temporal & Repeal Tracking (SA 1997 → 2015 Acts mapping)
|   +-- Remedies & Enforcement Analysis
|   +-- Phase VI: Advanced Doctrines (gap-filling, parol evidence, third-party liability, privilege)
|   +-- Key Case Law Reference (PNG & Commonwealth)
|   +-- Master Analytical Checklist (11 items)
|   +-- Response Depth Tiering (Tier 1/2/3)
|   +-- Mandatory Response Format (with Summary + Remedies sections)
|
+-- CROSS_REF_INDEX_FOR_CMA (const) — key SCA/CDA provisions for CMA mode
+-- CROSS_REF_INDEX_FOR_CDA (const) — key CMA/SCA provisions for CDA mode
+-- CROSS_REF_INDEX_FOR_SA  (const) — key 2015 successor provisions for SA mode
+-- CROSS_REF_INDEX_FOR_SCA (const) — key CMA/CDA provisions for SCA mode
|
+-- getAiModes() function
|   +-- General Purpose AI (disabled, inline prompt)
|   +-- SCPNG Document Analyst (disabled, external prompt file)
|   +-- CMA 2015 Expert (identity anchor + === boundary markers === + Act text + SHARED + CROSS_REF_INDEX_FOR_CMA)
|   +-- CDA 2015 Expert (identity anchor + === boundary markers === + Act text + SHARED + CROSS_REF_INDEX_FOR_CDA)
|   +-- SA 1997 Expert (identity anchor + temporal warning + === boundary markers === + Act text + SHARED + CROSS_REF_INDEX_FOR_SA)
|   +-- SCA 2015 Expert (identity anchor + === boundary markers === + Act text + SHARED + CROSS_REF_INDEX_FOR_SCA)
|   +-- All Acts Expert (MANIFEST + 5-step methodology + cross-act conflict analysis + temporal awareness + === boundary markers === + ALL Act texts [size-ordered: CDA→SCA→SA→CMA] + SHARED)
|
+-- Act text files loaded via imports:
    +-- /files/CMA2015.txt (Capital Market Act 2015)
    +-- /files/CDA2015.txt (Central Depositories Act 2015)
    +-- /files/SA1997.txt (Securities Act 1997)
    +-- /files/SCA2015.txt (Securities Commission Act 2015)
```

### Prompt Assembly Per Mode

Each legal expert mode assembles its prompt as:

**Single-Act Modes (CMA, CDA, SA, SCA):**
```
[Strong identity anchor + "YOU ARE THE [ACT] EXPERT"]
+
[Temporal context (SA 1997 mode: repeal warning)]
+
[Absolute rule: answer from own Act first]
+
[5-step mandatory search rules with redirect-only-as-last-resort]
+
"=== BEGIN [ACT NAME] TEXT ===" + [Full Act text] + "=== END [ACT NAME] TEXT ==="
+
SHARED_LEGAL_EXPERT_INSTRUCTIONS (includes anti-hallucination loaded Act awareness rule)
+
CROSS_REF_INDEX_FOR_[ACT] (lightweight cross-reference index from other Acts)
```

**All Acts Expert Mode:**
```
[LOADED ACTS MANIFEST — explicit checklist of all 4 loaded Acts with ✅ markers]
+
[Anti-hallucination warning: "NEVER say any Act is 'not loaded'"]
+
[5-step methodology (incl. STEP 5: cross-Act conflict analysis)]
+
[Temporal awareness — SA 1997 repeal status]
+
[4 Act texts in SIZE ORDER with boundary markers:]
  "=== BEGIN CDA 2015 TEXT ===" (115KB — smallest first)
  "=== BEGIN SCA 2015 TEXT ===" (123KB)
  "=== BEGIN SA 1997 TEXT ===" (253KB)
  "=== BEGIN CMA 2015 TEXT ===" (774KB — largest last)
+
SHARED_LEGAL_EXPERT_INSTRUCTIONS
```

**Why size ordering matters:** Large language models exhibit a "lost in the middle" effect where content buried deep in very long contexts gets less attention. By placing smaller Acts first, we ensure they're not overshadowed by the 774KB CMA text. The CMA goes last because it's the largest and benefits from recency bias.

### Where the Prompt Gets Injected

At runtime, the selected mode's prompt is injected via the Gemini v1beta API's native `system_instruction` field:

```typescript
const requestBody = {
  contents: conversationHistory,  // Only real user/model turns
  system_instruction: {
    parts: [{ text: currentMode.prompt }]
  },
  generationConfig: {
    temperature: 0.1,
    topP: 0.85,
    maxOutputTokens: 8192,
  },
};
```

This is a significant improvement over the previous approach which faked the system instruction as a user/model message pair, wasting context window space and causing inconsistent instruction-following.

---

## 4. The Legal Analysis Framework

### 4.1 Cross-Reference Resolution Rules (CRITICAL RULE)

**Purpose:** Prevent the AI from stopping at a definitional provision when the user is asking about the substantive provision in another Act.

**Rules:**

| # | Rule | Single-Act Behavior |
|---|---|---|
| 1 | Follow the cross-reference | Quote the SUBSTANTIVE provision, not just the definition |
| 2 | Quote BOTH provisions | Definitional first, then substantive in full |
| 3 | Search ALL loaded Acts | If only one Act loaded, search it exhaustively |
| 4 | Trace the full chain | Follow nested cross-references to the operative rule |
| 5 | Never say "need to cite another Act" if loaded | In single-Act mode, note cross-reference and suggest mode switch |
| 6 | Search the CORRECT Act first | **ALL ACTS EXPERT MODE ONLY** — single-Act modes ignore this |
| 7 | Check all interpretation sections | If only one Act loaded, search that Act's Section 2 thoroughly |

### 4.2 Mandatory Search Methodology

**5-Step Search Process:**

1. **Keyword Extraction** — Pull key nouns and legal concepts from the question
2. **Section-by-Section Scan** — Search the ENTIRE Act text, not just the Interpretation section
3. **Table of Contents Check** — Match section headings/titles to the question's subject
4. **Interpretation Section Scan** — Always check Section 2 for defined terms
5. **Don't Stop at First Match** — Find ALL sections that address the topic

**Failsafe:** If no answer is found after thorough search, say "This topic does not appear to be addressed in [Act Name]. I recommend switching to [mode]." — never force-fit an unrelated section.

### 4.3 Depth of Analysis Requirements

| Category | Minimum Requirement |
|---|---|
| Syntactic Analysis | Analyze EVERY operative word (shall, may, must, if, subject to, provided that). Map modifier scope for every list/qualifier. |
| Hohfeldian Mapping | COMPLETE relationship table for ALL parties and ALL correlatives. Accuracy rules enforced. |
| Cross-References | ALL related sections across ALL loaded Acts. Must include: referenced by, references to, appeals, revocation, enforcement, definitions. |
| Risk Flags | Minimum 3 SPECIFIC risks citing exact statutory language. No generic observations. |

**Hohfeldian Accuracy Rules:**

| Category | When to Use | What to Look For |
|---|---|---|
| Right/Duty | Direct entitlement paired with obligation | "shall," "is entitled to" |
| Privilege/No-Right | Freedom to act, no one can compel or prevent | "may" granting discretion |
| Power/Liability | One party can ALTER another's legal relationship | approve, terminate, revoke, amend |
| Immunity/Disability | ONLY when explicit shield from legal action | "shall not be liable," exculpatory clauses |

**Anti-Hallucination Rule:**
> Only cite section numbers you can VERIFY exist in the loaded text. Never invent or guess section numbers. If unsure, say: "A related provision likely exists regarding [topic] but could not be located in the available text."

### 4.4 Phase I: Syntactic & Lexical Forensics

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

**Shall/May/Must Hierarchy:**

| Term | Meaning |
|---|---|
| Shall | Mandatory obligation |
| Must | Clearer mandatory standard |
| May | Discretionary permission (Hohfeldian Privilege) |
| Will | Ambiguous — flag for analysis |
| Should | Precatory/advisory — nearly always unenforceable |

### 4.5 Phase II: Hohfeldian Analysis & Logical Structure

**The Four Correlative Pairs:**

| Category | Party A Holds | Party B Holds | Significance |
|---|---|---|---|
| Rights / Duty | Right to performance | Strict Duty to perform | Directly enforceable |
| Privilege / No-Right | Freedom to act | No right to stop Party A | Cannot be restrained |
| Power / Liability | Power to alter legal relation | Liability to that alteration | Requires strict procedural compliance |
| Immunity / Disability | Protection from legal action | Cannot assert a claim | Examine for unconscionability |

**Syllogistic Reasoning:**
- Major Premise (Rule of Law) -> from the governing Act provision
- Minor Premise (Facts/Document) -> applied to the specific scenario
- Conclusion -> inevitable legal result from both premises

**Fallacy Detection:** Flag circular reasoning, non sequitur, and equivocation.

### 4.6 Phase III: Canon Warfare (Llewellyn Defense)

| Your Canon (Thrust) | Counter-Canon (Parry) |
|---|---|
| Plain Meaning: Apply text exactly as written | Absurdity Doctrine: Literal text leads to absurd results |
| Expressio Unius: Inclusion of one = exclusion of others | Contextualism: Non-exhaustive list of examples |
| Specific Beats General: Specific clause overrides preamble | Document as a Whole: No clause rendered meaningless |
| Ejusdem Generis: General words limited to same category | Noscitur a Sociis: General term deliberately broad |
| Last Antecedent: Modifier attaches to nearest noun | Series-Qualifier: Modifier applies to all list items |

### 4.7 Phase IV: Jurisdictional Context (PNG Securities Law)

- **Governing Framework:** SCA 2015, CMA 2015, CDA 2015, SA 1997
- **Regulatory Hierarchy:** Legislation -> Regulatory Instruments -> Market Rules -> SCPNG Guidelines -> Industry Practice
- **Interpretation Standards:** PNG Interpretation Act; Commonwealth (Australia, UK) as persuasive authority
- **Efforts Clauses:** best efforts != reasonable efforts != commercially reasonable efforts
- **Penalty Provisions:** Always identify max fine, imprisonment term, strict vs. mens rea liability

### 4.8 Phase V: Black Swan Stress Test

| Stress Test | What to Check |
|---|---|
| Edge Cases | What happens under extreme or unusual circumstances? |
| Interaction Effects | Could another section's "Notwithstanding" clause override this? |
| Enforcement Gaps | Is there a penalty? What if the provision is breached with no penalty specified? |
| Definitional Gaps | Are key terms defined in Section 2? If not, what's the likely judicial interpretation? |
| Temporal Issues | Time limits, sunset clauses, transitional provisions? |

### 4.9 Temporal & Repeal Tracking (Added 3 March 2026)

**Critical Legislative Fact:** The Securities Act 1997 has been formally repealed by SCA 2015 Section 117.

**What's Implemented:**
- Every SA 1997 Expert response now includes a mandatory **Temporal Status** section
- Full Part-by-Part successor provision mapping (SA 1997 → 2015 Acts)
- Saving & transitional provisions documented (SCA 2015 ss.118-123)
- All Acts Expert mode includes temporal awareness for SA 1997 provisions
- Fidelity Fund → Capital Market Compensation Fund conversion tracked (SCA 2015 s.123)

**SA 1997 → 2015 Acts Successor Mapping:**

| SA 1997 Part | Successor Act | Subject Matter |
|---|---|---|
| Part II (ss.4-17) | SCA 2015 | Securities Commission establishment & powers |
| Part III Div 1 (ss.18-26) | CMA 2015 | Stock exchange approval & regulation |
| Part III Div 2 (ss.27-49) | CMA 2015 Part IX | Fidelity Fund → Capital Market Compensation Fund |
| Part IV (ss.51-94) | CMA 2015 | Prospectus, offer & allotment restrictions |
| Part V (ss.95-104) | CMA 2015 | Market conduct, manipulation, false trading |
| Part VI (ss.105-115) | CMA 2015 | Substantial security holders, disclosure |
| Part VII (ss.116-163) | CMA 2015 | Takeover provisions |

### 4.10 Remedies & Enforcement Analysis (Added 3 March 2026)

A new mandatory analysis section requiring identification of:
- **Penalty provisions**: Fine amounts, imprisonment terms, strict vs. mens rea liability
- **Enforcement mechanisms**: Commission administrative action, court orders, criminal prosecution, private civil action
- **Remedial hierarchy**: Administrative (fastest) → Civil (balance of probabilities) → Criminal (beyond reasonable doubt)
- **Enforcement gaps**: Obligations without penalties, disproportionate penalties, missing timeframes

### 4.11 Phase VI: Advanced Doctrines (Added 3 March 2026)

Four advanced doctrine sections added for Tier 2 and Tier 3 queries:

| Section | Content |
|---|---|
| 6.1 Implied Duties & Gap-Filling | Commission guidelines (CMA s.466), PNG Interpretation Act principles, Commonwealth persuasive authority |
| 6.2 Parol Evidence in Statutory Context | Four corners rule, purposive construction exception, subordinate legislation |
| 6.3 Third-Party Liability | Officer/director personal liability, aiding and abetting, civil accessorial liability |
| 6.4 Privilege & Confidentiality | Statutory secrecy obligations, privileged Commission proceedings, self-incrimination |

### 4.12 Key Case Law Reference (Added 3 March 2026)

Embedded case law database for AI reference:

**PNG Statutory Interpretation:**
- **Gari Baki v Allan Kopi [2008] PGNC 251; N4023** — Three-step approach: plain meaning → fair/liberal construction → contextual reading
- **Salamo Elema v Pacific MMI Insurance Ltd [2011] PGSC 9; SC1114** — Supreme Court endorsed fair, large, and liberal construction
- **PNG Constitution s.25(3)** — Interpretation giving effect to National Goals preferred

**PNG Securities Law:**
- **Oil Search Ltd v Securities Commission of PNG (2020)** — SCA 2015 does not authorize "Acting Chairman" appointments; strict compliance required
- **In the Matter of Oil Search Limited (2021)** — CMA 2015 intersection with Companies Act 1997 in scheme of arrangement

**Commonwealth Persuasive Authority:**
- **ASIC v Hellicar [2012] HCA 17** — Directors' duties in securities disclosure
- **ASIC v Fortescue Metals Group Ltd [2011] FCAFC 19** — Misleading conduct in securities markets
- **Project Blue Sky Inc v Australian Broadcasting Authority [1998] HCA 28** — Purposive statutory interpretation
- **CIC Insurance Ltd v Bankstown Football Club Ltd [1997] HCA 2** — Context over literal meaning

### 4.13 Response Depth Tiering (Added 3 March 2026)

Adaptive 3-tier response system:

| Tier | Trigger | Format |
|---|---|---|
| **Tier 1 — Quick Reference** | "What is the definition of...", "What does Section X say?", "What is the penalty for..." | Statutory quote → Brief explanation → Key cross-references → Follow-ups |
| **Tier 2 — Standard Analysis** (Default) | "How does Section X apply to...", "What are the requirements for...", "Can the Commission..." | Statutory quote → Syntactic analysis → Hohfeldian (relevant pairs) → Practical implications → Cross-references → Remedies → Summary → Follow-ups |
| **Tier 3 — Full Elite Analysis** | "Analyze the interaction between...", "What are the legal risks of...", multi-provision queries | Full mandatory format — all phases, all sections, minimum 3 risk flags, full Hohfeldian table, Canon Warfare |

### 4.14 Post-Response Self-Verification (Added 3 March 2026)

5-point mandatory verification checklist before finalizing every response:

1. **Section Number Audit** — Confirm every cited section number exists in loaded text
2. **Quote Accuracy Check** — Verify direct quotes match Act text word-for-word
3. **Act Attribution Check** — Verify every provision is attributed to the correct Act
4. **Cross-Reference Verification** — Verify referenced sections exist in cross-reference index or loaded text
5. **Hohfeldian Category Accuracy** — Confirm categorizations follow accuracy rules

### 4.15 Master Analytical Checklist

Applied to every response (updated 3 March 2026 — expanded from 9 to 11 items):

1. CROSS-REFERENCE RESOLUTION — Follow all cross-references, quote substantive provisions in full
2. Identify every modifier and map grammatical scope (shall, may, must, if, subject to)
3. Distinguish obligations as Covenant or Condition Precedent
4. Restate ALL key obligations in Hohfeldian terms as complete relationship table
5. Build a syllogism for each core legal argument
6. Identify applicable canons of construction AND their counter-canons
7. Apply PNG jurisdictional context and regulatory hierarchy
8. Stress-test for edge cases, interaction effects, enforcement gaps (minimum 3 specific risks)
9. Identify ALL related sections: referenced by, references to, appeals, revocation, enforcement, definitions
10. **TEMPORAL CHECK** — If analyzing SA 1997, flag repeal status, identify successor provisions, note transitional effects
11. **REMEDIES & ENFORCEMENT** — Identify penalty provisions, enforcement mechanisms, and enforcement gaps

### 4.16 Mandatory Response Format

**Structure (updated 3 March 2026):**

1. **Authenticity** — Direct word-for-word quote from the Act
2. **Multi-Act Cross-Referencing** — Separate quote boxes per Act, labeled clearly, full provisions
3. **Required Quote Format** — `> [!NOTE]` syntax with mandatory blank lines between subsections
4. **Analysis Section** — Structured as:
   - Syntactic Analysis (every operative word)
   - Hohfeldian Mapping (complete relationship table)
   - Practical Implications (what the provision DOES)
   - Cross-References & Interactions (all related sections with numbers and descriptions)
   - **Remedies & Enforcement** (penalty provisions, enforcement mechanisms, strict vs. mens rea, enforcement gaps)
   - Risk Flags (minimum 3, citing exact language)
   - **Temporal Status** (SA 1997 provisions only — repeal status, successor provision, transitional effects)
   - **Summary** (2-4 plain-language sentences: what the provision does, who it affects, key practical consequence)
5. **Rich Formatting** — Bold section numbers, italicize obligations
6. **Follow-up Questions** — 3 mandatory follow-ups in `<followups>` tag format

---

## 5. Per-Mode Prompt Architecture

### 5.1 Identity Anchor Pattern (All Single-Act Modes)

Every single-Act mode now opens with a strong identity anchor that prevents the self-redirect bug:

```
YOU ARE THE [ACT NAME] EXPERT. You have ONLY the [Act Name] loaded.
This is YOUR Act. Every question the user asks should be answered from THIS Act first.

ABSOLUTE RULE — ANSWER FROM YOUR OWN ACT FIRST:
The user has selected "[Mode Name]" mode. They EXPECT answers from the [Act Name].
You MUST rigorously and exhaustively search YOUR loaded Act before even considering
that the answer might be elsewhere. NEVER redirect the user to "[Mode Name]" — you ARE
the [Mode Name].
```

### 5.2 Five-Step Search Rules (All Single-Act Modes)

| # | Rule | Purpose |
|---|---|---|
| 1 | EXHAUSTIVE SELF-SEARCH | Extract keywords, scan entire text, every Part/Division/Subdivision + Section 2, headings, body text, penalty provisions, schedules, cross-references |
| 2 | CHECK SECTION HEADINGS | Match section titles to the question before reading body text |
| 3 | NEVER GRAB AN UNRELATED SECTION | If no match, say so clearly — don't force-fit |
| 4 | ANSWER IF FOUND | If ANY relevant provision exists — even tangential or definitional — quote it and provide full analysis. Do NOT redirect. |
| 5 | REDIRECT ONLY AS LAST RESORT | ONLY if ZERO relevant provisions found after exhaustive search. Use language: "After thoroughly searching the [Act], this specific topic does not appear to be addressed..." |

### 5.3 CMA 2015 Expert Mode
**Mode ID:** `cma_2015_expert`
- Identity anchor: "YOU ARE THE CAPITAL MARKET ACT 2015 (CMA 2015) EXPERT"
- 5-step search rules with CMA-specific examples
- Redirect-only-as-last-resort protocol
- **Cross-Reference Index** (`CROSS_REF_INDEX_FOR_CMA`): Key provisions from SCA 2015 (ss.4, 55, 105, 117-123) and CDA 2015 (s.2(1) definitions, ss.5, 14)

### 5.4 CDA 2015 Expert Mode
**Mode ID:** `cda_2015_expert`
- Identity anchor: "YOU ARE THE CENTRAL DEPOSITORIES ACT 2015 (CDA 2015) EXPERT"
- 5-step search rules with CDA-specific examples
- Redirect-only-as-last-resort protocol
- **Cross-Reference Index** (`CROSS_REF_INDEX_FOR_CDA`): Key provisions from CMA 2015 (s.2(1) imported definitions, ss.9, 179, 250) and SCA 2015 (ss.4, 43, 55, 105)

### 5.5 SA 1997 Expert Mode
**Mode ID:** `sa_1997_expert`
- Identity anchor: "YOU ARE THE SECURITIES ACT 1997 (SA 1997) EXPERT"
- **Temporal Context Warning**: Prominent repeal status notice (SCA 2015 s.117) with mandatory Temporal Status section in every response
- 5-step search rules with SA-specific examples
- Special rule: "If a term like 'expert' is defined in THIS Act, quote THIS Act's definition — not a definition from a different Act"
- **Cross-Reference Index** (`CROSS_REF_INDEX_FOR_SA`): Key successor provisions from SCA 2015 (ss.4, 117-123) and CMA 2015 (ss.9, 2(1), Part VII, Part IX) for temporal mapping

### 5.6 SCA 2015 Expert Mode
**Mode ID:** `sca_2015_expert`
- Identity anchor: "YOU ARE THE SECURITIES COMMISSION ACT 2015 (SCA 2015) EXPERT"
- 5-step search rules with SCA-specific examples
- **Cross-Reference Index** (`CROSS_REF_INDEX_FOR_SCA`): Key provisions from CMA 2015 (s.2(1) definitions, ss.3, 9, 30, 31, 36, 77) and CDA 2015 (ss.2(1), 5)
- Key Section Cheat Sheet:

| Topic | Section to Check |
|---|---|
| Chairman appointment & publication | Section 9 (Chairman) |
| Commission independence | Section 6 (Independence) |
| Term of office | Section 12 (Term of Office) |
| Commission powers & functions | Sections 4, 5, 7, 8 |
| Delegation | Section 11 (Delegation) |
| Appointment Committee | Section 18 |
| Definitions | Section 2 (Interpretation) |

### 5.7 All Acts Expert Mode
**Mode ID:** `merged_acts_expert`

**4-Step Methodology:**

| Step | Instruction |
|---|---|
| STEP 1 | IDENTIFY THE PRIMARY ACT based on subject matter (routing table) |
| STEP 2 | THOROUGH KEYWORD SEARCH across ALL four Acts — section headings, Section 2 of all Acts, every Part/Division |
| STEP 3 | QUOTE FROM THE CORRECT ACT FIRST — primary Act = main answer, others = supplementary |
| STEP 4 | VERIFY BEFORE CITING — only cite section numbers confirmed in loaded text |

**Additional Rules:**
- Never say a term is undefined without checking all four Interpretation sections
- Never say "this is covered in another Act" without quoting it — all four Acts are loaded
- **Temporal Awareness (Added 3 March 2026)**: SA 1997 is formally repealed by SCA 2015 s.117 — always note repeal status, quote both the repealed provision and the current 2015 successor, and explain saving/transitional effects (SCA 2015 ss.118-123)

---

## 6. API Integration

### Endpoint Migration: v1 to v1beta

**Before (v1):**
```
https://generativelanguage.googleapis.com/v1/models/{model}:generateContent
```
System prompt was faked as a user/model conversation pair:
```typescript
// OLD — wasted 2 turns of context, inconsistent instruction following
conversationHistory.push({ role: 'user', parts: [{ text: `System Instruction: ${prompt}` }] });
conversationHistory.push({ role: 'model', parts: [{ text: "Understood." }] });
```

**After (v1beta):**
```
https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```
System prompt sent as native top-level field:
```typescript
// NEW — dedicated system context, better instruction following
const requestBody = {
  contents: conversationHistory,
  system_instruction: { parts: [{ text: currentMode.prompt }] },
  generationConfig: { temperature: 0.1, topP: 0.85, maxOutputTokens: 8192 },
};
```

### Generation Configuration

| Parameter | Value | Rationale |
|---|---|---|
| `temperature` | `0.1` | Precision over creativity for statutory interpretation |
| `topP` | `0.85` | Slightly constrained sampling for consistency |
| `maxOutputTokens` | `8192` | Allows full Hohfeldian tables, cross-reference analysis, and summary |

### Conversation History Filtering

Messages sent to the API are filtered to exclude:
- Initial greeting message (index 0)
- Messages still being typed (`isTyping === true`)
- Error messages (`text.startsWith('Error:')`)
- Configuration messages (`text.startsWith('AI is not configured')`)

### Context Window Optimization (Added 3 March 2026)

To prevent token overflow in long sessions, conversation history is now limited:

| Mode | Max History Turns | Rationale |
|---|---|---|
| Single-Act modes | 20 messages | Moderate context pressure — one Act loaded |
| All Acts Expert | 10 messages | High context pressure — all 4 Act texts loaded simultaneously |

**When history exceeds the limit:**
1. The first user-model exchange is preserved (initial context)
2. A summarization marker is inserted: `[SYSTEM NOTE: Earlier conversation turns have been omitted...]`
3. The model acknowledges the trim and proceeds with available context
4. The most recent turns are preserved in full

This prevents truncated responses and context confusion in long analytical sessions.

### Follow-Up Question Parsing

```typescript
// OLD — failed when model output contained newlines
const followUpMatch = aiResponseText.match(/<followups>(.*?)<\/followups>/);

// NEW — correctly matches across newlines, filters empty entries
const followUpMatch = aiResponseText.match(/<followups>([\s\S]*?)<\/followups>/);
followUpQuestions = followUpMatch[1].split('|').map(q => q.trim()).filter(q => q.length > 0);
aiResponseText = aiResponseText.replace(/<followups>[\s\S]*?<\/followups>/, '').trim();
```

---

## 7. Test Results & Iterative Fixes

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
| Minister's power vs. Commission independence (CMA s.12 + SCA s.6) | All Acts | **A-** | Minor Hohfeldian imprecision |
| Thirteen core functions of CSD (CDA s.8) | CDA Expert | **B+** | Fabricated cross-ref section numbers |
| Minimum financial requirements (CMA s.43) | CMA Expert | **A-** | Possible hallucinated section |
| Chairman appointment notice publication | SCA Expert | **F** | Answered from wrong Act entirely |
| "Expert" definition | SA 1997 Expert | **B+** | Quoted wrong Act's definition |

**Fixes Applied:**
- Mandatory Search Methodology (5-step process)
- Hohfeldian Accuracy Rules
- Anti-Hallucination Rule
- Single-Act Mode Rewrites with search rules
- SA 1997 "Quote Your Own Act" Rule
- SCA 2015 Section Cheat Sheet
- All Acts 4-Step Methodology

### Round 3: Self-Redirect Bug Fix (March 2026)

| Test Question | Mode | Issue |
|---|---|---|
| "What are the limitations on establishing stock and derivatives markets according to Section 8?" | CMA 2015 Expert | AI responded as CDA Expert, told user to switch to CMA mode (the mode they were already in) |

**Fixes Applied:**
- Strong identity anchors in all 4 single-Act modes
- "ABSOLUTE RULE — ANSWER FROM YOUR OWN ACT FIRST" protocol
- Rule 4 changed from "REDIRECT WHEN APPROPRIATE" to "ANSWER IF FOUND"
- Rule 5 changed to "REDIRECT ONLY AS LAST RESORT" (zero provisions found)
- Shared instructions rules 3, 5, 6 updated for single-Act context awareness

---

## 8. Complete Prompt Reference

### File Location
`src/pages/AIHub.tsx`

### Constants & Variables

| Name | Type | Purpose |
|---|---|---|
| `SHARED_LEGAL_EXPERT_INSTRUCTIONS` | `const string` | Analysis framework (6 phases) + response format + checklist shared by all legal modes |
| `CROSS_REF_INDEX_FOR_CMA` | `const string` | Cross-reference index: key SCA 2015 & CDA 2015 provisions for CMA Expert mode |
| `CROSS_REF_INDEX_FOR_CDA` | `const string` | Cross-reference index: key CMA 2015 & SCA 2015 provisions for CDA Expert mode |
| `CROSS_REF_INDEX_FOR_SA` | `const string` | Cross-reference index: key 2015 Acts successor provisions for SA Expert mode |
| `CROSS_REF_INDEX_FOR_SCA` | `const string` | Cross-reference index: key CMA 2015 & CDA 2015 provisions for SCA Expert mode |
| `getAiModes(useKnowledgeBase)` | `function` | Returns array of mode objects with id, title, prompt |
| `cma2015PromptText` | `import` | Full text of CMA 2015 |
| `cda2015PromptText` | `import` | Full text of CDA 2015 |
| `sa1997PromptText` | `import` | Full text of SA 1997 |
| `sca2015PromptText` | `import` | Full text of SCA 2015 |

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

## 9. Future Improvements

### Resolved Items (3 March 2026)

| # | Previously Known Gap | Resolution |
|---|---|---|
| 1 | Single-Act modes cannot cross-reference | **RESOLVED** — Cross-reference indexes (`CROSS_REF_INDEX_FOR_*`) now provide key provisions from other Acts in each single-Act mode |
| 2 | Context window pressure | **MITIGATED** — Conversation history limiting (20/10 turns) + Act text reordering by size (CDA→SCA→SA→CMA) to mitigate "lost in the middle" effect |
| 3 | Hallucination persistence | **RESOLVED** — 5-point self-verification checklist + Act boundary markers (`=== BEGIN/END ===`) + LOADED ACTS MANIFEST + explicit "never claim Act not loaded" rule. Fixed "SCA not loaded" false claim in All Acts mode |
| 4 | Canon Warfare depth / no case law | **RESOLVED** — PNG & Commonwealth case law reference database embedded in shared instructions |
| 6 | Temporal Validity Check | **RESOLVED** — Full temporal/repeal tracking with SA 1997 → 2015 Acts successor mapping and transitional provisions |

### Known Remaining Gaps

1. **Penalty cross-reference table**: Many provisions reference general penalty sections. A pre-built penalty cross-reference table could be added to the prompt.

2. **Ambiguity Escalation Protocol**: When a provision admits two equally valid interpretations, present both with separate Hohfeldian tables and flag as a genuine interpretive dispute.

3. **Confidence Scoring**: Self-reported confidence indicators (HIGH/MEDIUM/LOW/INFERRED) on analytical conclusions, with appropriate caveats about AI self-calibration limitations. (Deliberately deferred — not implemented per stakeholder decision.)

4. **Dynamic Act Loading**: Single-Act modes use static cross-reference indexes rather than dynamically loading other Acts. A future RAG-based approach could retrieve only relevant sections on demand.

5. **Expanded PNG Case Law**: The current case law database is limited to publicly available decisions. As more PNG securities law decisions become available (via PACLII or SCPNG enforcement actions), the database should be expanded.

6. **Regulatory Instruments Database**: Commission guidelines, practice notes, and regulatory instruments issued under the Acts are not currently embedded. These could supplement the legislative text for practical compliance guidance.

7. **Securities Commission Amendment Act 2023**: The SCA was amended in 2023 — any changes to Commission powers, appointments, or enforcement provisions should be incorporated into the prompt framework.

### Suggested Test Questions for Validation

| Question | Expected Primary Source | Key Sections |
|---|---|---|
| "What is the definition of 'access' in a depository's computer system?" | CDA 2015 | s.2(1) definition + s.55 |
| "Where must the Chairman's appointment notice be published?" | SCA 2015 | s.9(2) — National Gazette |
| "What is the process for approval of a stock exchange?" | CMA 2015 | s.9 (full, with all subsections) |
| "How is 'expert' defined in the Securities Act?" | SA 1997 | s.2 interpretation section |
| "Can the Minister revoke a public interest director AND does that undermine Commission independence?" | All Acts | CMA s.12 + SCA s.6 (multi-Act) |
| "What penalties apply for unauthorized access to a depository computer system?" | CDA 2015 | s.55(3) — K10M fine / 10 years |
| "What are the limitations on establishing stock and derivatives markets?" | CMA 2015 | s.8 (should NOT redirect when in CMA mode) |
| "How does the 'public interest' objective in SCA s. 7 conflict with market efficiency mandates in CMA s. 13?" | All Acts | SCA s.7 + CMA s.13 (must quote BOTH, never claim SCA "not loaded") |
