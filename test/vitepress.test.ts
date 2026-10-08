import MarkdownIt from "markdown-it";
import { describe, expect, it, vi } from "vitest";
import type { UserConfig } from "vitepress";
import { downloadsSrcExclude, withDownloads } from "../src/vitepress.js";

describe("downloadsSrcExclude", () => {
  it("builds a glob per folder", () => {
    expect(downloadsSrcExclude()).toEqual(["**/downloads/**"]);
    expect(downloadsSrcExclude({ folders: ["downloads", "files"] })).toEqual([
      "**/downloads/**",
      "**/files/**",
    ]);
  });
});

describe("withDownloads", () => {
  it("adds srcExclude, a Vite plugin and the markdown plugin to an empty config", () => {
    const config = withDownloads({});
    expect(config.srcExclude).toEqual(["**/downloads/**"]);
    expect(config.vite?.plugins).toHaveLength(1);
    expect(typeof config.markdown?.config).toBe("function");
  });

  it("keeps existing srcExclude (string or array), plugins and markdown.config", () => {
    const existing = vi.fn();
    const other = { name: "other" };
    const config = withDownloads(
      {
        srcExclude: "**/_snippets/**",
        vite: { plugins: [other] },
        markdown: { config: existing },
      } as unknown as UserConfig,
      { folders: "files" },
    );
    expect(config.srcExclude).toEqual(["**/_snippets/**", "**/files/**"]);
    expect(config.vite?.plugins?.[0]).toBe(other);
    expect(config.vite?.plugins).toHaveLength(2);

    const md = new MarkdownIt();
    config.markdown!.config!(md as never);
    expect(existing).toHaveBeenCalledWith(md);
    const rules = (md.core.ruler as unknown as { __rules__: { name: string }[] }).__rules__;
    expect(rules.map((r) => r.name)).toContain("vitepress_downloads_links");
  });
});
