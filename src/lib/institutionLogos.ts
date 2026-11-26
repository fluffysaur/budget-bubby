/** Bundled institution logos in `public/logos/`. No third-party requests. */

/** Normalised institution name -> logo file name. */
export const INSTITUTION_ALIASES: Record<string, string> = {
    dbs: "dbs",
    "dbs bank": "dbs",
    posb: "dbs",
    "posb bank": "dbs",
    "dbs posb": "dbs",
    ocbc: "ocbc",
    "ocbc bank": "ocbc",
    "ocbc securities": "ocbc",
    uob: "uob",
    "uob bank": "uob",
    "united overseas bank": "uob",
    "uob kay hian": "uob",
    cpf: "cpf",
    "cpf board": "cpf",
    "central provident fund": "cpf",
    ibkr: "ibkr",
    "interactive brokers": "ibkr",
    moomoo: "moomoo",
    "moomoo sg": "moomoo",
    futu: "moomoo",
    webull: "webull",
    "webull singapore": "webull",
    sgx: "sgx",
    cdp: "sgx",
    "sgx cdp": "sgx",
    tiger: "tiger",
    "tiger brokers": "tiger",
    "tiger trade": "tiger",
    syfe: "syfe",
    endowus: "endowus",
    stashaway: "stashaway",
    "stash away": "stashaway",
    citi: "citibank",
    citibank: "citibank",
    hsbc: "hsbc",
    sc: "stanchart",
    stanchart: "stanchart",
    "standard chartered": "stanchart",
    "standard chartered bank": "stanchart",
    trust: "trust",
    "trust bank": "trust",
    youtrip: "youtrip",
    "you trip": "youtrip",
};

function normalise(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

/** Logo URL for an institution name, or null when none is bundled. */
export function getInstitutionLogo(
    institution: string | null | undefined,
): string | null {
    if (!institution) return null;
    const key = normalise(institution);
    if (!Object.hasOwn(INSTITUTION_ALIASES, key)) return null;
    return `${import.meta.env.BASE_URL}logos/${INSTITUTION_ALIASES[key]}.png`;
}

const INITIAL_COLOURS = [
    "bg-(--pastel-mint)",
    "bg-(--pastel-butter)",
    "bg-(--pastel-lilac)",
    "bg-(--pastel-coral)",
    "bg-(--pastel-pink)",
];

/** Stable pastel background for an initial circle. */
export function getInitialColour(name: string): string {
    let hash = 0;
    for (const char of normalise(name)) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return INITIAL_COLOURS[hash % INITIAL_COLOURS.length];
}

export function getInitial(name: string): string {
    return name.match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() ?? "?";
}
