## 2024-05-24 - [React Render Starvation with 60FPS Physics Loop]
**Learning:** The application features a 60FPS physics loop in `App.jsx` that frequently updates global state (`robotState`). The entire component tree was re-rendering 60 times per second, causing render starvation. Pure UI or computationally heavy child components (like SVG canvases in `WiringCanvas`) that do not depend on the fast-changing state must be wrapped in `React.memo()` to prevent unnecessary re-renders.
**Action:** When implementing heavy visual components in a physics-based simulation architecture, always separate the fast-changing state from the static UI and use `React.memo()` to isolate updates.

## 2024-05-25 - [Expensive Regex & JSON Parsing in High-Frequency Loops]
**Learning:** Placing heavy synchronous operations (like JSON parsing or complex Regex) inside a `useEffect` that depends on a high-frequency fast-changing state (like a 60FPS physics loop `robotState`) causes the expensive operations to run on every frame. This leads to main thread blocking and frame drops.
**Action:** When dealing with high-frequency render loops, aggressively cache heavy computations using `useMemo` tied ONLY to their slow-changing dependencies (e.g., `mentalMap`), so the 60FPS tick only iterates over pre-computed values.
