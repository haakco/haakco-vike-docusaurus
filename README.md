# HaakCo Vike Docusaurus

Reusable tooling for mounting a Docusaurus site inside an existing Vike app, with Pagefind search support for both production builds and local development.

## Packages

- `@haakco/vike-plugin-docusaurus`

## Scope

This repo standardizes the HaakCo pattern for:

- colocating a `docs-site/` Docusaurus app inside a larger web app
- building docs into the host app output
- indexing docs with Pagefind
- serving `/docs/*` through Vike in development
- rebuilding docs safely without exposing partial Pagefind assets

The Docusaurus theme and styling remain project-level concerns unless a second shared package is added later.

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
```

## Intended Consumer Pattern

Projects should consume the published package from GitHub or npm rather than copying Vite middleware inline.
