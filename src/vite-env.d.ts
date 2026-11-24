/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
    /** Web Push public key. When set, pushes come from the send-reminders function. */
    readonly VITE_VAPID_PUBLIC_KEY?: string;
    /** Members' PIN sign-in emails, comma-separated. */
    readonly VITE_MEMBER_EMAILS?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string;
