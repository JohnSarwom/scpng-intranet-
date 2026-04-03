# Launch Countdown

Component that displays a live 48-hour countdown on the Welcome Banner, leading up to the SCPNG Intranet website launch. When the countdown expires it switches to a bold, pulsating "Website Officially Launched!" message.

---

## Files

| File | Purpose |
|------|---------|
| `src/hooks/useCountdown.ts` | Fetches real server time, computes remaining ms, ticks every second |
| `src/components/dashboard/LaunchCountdown.tsx` | UI — countdown timer or launched banner |
| `src/components/dashboard/WelcomeBanner.tsx` | Renders `<LaunchCountdown />` in the right column of the banner |

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

| State | Condition | What renders |
|-------|-----------|--------------|
| Loading | `loading === true` | Spinner (`Loader2`) |
| Active | `timeLeft > 0` | HH : MM : SS countdown with Rocket label |
| Expired | `timeLeft === 0` | Pulsating launch message (see below) |

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

## Dependencies

- `framer-motion` — animations
- `lucide-react` — `Rocket`, `Loader2` icons
- WorldTimeAPI — free, no API key required
