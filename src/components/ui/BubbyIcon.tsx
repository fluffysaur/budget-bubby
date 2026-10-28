import React from "react";

export interface BubbyIconProps {
    className?: string;
}

/**
 * Budget Bubby Penguin Mascot Vector Icon (Waving ^ ^ Cheerful Peeking Portrait)
 */
export const BubbyIcon: React.FC<BubbyIconProps> = ({
    className = "h-7 w-7",
}) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="36 64 436 448"
            className={className}
            aria-hidden="true"
        >
            {/* Cute Rounded Head Feather Tuft */}
            <path
                d="M 254 114
                   C 242 84, 216 76, 214 92
                   C 212 104, 230 114, 244 120
                   Z"
                fill="#2b333c"
                stroke="#141414"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M 258 114
                   C 268 78, 300 72, 300 90
                   C 300 104, 282 114, 266 120
                   Z"
                fill="#2b333c"
                stroke="#141414"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Resting Right Flipper */}
            <path
                d="M 386 334
                   C 432 362, 464 406, 452 430
                   C 442 450, 408 438, 384 416
                   Z"
                fill="#2b333c"
                stroke="#141414"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Penguin Main Round Chubby Head & Torso Silhouette (Peeking from bottom) */}
            <path
                d="M 106 520
                   C 104 436, 118 368, 128 316
                   C 134 282, 130 242, 144 198
                   C 164 134, 206 112, 260 112
                   C 314 112, 356 134, 376 198
                   C 390 242, 386 282, 392 316
                   C 402 368, 416 436, 414 520
                   Z"
                fill="#2b333c"
                stroke="#141414"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Glossy Forehead Highlight */}
            <ellipse
                cx="190"
                cy="154"
                rx="18"
                ry="8"
                transform="rotate(-28 190 154)"
                fill="#ffffff"
                opacity="0.88"
            />
            <circle cx="166" cy="174" r="6" fill="#ffffff" opacity="0.88" />

            {/* White Face Mask & Connected White Tummy Patch */}
            <path
                d="M 260 258
                   C 246 190, 160 180, 150 256
                   C 142 312, 174 342, 168 368
                   C 158 412, 146 462, 146 520
                   L 374 520
                   C 374 462, 362 412, 352 368
                   C 346 342, 378 312, 370 256
                   C 360 180, 274 190, 260 258
                   Z"
                fill="#ffffff"
                stroke="#141414"
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Seamless Waving Left Flipper */}
            <path
                d="M 138 286
                   C 100 248, 54 216, 50 244
                   C 46 276, 74 344, 130 378"
                fill="#2b333c"
                stroke="#141414"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Happy ^ ^ Squinting Arc Eyes */}
            <path
                d="M 176 264 Q 197 236 218 264"
                fill="none"
                stroke="#141414"
                strokeWidth="11.5"
                strokeLinecap="round"
            />
            <path
                d="M 302 264 Q 323 236 344 264"
                fill="none"
                stroke="#141414"
                strokeWidth="11.5"
                strokeLinecap="round"
            />

            {/* Soft Rosy Blush Cheeks with Cute Diagonal Blush Marks */}
            <g>
                <ellipse
                    cx="176"
                    cy="296"
                    rx="23"
                    ry="12.5"
                    fill="#f7a8c9"
                    opacity="0.9"
                />
                <line
                    x1="167"
                    y1="300"
                    x2="172"
                    y2="292"
                    stroke="#ec4899"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                />
                <line
                    x1="175"
                    y1="300"
                    x2="180"
                    y2="292"
                    stroke="#ec4899"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                />
                <line
                    x1="183"
                    y1="300"
                    x2="188"
                    y2="292"
                    stroke="#ec4899"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                />
            </g>
            <g>
                <ellipse
                    cx="344"
                    cy="296"
                    rx="23"
                    ry="12.5"
                    fill="#f7a8c9"
                    opacity="0.9"
                />
                <line
                    x1="335"
                    y1="300"
                    x2="340"
                    y2="292"
                    stroke="#ec4899"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                />
                <line
                    x1="343"
                    y1="300"
                    x2="348"
                    y2="292"
                    stroke="#ec4899"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                />
                <line
                    x1="351"
                    y1="300"
                    x2="356"
                    y2="292"
                    stroke="#ec4899"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                />
            </g>

            {/* Cute Diamond-Rounded Open Smiling Beak */}
            <path
                d="M 224 278
                   Q 260 254 296 278
                   Q 290 322 260 326
                   Q 230 322 224 278 Z"
                fill="#f59e42"
                stroke="#141414"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M 237 285
                   Q 260 294 283 285
                   Q 277 314 260 316
                   Q 243 314 237 285 Z"
                fill="#9a1b1b"
                stroke="#141414"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M 246 302
                   Q 260 295 274 302
                   Q 269 315 260 316
                   Q 251 315 246 302 Z"
                fill="#f472b6"
            />
        </svg>
    );
};
