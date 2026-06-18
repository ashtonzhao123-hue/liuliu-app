/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_AMAP_KEY?: string;
  readonly VITE_AMAP_SECURITY_CODE?: string;
  readonly VITE_PLATFORM_FEE_RATE?: string;
  readonly VITE_HEFENG_WEATHER_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
