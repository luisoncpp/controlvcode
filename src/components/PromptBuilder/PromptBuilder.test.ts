import { describe, it, expect, vi, beforeEach } from "vitest";
import { PromptBuilder } from "./PromptBuilder";

// Mock de las llamadas a Tauri
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

describe("PromptBuilder", () => {
  let builder: PromptBuilder;

  beforeEach(() => {
    mockInvoke.mockReset();
    builder = new PromptBuilder("<execution_results />");
  });

  describe("constructor", () => {
    it("inicializa con valores predeterminados", () => {
      expect(builder.message.value).toBe("");
      expect(builder.attachedFiles.value).toEqual([]);
      expect(builder.showDropdown.value).toBe(false);
      expect(builder.searchResults.value).toEqual([]);
    });
  });

  describe("onMessageChange", () => {
    it("actualiza el mensaje y no muestra dropdown si no hay @", () => {
      builder.onMessageChange("hola mundo");
      expect(builder.message.value).toBe("hola mundo");
      expect(builder.showDropdown.value).toBe(false);
      expect(builder.searchResults.value).toEqual([]);
    });

    it("detecta @ y activa búsqueda con debounce", async () => {
      mockInvoke.mockResolvedValueOnce(["src/main.ts", "src/App.tsx"]);
      
      builder.onMessageChange("revisa @App");
      
      // El debounce aún no se ejecuta
      expect(builder.showDropdown.value).toBe(false);
      expect(builder.searchQuery.value).toBe("App");
      
      // Esperamos al debounce (200ms + margen)
      await new Promise(resolve => setTimeout(resolve, 250));
      
      expect(mockInvoke).toHaveBeenCalledWith("search_files", { query: "App" });
      expect(builder.showDropdown.value).toBe(true);
      expect(builder.searchResults.value).toEqual(["src/main.ts", "src/App.tsx"]);
    });

    it("no activa búsqueda si después del @ hay un espacio", () => {
      builder.onMessageChange("menciono @ algo");
      expect(builder.showDropdown.value).toBe(false);
      expect(builder.searchQuery.value).toBe("");
    });

    it("oculta el dropdown si el texto ya no contiene @", async () => {
      builder.showDropdown.value = true;
      builder.searchResults.value = ["file.ts"];
      
      builder.onMessageChange("otro texto sin menciones");
      
      expect(builder.showDropdown.value).toBe(false);
      expect(builder.searchResults.value).toEqual([]);
    });
  });

  describe("attachFile", () => {
    it("añade un archivo a la lista de adjuntos", async () => {
      mockInvoke.mockResolvedValueOnce("contenido del archivo");
      
      await builder.attachFile("src/main.ts");
      
      expect(builder.attachedFiles.value).toEqual([
        { path: "src/main.ts", content: "contenido del archivo" }
      ]);
      expect(builder.showDropdown.value).toBe(false);
      expect(builder.searchResults.value).toEqual([]);
    });

    it("no añade duplicados", async () => {
      builder.attachedFiles.value = [{ path: "src/main.ts", content: "ya existe" }];
      mockInvoke.mockResolvedValueOnce("contenido duplicado");
      
      await builder.attachFile("src/main.ts");
      
      expect(builder.attachedFiles.value).toHaveLength(1);
      expect(builder.attachedFiles.value[0].content).toBe("ya existe");
    });

    it("elimina la mención @query del mensaje", async () => {
      builder.message.value = "arregla @main.ts por favor";
      builder.searchQuery.value = "main.ts";
      mockInvoke.mockResolvedValueOnce("código...");
      
      await builder.attachFile("src/main.ts");
      
      expect(builder.message.value).toBe("arregla  por favor");
    });

    it("maneja errores al leer archivo", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("no encontrado"));
      
      await builder.attachFile("inexistente.ts");
      
      expect(builder.attachedFiles.value).toEqual([]);
      // No debe lanzar excepción
    });
  });

  describe("removeFile", () => {
    it("elimina un archivo adjunto por su ruta", () => {
      builder.attachedFiles.value = [
        { path: "a.ts", content: "a" },
        { path: "b.ts", content: "b" }
      ];
      
      builder.removeFile("a.ts");
      
      expect(builder.attachedFiles.value).toEqual([
        { path: "b.ts", content: "b" }
      ]);
    });
  });

  describe("buildPrompt", () => {
    it("incluye el feedback, el mensaje y los adjuntos", () => {
      builder.message.value = "arregla este bug";
      builder.attachedFiles.value = [
        { path: "src/main.ts", content: "console.log('bug')" },
        { path: "src/utils.ts", content: "export const x = 1" }
      ];
      
      const prompt = builder.buildPrompt();
      
      expect(prompt).toContain("<execution_results />");
      expect(prompt).toContain("arregla este bug");
      expect(prompt).toContain('<attachment path="src/main.ts">');
      expect(prompt).toContain("console.log('bug')");
      expect(prompt).toContain('</attachment>');
      expect(prompt).toContain('<attachment path="src/utils.ts">');
    });

    it("funciona sin feedback", () => {
      const builderSinFeedback = new PromptBuilder("");
      builderSinFeedback.message.value = "solo mensaje";
      
      const prompt = builderSinFeedback.buildPrompt();
      
      expect(prompt).not.toContain("<execution_results");
      expect(prompt).toContain("solo mensaje");
    });

    it("funciona sin adjuntos", () => {
      builder.message.value = "pregunta simple";
      
      const prompt = builder.buildPrompt();
      
      expect(prompt).toContain("<execution_results />");
      expect(prompt).toContain("pregunta simple");
      expect(prompt).not.toContain("<attachment");
    });
  });

  describe("copyToClipboard", () => {
    it("copia el prompt al portapapeles", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: { writeText }
      });
      
      builder.message.value = "test";
      const result = await builder.copyToClipboard();
      
      expect(result).toBe(true);
      expect(writeText).toHaveBeenCalledWith(builder.buildPrompt());
    });

    it("retorna false si falla la copia", async () => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error()) }
      });
      
      const result = await builder.copyToClipboard();
      
      expect(result).toBe(false);
    });
  });
});
