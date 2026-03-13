import { describe, expect, it } from "vitest";
import { buildHighlightedSearchUrl, resolvePagefindSearchFeatures } from "./search.js";

describe("resolvePagefindSearchFeatures", () => {
  it("uses feature flags to derive defaults", () => {
    const resolved = resolvePagefindSearchFeatures({
      baseUrl: "/docs/",
      features: {
        highlighting: { param: "hl" },
        metadata: { fields: ["section", "audience"] },
        filters: { defaultValue: { section: "api" } },
        sorting: { defaultValue: "date:desc" },
        subResults: { maxItems: 2 },
      },
    });

    expect(resolved.highlighting?.param).toBe("hl");
    expect(resolved.metadataFields).toEqual(["section", "audience"]);
    expect(resolved.defaultFilters).toEqual({ section: "api" });
    expect(resolved.defaultSort).toBe("date:desc");
    expect(resolved.subResultLimit).toBe(2);
  });

  it("allows disabling optional features explicitly", () => {
    const resolved = resolvePagefindSearchFeatures({
      baseUrl: "/docs/",
      highlightParam: false,
      features: {
        metadata: false,
        filters: false,
        sorting: false,
        subResults: false,
      },
    });

    expect(resolved.highlighting).toBeNull();
    expect(resolved.metadataFields).toEqual([]);
    expect(resolved.defaultFilters).toBeUndefined();
    expect(resolved.defaultSort).toBeUndefined();
    expect(resolved.subResultLimit).toBe(0);
  });
});

describe("buildHighlightedSearchUrl", () => {
  it("preserves existing query params while adding the highlight term", () => {
    expect(buildHighlightedSearchUrl("/docs/mcp/?tab=api", "highlight", "MCP")).toBe(
      "/docs/mcp/?tab=api&highlight=MCP",
    );
  });
});
