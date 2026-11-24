import { useEffect, useState } from "react";
import type {
    BaseBudgetProfile,
    BaseProfileAllocation,
    Category,
    HouseholdMember,
} from "../types/finance";

export interface MockSeedDefaults {
    members: HouseholdMember[];
    categories: Category[];
    baseProfiles: BaseBudgetProfile[];
    baseAllocations: BaseProfileAllocation[];
}

const EMPTY_DEFAULTS: MockSeedDefaults = {
    members: [],
    categories: [],
    baseProfiles: [],
    baseAllocations: [],
};

let cachedDefaults: MockSeedDefaults | null = null;
let pendingDefaultsPromise: Promise<MockSeedDefaults> | null = null;

function loadMockSeedDefaults(): Promise<MockSeedDefaults> {
    if (cachedDefaults) {
        return Promise.resolve(cachedDefaults);
    }
    if (!pendingDefaultsPromise) {
        pendingDefaultsPromise = import("../data/mockSeedData").then((mod) => {
            cachedDefaults = {
                members: mod.mockMembers,
                categories: mod.mockCategories,
                baseProfiles: mod.mockBaseProfiles,
                baseAllocations: mod.mockBaseAllocations,
            };
            return cachedDefaults;
        });
    }
    return pendingDefaultsPromise;
}

/**
 * Lazily loads mock seed metadata only when mock/demo mode is active.
 * Keeps `src/data/mockSeedData.ts` out of the production bundle.
 */
export function useLazyMockDefaults(enabled: boolean): MockSeedDefaults {
    const [defaults, setDefaults] = useState<MockSeedDefaults>(() =>
        enabled && cachedDefaults ? cachedDefaults : EMPTY_DEFAULTS,
    );

    useEffect(() => {
        if (!enabled || cachedDefaults) {
            return;
        }
        let cancelled = false;
        void loadMockSeedDefaults().then((loaded) => {
            if (!cancelled) {
                setDefaults(loaded);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [enabled]);

    if (!enabled) {
        return EMPTY_DEFAULTS;
    }
    return cachedDefaults ?? defaults;
}
