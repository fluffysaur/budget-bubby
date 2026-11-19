export const APP_VERSION: string =
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";

export const GIT_SHA: string =
    typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "";

export function formatAppVersion(version: string, sha?: string): string {
    const cleanVersion = version.replace(/^v/, "").trim() || "0.0.0";
    const cleanSha = sha?.trim();
    return cleanSha ? `v${cleanVersion} (${cleanSha})` : `v${cleanVersion}`;
}
