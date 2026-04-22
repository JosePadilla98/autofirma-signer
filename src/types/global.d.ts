// Ambient declaration file — no imports/exports so all interfaces merge globally.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Window {
  AutoScript: any;
}

interface ImportMetaEnv {
  readonly PUBLIC_SERVLET_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
