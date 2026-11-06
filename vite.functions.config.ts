import { defineConfig } from 'vite';
import path from 'path';

/**
 * Bundles the server-side code for the Edge Functions:
 * `npm run build:functions` writes supabase/functions/_shared/dist/
 * send-reminders.js and capture-expense.js (gitignored).
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
      entry: {
        'send-reminders': path.resolve(__dirname, 'src/server/sendReminders.ts'),
        'capture-expense': path.resolve(__dirname, 'src/server/captureExpense.ts'),
      },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
    rollupOptions: {
      // Resolved by the function's deno.json import map
      external: ['@supabase/supabase-js'],
    },
  },
});
