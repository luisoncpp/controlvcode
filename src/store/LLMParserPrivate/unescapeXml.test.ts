import { describe, it, expect } from "vitest";
import { unescapeXml } from "./unescapeXml";

describe("unescapeXml (smoke)", () => {
  it("convierte entidades básicas", () => {
    expect(unescapeXml("&lt;div&gt;")).toBe("<div>");
    expect(unescapeXml("&amp;")).toBe("&");
    expect(unescapeXml("&quot;")).toBe('"');
  });
});