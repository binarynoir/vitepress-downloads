import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import MarkdownIt from "markdown-it";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadsMarkdown } from "../src/markdown.js";
import type { DownloadsOptions } from "../src/types.js";

// The `download` attribute itself, not the word inside a "/downloads/" path.
const DOWNLOAD_ATTR = / download[ >=]/;

describe("downloadsMarkdown", () => {
  let srcDir: string;

  beforeEach(() => {
    srcDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpd-md-")));
    for (const file of [
      "tools/ai/downloads/query.sql",
      "tools/ai/downloads/notes.md",
      "tools/ai/downloads/my file.sql",
      "files/shared.zip",
      "tools/ai/page.md",
    ]) {
      const absolute = path.join(srcDir, file);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, "x");
    }
  });
  afterEach(() => {
    fs.rmSync(srcDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function render(markdown: string, options?: DownloadsOptions, relativePath = "tools/ai/page.md") {
    const md = new MarkdownIt().use(downloadsMarkdown, options);
    return md.render(markdown, { path: path.join(srcDir, relativePath), relativePath });
  }

  it("rewrites a relative link to a root-absolute download link", () => {
    expect(render("[q](./downloads/query.sql)")).toBe(
      '<p><a href="/tools/ai/downloads/query.sql" download="">q</a></p>\n',
    );
  });

  it("handles .md files, which VitePress would otherwise turn into pages", () => {
    expect(render("[n](./downloads/notes.md)")).toContain(
      'href="/tools/ai/downloads/notes.md" download',
    );
  });

  it("accepts a link without ./ and a root-absolute link", () => {
    expect(render("[q](downloads/query.sql)")).toContain('href="/tools/ai/downloads/query.sql"');
    expect(render("[q](/tools/ai/downloads/query.sql)")).toContain(
      'href="/tools/ai/downloads/query.sql"',
    );
  });

  it("resolves from the page's own folder, including ../", () => {
    expect(render("[z](../../files/shared.zip)", { folders: ["downloads", "files"] })).toContain(
      'href="/files/shared.zip" download',
    );
  });

  it("resolves relative to the page, not the source root", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render("[q](./downloads/query.sql)", undefined, "tools/ai/deep/page.md");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("tools/ai/deep/downloads/query.sql"));
  });

  it("decodes and re-encodes names with spaces and keeps ?query and #hash", () => {
    expect(render("[f](<./downloads/my file.sql>)")).toContain(
      'href="/tools/ai/downloads/my%20file.sql"',
    );
    expect(render("[f](./downloads/query.sql?v=2#top)")).toContain(
      'href="/tools/ai/downloads/query.sql?v=2#top"',
    );
  });

  it("honors custom folder names", () => {
    expect(render("[z](../../files/shared.zip)", { folders: "files" })).toMatch(DOWNLOAD_ATTR);
    expect(render("[q](./downloads/query.sql)", { folders: "files" })).not.toMatch(DOWNLOAD_ATTR);
  });

  it("leaves other links alone", () => {
    expect(render("[p](./page.md)")).toBe('<p><a href="./page.md">p</a></p>\n');
    expect(render("[e](https://example.com/downloads/a.sql)")).not.toMatch(DOWNLOAD_ATTR);
    expect(render("[h](#top)")).not.toMatch(DOWNLOAD_ATTR);
    expect(render("[m](mailto:a@example.com)")).not.toMatch(DOWNLOAD_ATTR);
    expect(render("[p](//cdn.example.com/downloads/a.sql)")).not.toMatch(DOWNLOAD_ATTR);
  });

  it("ignores a link that climbs out of the source directory", () => {
    expect(render("[x](../../../../../downloads/etc.sql)")).not.toMatch(DOWNLOAD_ATTR);
  });

  it("does not touch a link that already has a download attribute", () => {
    const md = new MarkdownIt().use(downloadsMarkdown);
    md.core.ruler.before("vitepress_downloads_links", "preset", (state) => {
      for (const block of state.tokens)
        for (const token of block.children ?? [])
          if (token.type === "link_open") token.attrSet("download", "custom.sql");
    });
    const html = md.render("[q](./downloads/query.sql)", {
      path: path.join(srcDir, "tools/ai/page.md"),
      relativePath: "tools/ai/page.md",
    });
    expect(html).toContain('href="./downloads/query.sql"');
    expect(html).toContain('download="custom.sql"');
  });

  it("warns on a missing file but still marks it as a download", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(render("[q](./downloads/missing.sql)")).toMatch(DOWNLOAD_ATTR);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("tools/ai/downloads/missing.sql"));
  });

  it("throws or stays quiet on a missing file as configured", () => {
    expect(() => render("[q](./downloads/missing.sql)", { onMissing: "error" })).toThrow(/no file/);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render("[q](./downloads/missing.sql)", { onMissing: "ignore" });
    expect(warn).not.toHaveBeenCalled();
  });

  it("does nothing without page paths in the environment", () => {
    const html = new MarkdownIt().use(downloadsMarkdown).render("[q](./downloads/query.sql)");
    expect(html).toBe('<p><a href="./downloads/query.sql">q</a></p>\n');
  });
});
