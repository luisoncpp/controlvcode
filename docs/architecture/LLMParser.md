# LLMParser – Architecture

## 🧠 Purpose
`LLMParser` transforms raw text (typically an LLM response) into a queue of executable `ActionNode` objects. It recognises five types of XML tags – `<cmd>`, `<file>`, `<tree>`, `<read>`, and `<replace>` – while respecting inline backtick-protected spans and XML entity escaping.

The implementation is split into a public facade (`LLMParser.ts`) and a private implementation directory (`LLMParserPrivate/`) that no other module may import directly. Execution logic for each tool lives in `src/store/Strategies/`.

---

## 🗂️ File structure

```
src/
├── types.ts                         ← Action types, ActionNode, ExecutionResult
├── store/
│   ├── ExecutionStore.ts            ← Orchestrates parsing & execution (via Strategies)
│   ├── LLMParser.ts                 ← Public facade (re-exports internals for tests)
│   ├── LLMParserPrivate/
│   │   ├── types.ts                 ← Shared types (Range, RawTag, ExtractedNode)
│   │   ├── unescapeXml.ts           ← XML entity decoder
│   │   ├── backtickRanges.ts        ← Inline backtick range detector
│   │   ├── scanner.ts               ← Generic XML tag scanner
│   │   └── extractor.ts             ← Tag → ExtractedNode converter
│   └── Strategies/
│       ├── types.ts                 ← ActionStrategy interface
│       ├── index.ts                 ← Strategy registry (defaultStrategies)
│       ├── CmdStrategy.ts           ← Shell command execution
│       ├── FileStrategy.ts          ← File writing execution
│       ├── TreeStrategy.ts          ← Directory listing execution
│       ├── ReadStrategy.ts          ← File reading + line number formatting
│       ├── ReplaceStrategy.ts       ← Text replacement execution
│       ├── ReadStrategy.test.ts
│       └── ReplaceStrategy.test.ts
src-tauri/src/
    └── lib.rs                       ← Tauri commands (read_file_with_line_numbers, replace_in_file, …)
```

---

## 🏷️ Supported tags

### `<cmd>` — Execute a terminal command

```xml
<cmd>npm install preact</cmd>
```

- **Extracted as**: `{ type: 'cmd', payload: 'npm install preact' }`
- **Strategy**: `CmdStrategy` → `invoke('execute_bash_command')` (wraps `cmd.exe /C` with UTF-8 codepage)
- **Result**: `ExecutionResult` with `stdout`, `stderr`, `exitCode`

### `<file>` — Write a file

```xml
<file path="src/Component.tsx">
export function Hello() {
  return <div>Hi</div>;
}
</file>
```

- **Extracted as**: `{ type: 'file', payload: 'src/Component.tsx', content: 'export function…' }`
- **Strategy**: `FileStrategy` → `invoke('write_file')` (creates parent dirs, overwrites)
- **Result**: confirmation message in `stdout`

### `<tree>` — List directory structure

```xml
<tree path="src/components" />
```

- **Extracted as**: `{ type: 'tree', payload: 'src/components' }`
- **Strategy**: `TreeStrategy` → `invoke('list_directory')` (recursive, ignores `.git`, `node_modules`, etc.)
- **Result**: tree-formatted output in `stdout`

### `<read>` — Read a file with line numbers

```xml
<!-- Read entire file -->
<read path="src/App.tsx" />

<!-- Read lines 10 to 25 -->
<read path="src/App.tsx" start="10" end="25" />

<!-- Read only line 42 -->
<read path="src/App.tsx" line="42" />

<!-- Read 15 lines starting at line 30 -->
<read path="src/App.tsx" line="30" count="15" />
```

- **Extracted as**: `{ type: 'read', payload: 'src/App.tsx', options: { start, end, line, count } }`
- **Strategy**: `ReadStrategy` — resolves `line`/`count` or `start`/`end` options, calls `invoke('read_file_with_line_numbers')`, formats output with `cat -n` style numbering.
- **Result**: numbered lines in `stdout`:
  ```
      1  import { h } from 'preact';
      2  
      3  export function App() {
  ```

### `<replace>` — Surgical text replacement

```xml
<!-- Replace first occurrence -->
<replace path="src/App.tsx" old="useState(0)" new="useSignal(0)" />

<!-- Replace all occurrences -->
<replace path="src/utils.ts" old="var " new="let " occurrence="all" />
```

- **Extracted as**: `{ type: 'replace', payload: 'src/App.tsx', content: 'useState(0)', newContent: 'useSignal(0)', options?: { occurrence: 'all' } }`
- **Strategy**: `ReplaceStrategy` — calls `invoke('replace_in_file')` with `all: boolean`, returns human-readable summary.
- **Result**: `Replaced 1 occurrence(s) in src/App.tsx.`

---

## 📄 File responsibilities

### `LLMParser.ts` (public facade)
- **Role**: Single entry point for the rest of the application and for unit tests.
- Exports the `LLMParser` class with `parse(rawText)` and re-exports all pure functions for testing.
- The `parse` pipeline: `extractNodes` → map each `ExtractedNode` to `ActionNode` with UUID, `status: 'pending'`, `result: null`.

### `LLMParserPrivate/types.ts`
Shared interfaces: `Range`, `RawTag`, `ExtractedNode` (supports `newContent` and `options`).

### `LLMParserPrivate/unescapeXml.ts`
Reverses XML entities: `<` → `<`, `>` → `>`, `&` → `&`, `"` → `"`.  
**Order matters**: `&` is replaced last to avoid corrupting compound entities.

### `LLMParserPrivate/backtickRanges.ts`
Detects inline backtick spans and triple-backtick fenced blocks. Tags inside these ranges are ignored by the scanner.

### `LLMParserPrivate/scanner.ts`
Character-by-character XML parser that produces `RawTag[]`. Handles nesting, self-closing tags, attributes with single/double quotes, and malformed input gracefully.

### `LLMParserPrivate/extractor.ts`
Converts `RawTag[]` to `ExtractedNode[]` via a `switch` on tag name. Applies `unescapeXml` to all payloads and contents. New tools are added here as new `case` branches.

### `ExecutionStore.ts`
Orchestrates the full lifecycle:
1. `processInput(text)` — parses via `LLMParser.parse`.
2. `executeNode(index)` — delegates to the Strategy pattern: looks up `this.strategies[node.type]` and calls `strategy.execute(node)`. (See `Strategies.md` for details).
3. Updates `node.status` and `node.result`, triggers auto-copy of feedback XML.

### `Strategies/ReadStrategy.ts`
Implements `ActionStrategy`. Parses `start`/`end`/`line`/`count` from `node.options`, calls `read_file_with_line_numbers` via Tauri, formats output with 5-digit line numbers.

### `Strategies/ReplaceStrategy.ts`
Implements `ActionStrategy`. Calls `replace_in_file` via Tauri with `all: boolean` based on `node.options.occurrence`, returns summary.

---

## 🔄 Object lifecycle & data flow

```
rawText (string)
        │
        ▼
  extractNodes(rawText)
        │
        ├──► getInlineBacktickRanges   (inside scanner)
        ├──► scanTags                  (inside extractor)
        │       │
        │       └──► skipProtected, parseName, parseAttributes
        │
        └──► for each RawTag:
                switch tag.name → ExtractedNode
        │
        ▼
  LLMParser.parse(rawText)
        │
        └──► extractNodes(rawText).map(node => ActionNode)
        │
        ▼
  ExecutionStore.executeNode(index)
        │
        ├──► this.strategies[node.type].execute(node)
        │       │
        │       ├── CmdStrategy      → invoke('execute_bash_command')
        │       ├── FileStrategy     → invoke('write_file')
        │       ├── TreeStrategy     → invoke('list_directory')
        │       ├── ReadStrategy     → invoke('read_file_with_line_numbers')
        │       └── ReplaceStrategy  → invoke('replace_in_file')
        │
        ▼
  ActionNode.result  →  UI displays stdout/stderr
```

---

## 🔗 Dependencies

### Internal (within `LLMParserPrivate`)

```
unescapeXml.ts   (no dependencies)
backtickRanges.ts → types.ts
scanner.ts       → types.ts, backtickRanges.ts
extractor.ts     → types.ts, scanner.ts, unescapeXml.ts
```

### Public facade

```
LLMParser.ts     → ../types (ActionNode)
                 → LLMParserPrivate/*
```

### Strategies

```
types.ts           (no dependencies)
CmdStrategy.ts     → @tauri-apps/api/core
FileStrategy.ts    → @tauri-apps/api/core
TreeStrategy.ts    → @tauri-apps/api/core
ReadStrategy.ts    → @tauri-apps/api/core
ReplaceStrategy.ts → @tauri-apps/api/core
index.ts           → All strategies, ../types
```

### Store

```
ExecutionStore.ts → LLMParser.ts
                  → Strategies/index.ts (defaultStrategies)
                  → Strategies/types.ts (ActionStrategy)
```

- No other module may import from `LLMParserPrivate/`. Tests import re-exported symbols from `LLMParser.ts`.

---

## 🧪 Test coverage

| File | Tests | Focus |
|---|---|---|
| `LLMParser.test.ts` | 44 | Backtick ranges, unescape, extractNodes, parse pipeline |
| `TagScanner.test.ts` | 11 | Scanner smoke tests |
| `LLMParserRead.test.ts` | 11 | `<read>` tag extraction and ActionNode generation |
| `LLMParserReplace.test.ts` | 4 | `<replace>` tag extraction and ActionNode generation |
| `ReadStrategy.test.ts` | 7 | `ReadStrategy` backend calls and line formatting |
| `ReplaceStrategy.test.ts` | 2 | `ReplaceStrategy` backend calls |
| **Total** | **94** | |

---

## 🗺️ Extension points

- **New tag type**: Add a `case` in `extractor.ts`, a strategy in `Strategies/` (register in `index.ts`), a Tauri command in `lib.rs`, and a test file. No changes needed in `ExecutionStore.ts`.
- **Additional escaping rules**: Extend `unescapeXml.ts`.
- **Custom backtick protection**: Modify `getInlineBacktickRanges`.
- **New shell support**: Add a shell selector in settings and branch in `execute_bash_command`.

---

> *LLMParser is the bridge between raw LLM text and executable actions. Its layered design keeps the public contract stable while allowing each internal concern and tool to evolve independently.*
