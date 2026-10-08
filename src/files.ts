import fs from "node:fs";
import path from "node:path";

export const DEFAULT_FOLDERS = ["downloads"];

/** Accepts one name or a list; falls back to the default when none is given. */
export function normalizeFolders(folders: string | string[] | undefined): string[] {
  const names = (Array.isArray(folders) ? folders : folders ? [folders] : DEFAULT_FOLDERS)
    .map((name) => name.trim().replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  for (const name of names) {
    if (name.includes("/") || name.includes("\\") || name === "." || name === "..") {
      throw new Error(
        `[vitepress-downloads] Folder name "${name}" must be a single folder name, not a path.`,
      );
    }
  }
  return names.length > 0 ? names : DEFAULT_FOLDERS;
}

function isHiddenOrIgnored(segment: string): boolean {
  return segment.startsWith(".") || segment === "node_modules";
}

/**
 * True when a POSIX path relative to the source directory is a file inside a
 * download folder. Hidden entries (`.DS_Store`, `.vitepress/`) and
 * `node_modules` never count.
 */
export function isDownloadPath(relativePath: string, folders: string[]): boolean {
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.length < 2 || segments.some(isHiddenOrIgnored)) return false;
  return segments.slice(0, -1).some((segment) => folders.includes(segment));
}

/** True when `target` is `root` or inside it. */
export function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

/** Every publishable file under `srcDir`, as POSIX paths relative to it. */
export function listDownloadFiles(srcDir: string, folders: string[]): string[] {
  const found: string[] = [];

  const walk = (dir: string, relativeDir: string, insideDownloads: boolean): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (isHiddenOrIgnored(entry.name)) continue;
      const relative = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const absolute = path.join(dir, entry.name);
      // Follow symlinks to files and folders, as a web server would.
      const stat = entry.isSymbolicLink() ? safeStat(absolute) : undefined;
      const isDirectory = stat ? stat.isDirectory() : entry.isDirectory();
      const isFile = stat ? stat.isFile() : entry.isFile();

      if (isDirectory) {
        walk(absolute, relative, insideDownloads || folders.includes(entry.name));
      } else if (isFile && insideDownloads) {
        found.push(relative);
      }
    }
  };

  walk(srcDir, "", false);
  return found.sort();
}

function safeStat(file: string): fs.Stats | undefined {
  try {
    return fs.statSync(file);
  } catch {
    return undefined;
  }
}
