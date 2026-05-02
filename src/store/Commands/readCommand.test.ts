import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeRead } from "./readCommand";

// Mock del módulo de Tauri
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockedInvoke = vi.mocked(invoke);

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// executeRead – llamadas al backend
// =============================================================================

describe("executeRead", () => {
  it("llama al backend sin start ni end cuando no hay opciones de linea", async () => {
    mockedInvoke.mockResolvedValueOnce("linea1\nlinea2");
    const result = await executeRead("src/App.tsx");
    expect(mockedInvoke).toHaveBeenCalledWith("read_file_with_line_numbers", {
      path: "src/App.tsx",
      startLine: null,
      endLine: null,
    });
    expect(result).toContain("1  linea1");
    expect(result).toContain("2  linea2");
  });

  it("llama al backend con start y end cuando se pasan esas opciones", async () => {
    mockedInvoke.mockResolvedValueOnce("linea10\nlinea11");
    const result = await executeRead("src/App.tsx", { start: 10, end: 11 });
    expect(mockedInvoke).toHaveBeenCalledWith("read_file_with_line_numbers", {
      path: "src/App.tsx",
      startLine: 10,
      endLine: 11,
    });
    expect(result).toContain("10  linea10");
    expect(result).toContain("11  linea11");
  });

  it("resuelve line como start y end iguales si no se pasa count", async () => {
    mockedInvoke.mockResolvedValueOnce("linea42");
    const result = await executeRead("src/App.tsx", { line: 42 });
    expect(mockedInvoke).toHaveBeenCalledWith("read_file_with_line_numbers", {
      path: "src/App.tsx",
      startLine: 42,
      endLine: 42,
    });
    expect(result).toBe("   42  linea42");
  });

  it("resuelve line + count como start y end calculado", async () => {
    mockedInvoke.mockResolvedValueOnce("l5\nl6\nl7");
    const result = await executeRead("src/App.tsx", { line: 5, count: 3 });
    expect(mockedInvoke).toHaveBeenCalledWith("read_file_with_line_numbers", {
      path: "src/App.tsx",
      startLine: 5,
      endLine: 7,
    });
    expect(result).toContain(" 5  l5");
    expect(result).toContain(" 6  l6");
    expect(result).toContain(" 7  l7");
  });

  it("devuelve string vacio si el backend devuelve contenido vacio", async () => {
    mockedInvoke.mockResolvedValueOnce("");
    const result = await executeRead("empty.txt");
    expect(result).toBe("");
  });

  it("propaga errores del backend", async () => {
    mockedInvoke.mockRejectedValueOnce(new Error("archivo no encontrado"));
    await expect(executeRead("noexiste.txt")).rejects.toThrow("archivo no encontrado");
  });
});

// =============================================================================
// Formateo de lineas (via executeRead)
// =============================================================================

describe("formateo de lineas", () => {
  it("numera lineas comenzando desde 1 por defecto", async () => {
    mockedInvoke.mockResolvedValueOnce("a\nb\nc");
    const result = await executeRead("test.txt");
    const expected = [
      "    1  a",
      "    2  b",
      "    3  c",
    ].join("\n");
    expect(result).toBe(expected);
  });

  it("numera lineas comenzando desde el start proporcionado", async () => {
    mockedInvoke.mockResolvedValueOnce("x\ny");
    const result = await executeRead("test.txt", { start: 100 });
    const expected = [
      "  100  x",
      "  101  y",
    ].join("\n");
    expect(result).toBe(expected);
  });

  it("numera una sola linea correctamente", async () => {
    mockedInvoke.mockResolvedValueOnce("unica");
    const result = await executeRead("test.txt", { line: 7 });
    expect(result).toBe("    7  unica");
  });
});
