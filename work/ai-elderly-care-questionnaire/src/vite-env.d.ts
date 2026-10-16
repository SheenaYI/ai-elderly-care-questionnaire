/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUBMIT_ENDPOINT?: string
  readonly VITE_QUESTIONNAIRE_VERSION?: string
  readonly VITE_ALLOW_DEMO_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
