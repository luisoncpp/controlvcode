import { describe, it, expect } from "vitest";
import { extractNodes, LLMParser } from "./LLMParser";

// =============================================================================
// extractNodes – read tag
// =============================================================================

describe("extractNodes – read tag", () => {
  it("extrae un read tag sin atributos de linea", () => {
    const nodes = extractNodes('<read path="src/App.tsx" />');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      type: "read",
      payload: "src/App.tsx",
    });
  });

  it("extrae un read tag con start y end", () => {
    const nodes = extractNodes(
      '<read path="src/App.tsx" start="10" end="20" />'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      type: "read",
      payload: "src/App.tsx",
      options: { start: "10", end: "20" },
    });
  });

  it("extrae un read tag solo con line", () => {
    const nodes = extractNodes('<read path="src/App.tsx" line="42" />');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      type: "read",
      payload: "src/App.tsx",
      options: { line: "42" },
    });
  });

  it("extrae un read tag con line y count", () => {
    const nodes = extractNodes(
      '<read path="src/App.tsx" line="5" count="10" />'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      type: "read",
      payload: "src/App.tsx",
      options: { line: "5", count: "10" },
    });
  });

  it("aplica unescape al path de read", () => {
    const nodes = extractNodes('<read path="src/comp&amp;.tsx" />');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].payload).toBe("src/comp&.tsx");
  });

  it("ignora read dentro de backtick inline", () => {
    const nodes = extractNodes('`<read path="x.ts" />`');
    expect(nodes).toHaveLength(0);
  });

  it("ignora read dentro de backtick inline pero extrae otro fuera", () => {
    const nodes = extractNodes(
      '`<read path="fake.ts" />` <read path="real.ts" />'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].payload).toBe("real.ts");
  });

  it("read aparece en mezcla con otros tipos de tags", () => {
    const nodes = extractNodes(
      '<cmd>npm install</cmd>\n' +
      '<read path="src/App.tsx" line="1" count="5" />\n' +
      '<file path="x.ts">hello</file>'
    );
    expect(nodes).toHaveLength(3);
    expect(nodes[0].type).toBe("cmd");
    expect(nodes[1].type).toBe("read");
    expect(nodes[1].payload).toBe("src/App.tsx");
    expect(nodes[1].options).toEqual({ line: "1", count: "5" });
    expect(nodes[2].type).toBe("file");
  });
});

// =============================================================================
// LLMParser.parse – read tag
// =============================================================================

describe("LLMParser.parse – read tag", () => {
  it("genera un ActionNode de tipo read con options", () => {
    const nodes = LLMParser.parse(
      '<read path="src/App.tsx" start="10" end="20" />'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("read");
    expect(nodes[0].payload).toBe("src/App.tsx");
    expect(nodes[0].options).toEqual({ start: "10", end: "20" });
    expect(nodes[0].status).toBe("pending");
    expect(nodes[0].result).toBeNull();
    expect(nodes[0].id).toBeTruthy();
  });

  it("genera un ActionNode read sin options", () => {
    const nodes = LLMParser.parse('<read path="README.md" />');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("read");
    expect(nodes[0].payload).toBe("README.md");
    expect(nodes[0].options).toBeUndefined();
  });

  it("genera ids unicos entre reads y otros tipos", () => {
    const nodes = LLMParser.parse(
      '<cmd>a</cmd><read path="x" /><read path="y" />'
    );
    const ids = nodes.map(n => n.id);
    expect(new Set(ids).size).toBe(3);
  });
});
