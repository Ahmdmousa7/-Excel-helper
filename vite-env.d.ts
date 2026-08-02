/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Renders the app without Google sign-in so Playwright can reach the shell.
   * Set only by `npm run build:e2e` and the Playwright web server. Statically
   * false in a production build — see components/AuthWrapper.tsx.
   */
  readonly VITE_E2E_AUTH_BYPASS?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
