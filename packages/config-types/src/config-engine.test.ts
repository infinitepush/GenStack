import { describe, expect, it } from "vitest";
import { normalizeAppConfig } from "./index";

describe("ConfigEngine", () => {
  it("defaults missing ui to an empty page list with a warning", () => {
    const result = normalizeAppConfig({ app: { name: "No UI" } });

    expect(result.config.ui.pages).toEqual([]);
    expect(result.warnings.some((warning) => warning.path === "ui")).toBe(true);
  });

  it("keeps unknown component types and reports a warning", () => {
    const result = normalizeAppConfig({
      ui: {
        pages: [
          {
            name: "Dashboard",
            route: "/dashboard",
            components: [{ type: "mystery_panel" }]
          }
        ]
      }
    });

    expect(result.config.ui.pages[0]?.components[0]?.type).toBe("mystery_panel");
    expect(result.warnings.some((warning) => warning.message.includes("Unknown component type"))).toBe(true);
  });

  it("defaults a missing auth block to disabled auth", () => {
    const result = normalizeAppConfig({ app: { name: "Public App" } });

    expect(result.config.auth).toEqual({ enabled: false, methods: [] });
  });

  it("deduplicates duplicate routes and keeps the last page", () => {
    const result = normalizeAppConfig({
      ui: {
        pages: [
          { name: "Old", route: "/dashboard", components: [] },
          { name: "New", route: "dashboard", components: [] }
        ]
      }
    });

    expect(result.config.ui.pages).toHaveLength(1);
    expect(result.config.ui.pages[0]?.name).toBe("New");
    expect(result.warnings.some((warning) => warning.message.includes("Duplicate route"))).toBe(true);
  });
});
