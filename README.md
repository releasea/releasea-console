# Releasea Console

Web dashboard for Releasea, built with React, TypeScript, and Vite.

## Overview

The Console is the primary UI for service lifecycle, deploy workflows, observability, traffic rules, governance, and platform settings.

> This README is primarily for component-level local development and contribution work. For end-user platform installation and usage, start with the public documentation linked below.

## Documentation

- Installation guide: [docs.releasea.io/?doc=installation](https://docs.releasea.io/?doc=installation)
- Installation modes: [docs.releasea.io/?doc=installation-modes](https://docs.releasea.io/?doc=installation-modes)
- Quickstart validation: [docs.releasea.io/?doc=smoke-checks](https://docs.releasea.io/?doc=smoke-checks)
- Environments and workers: [docs.releasea.io/?doc=environments-and-workers](https://docs.releasea.io/?doc=environments-and-workers)
- Public components: [docs.releasea.io/?doc=public-components](https://docs.releasea.io/?doc=public-components)
- Templates guide: [docs.releasea.io/?doc=templates](https://docs.releasea.io/?doc=templates)
- Contribution guide: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- Public roadmap: [../ROADMAP.md](../ROADMAP.md)

## Running Locally

```bash
npm install
npm run dev
```

## Build and Test

```bash
npm run build
npm run preview
npm run test
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `RELEASEA_API_BASE_URL` | Releasea API base URL | `http://localhost:8070/api` |
| `RELEASEA_WORKER_STALE_SECONDS` | Worker stale timeout (seconds) used for deploy, start, stop, and restart gating hints | `90` |
| `RELEASEA_ENABLE_SIGNUP` | Enables sign-up entrypoints in the auth UI | `false` |
| `RELEASEA_ADMIN_EMAIL` | Default email shown on the sign-in screen | `admin@releasea.io` |
| `RELEASEA_DOCS_URL` | Public documentation URL used by help links | `https://docs.releasea.io` |
| `RELEASEA_TEMPLATE_OWNER` | Default owner for template repository references | `releasea` |
| `RELEASEA_TEMPLATE_REPO` | Default template repository name | `templates` |

## Notes

- The Console consumes live status updates through SSE endpoints.
- Public docs are hosted separately in `releasea-docs` and linked via `RELEASEA_DOCS_URL`.

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.
