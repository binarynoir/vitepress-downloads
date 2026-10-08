import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { isDownloadPath, isInside, listDownloadFiles, normalizeFolders } from "./files.js";
import { contentTypeFor } from "./mime.js";
import type { DownloadsOptions } from "./types.js";

/**
 * A Vite plugin that publishes every file inside a download folder.
 *
 * - Build: copies each file into the output at the same path it has under the
 *   source directory, so `docs/guide/downloads/a.sql` is served at
 *   `/guide/downloads/a.sql`. Only the client build emits them.
 * - Dev: serves the same URLs straight from disk, as attachments, ahead of
 *   Vite's own handling, so `.js`, `.ts` and `.json` downloads are not
 *   transformed into modules.
 */
export function downloadsVitePlugin(options: DownloadsOptions = {}): Plugin {
  const folders = normalizeFolders(options.folders);
  let root = process.cwd();
  let base = "/";
  let isSsrBuild = false;

  return {
    name: "vitepress-downloads",

    configResolved(config) {
      root = config.root;
      base = config.base.startsWith("/") ? config.base : "/";
      isSsrBuild = !!config.build.ssr;
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();

        let pathname: string;
        try {
          pathname = decodeURIComponent((req.url ?? "").split("?")[0] ?? "");
        } catch {
          return next();
        }
        if (!pathname.startsWith(base) || pathname.includes("\0")) return next();

        const relative = pathname.slice(base.length).replace(/^\/+/, "");
        if (!isDownloadPath(relative, folders)) return next();

        const file = path.resolve(root, relative);
        if (!isInside(root, file)) return next();

        let real: string;
        try {
          real = fs.realpathSync(file);
          if (!fs.statSync(real).isFile()) return next();
        } catch {
          return next();
        }
        // `real` follows symlinks, as the build copy does; the `..` check above
        // already rejected any request path that climbs out of the source directory.
        const size = fs.statSync(real).size;
        const name = path.basename(file);

        res.setHeader("Content-Type", contentTypeFor(file));
        res.setHeader("Content-Length", size);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        );
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "no-cache");
        if (req.method === "HEAD") return void res.end();
        fs.createReadStream(real).pipe(res);
      });
    },

    generateBundle() {
      // VitePress runs a client build and an SSR build; publish once.
      const environment = (this as { environment?: { name: string } }).environment;
      if (environment ? environment.name !== "client" : isSsrBuild) return;

      for (const relative of listDownloadFiles(root, folders)) {
        this.emitFile({
          type: "asset",
          fileName: relative,
          source: fs.readFileSync(path.join(root, relative)),
        });
      }
    },
  };
}
