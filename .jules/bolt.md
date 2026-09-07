## 2024-05-24 - [React Render Starvation with 60FPS Physics Loop]
**Learning:** The application features a 60FPS physics loop in `App.jsx` that frequently updates global state (`robotState`). The entire component tree was re-rendering 60 times per second, causing render starvation. Pure UI or computationally heavy child components (like SVG canvases in `WiringCanvas`) that do not depend on the fast-changing state must be wrapped in `React.memo()` to prevent unnecessary re-renders.
**Action:** When implementing heavy visual components in a physics-based simulation architecture, always separate the fast-changing state from the static UI and use `React.memo()` to isolate updates.

## 2026-09-07 - [Heavy computations inside 60FPS Render Loop Effect]
**Learning:** In `SimulationArena3D.jsx`, heavy JSON parsing and regex logic was placed directly inside a `useEffect` hook that depends on the high-frequency `robotState`. This causes expensive computations to run up to 60 times a second, dragging down simulation performance.
**Action:** Avoid placing heavy synchronous operations (like JSON parsing or complex Regex) inside high-frequency render loops or `useEffect` blocks dependent on `robotState`. Always cache these operations using `useMemo` tied only to their slow-changing dependencies.
