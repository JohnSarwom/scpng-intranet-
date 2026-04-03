# GalleryLightbox Component

> Last Updated: 2026-03-30 11:57 AEST

## Overview

`GalleryLightbox` is the fullscreen image viewer for the Media Gallery module. It implements a smooth-scrolling, carousel-style lightbox with adjacent-slide peek ("peek-a-boo" effect), replacing the previous standard `Dialog`-based image viewer.

**Source**: `src/components/gallery/GalleryLightbox.tsx`
**Consumer**: `src/pages/Gallery.tsx`

---

## Design Language

The component follows the SCPNG **Dark Luxury / Glassmorphic** design system:

| Token              | Value                       | Usage                                    |
| :----------------- | :-------------------------- | :--------------------------------------- |
| Maroon (Primary)   | `#83002A`                   | Nav arrow hover, close button hover      |
| Gold (Secondary)   | `#c9a96e`                   | Counter text, date/location metadata     |
| Deep Black         | `rgba(8, 3, 5, 0.97)`      | Overlay background                       |
| Border Subtle      | `rgba(201, 169, 110, 0.25)` | Nav arrows, close button, avatar borders |
| Text Primary       | `#f5f0ea`                   | Author name, close icon                  |
| Text Muted         | `#c9a96e` at 60% opacity    | Counter, date, location labels           |

---

## Architecture

### Layout Structure (3 Sections)

```
┌──────────────────────────────────────────────────┐
│  TOP BAR:  Counter ("3 / 28")       [X] Close    │
├──────────────────────────────────────────────────┤
│                                                  │
│  [<]   ░░  ▓▓▓▓▓▓▓▓▓▓▓▓  ░░                [>]  │
│         adj   ACTIVE     adj                     │
│              (scale 1)                           │
│         (scale 0.87)                             │
│                                                  │
├──────────────────────────────────────────────────┤
│  METADATA:  [Avatar] Author  ·  Caption text     │
│             Date · Location     [Edit] [Delete]  │
│                                                  │
│            ● ● ● ● ● ● ● ● ●  (Dots)            │
└──────────────────────────────────────────────────┘
```

### Track Positioning — Core Algorithm

The carousel uses **pixel-based centering** ported directly from the WordPress reference. This is the single most important detail in the component:

```typescript
// Calculate slot width based on viewport
function getSlotWidth(): number {
  const vw = window.innerWidth;
  if (vw <= 600) return Math.round(vw * 0.85);  // Mobile: 85%
  if (vw <= 900) return Math.round(vw * 0.65);  // Tablet: 65%
  return Math.min(Math.round(vw * 0.52), 780);  // Desktop: 52%, max 780px
}

// Center the active slide in the viewport
const trackX = (vpW / 2) - (cur * (slotW + GAP)) - (slotW / 2);
```

**Why pixel-based, not CSS calc()?**
CSS `calc()` with viewport units inside Framer Motion's `animate` prop creates conflicts — Framer interpolates the value as a string, not a number, causing jitter. Pixel values allow Framer's spring physics to operate cleanly.

### Slide State Matrix

| State    | Scale  | Opacity | Brightness | Cursor  |
| :------- | :----- | :------ | :--------- | :------ |
| Active   | `1.00` | `1.0`   | `1.0`      | Default |
| Adjacent | `0.87` | `0.5`   | `0.6`      | Pointer |
| Far      | `0.78` | `0.25`  | `0.45`     | Pointer |

All transitions use `ease: [0.77, 0, 0.175, 1]` (a custom cubic-bezier matching the WordPress reference) with a `0.55s` duration.

### Track Animation

The track itself uses Framer Motion's spring physics:

```typescript
const TRANSITION = { type: 'spring', stiffness: 260, damping: 28 };
```

This produces a smooth, slightly elastic scroll that settles quickly without overshooting.

---

## Props Interface

```typescript
interface GalleryLightboxProps {
  isOpen: boolean;              // Controls visibility
  onClose: () => void;          // Callback to close the lightbox
  photos: LightboxPhoto[];      // Array of photo objects
  initialIndex: number;         // Which photo to open on
  eventTitle?: string;          // Displayed in top bar (not as heading)
  isAdmin?: boolean;            // Shows Edit/Delete buttons
  onEdit?: (photo) => void;     // Callback for Edit action
  onDelete?: (photo) => void;   // Callback for Delete action
}

interface LightboxPhoto {
  id: string;
  image_url: string;
  caption?: string;
  author?: string;
  initials?: string;
  date?: string | Date;
  location?: string;
}
```

---

## Interaction Features

### Keyboard Navigation
- **ArrowRight** — Next slide
- **ArrowLeft** — Previous slide
- **Escape** — Close lightbox

### Touch / Swipe
- Swipe threshold: `50px`
- Direction: Left swipe → next, Right swipe → previous

### Dot Navigation
- Maximum 20 dots rendered (to prevent overflow on large galleries)
- Active dot uses Gold (`#c9a96e`) with `scale(1.5)`
- Clicking a dot navigates directly to that slide

### Guard Rails
- `animating` flag prevents rapid-fire navigation (600ms cooldown)
- `metaFade` flag provides a smooth 250ms crossfade on the metadata bar when switching slides
- Body scroll is locked when the lightbox is open

---

## Integration with Gallery.tsx

The lightbox is consumed in `Gallery.tsx` with the following pattern:

```tsx
<GalleryLightbox
  isOpen={selectedImage !== null}
  onClose={() => setSelectedImage(null)}
  photos={currentEvent?.images.map(photo => ({
    ...photo,
    author: 'SCPNG Office',
    initials: 'SC',
    date: photo.created_at || currentEvent.date,
    location: 'Port Moresby'
  })) || []}
  initialIndex={imageIndex}
  eventTitle={currentEvent?.title}
  isAdmin={isAdmin}
  onEdit={(photo) => {
    const fullPhoto = currentEvent?.images.find(p => p.id === photo.id);
    if (fullPhoto) openEditModal(fullPhoto, { stopPropagation: () => {} });
  }}
  onDelete={(photo) => {
    const galleryImg = { id: photo.id, url: photo.image_url, caption: photo.caption || '' };
    openDeleteConfirm(galleryImg, { stopPropagation: () => {} });
  }}
/>
```

**Key detail**: The `photos` array is scoped to the current event, so the carousel only cycles through photos within the selected event — not the entire gallery.

---

## Dependencies

| Package          | Purpose                                     |
| :--------------- | :------------------------------------------ |
| `framer-motion`  | Spring-based track animation, slide scaling  |
| `lucide-react`   | Icons (ChevronLeft/Right, X, Calendar, etc.) |
| `@/lib/utils`    | `cn()` utility for className merging         |

---

## Related Documentation

- [Gallery Virtualization](../modules/gallery-virtualization.md) — The grid-level virtualization for the main gallery view
- [UI Patterns Guide](../guides/ui-patterns.md) — SCPNG design system conventions
