import { test, expect } from '@playwright/test';

test.describe('Mobile Drawer Scrolling & Viewport Layout', () => {
  test('Add Account drawer is not cut off and can scroll on mobile', async ({ page }) => {
    // Test on a small mobile device viewport (iPhone SE size: 375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/accounts');

    const addBtn = page.getByRole('button', { name: 'Add Account' }).first();
    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Wait for drawer slide-up animation (220ms) to complete
    await page.waitForTimeout(300);

    // Verify header is visible
    await expect(dialog.getByRole('heading', { level: 2, name: /Add New Account/i })).toBeVisible();

    // Verify footer actions are visible and completely within the viewport
    const createBtn = dialog.getByRole('button', { name: /Create Account/i });
    const cancelBtn = dialog.getByRole('button', { name: /Cancel/i });
    await expect(createBtn).toBeVisible();
    await expect(cancelBtn).toBeVisible();

    const createBox = await createBtn.boundingBox();
    expect(createBox).not.toBeNull();
    expect(createBox!.y + createBox!.height).toBeLessThanOrEqual(667);

    // Verify form container is scrollable
    const scrollContainer = dialog.locator('form > div.overflow-y-auto');
    await expect(scrollContainer).toBeVisible();

    // Expand the "+ More details" collapsible to make the form even taller
    const moreDetailsBtn = dialog.getByRole('button', { name: /\+ More details/i });
    await moreDetailsBtn.click();

    // Check notes input is in the DOM
    const notesInput = dialog.locator('#account-notes');
    await expect(notesInput).toBeAttached();

    // Scroll down inside the form container
    await scrollContainer.hover();
    await scrollContainer.evaluate((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.scrollTop = 200;
      htmlEl.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(200);

    const scrollTop = await scrollContainer.evaluate((el) => (el as HTMLElement).scrollTop);
    expect(scrollTop).toBeGreaterThan(0);

    // Verify footer actions are STILL visible and anchored at the bottom
    await expect(createBtn).toBeVisible();
    const createBoxAfter = await createBtn.boundingBox();
    expect(createBoxAfter!.y + createBoxAfter!.height).toBeLessThanOrEqual(667);

    // Close the modal
    await cancelBtn.click();
    await expect(dialog).not.toBeVisible();
  });

  test('Quick Add Expense drawer is not cut off and can scroll on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/expenses');

    const quickAddBtn = page.getByRole('button', { name: /Quick Add/i }).first();
    await quickAddBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Wait for drawer slide-up animation (220ms) to complete
    await page.waitForTimeout(300);

    // Verify header and footer are visible within viewport
    await expect(dialog.getByRole('heading', { level: 2, name: /Quick Add Expense/i })).toBeVisible();
    const addExpenseBtn = dialog.getByRole('button', { name: /Add Expense/i });
    await expect(addExpenseBtn).toBeVisible();

    const btnBox = await addExpenseBtn.boundingBox();
    expect(btnBox).not.toBeNull();
    expect(btnBox!.y + btnBox!.height).toBeLessThanOrEqual(667);

    // Expand date and notes
    const dateToggleBtn = dialog.getByRole('button', { name: /Add note \/ date|Today/i });
    await dateToggleBtn.click();

    // Verify scrolling
    const scrollContainer = dialog.locator('form > div.overflow-y-auto');
    await scrollContainer.hover();
    await scrollContainer.evaluate((el) => {
      const htmlEl = el as HTMLElement;
      htmlEl.scrollTop = 200;
      htmlEl.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(200);

    const scrollTop = await scrollContainer.evaluate((el) => (el as HTMLElement).scrollTop);
    expect(scrollTop).toBeGreaterThan(0);

    // Close modal
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
