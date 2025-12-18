# thynkai-toolkits

Creator and contributor tooling for ThynkAI.

This repository provides practical tools to:
- scaffold model entries and validator projects
- validate registry and protocol artifacts locally
- package and publish metadata updates safely
- run common checks used across the ThynkAI ecosystem

This repo is intentionally pragmatic. It should be useful with or without the rest of the org.

## What lives here

- `packages/cli/` — the ThynkAI CLI (`thynkai`)
- `packages/templates/` — templates used by the CLI
- `packages/validators/` — local validator runner helpers (lightweight)
- `docs/` — usage and contributor docs

## Quickstart

```bash
npm ci
npm run build
node packages/cli/dist/index.js --help
```

## Contributing

- Guide: `CONTRIBUTING.md`
- Code of Conduct: `CODE_OF_CONDUCT.md`
- Security: `SECURITY.md`

## Links

- Org: https://github.com/thynkai
- Core protocol primitives: https://github.com/thynkai/thynkai-core
- Models registry: https://github.com/thynkai/thynkai-models
- Docs hub: https://github.com/thynkai/thynkai-docs

