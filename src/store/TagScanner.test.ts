import { describe, it, expect } from "vitest";
import { scanTags, extractNodes, unescapeXml } from "./LLMParser";

describe("unescapeXml (smoke)", () => {
  it("convierte entidades básicas", () => {
    expect(unescapeXml("&lt;div&gt;")).toBe("<div>");
    expect(unescapeXml("&amp;")).toBe("&");
    expect(unescapeXml("&quot;")).toBe('"');
  });
});

describe("scanTags", () => {
  it("extrae un tag simple", () => {
    const tags = scanTags("<cmd>echo hola</cmd>");
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ name: "cmd", content: "echo hola", isSelfClosing: false });
  });

  it("extrae un tag self-closing", () => {
    const tags = scanTags('<tree path="src" />');
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ name: "tree", isSelfClosing: true, content: null });
    expect(tags[0].attributes["path"]).toBe("src");
  });

  it("extrae tag con espacios extra en atributos", () => {
    const tags = scanTags('<file  path="src/main.ts" >contenido</file>');
    expect(tags).toHaveLength(1);
    expect(tags[0].attributes["path"]).toBe("src/main.ts");
    expect(tags[0].content).toBe("contenido");
  });

  it("maneja anidación del mismo tag", () => {
    const text = '<file path="a.txt"><file path="b.txt">inner</file>outer</file>';
    const tags = scanTags(text);
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe("file");
    expect(tags[0].attributes["path"]).toBe("a.txt");
    expect(tags[0].content).toBe('<file path="b.txt">inner</file>outer');
  });

  it("ignora tags dentro de backticks inline", () => {
    const text = "`<cmd>no</cmd>` <cmd>si</cmd>";
    const tags = scanTags(text);
    expect(tags).toHaveLength(1);
    expect(tags[0].content?.trim()).toBe("si");
  });

  it("extrae múltiples tags en orden", () => {
    const text = "<cmd>a</cmd> texto <cmd>b</cmd>";
    const tags = scanTags(text);
    expect(tags).toHaveLength(2);
    expect(tags[0].content).toBe("a");
    expect(tags[1].content).toBe("b");
  });

  it("no extrae tags malformados (sin cierre)", () => {
    const text = "<cmd>sin cerrar";
    const tags = scanTags(text);
    expect(tags).toHaveLength(0);
  });
});

describe("extractNodes con scanTags", () => {
  it("ignora tags desconocidos", () => {
    const nodes = extractNodes('<unknown>texto</unknown> <cmd>real</cmd>');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("cmd");
    expect(nodes[0].payload).toBe("real");
  });

  it("mantiene el orden de aparición", () => {
    const nodes = extractNodes(
      '<cmd>echo segundo</cmd>\n<tree path="src" />\n<cmd>echo primero</cmd>'
    );
    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({ type: "cmd", payload: "echo segundo" });
    expect(nodes[1]).toMatchObject({ type: "tree", payload: "src" });
    expect(nodes[2]).toMatchObject({ type: "cmd", payload: "echo primero" });
  });

  it("aplica unescape a payload y contenido", () => {
    const nodes = extractNodes(
      '<cmd>echo &lt;div&gt;</cmd>'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].payload).toBe('echo <div>');
  });
});
