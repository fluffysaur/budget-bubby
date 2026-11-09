/**
 * Deep link configuration and launcher for banking apps.
 * Supports Singapore presets with native app schemes and web portal fallbacks.
 */

export interface BankDeepLinkConfig {
    bankName: string;
    appScheme: string;
    webUrl: string;
}

export const BANK_DEEP_LINKS: Record<string, BankDeepLinkConfig> = {
    dbs: {
        bankName: "DBS / POSB",
        appScheme: "dbsdigibank://",
        webUrl: "https://internet-banking.dbs.com.sg/",
    },
    ocbc: {
        bankName: "OCBC",
        appScheme: "ocbcdigital://",
        webUrl: "https://internet.ocbc.com/internet-banking/",
    },
    uob: {
        bankName: "UOB",
        appScheme: "uobtmrw://",
        webUrl: "https://pib.uob.com.sg/PIBLogin/",
    },
    citibank: {
        bankName: "Citibank",
        appScheme: "citimobile://",
        webUrl: "https://www.citibank.com.sg/",
    },
    "standard chartered": {
        bankName: "Standard Chartered",
        appScheme: "scmobile://",
        webUrl: "https://retail.sc.com/sg/nfs/login.htm",
    },
    hsbc: {
        bankName: "HSBC",
        appScheme: "hsbc://",
        webUrl: "https://www.hsbc.com.sg/",
    },
    amex: {
        bankName: "American Express",
        appScheme: "amex://",
        webUrl: "https://www.americanexpress.com/en-sg/account/login",
    },
    maybank: {
        bankName: "Maybank",
        appScheme: "maybanksg://",
        webUrl: "https://www.maybank2u.com.sg/",
    },
};

/**
 * Resolves a bank name to its deep link configuration, or null if unrecognised.
 */
export function getBankDeepLink(bankName: string): BankDeepLinkConfig | null {
    if (!bankName) return null;
    const normalized = bankName.trim().toLowerCase();

    if (normalized.includes("dbs") || normalized.includes("posb")) {
        return BANK_DEEP_LINKS.dbs;
    }
    if (normalized.includes("ocbc")) {
        return BANK_DEEP_LINKS.ocbc;
    }
    if (normalized.includes("uob")) {
        return BANK_DEEP_LINKS.uob;
    }
    if (normalized.includes("citi")) {
        return BANK_DEEP_LINKS.citibank;
    }
    if (
        normalized.includes("standard chartered") ||
        normalized.includes("stanchart") ||
        normalized.includes("scb")
    ) {
        return BANK_DEEP_LINKS["standard chartered"];
    }
    if (normalized.includes("hsbc")) {
        return BANK_DEEP_LINKS.hsbc;
    }
    if (normalized.includes("amex") || normalized.includes("american express")) {
        return BANK_DEEP_LINKS.amex;
    }
    if (normalized.includes("maybank")) {
        return BANK_DEEP_LINKS.maybank;
    }

    return null;
}

/**
 * Determines whether the current environment is a mobile browser.
 */
export function isMobileDevice(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Opens the banking app via deep link on mobile devices, or launches the bank's
 * web portal in a new tab on desktop or when app schemes are unsupported.
 */
export function openBankApp(bankName: string): void {
    const config = getBankDeepLink(bankName);
    if (!config) return;

    if (isMobileDevice() && typeof window !== "undefined") {
        let blurred = false;
        const onBlur = () => {
            blurred = true;
        };
        window.addEventListener("blur", onBlur, { once: true });

        // Try app scheme
        window.location.href = config.appScheme;

        // If the browser doesn't blur (app didn't open), fallback to web portal
        window.setTimeout(() => {
            window.removeEventListener("blur", onBlur);
            if (!blurred && typeof document !== "undefined" && !document.hidden) {
                window.open(config.webUrl, "_blank", "noopener,noreferrer");
            }
        }, 1500);
    } else if (typeof window !== "undefined") {
        window.open(config.webUrl, "_blank", "noopener,noreferrer");
    }
}
