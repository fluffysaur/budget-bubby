/**
 * Pool Jar geometry: stacks goal bands from the bottom in funding order,
 * sized by amount with a minimum height, and maps a money level to a height
 * so the water line lands inside the right band.
 */

export interface JarSegment {
    /** Money at the bottom and top of this segment. */
    from: number;
    to: number;
    /** Pixels from the jar floor. */
    bottom: number;
    height: number;
    /** Drawn with a squiggle break because it was squashed to fit. */
    broken: boolean;
}

export interface JarLayout {
    /** One segment per band, then an optional headroom segment above them. */
    bands: JarSegment[];
    headroom: JarSegment | null;
    height: number;
    /** Height in pixels for a money level, clamped to the jar. */
    toPx: (amount: number) => number;
}

export interface JarLayoutOptions {
    /** Band amounts in funding order. */
    bands: number[];
    /** Highest money level the jar must show (today or a preview). */
    maxLevel: number;
    /** Jar height in pixels. */
    height: number;
    /** Minimum band height in pixels (a 44px touch target). */
    minBand?: number;
    /** A band taller than this share of the jar is squashed and broken. */
    maxShare?: number;
}

/** Scales `weights` to fill `total`, giving every entry at least `min`. */
function fitHeights(
    weights: number[],
    total: number,
    min: number,
    indices: number[] = weights.map((_, i) => i),
): number[] {
    const heights = weights.map(() => 0);
    let free = indices;
    let remaining = total;
    // Pin entries that would fall below `min`, then share the rest.
    for (;;) {
        const weight = free.reduce((s, i) => s + weights[i], 0);
        const share = (i: number) =>
            weight > 0 ? (weights[i] / weight) * remaining : 0;
        const low = free.filter((i) => share(i) < min);
        if (low.length === 0) {
            for (const i of free) heights[i] = share(i);
            return heights;
        }
        for (const i of low) heights[i] = min;
        remaining = Math.max(0, remaining - low.length * min);
        free = free.filter((i) => !low.includes(i));
    }
}

export function layoutJar({
    bands,
    maxLevel,
    height,
    minBand = 44,
    maxShare = 0.5,
}: JarLayoutOptions): JarLayout {
    const amounts = bands.map((b) => Math.max(0, b));
    const claims = amounts.reduce((s, b) => s + b, 0);
    const headroomAmount = Math.max(0, maxLevel - claims);
    const weights = headroomAmount > 0 ? [...amounts, headroomAmount] : amounts;

    // The jar grows when minimum heights alone overflow it.
    const jarHeight = Math.max(height, weights.length * minBand);
    let heights = fitHeights(weights, jarHeight, minBand);

    const broken = weights.map(() => false);
    if (weights.length > 1) {
        const cap = jarHeight * maxShare;
        const bigIndex = heights.findIndex(
            (h, i) => h > cap && i < amounts.length,
        );
        if (bigIndex >= 0) {
            broken[bigIndex] = true;
            const others = weights
                .map((_, i) => i)
                .filter((i) => i !== bigIndex);
            const rest = fitHeights(weights, jarHeight - cap, minBand, others);
            heights = rest.map((h, i) => (i === bigIndex ? cap : h));
        }
    }

    const segments: JarSegment[] = [];
    let bottom = 0;
    let money = 0;
    weights.forEach((w, i) => {
        segments.push({
            from: money,
            to: money + w,
            bottom,
            height: heights[i],
            broken: broken[i],
        });
        bottom += heights[i];
        money += w;
    });

    const toPx = (amount: number): number => {
        if (segments.length === 0 || amount <= 0) return 0;
        for (const seg of segments) {
            if (amount <= seg.to) {
                const span = seg.to - seg.from;
                const f = span > 0 ? (amount - seg.from) / span : 1;
                return seg.bottom + f * seg.height;
            }
        }
        return jarHeight;
    };

    return {
        bands: segments.slice(0, amounts.length),
        headroom: headroomAmount > 0 ? segments[segments.length - 1] : null,
        height: jarHeight,
        toPx,
    };
}
