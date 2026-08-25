## 2024-05-24 - [React Render Starvation with 60FPS Physics Loop]
**Learning:** The application features a 60FPS physics loop in `App.jsx` that frequently updates global state (`robotState`). The entire component tree was re-rendering 60 times per second, causing render starvation. Pure UI or computationally heavy child components (like SVG canvases in `WiringCanvas`) that do not depend on the fast-changing state must be wrapped in `React.memo()` to prevent unnecessary re-renders.
**Action:** When implementing heavy visual components in a physics-based simulation architecture, always separate the fast-changing state from the static UI and use `React.memo()` to isolate updates.

## 2024-06-21 - [Heavy Synchronous Parsing in High-Frequency Render Loops]
**Learning:** Parsing JSON and evaluating multiple regular expressions inside a `useEffect` that is tied to a 60FPS physics loop (like `robotState`) causes significant thread starvation. The mental map strings from the AI backend were being parsed on every single frame, even though the map only updates occasionally.
**Action:** Always extract heavy parsing operations into a `useMemo` block that is tied only to the slow-changing dependency (e.g., `mentalMap`), preventing the expensive logic from running 60 times a second during the main physics render loop.
