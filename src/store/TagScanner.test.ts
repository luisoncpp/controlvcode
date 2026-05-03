
import { describe, it, expect } from "vitest";
import { scanTags, extractNodes } from "./LLMParser";

describe("scanTags", () => {
  it("extrae un tag simple", () => {
    const tags = scanTags("<cmd>echo hola</cmd>");
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ name: "cmd", content: "echo hola", isSelfClosing: false });
    expect(tags[0].children).toEqual([]); // Los tags simples no tienen hijos
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

  it("maneja anidación del mismo tag y popula children", () => {
    const text = '<file path="a.txt"><file path="b.txt">inner</file>outer</file>';
    const tags = scanTags(text);
    expect(tags).toHaveLength(1);
    expect(tags[0].name).toBe("file");
    expect(tags[0].attributes["path"]).toBe("a.txt");
    expect(tags[0].content).toBe('<file path="b.txt">inner</file>outer');
    
    // Verificar hijos parseados
    expect(tags[0].children).toHaveLength(1);
    expect(tags[0].children[0]).toMatchObject({
      name: "file",
      content: "inner",
      isSelfClosing: false
    });
    expect(tags[0].children[0].attributes["path"]).toBe("b.txt");
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

describe("scanTags con anidación (AST Recursivo)", () => {
  it("parsea etiquetas replace con hijos old y new", () => {
    const xml = `<replace path="archivo.txt">
<old>texto viejo</old>
<new>texto nuevo</new>
</replace>`;
    const tags = scanTags(xml);
    expect(tags).toHaveLength(1);
    
    const replaceTag = tags[0];
    expect(replaceTag.name).toBe("replace");
    expect(replaceTag.attributes.path).toBe("archivo.txt");
    expect(replaceTag.children.length).toBe(2);

    const oldTag = replaceTag.children.find(c => c.name === "old");
    const newTag = replaceTag.children.find(c => c.name === "new");

    expect(oldTag).toBeDefined();
    expect(oldTag?.content).toBe("texto viejo");
    expect(oldTag?.children).toEqual([]); // Hoja

    expect(newTag).toBeDefined();
    expect(newTag?.content).toBe("texto nuevo");
  });

  it("maneja CDATA dentro de etiquetas anidadas", () => {
    const xml = `<replace path="index.html">
<old><![CDATA[<div>Viejo</div>]]></old>
<new><![CDATA[<div>Nuevo & Mejor</div>]]></new>
</replace>`;
    const tags = scanTags(xml);
    const replaceTag = tags[0];

    const oldTag = replaceTag.children.find(c => c.name === "old");
    const newTag = replaceTag.children.find(c => c.name === "new");

    expect(oldTag?.isCData).toBe(true);
    expect(oldTag?.content).toBe("<div>Viejo</div>");
    
    expect(newTag?.isCData).toBe(true);
    expect(newTag?.content).toBe("<div>Nuevo & Mejor</div>");
  });

  it("mantiene compatibilidad con replace en atributos (sin hijos)", () => {
    const xml = `<replace path="file.txt" old="foo" new="bar" occurrence="all" />`;
    const tags = scanTags(xml);
    expect(tags).toHaveLength(1);
    
    const tag = tags[0];
    expect(tag.name).toBe("replace");
    expect(tag.attributes.old).toBe("foo");
    expect(tag.attributes.new).toBe("bar");
    expect(tag.content).toBeNull();
    expect(tag.children).toEqual([]);
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
      '<cmd>echo <div></cmd>'
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].payload).toBe('echo <div>');
  });
});

describe("scanTags con CDATA", () => {
  it("extrae contenido dentro de CDATA tal cual", () => {
    const text = '<file path="App.tsx"><![CDATA[<div>Hola</div>]]></file>';
    const tags = scanTags(text);
    expect(tags).toHaveLength(1);
    expect(tags[0].content).toBe('<div>Hola</div>');
    expect(tags[0].isCData).toBe(true);
  });

  it("CDATA con saltos de línea preserva la estructura", () => {
    const xml = `<file path="a.ts">
<![CDATA[
line1
  line2
    line3
]]>
</file>`;
    const tags = scanTags(xml);
    expect(tags).toHaveLength(1);
    expect(tags[0].content).toBe('\nline1\n  line2\n    line3\n');
    expect(tags[0].isCData).toBe(true);
  });

  it("ignora CDATA si está malformado (sin cierre )", () => {
    const text = '<cmd><![CDATA[sin cerrar</cmd>';
    const tags = scanTags(text);
    expect(tags).toHaveLength(0);
  });

  it("si falta el tag de cierre XML después del CDATA, no extrae", () => {
    const text = '<cmd><![CDATA[contenido]]>';
    const tags = scanTags(text);
    expect(tags).toHaveLength(0);
  });
});

describe("extractNodes con CDATA", () => {
  it("NO aplica unescapeXml cuando el contenido es CDATA", () => {
    const nodes = extractNodes('<cmd><![CDATA[echo <div>Hola</div>]]></cmd>');
    expect(nodes).toHaveLength(1);
    // El schema de 'cmd' tiene trimPayload: true
    expect(nodes[0].payload).toBe('echo <div>Hola</div>');
  });

  it("SI aplica unescapeXml si NO es CDATA (comportamiento original)", () => {
    const nodes = extractNodes('<cmd>echo <div></cmd>');
    expect(nodes).toHaveLength(1);
    expect(nodes[0].payload).toBe('echo <div>');
  });
});
