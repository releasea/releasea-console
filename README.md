# Releasea Console

Web dashboard for Releasea, built with React, TypeScript, and Vite.

## Overview

The console is the primary UI for service lifecycle, deploy workflows, observability, traffic rules, governance, and settings.

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
| `RELEASEA_ENABLE_SIGNUP` | Enables sign-up entrypoints in auth UI | `false` |
| `RELEASEA_ADMIN_EMAIL` | Default email shown on auth screen | `admin@releasea.io` |
| `RELEASEA_DOCS_URL` | Public documentation URL used by help links | `https://docs.releasea.io` |
| `RELEASEA_TEMPLATE_OWNER` | Default owner for template repository references | `releasea` |
| `RELEASEA_TEMPLATE_REPO` | Default template repository name | `templates` |

## Notes

- The console consumes live status updates through SSE endpoints.
- Public docs are hosted separately in `releasea-docs` and linked via `RELEASEA_DOCS_URL`.

## License

Apache 2.0 - See [LICENSE](LICENSE) for details.
