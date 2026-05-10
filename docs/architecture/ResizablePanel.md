
# ResizablePanel

Deep module that provides a horizontally resizable sidebar panel with compact mode support.

## Responsibilities
- Handle mouse-based drag resizing with visual feedback.
- Persist user-preferred width to `localStorage`.
- Toggle between **compact** (<180px, icon-only) and **expanded** modes based on width.

## Interface
- `children: (isCompact: boolean) => JSX.Element` — render prop receiving compact state.

## Key Behaviors
- **Drag handle**: 1px wide divider on the right edge. Hover/active states use blue accent.
- **Bounds**: Min 60px, max 600px, default 350px.
- **Cleanup**: Removes global mouse listeners and resets body cursor/user-select on unmount.

## Dependencies
- Preact `Component` (class-based, no hooks).
- No external project dependencies.
