/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly RELEASEA_API_BASE_URL?: string;
  readonly RELEASEA_ENABLE_SIGNUP?: string;
  readonly RELEASEA_ADMIN_EMAIL?: string;
  readonly RELEASEA_DOCS_URL?: string;
  readonly RELEASEA_TEMPLATE_OWNER?: string;
  readonly RELEASEA_TEMPLATE_REPO?: string;
  readonly RELEASEA_WORKER_STALE_SECONDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
