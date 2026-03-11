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

## Browser Search Helpers

Use the browser-safe export in Docusaurus theme code:

```ts
import {
  createPagefindSearchClient,
  enablePagefindHighlighting,
} from '@haakco/vike-plugin-docusaurus/browser';

const search = createPagefindSearchClient({
  baseUrl: '/docs/',
  features: {
    highlighting: { param: 'highlight' },
    metadata: { fields: ['section', 'audience'] },
    subResults: { maxItems: 3 },
    filters: false,
    sorting: false,
  },
});
```

Use `enablePagefindHighlighting()` from `docs-site/src/theme/Root.tsx` to highlight terms after navigation:

```ts
void enablePagefindHighlighting({
  baseUrl: '/docs/',
  highlightParam: 'highlight',
});
```

### Feature Options

- `features.highlighting`
  - `false` disables destination-page term highlighting
  - `{ param: 'highlight' }` enables query-param-based highlighting
- `features.metadata`
  - `false` disables metadata extraction
  - `{ fields: ['section', 'audience'] }` exposes selected Pagefind metadata fields
- `features.subResults`
  - `false` disables section/sub-result rendering
  - `{ maxItems: 3 }` limits how many sub-results are surfaced per result
- `features.filters`
  - `false` disables default filters
  - `{ defaultValue: { section: 'api' } }` sets default filters
- `features.sorting`
  - `false` disables default sorting
  - `{ defaultValue: 'date:desc' }` or a Pagefind sort object sets the default sort

This keeps the common search setup simple while still making advanced behavior opt-in and declarative.

## Content Conventions

The shared package does not force content annotations, but it is designed to work cleanly with Pagefind’s content attributes:

- `data-pagefind-meta` for extra metadata fields
- `data-pagefind-filter` for faceted search values
- `data-pagefind-weight` for custom ranking

The recommended pattern is:
- keep the base integration minimal
- enable `metadata`, `filters`, and `sorting` through config
- use `data-pagefind-*` annotations only where a project needs more control

## Build Usage

```bash
haakco-vike-docusaurus-build --root . --site-dir docs-site --output-dir build/client/docs
```

## Development

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```
