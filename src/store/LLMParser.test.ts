import { describe, it, expect } from "vitest";
import { LLMParser, extractNodes, getInlineBacktickRanges, unescapeXml } from "./LLMParser";

// =============================================================================
// getInlineBacktickRanges
// =============================================================================

describe("getInlineBacktickRanges", () => {
  it("detecta un backtick inline simple", () => {
    const ranges = getInlineBacktickRanges("usa `npm install` para instalar");
    expect(ranges).toHaveLength(1);
    expect(ranges[0]).toEqual({ start: 4, end: 17 });
  });

  it("detecta multiples backticks inline", () => {
    const ranges = getInlineBacktickRanges("`a` y `b` y `c`");
    expect(ranges).toHaveLength(3);
    expect(ranges[0]).toEqual({ start: 0, end: 3 });
    expect(ranges[1]).toEqual({ start: 6, end: 9 });
    expect(ranges[2]).toEqual({ start: 12, end: 15 });
  });

  it("ignora bloques markdown triple-backtick", () => {
    const text = "```\ncodigo\n```";
    const ranges = getInlineBacktickRanges(text);
    expect(ranges).toHaveLength(0);
  });

  it("ignora backticks inline dentro de bloques markdown", () => {
    const text = "```js\n`inline`\n```";
    const ranges = getInlineBacktickRanges(text);
    expect(ranges).toHaveLength(0);
  });

  it("detecta backtick inline fuera de bloque markdown", () => {
    const text = "fuera `inline` ```bloque``` mas `otro`";
    const ranges = getInlineBacktickRanges(text);
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ start: 6, end: 14 });
    expect(ranges[1]).toEqual({ start: 32, end: 38 });
  });

  it("maneja backtick sin cierre (ignora, no crashea)", () => {
    const ranges = getInlineBacktickRanges("texto `sin cerrar");
    expect(ranges).toHaveLength(0);
  });

  it("maneja backticks vacios", () => {
    const ranges = getInlineBacktickRanges("`` vacio ``");
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ start: 0, end: 2 });
    expect(ranges[1]).toEqual({ start: 9, end: 11 });
  });

  it("maneja bloque markdown sin cierre (no protege nada despues)", () => {
    const text = "```\ncodigo\n`inline`";
    const ranges = getInlineBacktickRanges(text);
    expect(ranges).toHaveLength(0);
  });

  it("maneja texto vacio", () => {
    expect(getInlineBacktickRanges("")).toHaveLength(0);
  });
});

// =============================================================================
// unescapeXml
// =============================================================================

describe("unescapeXml", () => {
  it("convierte &lt; y &gt;", () => {
    expect(unescapeXml("&lt;div&gt;")).toBe("<div>");
  });

  it("convierte &amp;", () => {
    expect(unescapeXml("a &amp; b")).toBe("a & b");
  });

  it("convierte &quot;", () => {
    expect(unescapeXml('&quot;hola&quot;')).toBe('"hola"');
  });

  it("no modifica texto sin entidades", () => {
    expect(unescapeXml("hola mundo")).toBe("hola mundo");
  });

  it("convierte 2 pasadas", () => {
    expect(unescapeXml("a &amp;lt; b")).toBe("a &lt; b");
  });  
});

// =============================================================================
// extractNodes
// =============================================================================

describe("extractNodes", () => {
  it("extrae un comando simple", () => {
    const nodes = extractNodes("<cmd>npm install</cmd>");
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({ type: "cmd", payload: "npm install" });
  });

  it("extrae multiples comandos", () => {
    const nodes = extractNodes(
      "<cmd>npm install</cmd> y luego <cmd>npm run build</cmd>"
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].payload).toBe("npm install");
    expect(nodes[1].payload).toBe("npm run build");
  });

  it("extrae comando multilinea", () => {
    const nodes = extractNodes("<cmd>linea1\nlinea2\nlinea3</cmd>");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].payload).toBe("linea1\nlinea2\nlinea3");
  });

  it("extrae un file tag", () => {
    const nodes = extractNodes('<file path="src/main.ts">contenido</file>');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      type: "file",
      payload: "src/main.ts",
      content: "contenido",
    });
  });

  it("extrae un file tag multilinea", () => {
    const nodes = extractNodes(
      '<file path="src/app.tsx">\nimport React from "react";\n</file>'
    );
    expect(nodes[0].content).toBe('import React from "react";\n');
  });

  it("extrae un tree tag self-closing", () => {
    const nodes = extractNodes('<tree path="src/components" />');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({ type: "tree", payload: "src/components" });
  });

  it("extrae un tree tag con cierre explicito", () => {
    const nodes = extractNodes('<tree path="src"></tree>');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({ type: "tree", payload: "src" });
  });

  it("ignora comando dentro de backtick inline", () => {
    const nodes = extractNodes("mira `<cmd>npm install</cmd>` en el texto");
    expect(nodes).toHaveLength(0);
  });

  it("ignora file dentro de backtick inline", () => {
    const nodes = extractNodes(
      'ejemplo `<file path="x.ts">y</file>` de uso'
    );
    expect(nodes).toHaveLength(0);
  });

  it("ignora tree dentro de backtick inline", () => {
    const nodes = extractNodes(
      'referencia `<tree path="src" />` aqui'
    );
    expect(nodes).toHaveLength(0);
  });

  it("ejecuta comando dentro de bloque markdown", () => {
    const nodes = extractNodes("```\n<cmd>npm install</cmd>\n```");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("cmd");
  });

  it("ejecuta file dentro de bloque markdown", () => {
    const nodes = extractNodes(
      '```xml\n<file path="x.ts">contenido</file>\n```'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("file");
  });

  it("ignora tag en backtick inline pero ejecuta otro fuera", () => {
    const nodes = extractNodes(
      '`<cmd>fake</cmd>` real: <cmd>npm install</cmd>'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].payload).toBe("npm install");
  });

  it("ignora tag en backtick inline entre dos tags reales", () => {
    const nodes = extractNodes(
      '<cmd>uno</cmd> `<cmd>fake</cmd>` <cmd>dos</cmd>'
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].payload).toBe("uno");
    expect(nodes[1].payload).toBe("dos");
  });

  it("ignora tag cuando backtick empieza justo antes del opening tag", () => {
    const nodes = extractNodes("texto`<cmd>npm install</cmd>`mas texto");
    expect(nodes).toHaveLength(0);
  });

  it("genera parse_error para tags parciales o malformados", () => {
    const nodes = extractNodes("<cmd>sin cerrar");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("parse_error");
    expect(nodes[0].payload).toContain("malformado");
  });

  it("no extrae tags parciales de cierre", () => {
    const nodes = extractNodes("npm install</cmd>");
    expect(nodes).toHaveLength(0);
  });

  it("maneja texto sin tags", () => {
    const nodes = extractNodes("solo texto normal sin ninguna etiqueta");
    expect(nodes).toHaveLength(0);
  });

  it("maneja mezcla de todos los tipos de tags", () => {
    const nodes = extractNodes(
      '<cmd>npm install</cmd>\n<file path="x.ts">hola</file>\n<tree path="src" />'
    );
    expect(nodes).toHaveLength(3);
    expect(nodes[0].type).toBe("cmd");
    expect(nodes[1].type).toBe("file");
    expect(nodes[2].type).toBe("tree");
  });

  it("ignora tag en backtick inline con multiples backticks en linea", () => {
    const nodes = extractNodes(
      '`uno` `<cmd>fake</cmd>` `tres` <cmd>real</cmd>'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].payload).toBe("real");
  });

  it("maneja bloque markdown vacio", () => {
    const nodes = extractNodes("``````\n<cmd>npm install</cmd>\n``````");
    expect(nodes).toHaveLength(1);
  });

  it("ignora tag cuando hay backtick justo antes del opening tag", () => {
    const nodes = extractNodes("`<file path=\"x.ts\">cont</file>`");
    expect(nodes).toHaveLength(0);
  });

  it("extrae file con atributos extra antes de path", () => {
    const nodes = extractNodes(
      '<file encoding="utf-8" path="src/main.ts">data</file>'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].payload).toBe("src/main.ts");
  });

  it("no protege contenido entre backticks dobles sueltos", () => {
    const text = "``\n<cmd>npm install</cmd>\n``";
    const nodes = extractNodes(text);
    expect(nodes).toHaveLength(1);
  });

  it("devuelve nodos en el orden de aparición, no agrupados por tipo", () => {
    const nodes = extractNodes(
      '<cmd>echo segundo</cmd>\n<tree path="src" />\n<cmd>echo primero</cmd>\n<file path="test.txt">contenido</file>'
    );
    expect(nodes).toHaveLength(4);
    expect(nodes[0]).toEqual({ type: "cmd", payload: "echo segundo" });
    expect(nodes[1]).toEqual({ type: "tree", payload: "src" });
    expect(nodes[2]).toEqual({ type: "cmd", payload: "echo primero" });
    expect(nodes[3]).toEqual({ type: "file", payload: "test.txt", content: "contenido" });
  });

  it("aplica unescape a contenido de file y payload de cmd", () => {
    const nodes = extractNodes(
      '<cmd>echo &lt;div&gt;Hola&lt;/div&gt;</cmd>\n<file path="index.html">&lt;html&gt;&amp;nbsp;&lt;/html&gt;</file>'
    );
    expect(nodes).toHaveLength(2);
    expect(nodes[0].type).toBe("cmd");
    expect(nodes[0].payload).toBe('echo <div>Hola</div>');
    expect(nodes[1].type).toBe("file");
    expect(nodes[1].payload).toBe("index.html");
    expect(nodes[1].content).toBe('<html>&nbsp;</html>');
  });
});

// =============================================================================
// LLMParser.parse (integracion)
// =============================================================================

describe("LLMParser.parse", () => {
  it("genera ids unicos para cada nodo", () => {
    const nodes = LLMParser.parse(
      "<cmd>a</cmd><cmd>b</cmd><cmd>c</cmd>"
    );
    const ids = nodes.map(n => n.id);
    expect(new Set(ids).size).toBe(3);
  });

  it("asigna status pending y result null", () => {
    const nodes = LLMParser.parse("<cmd>npm install</cmd>");
    expect(nodes[0].status).toBe("pending");
    expect(nodes[0].result).toBeNull();
  });

  it("incluye content en nodos file", () => {
    const nodes = LLMParser.parse('<file path="x.ts">hello</file>');
    expect(nodes[0].content).toBe("hello");
  });

  it("no incluye content en nodos cmd", () => {
    const nodes = LLMParser.parse("<cmd>npm install</cmd>");
    expect(nodes[0].content).toBeUndefined();
  });
});
