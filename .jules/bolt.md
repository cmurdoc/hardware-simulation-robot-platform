## 2024-05-24 - [React Render Starvation with 60FPS Physics Loop]
**Learning:** The application features a 60FPS physics loop in `App.jsx` that frequently updates global state (`robotState`). The entire component tree was re-rendering 60 times per second, causing render starvation. Pure UI or computationally heavy child components (like SVG canvases in `WiringCanvas`) that do not depend on the fast-changing state must be wrapped in `React.memo()` to prevent unnecessary re-renders.
**Action:** When implementing heavy visual components in a physics-based simulation architecture, always separate the fast-changing state from the static UI and use `React.memo()` to isolate updates.

## 2026-08-29 - [Heavy Sync Operations in 60FPS Render Loops]
**Learning:** Found heavy text parsing (JSON and Regex) of AI mental maps happening directly inside a `useEffect` in `SimulationArena3D.jsx` that depended on the fast-updating `robotState`. This meant string parsing was unnecessarily executing 60 times a second, causing CPU overhead.
**Action:** Avoid placing heavy synchronous operations inside high-frequency render loops or `useEffect` blocks dependent on `robotState`. Cache these operations using `useMemo` tied only to their slow-changing dependencies (e.g. `mentalMap`).
