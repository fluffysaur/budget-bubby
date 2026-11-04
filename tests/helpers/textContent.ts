/**
 * Text matcher for sentences that contain a <CurrencyText> amount, e.g.
 * "Food is S$80.00 over". Matches the innermost element whose full text
 * content (including child elements) matches, instead of only its own text nodes.
 */
const normalize = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

export function withText(pattern: RegExp) {
    return (_content: string, element: Element | null): boolean => {
        if (!element) return false;
        if (!pattern.test(normalize(element.textContent))) return false;
        return !Array.from(element.children).some((child) =>
            pattern.test(normalize(child.textContent)),
        );
    };
}
