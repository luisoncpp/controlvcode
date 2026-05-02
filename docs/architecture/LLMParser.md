# LLMParser – Architecture

## 🧠 Purpose
`LLMParser` transforms raw text (typically an LLM response) into a queue of executable `ActionNode` objects. It recognises five types of XML tags – `<cmd>`, `<file>`, `<tree>`, `<read>`, and `<replace>` – while respecting inline backtick-protected spans and XML entity escaping.

The implementation is split into a public facade (`LLMParser.ts`) and a private implementation directory (`LLMParserPrivate/`) that no other module may import directly. Execution logic for each tool lives in `src/store/Commands/`.

---

## 🗂️ File structure

```
src/
├── types.ts                         ← Action types, ActionNode, ExecutionResult
├── store/
│   ├── ExecutionStore.ts            ← Orchestrates parsing & execution
│   ├── LLMParser.ts                 ← Public facade (re-exports internals for tests)
│   ├── LLMParserPrivate/
│   │   ├── types.ts                 ← Shared types (Range, RawTag, ExtractedNode)
│   │   ├── unescapeXml.ts           ← XML entity decoder
│   │   ├── backtickRanges.ts        ← Inline backtick range detector
│   │   ├── scanner.ts               ← Generic XML tag scanner
│   │   └── extractor.ts             ← Tag → ExtractedNode converter
│   └── Commands/
│       ├── readCommand.ts           ← executeRead + line number formatting
│       ├── readCommand.test.ts
│       ├── replaceCommand.ts        ← executeReplace (text substitution)
│       └── replaceCommand.test.ts
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
- **Backend**: `execute_bash_command` (wraps `cmd.exe /C` with UTF-8 codepage)
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
- **Backend**: `write_file` (creates parent dirs, overwrites)
- **Result**: confirmation message in `stdout`

### `<tree>` — List directory structure

```xml
<tree path="src/components" />
```

- **Extracted as**: `{ type: 'tree', payload: 'src/components' }`
- **Backend**: `list_directory` (recursive, ignores `.git`, `node_modules`, etc.)
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
- **Frontend command**: `executeRead(path, options)` — resolves line options, calls backend, formats with `cat -n` style numbering
- **Backend**: `read_file_with_line_numbers` — reads file, validates line range, returns raw content
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
- **Frontend command**: `executeReplace(path, oldStr, newStr, options)` — invokes backend, returns summary
- **Backend**: `replace_in_file` — reads file, checks for `old_str` existence, replaces first or all occurrences, writes back
- **Result**: `Replaced 1 occurrence(s) in src/App.tsx.`

---

## 📄 File responsibilities

### `LLMParser.ts` (public facade)
- **Role**: Single entry point for the rest of the application and for unit tests.
- Exports the `LLMParser` class with `parse(rawText)` and re-exports all pure functions for testing.
- The `parse` pipeline: `extractNodes` → map each `ExtractedNode` to `ActionNode` with UUID, `status: 'pending'`, `result: null`.

### `LLMParserPrivate/types.ts`
Shared interfaces: `Range`, `RawTag`, `ExtractedNode` (now supports `newContent` and `options`).

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
1. `processInput(text)` — parses via `LLMParser.parse`
2. `executeNode(index)` — dispatches based on `node.type`:
   - `cmd` → `invoke('execute_bash_command')`
   - `file` → `invoke('write_file')`
   - `tree` → `invoke('list_directory')`
   - `read` → `executeRead()` (frontend command)
   - `replace` → `executeReplace()` (frontend command)
3. Updates `node.status` and `node.result`, triggers auto-copy of feedback XML.

### `Commands/readCommand.ts`
- `executeRead(path, options)`: resolves `line`/`count` or `start`/`end`, calls `read_file_with_line_numbers` via Tauri, formats output with 5-digit line numbers.

### `Commands/replaceCommand.ts`
- `executeReplace(path, oldStr, newStr, options)`: calls `replace_in_file` via Tauri with `all: boolean`, returns human-readable summary.

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
        ├── type 'cmd'     → invoke('execute_bash_command')
        ├── type 'file'    → invoke('write_file')
        ├── type 'tree'    → invoke('list_directory')
        ├── type 'read'    → executeRead() → invoke('read_file_with_line_numbers')
        ├── type 'replace' → executeReplace() → invoke('replace_in_file')
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

### Commands

```
readCommand.ts    → @tauri-apps/api/core
replaceCommand.ts → @tauri-apps/api/core
```

### Store

```
ExecutionStore.ts → LLMParser.ts
                  → Commands/readCommand.ts
                  → Commands/replaceCommand.ts
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
| `readCommand.test.ts` | 9 | `executeRead` backend calls and line formatting |
| `replaceCommand.test.ts` | 2 | `executeReplace` backend calls |
| **Total** | **96** | |

---

## 🗺️ Extension points

- **New tag type**: Add a `case` in `extractor.ts`, a command in `Commands/`, a Tauri command in `lib.rs`, a dispatch branch in `ExecutionStore.ts`, and a test file.
- **Additional escaping rules**: Extend `unescapeXml.ts`.
- **Custom backtick protection**: Modify `getInlineBacktickRanges`.
- **New shell support**: Add a shell selector in settings and branch in `execute_bash_command`.

---

> *LLMParser is the bridge between raw LLM text and executable actions. Its layered design keeps the public contract stable while allowing each internal concern and tool to evolve independently.*
