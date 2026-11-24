import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { execSync } from "child_process";
import pkg from "./package.json";

function resolveGitSha(): string {
    const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA;
    if (vercelSha) {
        return vercelSha.slice(0, 7);
    }
    try {
        return execSync("git rev-parse --short HEAD", {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        }).trim();
    } catch {
        return "dev";
    }
}

function getNodeModulePackage(id: string): string | null {
    const normalized = id.replaceAll("\\", "/");
    const marker = "/node_modules/";
    const lastIdx = normalized.lastIndexOf(marker);
    if (lastIdx === -1) return null;
    const rest = normalized.slice(lastIdx + marker.length);
    if (rest.startsWith("@")) {
        const parts = rest.split("/");
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
    }
    return rest.split("/")[0] || null;
}

const REACT_VENDOR_PACKAGES = new Set([
    "react",
    "react-dom",
    "scheduler",
    "react-router",
    "react-router-dom",
]);

const MOTION_VENDOR_PACKAGES = new Set([
    "motion",
    "motion-dom",
    "motion-utils",
]);

const UI_VENDOR_PACKAGES = new Set(["tailwind-merge", "clsx"]);

// https://vite.dev/config/
export default defineConfig({
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
        __GIT_SHA__: JSON.stringify(resolveGitSha()),
    },
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: "prompt",
            includeAssets: [
                "icon.svg",
                "favicon.ico",
                "pwa-192x192.png",
                "pwa-512x512.png",
                "apple-touch-icon.png",
                "vite.svg",
            ],
            manifest: {
                name: "Budget Bubby",
                short_name: "Budget Bubby",
                description:
                    "Couple & Personal Finance Planner for Singapore households",
                theme_color: "#e9e2da",
                background_color: "#e9e2da",
                display: "standalone",
                orientation: "portrait",
                start_url: "/",
                scope: "/",
                icons: [
                    {
                        src: "/pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                    {
                        src: "/pwa-maskable-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                        purpose: "maskable",
                    },
                    {
                        src: "/icon.svg",
                        sizes: "any",
                        type: "image/svg+xml",
                        purpose: "any",
                    },
                ],
                shortcuts: [
                    {
                        name: "Add Expense",
                        short_name: "Add",
                        description: "Log a new household or personal expense",
                        url: "/expenses?action=new",
                        icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
                    },
                    {
                        name: "Expenses",
                        short_name: "Expenses",
                        description: "View household expenses list",
                        url: "/expenses",
                        icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
                    },
                    {
                        name: "Dashboard",
                        short_name: "Dashboard",
                        description: "View overall finance dashboard",
                        url: "/",
                        icons: [{ src: "/pwa-192x192.png", sizes: "192x192" }],
                    },
                ],
            },
            // Custom service worker (src/sw.ts) for push notifications.
            // Precaching and font caching that generateSW used to do live there too.
            strategies: "injectManifest",
            srcDir: "src",
            filename: "sw.ts",
            injectManifest: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
            },
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    const pkgName = getNodeModulePackage(id);
                    if (!pkgName) return undefined;
                    if (REACT_VENDOR_PACKAGES.has(pkgName)) {
                        return "vendor-react";
                    }
                    if (pkgName.startsWith("@supabase/")) {
                        return "vendor-supabase";
                    }
                    if (pkgName.startsWith("@tanstack/")) {
                        return "vendor-query";
                    }
                    if (MOTION_VENDOR_PACKAGES.has(pkgName)) {
                        return "vendor-motion";
                    }
                    if (
                        pkgName.startsWith("@floating-ui/") ||
                        UI_VENDOR_PACKAGES.has(pkgName)
                    ) {
                        return "vendor-ui";
                    }
                    return undefined;
                },
            },
        },
    },
    server: {
        port: 5173,
    },
});
