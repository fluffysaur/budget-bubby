import { defineConfig } from 'vite';
import path from 'path';

/**
 * Bundles the server-side reminder sender for the send-reminders Edge
 * Function: `npm run build:functions` writes
 * supabase/functions/_shared/dist/send-reminders.js (gitignored).
 */
export default defineConfig({
  // Expose no env vars: the app's browser config must not be baked into the
  // server bundle. The function gets its client from Deno secrets.
  envPrefix: 'BB_SERVER_BUNDLE_NONE_',
  publicDir: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'supabase/functions/_shared/dist',
    emptyOutDir: true,
    target: 'es2022',
    minify: false,
    sourcemap: false,
    lib: {
      entry: path.resolve(__dirname, 'src/server/sendReminders.ts'),
      formats: ['es'],
      fileName: () => 'send-reminders.js',
    },
    rollupOptions: {
      // Resolved by the function's deno.json import map
      external: ['@supabase/supabase-js'],
    },
  },
});
