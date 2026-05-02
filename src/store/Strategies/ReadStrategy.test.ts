import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReadStrategy } from "./ReadStrategy";
import { ActionNode } from "../../types";

// Mock del módulo de Tauri
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockedInvoke = vi.mocked(invoke);
const strategy = new ReadStrategy();

const makeNode = (opts?: Record<string, string>): ActionNode => ({
  id: '1',
  type: 'read',
  payload: 'src/App.tsx',
  status: 'pending',
  result: null,
  options: opts,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// ReadStrategy – ejecución y formateo
// =============================================================================

describe("ReadStrategy", () => {
  it("llama al backend sin start ni end cuando no hay opciones de linea", async () => {
    mockedInvoke.mockResolvedValueOnce("linea1\nlinea2");
    const result = await strategy.execute(makeNode());
    
    expect(mockedInvoke).toHaveBeenCalledWith("read_file_with_line_numbers", {
      path: "src/App.tsx",
      startLine: null,
      endLine: null,
    });
    expect(result.stdout).toContain("    1  linea1");
    expect(result.stdout).toContain("    2  linea2");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  it("llama al backend con start y end cuando se pasan esas opciones", async () => {
    mockedInvoke.mockResolvedValueOnce("linea10\nlinea11");
    const result = await strategy.execute(makeNode({ start: '10', end: '11' }));
    
    expect(mockedInvoke).toHaveBeenCalledWith("read_file_with_line_numbers", {
      path: "src/App.tsx",
      startLine: 10,
      endLine: 11,
    });
    expect(result.stdout).toContain("   10  linea10");
    expect(result.stdout).toContain("   11  linea11");
  });

  it("resuelve line como start y end iguales si no se pasa count", async () => {
    mockedInvoke.mockResolvedValueOnce("linea42");
    const result = await strategy.execute(makeNode({ line: '42' }));
    
    expect(mockedInvoke).toHaveBeenCalledWith("read_file_with_line_numbers", {
      path: "src/App.tsx",
      startLine: 42,
      endLine: 42,
    });
    expect(result.stdout).toBe("   42  linea42");
  });

  it("resuelve line + count como start y end calculado", async () => {
    mockedInvoke.mockResolvedValueOnce("l5\nl6\nl7");
    const result = await strategy.execute(makeNode({ line: '5', count: '3' }));
    
    expect(mockedInvoke).toHaveBeenCalledWith("read_file_with_line_numbers", {
      path: "src/App.tsx",
      startLine: 5,
      endLine: 7,
    });
    expect(result.stdout).toContain("    5  l5");
    expect(result.stdout).toContain("    6  l6");
    expect(result.stdout).toContain("    7  l7");
  });

  it("devuelve string vacio si el backend devuelve contenido vacio", async () => {
    mockedInvoke.mockResolvedValueOnce("");
    const result = await strategy.execute(makeNode());
    expect(result.stdout).toBe("");
  });

  it("propaga errores del backend envolviéndolos en error de ejecución", async () => {
    mockedInvoke.mockRejectedValueOnce(new Error("archivo no encontrado"));
    
    // Al propagarse por el execute genérico, el Store lo captura, pero aquí testeamos la estrategia
    await expect(strategy.execute(makeNode())).rejects.toThrow("archivo no encontrado");
  });

  it("numera lineas comenzando desde el start proporcionado", async () => {
    mockedInvoke.mockResolvedValueOnce("x\ny");
    const result = await strategy.execute(makeNode({ start: '100' }));
    const expected = [
      "  100  x",
      "  101  y",
    ].join("\n");
    expect(result.stdout).toBe(expected);
  });
});
