# ActionVisualizers – Architecture

## 🧠 Purpose
The `ActionVisualizers` module is responsible for rendering detailed, context-specific views of queued actions (e.g., terminal commands, file modifications) before they are executed. It implements the **Strategy Pattern** to dynamically select the appropriate UI component based on the action's type (e.g., replace, patch).

This provides the "Human-in-the-loop" with clear, readable insights into exactly what an action will do before pressing "Ejecutar" (Execute).

---

## 🗂️ File structure

src/components/ActionVisualizers/
  index.tsx               ← Strategy registry, default fallback, and entry point
  ReplaceVisualizer.tsx   ← Specialized visualizer for replace actions
  PatchVisualizer.tsx     ← Specialized visualizer for patch actions

---

## 📄 File responsibilities

### `index.tsx`
**Role**: Public entry point and Strategy registry. Determines which visualizer to render based on `node.type`.

- **DefaultVisualizer**: Acts as the fallback strategy. It takes the ActionNode (excluding execution results to save space), stringifies it, and displays it in a raw, mono-spaced JSON preformatted block.

### `ReplaceVisualizer.tsx`
**Role**: Provides a graphical representation of a replace action.
- **Logic**: Since a replace action only contains the raw content (text to find) and newContent (text to replace it with), this component generates a "fake" git-compatible diff string on the fly using `generateFakeDiff()`.
- **UI**: Wraps the generated diff string and passes it into the external `DiffViewer` component, allowing the user to see exact line additions (green) and deletions (red).

### `PatchVisualizer.tsx`
**Role**: Provides a graphical representation of a patch action.
- **Logic**: Extracts the native diff format already present in `node.content`.
- **UI**: Passes the diff directly to the external `DiffViewer` component.

---

## 🔌 External Dependencies

The `ActionVisualizers` do not communicate with the backend (Tauri) or manage global state. They are pure presentation components.

- **DiffViewer** (`src/components/DiffViewer/`): Used heavily by the file-modification visualizers to render syntax-highlighted code diffs.
- **ActionNode** (`src/types.ts`): The data contract that all visualizers must consume.

---

## 🔄 Rendering Lifecycle

1. [User] Clicks the "Info" (Details) button on an ActionCard in the Queue.
2. [QueueViewer.tsx] Sets the local state `selectedNode` to the clicked action.
3. [ActionDetailsModal.tsx] Mounts and overlays the screen, passing the node to the visualizer wrapper.
4. [ActionVisualizers/index.tsx] Evaluates `node.type`.
   a. If type is 'replace', returns ReplaceVisualizer.
   b. If type is 'patch', returns PatchVisualizer.
   c. If type is unregistered (e.g., 'cmd', 'read'), returns DefaultVisualizer.
5. [Specific Visualizer] Parses the node's payload/content and renders the highly-specific UI.
6. [User] Inspects the action safely and closes the modal to proceed.

---

## 📦 Isolation

- **Open/Closed Principle**: The module is open for extension but closed for modification. Adding a new visualizer (e.g., `CmdVisualizer`) only requires creating a new file and adding one line to the visualizers dictionary in `index.tsx`.
- The visualizers do not mutate the ActionNode data; they strictly read it for display purposes.

---

## 🗺️ Possible extensions

- **ReadVisualizer**: A component that highlights the specific lines a read command will target (using start and end attributes).
- **CmdVisualizer**: A customized terminal-like UI to display the raw payload for shell commands.
- **Syntax Highlighting for Fallback**: Applying basic syntax highlighting to the JSON output in the DefaultVisualizer.
- **Side-by-Side Diff**: Allowing the ReplaceVisualizer to toggle between inline and side-by-side diff views.