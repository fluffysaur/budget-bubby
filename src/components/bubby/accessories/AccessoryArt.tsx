/**
 * Bubby accessories, each drawn once around the origin. Head items sit on
 * y = 0 and rise upwards; face items centre between the eyes; hand items
 * centre on the flipper tip.
 */

import type { AccessoryId } from "../../../lib/bubby/accessories";
import { COIN, INK, PINK } from "../../../lib/bubby/anchors";

const BUTTER = "var(--pastel-butter, #ffe999)";
const LILAC = "var(--pastel-lilac, #dfc2ff)";
const MINT = "var(--pastel-mint, #bbf7d0)";
const ink = (w: number) => ({
    stroke: INK,
    strokeWidth: w,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
});

function HardHat() {
    return (
        <g>
            <path d="M -102 0 C -102 -78 102 -78 102 0 Z" fill={BUTTER} {...ink(11)} />
            <path d="M -14 0 L -14 -54 Q 0 -66 14 -54 L 14 0" fill="none" {...ink(8)} />
            <rect x="-124" y="-10" width="248" height="24" rx="12" fill={BUTTER} {...ink(10)} />
        </g>
    );
}

function PartyHat() {
    return (
        <g>
            <path d="M -56 4 L 0 -120 L 56 4 Z" fill={LILAC} {...ink(9)} />
            <circle cx="-12" cy="-34" r="7" fill={PINK} />
            <circle cx="16" cy="-62" r="6" fill={COIN} />
            <circle cx="10" cy="-14" r="6" fill={MINT} />
            <circle cx="0" cy="-124" r="15" fill={PINK} {...ink(6)} />
        </g>
    );
}

function BucketHat() {
    return (
        <g>
            <path d="M -76 -2 C -70 -80 70 -80 76 -2 Z" fill={MINT} {...ink(10)} />
            <ellipse cx="0" cy="2" rx="118" ry="17" fill={MINT} {...ink(9)} />
            <path d="M -70 -22 Q 0 -10 70 -22" fill="none" {...ink(5)} />
        </g>
    );
}

function Crown() {
    return (
        <g>
            <path d="M -72 4 L -80 -70 L -40 -34 L 0 -88 L 40 -34 L 80 -70 L 72 4 Z" fill={COIN} {...ink(10)} />
            <circle cx="0" cy="-20" r="9" fill={PINK} {...ink(4)} />
            <circle cx="-44" cy="-14" r="7" fill={MINT} {...ink(4)} />
            <circle cx="44" cy="-14" r="7" fill={LILAC} {...ink(4)} />
        </g>
    );
}

function SparkleBow() {
    return (
        <g transform="translate(0 -26)">
            <path d="M 0 0 L -74 -38 L -68 34 Z" fill="#f7a8c9" {...ink(9)} />
            <path d="M 0 0 L 74 -38 L 68 34 Z" fill="#f7a8c9" {...ink(9)} />
            <circle cx="0" cy="0" r="17" fill={PINK} {...ink(8)} />
            <path d="M 78 -74 L 84 -60 L 98 -54 L 84 -48 L 78 -34 L 72 -48 L 58 -54 L 72 -60 Z" fill={COIN} {...ink(4)} />
        </g>
    );
}

function Specs() {
    return (
        <g>
            <circle cx="-63" cy="-14" r="32" fill="#ffffff" fillOpacity="0.25" {...ink(8)} />
            <circle cx="63" cy="-14" r="32" fill="#ffffff" fillOpacity="0.25" {...ink(8)} />
            <path d="M -31 -18 Q 0 -32 31 -18" fill="none" {...ink(7)} />
            <path d="M -95 -18 L -112 -26 M 95 -18 L 112 -26" fill="none" {...ink(7)} />
        </g>
    );
}

function Scarf() {
    return (
        <g>
            <path d="M 36 14 L 72 92 L 34 100 L 18 24 Z" fill={BUTTER} {...ink(9)} />
            <path d="M -102 -18 Q 0 12 102 -18 L 106 14 Q 0 44 -106 14 Z" fill={BUTTER} {...ink(10)} />
            <path d="M -60 -2 L -54 22 M 0 6 L 2 30 M 60 -2 L 54 22" fill="none" {...ink(5)} />
        </g>
    );
}

function KopiCup() {
    return (
        <g>
            <path d="M -8 -44 q -10 -12 0 -24" fill="none" {...ink(4)} opacity="0.5" />
            <path d="M -22 -30 L 22 -30 L 18 24 Q 0 32 -18 24 Z" fill="#ffffff" {...ink(8)} />
            <rect x="-21" y="-10" width="42" height="16" fill="#c98b4f" />
            <ellipse cx="0" cy="-30" rx="25" ry="7" fill="#ffffff" {...ink(7)} />
        </g>
    );
}

function AngBao() {
    return (
        <g transform="rotate(-10)">
            <rect x="-24" y="-34" width="48" height="64" rx="6" fill="#e2463b" {...ink(8)} />
            <path d="M -24 -30 L 0 -12 L 24 -30" fill="none" {...ink(5)} />
            <circle cx="0" cy="4" r="11" fill={COIN} {...ink(4)} />
        </g>
    );
}

function HeartBalloon() {
    return (
        <g>
            <path d="M 0 0 C -10 -40 14 -80 4 -124" fill="none" {...ink(4)} />
            <path d="M 4 -122 C -44 -156 -26 -204 4 -178 C 34 -204 52 -156 4 -122 Z" fill={PINK} {...ink(8)} />
            <ellipse cx="-10" cy="-170" rx="7" ry="4" fill="#ffffff" opacity="0.8" transform="rotate(-30 -10 -170)" />
        </g>
    );
}

export function AccessoryArt({ id }: { id: AccessoryId }) {
    switch (id) {
        case "hardhat":
            return <HardHat />;
        case "partyhat":
            return <PartyHat />;
        case "buckethat":
            return <BucketHat />;
        case "crown":
            return <Crown />;
        case "bow":
            return <SparkleBow />;
        case "specs":
            return <Specs />;
        case "scarf":
            return <Scarf />;
        case "kopi":
            return <KopiCup />;
        case "angbao":
            return <AngBao />;
        case "balloon":
            return <HeartBalloon />;
        default:
            return null;
    }
}
