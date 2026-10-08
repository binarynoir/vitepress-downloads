import type { UserConfig } from "vitepress";
import type { MarkdownIt } from "markdown-it";
import { normalizeFolders } from "./files.js";
import { downloadsMarkdown } from "./markdown.js";
import type { DownloadsOptions } from "./types.js";
import { downloadsVitePlugin } from "./vite.js";

/**
 * `srcExclude` globs that keep Markdown files inside download folders from
 * being built as pages. `withDownloads` adds these for you.
 */
export function downloadsSrcExclude(options: DownloadsOptions = {}): string[] {
  return normalizeFolders(options.folders).map((folder) => `**/${folder}/**`);
}

/**
 * Wraps a VitePress config so every file in a download folder is published
 * and can be linked from Markdown with a relative path.
 *
 * ```ts
 * // .vitepress/config.mts
 * import { defineConfig } from "vitepress";
 * import { withDownloads } from "@binarynoir/vitepress-downloads/vitepress";
 *
 * export default withDownloads(defineConfig({ /* ...your config... *\/ }), {
 *   folders: ["downloads", "files"],
 * });
 * ```
 *
 * Existing `srcExclude`, `markdown.config` and `vite.plugins` are kept, so it
 * composes with other `withX()` wrappers in any order.
 */
export function withDownloads(config: UserConfig, options: DownloadsOptions = {}): UserConfig {
  // VitePress types this as string[], but a bare string is tolerated at runtime.
  const existingSrcExclude = config.srcExclude as string[] | string | undefined;
  config.srcExclude = [
    ...(Array.isArray(existingSrcExclude)
      ? existingSrcExclude
      : existingSrcExclude
        ? [existingSrcExclude]
        : []),
    ...downloadsSrcExclude(options),
  ];

  config.markdown ??= {};
  const existingMarkdownConfig = config.markdown.config ?? (() => {});
  config.markdown.config = (md) => {
    // VitePress 2 types this callback against `markdown-it-async`'s MarkdownIt,
    // a structural superset of plain markdown-it's; the cast bridges the two.
    downloadsMarkdown(md as unknown as MarkdownIt, options);
    existingMarkdownConfig(md);
  };

  config.vite ??= {};
  config.vite.plugins = [...(config.vite.plugins ?? []), downloadsVitePlugin(options)];

  return config;
}
