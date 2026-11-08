import { defineConfig, devices } from "@playwright/test";

// Dedicated port so e2e never reuses an unrelated dev server on 5173.
const E2E_PORT = 5199;
const E2E_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: [["list"], ["html", { open: "never" }]],
    use: {
        baseURL: E2E_URL,
        trace: "on-first-retry",
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "Mobile Safari",
            use: { ...devices["iPhone 12"] },
        },
    ],
    webServer: {
        command: `npm run dev -- --port ${E2E_PORT} --strictPort`,
        url: E2E_URL,
        reuseExistingServer: false,
        // Empty Supabase vars override any .env file, forcing mock data mode.
        env: {
            VITE_SUPABASE_URL: "",
            VITE_SUPABASE_ANON_KEY: "",
        },
    },
});
