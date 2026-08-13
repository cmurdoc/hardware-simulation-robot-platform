## 2024-05-24 - React.memo for Canvas Component in Physics Loop
**Learning:** The physics loop state (`robotState`) is hoisted to `App.jsx` and updated via `requestAnimationFrame` up to 60 times a second while `simulationRunning` is true. This causes all children, including the heavy SVG `WiringCanvas`, to re-render constantly even if their props haven't changed.
**Action:** Use `React.memo` on pure UI or heavy rendering components (like `WiringCanvas`) to prevent severe render starvation when sibling/parent state (like real-time physics data) updates frequently.
