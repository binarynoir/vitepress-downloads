import fs from "node:fs";
import path from "node:path";
import type { MarkdownIt, StateCore, Token } from "markdown-it";
import { isDownloadPath, isInside, normalizeFolders } from "./files.js";
import type { DownloadsOptions } from "./types.js";

const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;

interface PageEnv {
  /** Absolute path of the Markdown file being rendered. */
  path?: string;
  /** Path of that file relative to the source directory, with `/` separators. */
  relativePath?: string;
}

/**
 * A markdown-it plugin that finds links into a download folder, such as
 * `[report](./downloads/report.sql)`, and rewrites them to the file's
 * published URL with a `download` attribute.
 *
 * The attribute is what makes this work in VitePress: it makes the link skip
 * VitePress's page-link handling (no `.html` suffix, no dead-link check, no
 * client-side routing), so the browser downloads the file.
 *
 * Links are resolved the way VitePress resolves any Markdown link: relative to
 * the page's source file, or to the source directory when they start with `/`.
 * Pair this with the Vite plugin, which publishes the files, and with
 * `srcExclude`, so Markdown files in a download folder are not built as pages.
 * `withDownloads` from `@binarynoir/vitepress-downloads/vitepress` does all three.
 */
export function downloadsMarkdown(md: MarkdownIt, options: DownloadsOptions = {}): void {
  const folders = normalizeFolders(options.folders);
  const onMissing = options.onMissing ?? "warn";

  md.core.ruler.after("inline", "vitepress_downloads_links", (state: StateCore) => {
    const env = state.env as PageEnv | undefined;
    if (!env?.path || !env.relativePath) return;

    // The page's own location tells us the source directory without any config.
    const depth = env.relativePath.split("/").length;
    const srcDir = path.resolve(env.path, ...Array<string>(depth).fill(".."));
    const pageDir = path.dirname(env.path);

    for (const block of state.tokens) {
      if (block.type !== "inline" || !block.children) continue;
      for (const token of block.children) {
        if (token.type === "link_open") rewriteLink(token, env, srcDir, pageDir);
      }
    }
  });

  function rewriteLink(token: Token, env: PageEnv, srcDir: string, pageDir: string): void {
    const href = String(token.attrGet("href") ?? "");
    if (!href || href.startsWith("#") || href.startsWith("//") || SCHEME_RE.test(href)) return;
    if (token.attrIndex("download") >= 0) return;

    const match = /^([^?#]*)(.*)$/.exec(href);
    const rawPath = match?.[1] ?? "";
    const suffix = match?.[2] ?? "";
    let decoded: string;
    try {
      decoded = decodeURIComponent(rawPath);
    } catch {
      return;
    }

    const absolute = decoded.startsWith("/")
      ? path.join(srcDir, decoded)
      : path.resolve(pageDir, decoded);
    if (!isInside(srcDir, absolute)) return;

    const relative = path.relative(srcDir, absolute).split(path.sep).join("/");
    if (!isDownloadPath(relative, folders)) return;

    if (!isFile(absolute) && onMissing !== "ignore") {
      const message = `[vitepress-downloads] ${env.relativePath}: no file at ${relative} (linked as "${href}")`;
      if (onMissing === "error") throw new Error(message);
      console.warn(message);
    }

    // Root-absolute, so the link survives any page URL style (cleanUrls,
    // index pages); VitePress adds the site `base` to a `/` href afterwards.
    token.attrSet("href", "/" + relative.split("/").map(encodeURIComponent).join("/") + suffix);
    token.attrSet("download", "");
  }
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
