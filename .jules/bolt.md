## 2024-05-24 - [React Render Starvation with 60FPS Physics Loop]
**Learning:** The application features a 60FPS physics loop in `App.jsx` that frequently updates global state (`robotState`). The entire component tree was re-rendering 60 times per second, causing render starvation. Pure UI or computationally heavy child components (like SVG canvases in `WiringCanvas`) that do not depend on the fast-changing state must be wrapped in `React.memo()` to prevent unnecessary re-renders.
**Action:** When implementing heavy visual components in a physics-based simulation architecture, always separate the fast-changing state from the static UI and use `React.memo()` to isolate updates.

## 2024-05-25 - [Heavy String Parsing in High-Frequency useEffects]
**Learning:** `SimulationArena3D.jsx` was parsing a mental map string using `JSON.parse` and multiple `RegExp.exec` loops inside a `useEffect` that was triggered by the 60FPS physics loop (via `robotState` dependency). This caused unnecessary CPU overhead, as the mental map data only changes infrequently.
**Action:** Always decouple slow-changing data from fast-changing data in high-frequency rendering environments. Extract heavy text parsing (like JSON or RegEx) into a `useMemo` hook that only depends on the slow-changing data (e.g., `mentalMap`), then feed the pre-parsed result into the fast-updating render loop or `useEffect`.
