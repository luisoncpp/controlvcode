
import { describe, it, expect } from "vitest";
import { extractNodes, LLMParser } from "./LLMParser";

describe("extractNodes – replace tag", () => {
  it("extrae un replace tag con old y new (atributos)", () => {
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

  it("aplica unescape a old y new (atributos)", () => {
    const nodes = extractNodes(
      '<replace path="x.ts" old="&amp;lt;" new="&amp;gt;" />'
    );
    expect(nodes[0].content).toBe("&lt;");
    expect(nodes[0].newContent).toBe("&gt;");
  });

  it("extrae replace anidado con old y new", () => {
    const nodes = extractNodes(
      `<replace path="src/App.tsx">
<old>useState(0)</old>
<new>useSignal(0)</new>
</replace>`
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      type: "replace",
      payload: "src/App.tsx",
      content: "useState(0)",
      newContent: "useSignal(0)",
    });
  });

  it("extrae replace anidado con CDATA", () => {
    const nodes = extractNodes(
      `<replace path="src/App.tsx">
<old><![CDATA[<div>Viejo</div>]]></old>
<new><![CDATA[<div>Nuevo & Mejor</div>]]></new>
</replace>`
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].content).toBe("<div>Viejo</div>");
    expect(nodes[0].newContent).toBe("<div>Nuevo & Mejor</div>");
  });

  it("extrae replace anidado con CDATA dentro de un replace", () => {
    const nodes = extractNodes(
      `<replace path="src/App.tsx">
<old><![CDATA[<div>Viejo</div>]]></old>
<new><![CDATA[<div>Nuevo & Mejor<replace path="src/App.tsx"></div>]]></new>
</replace>`
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].content).toBe("<div>Viejo</div>");
    expect(nodes[0].newContent).toBe("<div>Nuevo & Mejor<replace path=\"src/App.tsx\"></div>");
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
