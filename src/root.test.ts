import { describe, expect, it } from "vitest";
import {
  createPagefindSearchClient as createFromRoot,
  enablePagefindHighlighting as enableFromRoot,
} from "./root.js";
import {
  createPagefindSearchClient as createFromSearch,
  enablePagefindHighlighting as enableFromSearch,
} from "./search.js";

describe("root exports", () => {
  it("re-exports the browser search helpers", () => {
    expect(createFromRoot).toBe(createFromSearch);
    expect(enableFromRoot).toBe(enableFromSearch);
  });
});
