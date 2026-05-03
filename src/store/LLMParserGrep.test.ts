import { describe, it, expect } from "vitest";
import { extractNodes, LLMParser } from "./LLMParser";

describe("extractNodes – grep tag", () => {
  it("extrae grep con pattern hijo", () => {
    const nodes = extractNodes(
      `<grep path="src">
  <pattern>console.log</pattern>
</grep>`
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      type: "grep",
      payload: "src",
      content: "console.log",
    });
  });

  it("extrae grep con CDATA en pattern", () => {
    const nodes = extractNodes(
      `<grep path="src">
  <pattern><![CDATA[console.log("hola")]]></pattern>
</grep>`
    );
    expect(nodes[0].payload).toBe("src");
    expect(nodes[0].content).toBe('console.log("hola")');
  });

  it("extrae grep con atributos (legacy)", () => {
    const nodes = extractNodes(
      '<grep path="src" pattern="TODO" />'
    );
    expect(nodes[0]).toEqual({
      type: "grep",
      payload: "src",
      content: "TODO",
    });
  });

  it("extrae grep con options glob e ignore_case", () => {
    const nodes = extractNodes(
      '<grep path="src" glob="*.ts" ignore_case="true" pattern="todo" />'
    );
    expect(nodes[0].options).toEqual({
      glob: "*.ts",
      ignore_case: "true",
    });
    expect(nodes[0].content).toBe("todo");
  });
});

describe("LLMParser.parse – grep tag", () => {
  it("genera ActionNode grep con todos los campos", () => {
    const nodes = LLMParser.parse(
      `<grep path="src">
  <pattern>console.log</pattern>
</grep>`
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("grep");
    expect(nodes[0].payload).toBe("src");
    expect(nodes[0].content).toBe("console.log");
    expect(nodes[0].status).toBe("pending");
  });
});
