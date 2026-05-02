import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeReplace } from "./replaceCommand";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
const mockedInvoke = vi.mocked(invoke);

beforeEach(() => vi.clearAllMocks());

describe("executeReplace", () => {
  it("llama al backend con all=false por defecto", async () => {
    mockedInvoke.mockResolvedValueOnce({ replaced: 1 });
    const result = await executeReplace("x.ts", "old", "new");
    expect(mockedInvoke).toHaveBeenCalledWith("replace_in_file", {
      path: "x.ts", oldStr: "old", newStr: "new", all: false,
    });
    expect(result).toContain("1 occurrence");
  });

  it("llama al backend con all=true cuando occurrence es all", async () => {
    mockedInvoke.mockResolvedValueOnce({ replaced: 4 });
    const result = await executeReplace("x.ts", "old", "new", { occurrence: "all" });
    expect(mockedInvoke).toHaveBeenCalledWith("replace_in_file", {
      path: "x.ts", oldStr: "old", newStr: "new", all: true,
    });
    expect(result).toContain("4 occurrence");
  });
});
