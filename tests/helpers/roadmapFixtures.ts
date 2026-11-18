import type {
    RoadmapGoalInput,
    RoadmapGoalResult,
} from "../../src/lib/roadmap/types";

export function makePlan(
    overrides: Partial<RoadmapGoalResult> = {},
    goal: Partial<RoadmapGoalInput> = {},
): RoadmapGoalResult {
    return {
        goal: {
            id: "goal-1",
            title: "Japan Holiday",
            emoji: "✈️",
            targetAmount: 6000,
            targetDate: "2026-12-31",
            spent: 0,
            done: false,
            ...goal,
        },
        order: 0,
        stillNeeded: 6000,
        fundedToday: 2000,
        progress: 1 / 3,
        monthsLeft: 6,
        claimStart: 0,
        claimEnd: 6000,
        available: 6000,
        gap: 0,
        margin: 0,
        shortPerMonth: 0,
        fillMonth: "2026-10",
        status: "on_track",
        ...overrides,
    };
}
