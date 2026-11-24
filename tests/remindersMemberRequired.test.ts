import { describe, expect, it, vi } from "vitest";
import {
    computeRemindersFrom,
    type ReminderDataSource,
} from "../src/lib/reminders/engine";
import { evaluateAndDispatchReminders } from "../src/lib/notificationScheduler";
import { financeService } from "../src/services/financeService";

describe("reminders without a member", () => {
    it("computes nothing and reads no data when memberId is empty", async () => {
        const source = new Proxy(
            {},
            {
                get: () => () => {
                    throw new Error("should not read data");
                },
            },
        ) as unknown as ReminderDataSource;
        await expect(
            computeRemindersFrom(source, { memberId: "" }),
        ).resolves.toEqual([]);
    });

    it("dispatches nothing when memberId is empty", async () => {
        const prefsSpy = vi.spyOn(financeService, "getNotificationPreferences");
        await expect(
            evaluateAndDispatchReminders({ memberId: "" }),
        ).resolves.toEqual([]);
        expect(prefsSpy).not.toHaveBeenCalled();
        prefsSpy.mockRestore();
    });
});
