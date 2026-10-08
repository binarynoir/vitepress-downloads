import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plugin } from "vite";
import { downloadsVitePlugin } from "../src/vite.js";

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

describe("downloadsVitePlugin", () => {
  let root: string;

  beforeEach(() => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "vpd-vite-")));
    fs.mkdirSync(path.join(root, "ai/downloads"), { recursive: true });
    fs.writeFileSync(path.join(root, "ai/downloads/query.sql"), "select 1;");
    fs.writeFileSync(path.join(root, "ai/downloads/app.js"), "export {}");
    fs.writeFileSync(path.join(root, "ai/page.md"), "# page");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  function setup(config: { base?: string; ssr?: boolean } = {}, options = {}) {
    const plugin = downloadsVitePlugin(options);
    (plugin.configResolved as (c: unknown) => void)({
      root,
      base: config.base ?? "/",
      build: { ssr: config.ssr ?? false },
    });
    return plugin;
  }

  function middlewareOf(plugin: Plugin): Middleware {
    let registered!: Middleware;
    (plugin.configureServer as (s: unknown) => void)({
      middlewares: { use: (fn: Middleware) => (registered = fn) },
    });
    return registered;
  }

  /** Runs the middleware against a fake response and waits for the body to finish. */
  async function request(middleware: Middleware, url: string, method = "GET") {
    const headers: Record<string, unknown> = {};
    const res = Object.assign(new PassThrough(), {
      setHeader: (key: string, value: unknown) => void (headers[key] = value),
    });
    const chunks: Buffer[] = [];
    res.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<void>((resolve) => res.on("end", resolve));
    const next = vi.fn(() => res.end());

    middleware({ url, method } as IncomingMessage, res as unknown as ServerResponse, next);
    await finished;
    return { headers, next, body: Buffer.concat(chunks).toString() };
  }

  describe("build", () => {
    function generate(plugin: Plugin, environment?: { name: string }) {
      const emitted: { fileName: string; source: Buffer }[] = [];
      const context = {
        environment,
        emitFile: (file: { fileName: string; source: Buffer }) => emitted.push(file),
      };
      (plugin.generateBundle as (this: unknown) => void).call(context);
      return emitted;
    }

    it("emits each download at its source-relative path", () => {
      const emitted = generate(setup());
      expect(emitted.map((f) => f.fileName)).toEqual([
        "ai/downloads/app.js",
        "ai/downloads/query.sql",
      ]);
      expect(emitted[1]?.source.toString()).toBe("select 1;");
    });

    it("emits only from the client environment", () => {
      expect(generate(setup(), { name: "ssr" })).toEqual([]);
      expect(generate(setup(), { name: "client" })).toHaveLength(2);
    });

    it("skips an SSR build when no environment is reported", () => {
      expect(generate(setup({ ssr: true }))).toEqual([]);
    });
  });

  describe("dev server", () => {
    it("serves a download as an attachment", async () => {
      const { headers, body, next } = await request(
        middlewareOf(setup()),
        "/ai/downloads/query.sql?t=1",
      );
      expect(next).not.toHaveBeenCalled();
      expect(headers["Content-Type"]).toBe("text/plain; charset=utf-8");
      expect(headers["Content-Disposition"]).toContain("attachment");
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(body).toBe("select 1;");
    });

    it("answers HEAD without a body", async () => {
      const { body, next } = await request(
        middlewareOf(setup()),
        "/ai/downloads/query.sql",
        "HEAD",
      );
      expect(next).not.toHaveBeenCalled();
      expect(body).toBe("");
    });

    it("serves .js downloads raw, so Vite does not transform them", async () => {
      const { next, headers, body } = await request(middlewareOf(setup()), "/ai/downloads/app.js");
      expect(body).toBe("export {}");
      expect(next).not.toHaveBeenCalled();
      expect(headers["Content-Type"]).toBe("application/octet-stream");
    });

    it("passes everything else to the next handler", async () => {
      const middleware = middlewareOf(setup());
      const urls = [
        "/ai/page.md",
        "/ai/downloads/missing.sql",
        "/ai/downloads/",
        "/ai/downloads/%E0%A4%A",
        "/ai/downloads/../page.md",
        "/ai/downloads/..%2F..%2Fsecret.sql",
      ];
      for (const url of urls) {
        expect((await request(middleware, url)).next, url).toHaveBeenCalled();
      }
      expect(
        (await request(middleware, "/ai/downloads/query.sql", "POST")).next,
      ).toHaveBeenCalled();
    });

    it("follows a symlink placed inside a download folder, like the build copy", async () => {
      const outside = path.join(os.tmpdir(), `vpd-secret-${process.pid}.txt`);
      fs.writeFileSync(outside, "secret");
      fs.symlinkSync(outside, path.join(root, "ai/downloads/link.txt"));
      try {
        const { next, body } = await request(middlewareOf(setup()), "/ai/downloads/link.txt");
        expect(next).not.toHaveBeenCalled();
        expect(body).toBe("secret");
      } finally {
        fs.rmSync(outside, { force: true });
      }
    });

    it("respects a site base", async () => {
      const middleware = middlewareOf(setup({ base: "/docs/" }));
      expect(
        (await request(middleware, "/docs/ai/downloads/query.sql")).next,
      ).not.toHaveBeenCalled();
      expect((await request(middleware, "/ai/downloads/query.sql")).next).toHaveBeenCalled();
    });
  });
});
