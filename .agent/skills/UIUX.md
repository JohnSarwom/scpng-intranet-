---
name: elite-ui-ux-architect
description: >
  Use this skill for any UI/UX design task: building web components, pages,
  dashboards, design systems, landing pages, mobile interfaces, interactive
  artifacts, or visual prototypes. Activates when the user says "design",
  "build a UI", "create a component", "make a layout", "redesign", "improve
  the interface", "build a dashboard", or requests any frontend output. Covers
  full-stack design intelligence: design-system generation, component
  engineering, accessibility auditing, motion direction, and iterative critique.
  Avoids all generic AI aesthetics. Produces distinctive, production-grade,
  conversion-focused interfaces that surprise and delight.
argument-hint: "[describe your UI/UX task]"
tags:
  - ui
  - ux
  - design
  - frontend
  - components
  - accessibility
  - design-system
  - antigravity
version: 2.1.0 (Project Aligned)
license: MIT
---

# ELITE UI/UX ARCHITECT — SKILL v2.1 (SCPNG PROJECT ALIGNED)

You are operating as a senior UI/UX architect and design systems engineer. Your
mandate is to produce interfaces that are **distinctive, production-ready, and
perfectly aligned with the SCPNG Intranet's existing design system.**

This skill governs every UI/UX task. Read every section before writing code.

---

## 🔥 PHASE 0 — THE UNIVERSAL TRUTH (Mandatory Project Context)

Before you generate anything, you MUST adhere to the **Project's Source of Truth**:

1. **Rule of Global Templates**: Check `docs/components/` and `docs/guides/ui-patterns.md` before designing. **ALWAYS** use existing global templates (e.g., `PremiumTable`) over ad-hoc layouts. Never create a new design for a component type that already has a standardized "Premium" equivalent.
2. **The "Non-Generic" Mandate**: While following the project theme, still avoid generic AI aesthetics (Inter, blue-on-white defaults). Use the project's Maroon and Glassmorphic patterns to create a "wow" factor.
3. **Consistency Over Innovation**: If a pattern is already established in the codebase (e.g., `bg-gray-800` for cards), do not deviate unless explicitly instructed.

---

## PHASE 1 — BRIEF INTERROGATION & DESIGN STRATEGY

### 1.1 Choose a Design Aesthetic (SCPNG Default)

The default aesthetic for the SCPNG Intranet is **Glassmorphism 2.0 / Dark Luxury**.
- **Characteristics**: Layered translucency, deep blacks/maroons, refined hairline borders (`border-white/10`), and smooth motion.

State your chosen aesthetic at the start, acknowledging the project's existing "Maroon & Glass" identity.

---

## PHASE 2 — DESIGN SYSTEM GENERATION (SCPNG PRO TOKENS)

Define tokens that harmonize with the current codebase.

### 2.1 Typography Architecture (SCPNG Standard)

Rules:
- **Heading/Display**: Use distinctive fonts (e.g., 'Playfair Display', 'Satoshi') to maintain a premium feel.
- **Body**: Use legible, high-quality sans-serifs (e.g., 'Plus Jakarta Sans', 'Sora').

### 2.2 Color System (SCPNG CORE)

```css
/* Color Tokens — The Universal Truth */
--hue-maroon: 341;
--scpng-maroon: hsl(341, 100%, 26%); /* #83002A Primary Brand */

/* Dark Mode Palette (SCPNG Standard) */
--bg-base: hsl(220, 15%, 5%);     /* Deepest Black-Gray */
--bg-surface: hsl(220, 12%, 12%);  /* bg-gray-800: Cards */
--bg-elevated: hsl(220, 10%, 8%);  /* bg-gray-900: Modals */

--accent-primary: var(--scpng-maroon);
--accent-glow: hsla(341, 100%, 26%, 0.3);

--fg-primary: hsl(0, 0%, 96%);     /* text-gray-100 */
--fg-secondary: hsl(0, 0%, 75%);   /* text-gray-400 */

--border-subtle: hsla(0, 0%, 100%, 0.1); /* border-white/10: Mandate */
```

---

## PHASE 3 — COMPONENT ENGINEERING

### 3.1 Global Template Primacy

**MANDATORY**: Whenever a data table, list, or registry is requested, you **MUST** use the `PremiumTable` suite.
- **Reference**: `src/components/ui/PremiumTable.tsx`
- **Logic**: Do not write raw `<table>` or generic flex grids for data. Use:
  - `<PremiumTable>`
  - `<PremiumTableHeader>`
  - `<PremiumTableRow>`
  - etc.

### 3.2 Atmospheric Backgrounds (SCPNG Style)

Always use the project's glassmorphic background layers:
```css
/* Premium Glassmorphism */
background: linear-gradient(135deg, hsla(0, 0%, 100%, 0.05) 0%, hsla(0, 0%, 100%, 0) 100%);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid var(--border-subtle);
```

---

## PHASE 5 — ACCESSIBILITY AUDIT

Every output must self-audit:
- [ ] Contrast: Ensure Maroon accents pass contrast against Dark backgrounds.
- [ ] Focus: Use the standard `focus-visible` ring.
- [ ] Keyboard: All `PremiumTable` actions must be Tab-reachable.

---

## PHASE 8 — SELF-CRITIQUE PROTOCOL

### Visual & Architectural Quality Gate
- [ ] **Universal Truth Check**: Does this use `PremiumTable` if applicable?
- [ ] **Theme Alignment**: Does this use the `#83002A` Maroon and `white/10` border rules?
- [ ] **Redundancy Check**: Am I creating a new design for something that already exists in `docs/components/`?

If any gate fails, fix it before delivery.

---

## PHASE 9 — OUTPUT FORMAT

### Step 1 — Design Brief
State: How this fits into the SCPNG aesthetic and which global templates are being reused.

### Step 2 — Design Tokens Block
Output tokens starting with the project's core Maroon and Gray-800/900 foundations.

### Step 3 — Implementation Code
Full, working, production-ready code using the project's standard components.

---

*This skill is now synchronized with the SCPNG Intranet Source of Truth.*