import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { buildHighlightedSearchUrl, resolvePagefindSearchFeatures } from "./search.js";

const temporaryDirectories: string[] = [];

const createFixtureBaseUrl = async (files: Record<string, string>) => {
  const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), "pagefind-fixture-"));
  temporaryDirectories.push(fixtureRoot);

  for (const [relativePath, contents] of Object.entries(files)) {
    const targetPath = path.join(fixtureRoot, relativePath);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, contents);
  }

  return `${pathToFileURL(fixtureRoot).href}/`;
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
  delete (globalThis as Record<string, unknown>).__pagefindInitCount;
  delete (globalThis as Record<string, unknown>).__pagefindSearchCalls;
});

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

  it("preserves hashes while replacing an existing highlight value", () => {
    expect(
      buildHighlightedSearchUrl("/docs/mcp/?highlight=old#section-1", "highlight", "MCP"),
    ).toBe("/docs/mcp/?highlight=MCP#section-1");
  });
});

describe("createPagefindSearchClient", () => {
  it("loads the pagefind bundle, applies defaults, and shapes results", async () => {
    const baseUrl = await createFixtureBaseUrl({
      "pagefind/pagefind.js": `
        globalThis.__pagefindInitCount = 0;
        globalThis.__pagefindSearchCalls = [];

        export async function init() {
          globalThis.__pagefindInitCount += 1;
        }

        export async function filters() {
          return { section: ["api", "guides"] };
        }

        export async function search(query, options) {
          globalThis.__pagefindSearchCalls.push({ query, options });
          return {
            results: [
              {
                id: "result-1",
                data: async () => ({
                  url: "/docs/intro",
                  excerpt: "Intro excerpt",
                  meta: { title: "Intro", section: "guides", audience: "dev" },
                  sub_results: [
                    { url: "/docs/intro#one", title: "One", excerpt: "First" },
                    { url: "/docs/intro#two", title: "Two", excerpt: "Second" },
                  ],
                }),
              },
              {
                id: "result-2",
                data: async () => ({
                  url: "/docs/api",
                  excerpt: "API excerpt",
                  meta: { section: "api" },
                }),
              },
            ],
          };
        }
      `,
    });

    const { createPagefindSearchClient } = await import("./search.js");
    const client = createPagefindSearchClient({
      baseUrl,
      features: {
        highlighting: { param: "hl" },
        metadata: { fields: ["section", "audience"] },
        filters: { defaultValue: { section: "guides" } },
        sorting: { defaultValue: "date:desc" },
        subResults: { maxItems: 1 },
      },
    });

    expect(await client.getFilters()).toEqual({ section: ["api", "guides"] });

    const results = await client.search("MCP");

    expect(results).toEqual([
      {
        url: "/docs/intro?hl=MCP",
        title: "Intro",
        excerpt: "Intro excerpt",
        meta: { title: "Intro", section: "guides", audience: "dev" },
        metadata: { section: "guides", audience: "dev" },
        subResults: [{ url: "/docs/intro?hl=MCP#one", title: "One", excerpt: "First" }],
      },
      {
        url: "/docs/api?hl=MCP",
        title: "Untitled",
        excerpt: "API excerpt",
        meta: { section: "api" },
        metadata: { section: "api" },
        subResults: [],
      },
    ]);

    expect((globalThis as Record<string, unknown>).__pagefindInitCount).toBe(2);
    expect((globalThis as Record<string, unknown>).__pagefindSearchCalls).toEqual([
      {
        query: "MCP",
        options: {
          filters: { section: "guides" },
          sort: "date:desc",
        },
      },
    ]);
  });

  it("respects per-search overrides and disables optional features cleanly", async () => {
    const baseUrl = await createFixtureBaseUrl({
      "pagefind/pagefind.js": `
        export async function init() {}

        export async function search(_query, options) {
          globalThis.__pagefindSearchCalls = [options];
          return {
            results: [
              {
                id: "result-1",
                data: async () => ({
                  url: "/docs/reference",
                  excerpt: "Reference excerpt",
                  meta: { title: "Reference", section: "api" },
                  sub_results: [
                    { url: "/docs/reference#details", title: "Details", excerpt: "More" },
                  ],
                }),
              },
            ],
          };
        }
      `,
    });

    const { createPagefindSearchClient } = await import("./search.js");
    const client = createPagefindSearchClient({
      baseUrl,
      highlightParam: false,
      features: {
        metadata: false,
        filters: false,
        sorting: false,
        subResults: false,
      },
    });

    const results = await client.search("ignored", {
      filters: { section: "api" },
      sort: { title: "asc" },
      limit: 1,
    });

    expect(results).toEqual([
      {
        url: "/docs/reference",
        title: "Reference",
        excerpt: "Reference excerpt",
        meta: { title: "Reference", section: "api" },
        metadata: {},
        subResults: [],
      },
    ]);
    expect((globalThis as Record<string, unknown>).__pagefindSearchCalls).toEqual([
      {
        filters: { section: "api" },
        sort: { title: "asc" },
      },
    ]);
  });

  it("returns null filters when the pagefind module does not expose them", async () => {
    const baseUrl = await createFixtureBaseUrl({
      "pagefind/pagefind.js": `
        export async function init() {}
        export async function search() {
          return { results: [] };
        }
      `,
    });

    const { createPagefindSearchClient } = await import("./search.js");
    const client = createPagefindSearchClient({ baseUrl });

    await expect(client.getFilters()).resolves.toBeNull();
  });
});

describe("enablePagefindHighlighting", () => {
  it("creates a highlighter from the pagefind highlight bundle", async () => {
    const baseUrl = await createFixtureBaseUrl({
      "pagefind/pagefind-highlight.js": `
        export class PagefindHighlight {
          constructor(options) {
            this.options = options;
          }
        }
      `,
    });

    const { enablePagefindHighlighting } = await import("./search.js");
    const highlighter = (await enablePagefindHighlighting({
      baseUrl,
      highlightParam: "q",
      constructorOptions: { markTag: "strong" },
    })) as { options: Record<string, string> };

    expect(highlighter.options).toEqual({
      highlightParam: "q",
      markTag: "strong",
    });
  });

  it("throws when the highlight constructor cannot be found", async () => {
    const baseUrl = await createFixtureBaseUrl({
      "pagefind/pagefind-highlight.js": "export default {};",
    });

    const { enablePagefindHighlighting } = await import("./search.js");

    await expect(enablePagefindHighlighting({ baseUrl })).rejects.toThrow(
      "PagefindHighlight constructor not found in pagefind-highlight.js",
    );
  });
});
