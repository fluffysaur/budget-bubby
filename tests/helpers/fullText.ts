/**
 * getByText matcher on an element's full textContent, for text split across
 * nested spans (MetaList facts, label + emphasised value). Anchor the regex
 * (^...$) so ancestors with extra text don't also match.
 */
export const fullText =
    (re: RegExp) =>
    (_content: string, el: Element | null): boolean =>
        !!el && re.test(el.textContent ?? "");
