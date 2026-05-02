import { describe, it, expect } from "vitest";
import { extractNodes, LLMParser } from "./LLMParser";

describe("extractNodes – replace tag", () => {
  it("extrae un replace tag con old y new", () => {
    const nodes = extractNodes(
      '<replace path="src/App.tsx" old="useState(0)" new="useSignal(0)" />'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      type: "replace",
      payload: "src/App.tsx",
      content: "useState(0)",
      newContent: "useSignal(0)",
    });
  });

  it("extrae replace con occurrence all", () => {
    const nodes = extractNodes(
      '<replace path="src/App.tsx" old="var" new="let" occurrence="all" />'
    );
    expect(nodes[0].options).toEqual({ occurrence: "all" });
  });

  it("aplica unescape a old y new", () => {
    const nodes = extractNodes(
      '<replace path="x.ts" old="&amp;lt;" new="&amp;gt;" />'
    );
    expect(nodes[0].content).toBe("&lt;");
    expect(nodes[0].newContent).toBe("&gt;");
  });
});

describe("LLMParser.parse – replace tag", () => {
  it("genera ActionNode replace con todos los campos", () => {
    const nodes = LLMParser.parse(
      '<replace path="src/App.tsx" old="a" new="b" />'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("replace");
    expect(nodes[0].payload).toBe("src/App.tsx");
    expect(nodes[0].content).toBe("a");
    expect(nodes[0].newContent).toBe("b");
    expect(nodes[0].status).toBe("pending");
  });
});
