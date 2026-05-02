import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReplaceStrategy } from "./ReplaceStrategy";
import { ActionNode } from "../../types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
const mockedInvoke = vi.mocked(invoke);
const strategy = new ReplaceStrategy();

const makeNode = (opts?: Record<string, string>, content?: string, newContent?: string): ActionNode => ({
  id: '1',
  type: 'replace',
  payload: 'x.ts',
  status: 'pending',
  result: null,
  options: opts,
  content,
  newContent,
});

beforeEach(() => vi.clearAllMocks());

describe("ReplaceStrategy", () => {
  it("llama al backend con all=false por defecto y devuelve ExecutionResult", async () => {
    mockedInvoke.mockResolvedValueOnce({ replaced: 1 });
    const result = await strategy.execute(makeNode(undefined, "old", "new"));
    
    expect(mockedInvoke).toHaveBeenCalledWith("replace_in_file", {
      path: "x.ts", oldStr: "old", newStr: "new", all: false,
    });
    expect(result.stdout).toContain("1 occurrence");
    expect(result.exitCode).toBe(0);
  });

  it("llama al backend con all=true cuando occurrence es all", async () => {
    mockedInvoke.mockResolvedValueOnce({ replaced: 4 });
    const result = await strategy.execute(makeNode({ occurrence: "all" }, "old", "new"));
    
    expect(mockedInvoke).toHaveBeenCalledWith("replace_in_file", {
      path: "x.ts", oldStr: "old", newStr: "new", all: true,
    });
    expect(result.stdout).toContain("4 occurrence");
    expect(result.exitCode).toBe(0);
  });
});
