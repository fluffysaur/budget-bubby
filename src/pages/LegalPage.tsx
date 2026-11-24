/**
 * Public legal page (privacy policy / terms of use).
 * Rendered outside the auth gate so it works logged out and in demo mode.
 */

import { useEffect } from "react";
import { applyThemeClass, readStoredTheme } from "../lib/theme";
import { Alert } from "../components/ui/Alert";
import { Card } from "../components/ui/Card";
import { BubbyIcon } from "../components/ui/BubbyIcon";
import {
    LEGAL_DOCS,
    LEGAL_DRAFT_NOTICE,
    LEGAL_LAST_UPDATED,
    LEGAL_PATHS,
    type LegalDocKey,
} from "../data/legalContent";

export interface LegalPageProps {
    doc: LegalDocKey;
}

const LINK_CLASS =
    "inline-flex min-h-11 items-center underline decoration-(--pastel-lilac) decoration-2 underline-offset-2";

export function LegalPage({ doc }: LegalPageProps) {
    // Public route renders outside HouseholdProvider, so apply the saved theme here.
    useEffect(() => {
        applyThemeClass(readStoredTheme());
    }, []);

    const content = LEGAL_DOCS[doc];
    const otherKey: LegalDocKey = doc === "privacy" ? "terms" : "privacy";

    return (
        <div
            data-testid={`legal-page-${doc}`}
            className="min-h-dvh w-full bg-(--bg-canvas) text-(--text-ink) px-4 py-8"
        >
            <main className="mx-auto w-full max-w-2xl flex flex-col gap-4">
                <a
                    href="/"
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-(--text-muted) hover:text-(--text-ink) transition-colors"
                >
                    <BubbyIcon className="h-8 w-8" />
                    <span>Budget Bubby</span>
                </a>

                <h1 className="text-2xl font-black tracking-tight font-display">
                    {content.title}
                </h1>

                <Alert variant="warning" title="Draft">
                    {LEGAL_DRAFT_NOTICE}
                </Alert>

                <p className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                    Updated {LEGAL_LAST_UPDATED}
                </p>
                <p className="text-sm font-medium text-(--text-muted)">
                    {content.summary}
                </p>

                {content.sections.map((section) => (
                    <Card key={section.heading} elevation="sm" padding="md">
                        <h2 className="text-lg font-black font-display mb-2">
                            {section.heading}
                        </h2>
                        {section.paragraphs?.map((p) => (
                            <p
                                key={p}
                                className="text-sm font-medium leading-relaxed mb-2 wrap-break-word"
                            >
                                {p}
                            </p>
                        ))}
                        {section.bullets && (
                            <ul className="list-disc pl-5 text-sm font-medium leading-relaxed space-y-1 wrap-break-word">
                                {section.bullets.map((b) => (
                                    <li key={b}>{b}</li>
                                ))}
                            </ul>
                        )}
                    </Card>
                ))}

                <nav
                    aria-label="Legal"
                    className="flex flex-wrap gap-4 pt-2 text-sm font-bold"
                >
                    <a href={LEGAL_PATHS[otherKey]} className={LINK_CLASS}>
                        {LEGAL_DOCS[otherKey].title}
                    </a>
                    <a href="/" className={LINK_CLASS}>
                        Back to app
                    </a>
                </nav>
            </main>
        </div>
    );
}

export default LegalPage;
