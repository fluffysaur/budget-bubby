/**
 * Little snack treats for Bubby's collection (inline SVG, 64x64).
 */

import { COIN, INK, PINK } from "../../lib/bubby/anchors";

const line = {
    stroke: INK,
    strokeWidth: 4,
    strokeLinejoin: "round" as const,
    strokeLinecap: "round" as const,
};

function Art({ id }: { id: string }) {
    switch (id) {
        case "fish":
            return (
                <g>
                    <path
                        d="M 10 32 C 20 18 40 18 48 32 C 40 46 20 46 10 32 Z"
                        fill="#9cc7e8"
                        {...line}
                    />
                    <path
                        d="M 48 32 L 58 22 L 58 42 Z"
                        fill="#9cc7e8"
                        {...line}
                    />
                    <circle cx="20" cy="30" r="2.5" fill={INK} />
                </g>
            );
        case "popsicle":
            return (
                <g>
                    <rect
                        x="28"
                        y="40"
                        width="8"
                        height="18"
                        rx="4"
                        fill="#d9b38c"
                        {...line}
                    />
                    <rect
                        x="18"
                        y="8"
                        width="28"
                        height="38"
                        rx="12"
                        fill={PINK}
                        {...line}
                    />
                    <path d="M 18 22 L 46 22" {...line} fill="none" />
                </g>
            );
        case "cake":
            return (
                <g>
                    <path
                        d="M 8 46 L 56 46 L 56 30 L 8 38 Z"
                        fill="#fde2b8"
                        {...line}
                    />
                    <path
                        d="M 8 38 L 56 30 L 34 20 Z"
                        fill="#ffffff"
                        {...line}
                    />
                    <circle cx="36" cy="18" r="5" fill="#e2463b" {...line} />
                </g>
            );
        case "kaya-toast":
            return (
                <g>
                    <rect
                        x="10"
                        y="14"
                        width="44"
                        height="36"
                        rx="10"
                        fill="#e9b872"
                        {...line}
                    />
                    <rect
                        x="16"
                        y="20"
                        width="32"
                        height="24"
                        rx="6"
                        fill="#fff3d6"
                    />
                    <path
                        d="M 18 32 L 46 32"
                        stroke="#7fb069"
                        strokeWidth="6"
                        strokeLinecap="round"
                    />
                </g>
            );
        case "curry-puff":
            return (
                <g>
                    <path
                        d="M 8 42 C 8 18 56 18 56 42 Z"
                        fill={COIN}
                        {...line}
                    />
                    <path
                        d="M 12 40 q 4 -6 8 0 q 4 -6 8 0 q 4 -6 8 0 q 4 -6 8 0 q 4 -6 8 0"
                        fill="none"
                        {...line}
                    />
                </g>
            );
        case "dumpling":
        default:
            return (
                <g>
                    <path
                        d="M 8 40 C 8 22 56 22 56 40 C 46 48 18 48 8 40 Z"
                        fill="#f4f1ec"
                        {...line}
                    />
                    <path
                        d="M 22 28 q 4 6 0 10 M 32 26 q 4 6 0 12 M 42 28 q 4 6 0 10"
                        fill="none"
                        {...line}
                    />
                </g>
            );
    }
}

export function SnackArt({
    id,
    className = "h-8 w-8",
}: {
    id: string;
    className?: string;
}) {
    return (
        <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
            <Art id={id} />
        </svg>
    );
}

export default SnackArt;
