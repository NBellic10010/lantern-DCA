/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_SUI_NETWORK: string;
  readonly VITE_PACKAGE_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

