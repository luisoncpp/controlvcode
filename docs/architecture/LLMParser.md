# LLMParser – Architecture

## 🧠 Purpose
`LLMParser` transforms raw text (typically an LLM response) into a queue of executable `ActionNode` objects. It recognises three types of XML tags – `<cmd>`, `<file>`, and `<tree>` – while respecting inline backtick-protected spans and XML entity escaping.

The implementation is split into a public facade (`LLMParser.ts`) and a private implementation directory (`LLMParserPrivate/`) that no other module may import directly.

---

## 🗂️ File structure

```
src/store/
  LLMParser.ts                    ← Public facade (re-exports internals for tests)
  LLMParserPrivate/
    types.ts                      ← Shared types (Range, RawTag, ExtractedNode)
    unescapeXml.ts                ← XML entity decoder
    backtickRanges.ts             ← Inline backtick range detector
    scanner.ts                    ← Generic XML tag scanner
    extractor.ts                  ← Tag → ExtractedNode converter
```

---

## 📄 File responsibilities

### `LLMParser.ts` (public facade)

- **Role**: Single entry point for the rest of the application and for unit tests.
- Exports:
  - The `LLMParser` class with a static `parse(rawText: string): ActionNode[]` method.
  - All previously public pure functions (`unescapeXml`, `getInlineBacktickRanges`, `scanTags`, `extractNodes`) **re-exported** from the private modules so existing tests continue to work.
- Does **not** contain any parsing logic itself – only the private imports and the `parse` pipeline:
  1. `extractNodes(rawText)` → produces plain `ExtractedNode[]`.
  2. Maps each `ExtractedNode` into an `ActionNode` with a random UUID, `status: 'pending'`, and `result: null`.

### `LLMParserPrivate/types.ts`

- Defines three interfaces shared across the private modules:
  - `Range`: `{ start, end }` – used by backtick protection.
  - `RawTag`: structure produced by the scanner (`name`, `attributes`, `content`, `isSelfClosing`, `startIndex`, `endIndex`).
  - `ExtractedNode`: normalised node (`type`, `payload`, optional `content`) ready for consumption.

### `LLMParserPrivate/unescapeXml.ts`

- **Pure function** `unescapeXml(text: string): string`.
- Reverses the XML entities commonly emitted by LLMs:
  - `&lt;` → `<`
  - `&gt;` → `>`
  - `&amp;` → `&`
  - `&quot;` → `"`
- **Order matters**: `&` is replaced **last** to avoid corrupting compound entities like `&lt;`.

### `LLMParserPrivate/backtickRanges.ts`

- **Pure function** `getInlineBacktickRanges(text: string): Range[]`.
- Scans the raw text and returns intervals covered by:
  - Inline single-backtick spans (`` `code` ``).
  - Triple-backtick fenced blocks (``` ``` ```), which are skipped entirely (not tracked as protected ranges, but the scanner later advances past them).
- Used by `scanTags` to know where tags **must not** be parsed.

### `LLMParserPrivate/scanner.ts`

- **Core function** `scanTags(rawText: string): RawTag[]`.
- Implements a character-by-character XML parser that is tolerant to malformed markup.
- Algorithm:
  1. Obtain protected ranges via `getInlineBacktickRanges`.
  2. Walk the string; skip any position inside a protected range.
  3. When `<` is found, attempt to parse a tag name.
  4. Parse attributes (handling both single and double quotes).
  5. If self-closing (`/>`), record a `RawTag` with `isSelfClosing: true`.
  6. Otherwise, search for the matching closing tag, counting nesting depth.
  7. Content between opening and closing tag is captured as-is (without the closing tag itself).
- Private helpers (`skipProtected`, `parseName`, `parseAttributes`) are extracted to keep the main loop readable.

### `LLMParserPrivate/extractor.ts`

- **Function** `extractNodes(rawText: string): ExtractedNode[]`.
- Calls `scanTags` and converts recognised tag names to `ExtractedNode` objects:
  - `<cmd>content</cmd>` → `{ type: 'cmd', payload: unescapeXml(content.trim()) }`
  - `<file path="...">content</file>` → `{ type: 'file', payload: unescapeXml(path), content: unescapeXml(content) }`
  - `<tree path="..." />` → `{ type: 'tree', payload: unescapeXml(path) }`
- Unknown tags are silently ignored, making the system extensible.

---

## 🔄 Object lifecycle & data flow

```
rawText (string)
        │
        ▼
  extractNodes(rawText)                ← public facade calls this
        │
        ├──► getInlineBacktickRanges   (inside scanner)
        ├──► scanTags                  (inside extractor)
        │       │
        │       └──► skipProtected
        │            parseName, parseAttributes
        │
        └──► for each RawTag:
                switch tag.name:
                  'cmd'  → ExtractedNode { type:'cmd', payload }
                  'file' → ExtractedNode { type:'file', payload, content }
                  'tree' → ExtractedNode { type:'tree', payload }
        │
        ▼
  LLMParser.parse(rawText)
        │
        └──► extractNodes(rawText).map(node => ({
               id: crypto.randomUUID(),
               type: node.type,
               payload: node.payload,
               content: node.content,
               status: 'pending',
               result: null
             }))
        │
        ▼
  ActionNode[]  (consumed by ExecutionStore)
```

1. The calling code invokes `LLMParser.parse(rawText)`.
2. `parse` delegates to `extractNodes`, which coordinates `scanTags` and `unescapeXml`.
3. `scanTags` first builds protected ranges via `getInlineBacktickRanges` and then extracts raw tags.
4. `extractNodes` converts each recognised `RawTag` into an `ExtractedNode`, applying unescaping.
5. `parse` enriches each `ExtractedNode` into a full `ActionNode` with identity and execution metadata.

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
                 → LLMParserPrivate/unescapeXml.ts
                 → LLMParserPrivate/backtickRanges.ts
                 → LLMParserPrivate/scanner.ts
                 → LLMParserPrivate/extractor.ts
```

- No other module in the application may import from `LLMParserPrivate/`. The only consumers are `LLMParser.ts` and the test files (which continue to import the re-exported symbols from `LLMParser.ts`).

### External

- `crypto.randomUUID()` (browser API) for generating unique action IDs.
- No Tauri, React, or signal dependencies – the parser is fully synchronous and framework-agnostic.

---

## 🧪 Test coverage

Two test files validate the parser:

- `LLMParser.test.ts` (44 tests): covers `unescapeXml`, `getInlineBacktickRanges`, `extractNodes`, and the `LLMParser.parse` pipeline.
- `TagScanner.test.ts` (11 tests): additional smoke tests for `scanTags` and `unescapeXml`.

Both files import exclusively from `LLMParser.ts`, ensuring the public API remains the single source of truth.

---

## 🗺️ Extension points

- **New tag types**: Add a `case` in `extractor.ts` and optionally a corresponding `ActionNode['type']` in the public types.
- **Additional escaping rules**: Extend `unescapeXml.ts` with new entities as needed.
- **Custom backtick protection**: Modify `getInlineBacktickRanges` if new markdown constructs need to be skipped.

---

> *LLMParser is the bridge between raw LLM text and executable actions. Its layered design keeps the public contract stable while allowing each internal concern to evolve independently.*
