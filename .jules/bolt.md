## 2024-05-24 - [React Render Starvation with 60FPS Physics Loop]
**Learning:** The application features a 60FPS physics loop in `App.jsx` that frequently updates global state (`robotState`). The entire component tree was re-rendering 60 times per second, causing render starvation. Pure UI or computationally heavy child components (like SVG canvases in `WiringCanvas`) that do not depend on the fast-changing state must be wrapped in `React.memo()` to prevent unnecessary re-renders.
**Action:** When implementing heavy visual components in a physics-based simulation architecture, always separate the fast-changing state from the static UI and use `React.memo()` to isolate updates.

## 2026-09-02 - [Avoid heavy synchronous ops in 60FPS tick useEffects]
**Learning:** Found an anti-pattern in `SimulationArena3D.jsx` where heavy synchronous operations (like JSON parsing and complex regex searches) were inside a `useEffect` that depended on the rapidly changing `robotState` (from the 60FPS physics loop). This caused CPU waste on every frame.
**Action:** Always extract expensive synchronous work (like parsing) into a `useMemo` block that only depends on the actual slow-changing source data (e.g. `mentalMap`), keeping the fast-tick `useEffect` lightweight.
