# Contributing to thynkai-toolkits

Tooling should be boring, predictable, and easy to audit.

## Development

```bash
npm ci
npm run ci
```

## Standards

- Keep commands deterministic and side-effect safe.
- Prefer explicit flags over implicit behavior.
- Avoid network access by default (require `--yes` / `--dry-run=false`).
- Produce machine-readable output when possible (`--json`).

## Review process

Maintainers review for:
- safety (no destructive defaults)
- backwards compatibility (CLI flags and outputs)
- documentation updates
- tests for parsing/validation logic

## Community

Follow `CODE_OF_CONDUCT.md`. For security issues, see `SECURITY.md`.

