import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownTextProps {
    children: string;
    className?: string;
}

const REMARK_PLUGINS = [remarkGfm];

/** Only http(s) links are clickable; everything else renders as plain text. */
function isSafeHref(href: string | undefined): href is string {
    return !!href && /^https?:\/\//i.test(href);
}

const COMPONENTS: Components = {
    p: ({ children }) => (
        <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>
    ),
    strong: ({ children }) => (
        <strong className="font-black">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    h1: ({ children }) => (
        <p className="mt-2 mb-1 font-black font-display first:mt-0">
            {children}
        </p>
    ),
    h2: ({ children }) => (
        <p className="mt-2 mb-1 font-black font-display first:mt-0">
            {children}
        </p>
    ),
    h3: ({ children }) => (
        <p className="mt-2 mb-1 font-black font-display first:mt-0">
            {children}
        </p>
    ),
    h4: ({ children }) => (
        <p className="mt-2 mb-1 font-black font-display first:mt-0">
            {children}
        </p>
    ),
    h5: ({ children }) => (
        <p className="mt-2 mb-1 font-black font-display first:mt-0">
            {children}
        </p>
    ),
    h6: ({ children }) => (
        <p className="mt-2 mb-1 font-black font-display first:mt-0">
            {children}
        </p>
    ),
    ul: ({ children }) => (
        <ul className="my-1.5 list-disc space-y-0.5 pl-5 first:mt-0 last:mb-0">
            {children}
        </ul>
    ),
    ol: ({ children }) => (
        <ol className="my-1.5 list-decimal space-y-0.5 pl-5 first:mt-0 last:mb-0">
            {children}
        </ol>
    ),
    li: ({ children }) => <li className="pl-0.5">{children}</li>,
    a: ({ href, children }) =>
        isSafeHref(href) ? (
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline underline-offset-2"
            >
                {children}
            </a>
        ) : (
            <span>{children}</span>
        ),
    img: ({ alt }) => <span>{alt}</span>,
    code: ({ children }) => (
        <code className="rounded-md border border-(--border-ink)/30 bg-(--bg-cream) px-1 py-0.5 font-mono text-[0.85em]">
            {children}
        </code>
    ),
    pre: ({ children }) => (
        <pre className="my-1.5 overflow-x-auto rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-2.5 text-xs [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0">
            {children}
        </pre>
    ),
    blockquote: ({ children }) => (
        <blockquote className="my-1.5 border-l-4 border-(--border-ink)/40 pl-2.5 text-(--text-muted)">
            {children}
        </blockquote>
    ),
    hr: () => <hr className="my-2 border-t-2 border-(--border-ink)/30" />,
    table: ({ children }) => (
        <div className="my-1.5 overflow-x-auto rounded-xl border-2 border-(--border-ink)">
            <table className="w-full border-collapse text-xs">{children}</table>
        </div>
    ),
    thead: ({ children }) => (
        <thead className="bg-(--bg-cream)">{children}</thead>
    ),
    th: ({ children, style }) => (
        <th
            style={style}
            className="whitespace-nowrap border-b-2 border-(--border-ink) px-2 py-1.5 text-left font-black"
        >
            {children}
        </th>
    ),
    td: ({ children, style }) => (
        <td
            style={style}
            className="whitespace-nowrap border-t border-(--border-ink)/20 px-2 py-1.5"
        >
            {children}
        </td>
    ),
};

/** Renders AI-produced markdown safely (no raw HTML, http(s)-only links). */
export const MarkdownText = memo(function MarkdownText({
    children,
    className,
}: MarkdownTextProps) {
    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={REMARK_PLUGINS}
                components={COMPONENTS}
                skipHtml
            >
                {children}
            </ReactMarkdown>
        </div>
    );
});
