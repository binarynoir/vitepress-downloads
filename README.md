# vitepress-downloads

[![npm version](https://img.shields.io/npm/v/@binarynoir/vitepress-downloads.svg)](https://www.npmjs.com/package/@binarynoir/vitepress-downloads)
[![CI](https://github.com/binarynoir/vitepress-downloads/actions/workflows/ci.yml/badge.svg)](https://github.com/binarynoir/vitepress-downloads/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@binarynoir/vitepress-downloads.svg)](LICENSE)

A [VitePress](https://vitepress.dev) plugin that turns a folder named
`downloads` into downloadable files, linked with a plain relative path.

[Documentation and live demo](https://binarynoir.github.io/plugins/downloads)

[![Support me on Buy Me a Coffee](https://img.shields.io/badge/Support%20me-Buy%20Me%20a%20Coffee-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/binarynoir)
[![Support me on Ko-fi](https://img.shields.io/badge/Support%20me-Ko--fi-blue?style=for-the-badge&logo=ko-fi)](https://ko-fi.com/binarynoir)
[![Visit my website](https://img.shields.io/badge/Website-binarynoir.tech-8c8c8c?style=for-the-badge)](https://binarynoir.tech)

## What this does

VitePress is built for pages. Getting a `.sql`, `.zip`, `.xlsx` or even a `.md`
file onto the site as a download normally means copying it into `public/` and
linking it by an absolute URL that has nothing to do with where the page lives.

With this plugin you keep the file next to the page that uses it:

```txt
docs/tools/ai/
  index.md
  downloads/
    check-access.sql
    template.xlsx
```

```md
[Access check script](./downloads/check-access.sql)
```

Every file in that folder is published at the same path (`/tools/ai/downloads/check-access.sql`),
and the link becomes a real download link.

- **Relative links work.** Resolved from the page, like any Markdown link.
- **Any file type**, including `.md`, `.js`, `.json` and `.ts`. Markdown files in a download folder are never built as pages.
- **Any folder name, any depth.** One `downloads` folder per section, or `files`, or both.
- **Works in `vitepress dev` and `vitepress build`**, so what you click while writing is what ships.

## Install

```sh
npm install --save-dev @binarynoir/vitepress-downloads
```

## Usage

```ts
// .vitepress/config.mts
import { defineConfig } from "vitepress";
import { withDownloads } from "@binarynoir/vitepress-downloads/vitepress";

export default withDownloads(
  defineConfig({
    // ...your config
  }),
);
```

`withDownloads` keeps your existing `srcExclude`, `markdown.config` and
`vite.plugins`, so it composes with other `withX()` wrappers in any order.

### Linking

Link from any page the way you would to another Markdown file:

```md
[Script](./downloads/script.sql)
[Template](downloads/template.xlsx)
[Shared file](/guide/downloads/shared.zip)
```

A path that starts with `/` is relative to the docs source directory. A link
is treated as a download when the file it points to is inside a download
folder. All other links are left to VitePress.

The link is rewritten to the file's root-absolute URL (so it survives
`cleanUrls`, index pages and a site `base`) and gets a `download` attribute.
That attribute is also what keeps VitePress from turning `file.sql` into
`file.sql.html` or running a dead-link check on it.

## Options

| Option      | Default         | Description                                                                                                                          |
| ----------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `folders`   | `["downloads"]` | Folder name or names to publish. Names, not paths: `"files"` matches `docs/a/files/` and `docs/b/c/files/`.                          |
| `onMissing` | `"warn"`        | What to do when a link points into a download folder but the file is not there: `"warn"`, `"error"` (fails the build) or `"ignore"`. |

```ts
withDownloads(config, { folders: ["downloads", "files"], onMissing: "error" });
```

## Sidebar and navbar

The plugin keeps Markdown files in download folders out of the VitePress build,
but it cannot see your navigation plugins. If you generate the sidebar from the
folder tree, such as with
[`@binarynoir/vitepress-auto-sidebar`](https://github.com/binarynoir/vitepress-auto-sidebar),
exclude the folder there too, or a downloadable `notes.md` shows up as a dead
sidebar page. With auto-sidebar and auto-navbar, put the folder name in an
`.exclude` file in the folder that contains it:

```txt
# docs/tools/ai/.exclude
downloads/
```

## Behavior details

- **Hidden files** (`.DS_Store`) and `node_modules` are never published.
- **Symlinks** inside a download folder are followed, in dev and build.
- **Dev server**: downloads are served from disk as attachments (`Content-Disposition: attachment`), ahead of Vite, so a `.js` or `.ts` download is not transformed into a module.
- **Build**: files are emitted once, by the client build, at the same path they have under the source directory.
- **Case matters**: `Downloads` is not `downloads`.
- **Everything in a download folder is public.** The files are copied into the built site as they are. Do not keep anything there you would not put on the site.

## Lower-level pieces

`withDownloads` is three things. Use them separately when you need more control:

```ts
import { downloadsMarkdown, downloadsVitePlugin } from "@binarynoir/vitepress-downloads";
import { downloadsSrcExclude } from "@binarynoir/vitepress-downloads/vitepress";

export default defineConfig({
  srcExclude: downloadsSrcExclude({ folders: ["files"] }),
  markdown: { config: (md) => md.use(downloadsMarkdown, { folders: ["files"] }) },
  vite: { plugins: [downloadsVitePlugin({ folders: ["files"] })] },
});
```

Pass the same options to all three.

## Releasing

Releases are tag-triggered. To ship a new version, from a clean `main` that's
in sync with `origin/main`:

```sh
npm run release:patch   # or release:minor / release:major
```

This runs typecheck/lint/test/build locally, then `npm version <bump>`
(bumps `package.json`, commits, and creates a matching `vX.Y.Z` tag) and
`git push --follow-tags`. Pushing that tag triggers
[`.github/workflows/release.yml`](.github/workflows/release.yml), which
re-runs the checks, publishes to npm (with
[provenance](https://docs.npmjs.com/generating-provenance-statements)), and
creates a GitHub release with auto-generated notes.

For a prerelease or an explicit version, use `npm run release -- <arg>`
(e.g. `npm run release -- 1.2.3` or `npm run release -- prerelease`) — see
[`npm version`](https://docs.npmjs.com/cli/v10/commands/npm-version) for the
full list of accepted values.

This requires an `NPM_TOKEN` repository secret (an npm
[automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens)
with publish access) — set it under Settings → Secrets and variables →
Actions.

## License

[MIT](LICENSE)

---

## Support

If you encounter any issues or have questions, please open an issue on [GitHub](https://github.com/binarynoir/vitepress-downloads/issues).

## Author

John Smith III

## Acknowledgments

Thanks to all contributors and users for their support and feedback.
