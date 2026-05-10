
# ReferenceResolver – Architecture

## 🧠 Purpose
`ReferenceResolver` is responsible for automatically discovering and attaching file dependencies referenced inside user-attached files via the `@filepath` syntax. To ensure robust performance and system stability, it implements a Breadth-First Search (BFS) algorithm to prevent infinite loops caused by cyclic dependencies (e.g., File A references File B, which references File A) and uses an in-memory caching mechanism to minimize redundant I/O operations against the disk.

The implementation is designed as a pure, dependency-injected module within the `PromptBuilder` domain, making it completely agnostic to the underlying runtime (Tauri or Browser) and highly testable.

---

## 🗂️ File structure


```

src/
├── components/
│   ├── PromptBuilder/
│   │   ├── PromptBuilder.ts               ← Integration point, maintains state and I/O cache
│   │   ├── ReferenceResolver/
│   │   │   ├── index.ts                   ← Barrel export
│   │   │   ├── extractor.ts               ← Pure regex parsing logic
│   │   │   ├── ReferenceResolver.ts       ← BFS traversal and dependency resolution
│   │   │   └── ReferenceResolver.test.ts  ← Unit tests (cycles, missing files)

```

---

## 📄 File responsibilities

### `extractor.ts`
- **Role**: Pure function responsible for scanning a string (file content) and extracting all valid paths mentioned after an `@` symbol.
- **Details**: Uses a targeted regex (`/@([a-zA-Z0-9_./\-]+)/g`). Cleans up trailing punctuation (like periods at the end of a sentence) to avoid false-positive invalid paths.

### `ReferenceResolver.ts`
- **Role**: The core traversal engine. 
- **Details**: 
  - Maintains a `visitedFiles` Set to guarantee no file is processed twice.
  - Maintains a `processingQueue` array for BFS.
  - Accepts a `readFileProvider: (filePath: string) => Promise<string>` delegate. This inversion of control prevents the module from being tightly coupled to Tauri's `invoke` API, allowing unit tests to provide mock file systems seamlessly.
  - Silently catches and ignores missing files so the rest of the BFS process does not crash.

### `PromptBuilder.ts` (Integration)
- **Role**: The UI state manager that connects user interactions with the `ReferenceResolver`.
- **Details**:
  - Implements an ephemeral `Map<string, string>` as an I/O cache. This ensures that even if `ReferenceResolver` requests a file's content during the BFS traversal, and later `PromptBuilder` requests it again to attach it to the payload, the Tauri backend (Rust) is only called *once* per unique file.
  - Adds a layer of protection for test mocks (`undefined` check) to prevent mock exhaustion.

---

## 🔄 Object lifecycle & data flow


```

User selects file 'A'
│
▼
PromptBuilder.attachFile('A')
│
├──► Initialize I/O Cache (Map)
├──► readFileProvider('A') ──────► Cache Miss ─► Tauri `invoke`
│
▼
resolveAllDependencies(['A'], readFileProvider)
│
├──► BFS Queue: ['A']
│
├──► Process 'A'
│       ├──► extractFileMentions(contentA) ─► returns ['B', 'C']
│       └──► Queue: ['B', 'C']
│
├──► Process 'B'
│       ├──► readFileProvider('B') ─► Cache Miss ─► Tauri `invoke`
│       ├──► extractFileMentions(contentB) ─► returns ['A']
│       └──► 'A' is in VisitedSet -> Ignored (Cycle prevented)
│
├──► Process 'C'
│       └──► ...
│
▼
Returns unique array: ['A', 'B', 'C']
│
▼
attachMultipleFiles(['A', 'B', 'C'], readFileProvider)
│
└──► Retrieves content from Cache (No disk I/O cost)
└──► Appends to `attachedFiles` signal

```

---

## 🔗 Dependencies

### Internal

```

ReferenceResolver.ts  → extractor.ts
PromptBuilder.ts      → ReferenceResolver/index.ts

```

### External

```

PromptBuilder.ts      → @tauri-apps/api/core (invoke)
PromptBuilder.ts      → @preact/signals (signal)

```

---

## 🧪 Test coverage

| File | Focus |
|---|---|
| `ReferenceResolver.test.ts` | Regex extraction (single/multiple), exact match (no trailing dots), BFS cycle prevention (`A -> B -> A`), graceful missing file fallback. |
| `PromptBuilder.test.ts` | Auto-attaching flows, UI state resets, cache validation, missing file handling. |

---

## 🗺️ Extension points

- **Relative Paths**: Currently, paths are resolved exactly as written (`@src/main.ts`). If relative path support is needed (`@./Button.tsx`), the `extractor.ts` output would need to be combined with the origin file's path before being pushed to the BFS queue.
- **Deep Nesting Limits**: If projects get incredibly large, a maximum depth variable could be added to the BFS state to avoid resolving the entire project indirectly.
