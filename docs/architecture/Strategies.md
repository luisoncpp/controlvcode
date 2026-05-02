# Strategies – Architecture

## 🧠 Purpose
The Strategy pattern decouples the execution logic of different XML tags (`<cmd>`, `<file>`, `<tree>`, `<read>`, `<replace>`) from the `ExecutionStore` orchestrator. 

Instead of a static `if-else` chain, the Store delegates execution to a registry of `ActionStrategy` implementations. This enforces the Open/Closed Principle: adding a new command requires creating a new strategy file and registering it, without touching the Store.

---

## 🗂️ File structure

```
src/store/Strategies/
├── types.ts                 ← ActionStrategy interface
├── index.ts                 ← Strategy registry (defaultStrategies)
├── CmdStrategy.ts           ← Tauri invoke wrapper for shell commands
├── FileStrategy.ts          ← Tauri invoke wrapper for file writing
├── TreeStrategy.ts          ← Tauri invoke wrapper for directory listing
├── ReadStrategy.ts          ← File reading + line formatting logic
├── ReadStrategy.test.ts     ← Tests for ReadStrategy
├── ReplaceStrategy.ts       ← Text replacement logic
└── ReplaceStrategy.test.ts  ← Tests for ReplaceStrategy
```

---

## 🧩 The Strategy Interface

```typescript
// src/store/Strategies/types.ts
import { ActionNode, ExecutionResult } from '../../types';

export interface ActionStrategy {
  execute(node: ActionNode): Promise<ExecutionResult>;
}
```

Every strategy receives a raw `ActionNode` and is responsible for:
1. Extracting and parsing its specific `options` or `content` from the node.
2. Calling the corresponding backend (Tauri `invoke`) or internal logic.
3. Returning a uniform `ExecutionResult` object (`{ stdout, stderr, exitCode }`).

---

## 🗄️ The Registry

```typescript
// src/store/Strategies/index.ts
export const defaultStrategies: Record<ActionType, ActionStrategy> = {
  cmd: new CmdStrategy(),
  file: new FileStrategy(),
  tree: new TreeStrategy(),
  read: new ReadStrategy(),
  replace: new ReplaceStrategy(),
};
```

- **Single Source of Truth**: Only `index.ts` knows which strategies exist.
- **Type-Safe**: TypeScript enforces that a strategy exists for every `ActionType`.
- **No Runtime Registration**: Strategies are statically mapped. This keeps the production wiring zero-density (no factories or dynamic loaders).

---

## 🔌 The Seam (Dependency Injection)

To enable isolated unit testing of `ExecutionStore` without mocking Tauri or the file system, the strategy map is injected via an optional constructor parameter:

```typescript
// ExecutionStore.ts
export class ExecutionStore {
  private strategies: Record<string, ActionStrategy>;
  
  constructor(customStrategies?: Record<string, ActionStrategy>) {
    this.strategies = customStrategies ?? defaultStrategies;
  }
  // ...
}
```

- **Production**: `new ExecutionStore()` uses `defaultStrategies`.
- **Tests**: `new ExecutionStore({ cmd: mockCmd })` injects mocks seamlessly.

---

## 🔄 Data flow

```
ExecutionStore.executeNode(index)
        │
        ├── const strategy = this.strategies[node.type]
        │
        ├── strategy.execute(node)
        │       │
        │       ├── CmdStrategy      → invoke('execute_bash_command')
        │       ├── FileStrategy     → invoke('write_file')
        │       ├── TreeStrategy     → invoke('list_directory')
        │       ├── ReadStrategy     → invoke('read_file_with_line_numbers') + format
        │       └── ReplaceStrategy  → invoke('replace_in_file') + format
        │
        ▼
  ExecutionResult { stdout, stderr, exitCode }
        │
        ▼
  Updates ActionNode.status and ActionNode.result
```

---

## 🗺️ How to add a new strategy

1. **Define the tag**: Add the new type to `ActionType` in `src/types.ts`.
2. **Implement the strategy**: Create `src/store/Strategies/NewStrategy.ts` implementing `ActionStrategy`. Handle `node.options`, call Tauri, and return `ExecutionResult`.
3. **Register it**: Add `newType: new NewStrategy()` to `defaultStrategies` in `src/store/Strategies/index.ts`.
4. **Parse it**: Add the extraction logic in `LLMParserPrivate/extractor.ts`.
5. **Backend**: Add the corresponding Tauri command in `src-tauri/src/lib.rs`.

No changes are required in `ExecutionStore.ts`.

---

## 🧪 Test coverage

| File | Tests | Focus |
|---|---|---|
| `ReadStrategy.test.ts` | 7 | Backend calls, line options parsing, line formatting |
| `ReplaceStrategy.test.ts` | 2 | Backend calls, occurrence handling |
| **Total** | **9** | |

---

> *Strategies keep execution logic localized and testable. The Store orchestrates; the Strategies execute.*
