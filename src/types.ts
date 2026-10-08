export interface DownloadsOptions {
  /**
   * Folder name(s) whose contents are published as downloadable files. Any
   * folder with one of these names, at any depth under the docs source
   * directory, counts, and so does everything inside it.
   * @default ["downloads"]
   */
  folders?: string | string[];

  /**
   * What to do when a Markdown link points into a download folder but no such
   * file exists. `"error"` throws, which fails the build and shows the error
   * overlay in dev.
   * @default "warn"
   */
  onMissing?: "warn" | "error" | "ignore";
}
