# `@haakco/vike-plugin-docusaurus`

Vike dev-server integration and build helpers for a colocated Docusaurus site that uses Pagefind for search.

## What It Handles

- Builds a colocated Docusaurus site
- Generates a Pagefind index
- Swaps docs output atomically
- Serves `/docs/*` from a Vike dev server
- Rebuilds docs when source files under `docs-site/` change

## Vite Usage

```ts
import { vikePluginDocusaurus } from '@haakco/vike-plugin-docusaurus';

export default defineConfig({
  plugins: [
    vikePluginDocusaurus({
      rootDir: __dirname,
      siteDir: 'docs-site',
      outputDir: 'build/client/docs',
      mountPath: '/docs',
      dev: {
        proxyPort: 3001,
      },
    }),
  ],
});
```

## Build Usage

```bash
haakco-vike-docusaurus-build --root . --site-dir docs-site --output-dir build/client/docs
```
