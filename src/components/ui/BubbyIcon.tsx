import React from "react";

export interface BubbyIconProps {
    className?: string;
}

/**
 * Budget Bubby Penguin Mascot Vector Icon (framed for in-app badges & headers)
 */
export const BubbyIcon: React.FC<BubbyIconProps> = ({ className = "h-7 w-7" }) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="95 68 322 368"
            className={className}
            aria-hidden="true"
        >
            {/* Subtle Flat Ground Shadow */}
            <ellipse cx="256" cy="428" rx="120" ry="10" fill="#c7a2f5" />

            {/* Left & Right Feet */}
            <ellipse
                cx="198"
                cy="418"
                rx="30"
                ry="14"
                fill="#f59e42"
                stroke="#141414"
                strokeWidth="8"
                transform="rotate(-5 198 418)"
            />
            <ellipse
                cx="314"
                cy="418"
                rx="30"
                ry="14"
                fill="#f59e42"
                stroke="#141414"
                strokeWidth="8"
                transform="rotate(5 314 418)"
            />

            {/* Cute Head Feather Tuft */}
            <path
                d="M 246 104 C 242 82, 230 74, 226 80 C 234 88, 239 96, 241 104 Z"
                fill="#2b333c"
                stroke="#141414"
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M 254 104 C 258 78, 272 72, 277 78 C 268 86, 263 95, 261 104 Z"
                fill="#2b333c"
                stroke="#141414"
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Penguin Main Body */}
            <path
                d="M 256 100
                   C 188 100, 148 144, 142 208
                   C 138 248, 122 286, 122 338
                   C 122 404, 174 422, 256 422
                   C 338 422, 390 404, 390 338
                   C 390 286, 374 248, 370 208
                   C 364 144, 324 100, 256 100 Z"
                fill="#2b333c"
                stroke="#141414"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* White Face & Belly Patch */}
            <path
                d="M 256 154
                   C 234 134, 174 138, 172 194
                   C 170 232, 180 264, 172 310
                   C 162 364, 198 404, 256 404
                   C 314 404, 350 364, 340 310
                   C 332 264, 342 232, 340 194
                   C 338 138, 278 134, 256 154 Z"
                fill="#ffffff"
                stroke="#141414"
                strokeWidth="7.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Gentle Curved Eyebrows */}
            <path
                d="M 224 176 Q 232 171 239 175"
                fill="none"
                stroke="#141414"
                strokeWidth="5.5"
                strokeLinecap="round"
            />
            <path
                d="M 273 175 Q 280 171 288 176"
                fill="none"
                stroke="#141414"
                strokeWidth="5.5"
                strokeLinecap="round"
            />

            {/* Solid Black Oval Dot Eyes */}
            <ellipse cx="233" cy="190" rx="5" ry="7" fill="#141414" />
            <ellipse cx="279" cy="190" rx="5" ry="7" fill="#141414" />

            {/* Soft Rosy Blush Cheeks */}
            <ellipse cx="204" cy="204" rx="14" ry="8" fill="#f7a8c9" opacity="0.8" />
            <ellipse cx="308" cy="204" rx="14" ry="8" fill="#f7a8c9" opacity="0.8" />

            {/* Cute Small Rounded Beak */}
            <path
                d="M 244 200 C 244 195, 268 195, 268 200 C 268 209, 262 215, 256 215 C 250 215, 244 209, 244 200 Z"
                fill="#f59e42"
                stroke="#141414"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Flat Pastel Gold Coin Held Against Tummy */}
            <g>
                <circle
                    cx="256"
                    cy="322"
                    r="74"
                    fill="#ffe47a"
                    stroke="#141414"
                    strokeWidth="8"
                />
                <circle
                    cx="256"
                    cy="322"
                    r="55"
                    fill="#ffda54"
                    stroke="#141414"
                    strokeWidth="5.5"
                />
                <path
                    d="M 268 304 C 268 295, 244 295, 244 306 C 244 316, 268 317, 268 329 C 268 340, 244 340, 244 330"
                    fill="none"
                    stroke="#141414"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <line
                    x1="256"
                    y1="289"
                    x2="256"
                    y2="346"
                    stroke="#141414"
                    strokeWidth="7"
                    strokeLinecap="round"
                />
            </g>

            {/* Seamlessly Attached Left Arm / Flipper */}
            <path
                d="M 136 240 C 118 278, 124 342, 198 342 C 216 342, 218 316, 198 313 C 168 308, 158 284, 160 256 Z"
                fill="#2b333c"
                stroke="none"
            />
            <path
                d="M 136 240 C 118 278, 124 342, 198 342 C 216 342, 218 316, 198 313 C 168 308, 158 284, 160 256"
                fill="none"
                stroke="#141414"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Seamlessly Attached Right Arm / Flipper */}
            <path
                d="M 376 240 C 394 278, 388 342, 314 342 C 296 342, 294 316, 314 313 C 344 308, 354 284, 352 256 Z"
                fill="#2b333c"
                stroke="none"
            />
            <path
                d="M 376 240 C 394 278, 388 342, 314 342 C 296 342, 294 316, 314 313 C 344 308, 354 284, 352 256"
                fill="none"
                stroke="#141414"
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

