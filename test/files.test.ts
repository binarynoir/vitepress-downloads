import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isDownloadPath, isInside, listDownloadFiles, normalizeFolders } from "../src/files.js";

describe("normalizeFolders", () => {
  it("defaults to downloads", () => {
    expect(normalizeFolders(undefined)).toEqual(["downloads"]);
    expect(normalizeFolders([])).toEqual(["downloads"]);
  });

  it("accepts a string or a list and trims slashes", () => {
    expect(normalizeFolders("files")).toEqual(["files"]);
    expect(normalizeFolders(["/downloads/", "files"])).toEqual(["downloads", "files"]);
  });

  it("rejects paths", () => {
    expect(() => normalizeFolders("a/b")).toThrow(/single folder name/);
    expect(() => normalizeFolders("..")).toThrow(/single folder name/);
  });
});

describe("isDownloadPath", () => {
  const folders = ["downloads", "files"];

  it("matches files in a download folder at any depth", () => {
    expect(isDownloadPath("downloads/a.sql", folders)).toBe(true);
    expect(isDownloadPath("tools/ai/downloads/a.sql", folders)).toBe(true);
    expect(isDownloadPath("tools/files/deep/er/a.sql", folders)).toBe(true);
  });

  it("does not match elsewhere", () => {
    expect(isDownloadPath("tools/ai/a.sql", folders)).toBe(false);
    expect(isDownloadPath("tools/downloads-old/a.sql", folders)).toBe(false);
    expect(isDownloadPath("downloads", folders)).toBe(false);
    expect(isDownloadPath("tools/downloads", folders)).toBe(false);
  });

  it("ignores hidden entries and node_modules", () => {
    expect(isDownloadPath("downloads/.DS_Store", folders)).toBe(false);
    expect(isDownloadPath(".vitepress/dist/downloads/a.sql", folders)).toBe(false);
    expect(isDownloadPath("downloads/node_modules/a.js", folders)).toBe(false);
  });
});

describe("isInside", () => {
  it("accepts the root and its children, rejects siblings and parents", () => {
    expect(isInside("/a/b", "/a/b")).toBe(true);
    expect(isInside("/a/b", "/a/b/c")).toBe(true);
    expect(isInside("/a/b", "/a/c")).toBe(false);
    expect(isInside("/a/b", "/a")).toBe(false);
  });
});

describe("listDownloadFiles", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "vpd-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (relative: string) => {
    const file = path.join(dir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "x");
  };

  it("lists files under download folders only, skipping hidden and node_modules", () => {
    write("index.md");
    write("ai/page.md");
    write("ai/downloads/a.sql");
    write("ai/downloads/sub/b.md");
    write("ai/downloads/.DS_Store");
    write("files/c.zip");
    write(".vitepress/dist/downloads/old.sql");
    write("node_modules/pkg/downloads/n.js");

    expect(listDownloadFiles(dir, ["downloads", "files"])).toEqual([
      "ai/downloads/a.sql",
      "ai/downloads/sub/b.md",
      "files/c.zip",
    ]);
  });

  it("returns nothing when there are no download folders", () => {
    write("index.md");
    expect(listDownloadFiles(dir, ["downloads"])).toEqual([]);
  });
});
