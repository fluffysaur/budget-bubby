import { test, expect, type Page } from "@playwright/test";

async function openAddExpenseModal(page: Page, isMobile: boolean) {
    if (isMobile) {
        await page
            .getByRole("navigation", { name: "Mobile Navigation" })
            .getByRole("button", { name: "Quick Add" })
            .click();
    } else {
        await page
            .getByRole("button", { name: /Add Expense/i })
            .first()
            .click();
    }
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    return modal;
}

test.describe("Offline Queue Sync Flow", () => {
    test("goes offline, adds an expense, edits it, deletes another, goes online, and preserves final state", async ({
        page,
        context,
        isMobile,
    }) => {
        await page.goto("/expenses");

        // 1. Add a baseline expense while online so it exists in the current month view
        const initialModal = await openAddExpenseModal(page, isMobile);
        await initialModal.locator('input[placeholder="0.00"]').fill("12.00");
        await initialModal.locator("#expense-item").fill("Online Toast Set");
        await initialModal.getByRole("button", { name: /^Add$/i }).click();
        await expect(initialModal).not.toBeVisible();
        await expect(page.getByText("Online Toast Set").first()).toBeVisible();

        // 2. Go offline
        await context.setOffline(true);
        await expect(page.getByRole("status").first()).toContainText(
            /offline/i,
        );

        // 3. Add a new expense while offline
        const addModal = await openAddExpenseModal(page, isMobile);
        await addModal.locator('input[placeholder="0.00"]').fill("24.50");
        await addModal.locator("#expense-item").fill("Offline Laksa");
        await addModal.getByRole("button", { name: /^Add$/i }).click();
        await expect(addModal).not.toBeVisible();

        await expect(page.getByText("Offline Laksa").first()).toBeVisible();
        await expect(page.getByText("S$24.50").first()).toBeVisible();

        // 4. Edit the newly added offline expense
        await page
            .getByRole("button", { name: "Edit Offline Laksa" })
            .first()
            .click();
        const editModal = page.getByRole("dialog");
        await expect(editModal).toBeVisible();
        await editModal.locator('input[placeholder="0.00"]').fill("28.00");
        await editModal.locator("#expense-item").fill("Offline Laksa Upsized");
        await editModal.getByRole("button", { name: /^Save$/i }).click();
        await expect(editModal).not.toBeVisible();

        await expect(
            page.getByText("Offline Laksa Upsized").first(),
        ).toBeVisible();
        await expect(page.getByText("S$28.00").first()).toBeVisible();

        // 5. Delete the other ("Online Toast Set") expense while offline
        await page
            .getByRole("button", { name: "Delete Online Toast Set" })
            .first()
            .click();
        const deleteModal = page.getByRole("dialog");
        await expect(deleteModal).toBeVisible();
        await deleteModal
            .getByRole("button", {
                name: "Confirm delete Online Toast Set",
            })
            .click();
        await expect(deleteModal).not.toBeVisible();
        await expect(page.getByText("Online Toast Set")).toHaveCount(0);

        // 6. Reconnect (go online) and wait for outbox to flush
        await context.setOffline(false);

        await expect
            .poll(async () => {
                return await page.evaluate(() => {
                    const raw = window.localStorage.getItem(
                        "budget_bubby_offline_outbox_v1",
                    );
                    if (!raw) return 0;
                    try {
                        return JSON.parse(raw).length;
                    } catch {
                        return -1;
                    }
                });
            })
            .toBe(0);

        // 7. Assert final state on the page
        await expect(
            page.getByText("Offline Laksa Upsized").first(),
        ).toBeVisible();
        await expect(page.getByText("S$28.00").first()).toBeVisible();
        await expect(page.getByText("Online Toast Set")).toHaveCount(0);
    });
});
