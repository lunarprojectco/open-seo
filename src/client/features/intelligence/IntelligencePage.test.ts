import { describe, expect, it } from "vitest";
import { classifyQuery } from "./IntelligencePage";

describe("the Intelligence search box", () => {
  it("tells a keyword, a domain and a URL apart", () => {
    expect(classifyQuery("furnace repair calgary")).toEqual({
      kind: "keyword",
      value: "furnace repair calgary",
    });
    expect(classifyQuery("Example.com")).toEqual({
      kind: "domain",
      value: "example.com",
    });
    expect(classifyQuery("hvacautomations.ca")).toEqual({
      kind: "domain",
      value: "hvacautomations.ca",
    });
    expect(classifyQuery("https://example.com/furnace-repair")).toEqual({
      kind: "url",
      value: "https://example.com/furnace-repair",
    });
    expect(classifyQuery("   ")).toBeNull();
    expect(classifyQuery("furnace.repair calgary")).toEqual({
      kind: "keyword",
      value: "furnace.repair calgary",
    });
  });
});
