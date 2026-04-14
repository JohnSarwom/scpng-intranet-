# Task Card Completion Animation

## Overview

A "Mark as complete" button with confetti celebration animation on task cards in the Kanban board view. When a user marks a task as complete, the card plays a multi-phase animation sequence before notifying the parent component.

## Files Modified

- `src/components/unit-tabs/TaskCard.tsx` — all changes are contained here

## How It Works

### Three-Phase Animation

The completion flow uses a state machine with three phases:

1. **idle** — Default state. Card renders normally with a "Mark as complete" button at the bottom.
2. **completing** (1.5s) — Triggered on button click:
   - Canvas-based confetti burst (56 particles with physics simulation)
   - Expanding green ring burst (`ringBurst` CSS keyframe)
   - Green overlay fades in with a checkmark icon and "Completed!" label
   - Card border turns green with a subtle glow
   - Button changes to solid green showing "Done!"
3. **done** (0.5s) — Card fades out and scales down, then `onComplete(id, true)` fires to notify the parent.

### Uncomplete Path

If a task is already completed, clicking the button toggles it back to incomplete immediately with no animation — `onComplete(id, false)` fires directly.

### Confetti Engine

- `spawnConfetti(canvas)` — spawns 56 rectangular particles from the card center
- Each particle has random velocity, spin, gravity, and color from the project palette
- Colors: greens (`#1D9E75`, `#5DCAA5`, `#9FE1CB`), maroon (`#7a1530`), golds (`#FAC775`, `#EF9F27`), blues (`#B5D4F4`, `#378ADD`)
- Particles fade via a `life` property with random decay rates
- Uses `requestAnimationFrame` for smooth 60fps rendering

### CSS Keyframes

Injected once on first mount via `injectKeyframes()`:

- `ringBurst` — scales a green ring from 0 to 2.8x while fading opacity
- `completionPulse` — pulsing green box-shadow (available for future use)

## Button States

| State | Appearance | Action |
|-------|-----------|--------|
| Not completed | Outlined, muted text, "Mark as complete" | Triggers animation |
| Completing | Solid green, white text, "Done!" | Disabled |
| Completed (idle) | Green-tinted, "Completed" | Click to uncomplete |

## Integration

The button only renders when the `onComplete` prop is provided to `TaskCard`. The existing `onComplete(id: string, completed: boolean)` callback contract is unchanged — parent components (TasksTab, etc.) require no modifications.

The `isCompleted` styling on `PremiumKanbanCard` (opacity, grayscale) is suppressed during the animation and only applied once the phase returns to idle, preventing visual conflict with the overlay.

## Dependencies

- No new dependencies added
- Uses native Canvas API for confetti (no library)
- Uses existing `framer-motion` (already imported but not used for this feature)
- CSS keyframes injected via DOM (`document.createElement("style")`)
