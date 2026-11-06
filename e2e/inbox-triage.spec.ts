import { test, expect, type Page } from '@playwright/test';

// Demo mode seeds three pending items: Grab Food, Ntuc Fairprice, Starbucks.

async function freshInbox(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('budget_bubby_mock_inbox_v1'));
  await page.goto('/inbox');
  const card = page.getByTestId('inbox-card');
  await expect(card).toBeVisible();
  return card;
}

async function drag(page: Page, dx: number) {
  const box = await page.getByTestId('inbox-card').boundingBox();
  if (!box) throw new Error('No inbox card');
  const y = box.y + box.height / 2;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(x + (dx * i) / 10, y);
  }
  await page.mouse.up();
}

test.describe('Inbox triage', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('swipe right confirms, swipe left discards with Undo, then Inbox Zero', async ({ page }) => {
    const card = await freshInbox(page);
    await expect(page.getByText('3 to sort')).toBeVisible();
    await expect(card.getByText('Grab Food')).toBeVisible();

    await drag(page, 300);
    await expect(page.getByText('2 to sort')).toBeVisible();

    await drag(page, -300);
    await expect(page.getByText('1 to sort')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('2 to sort')).toBeVisible();

    await page.getByRole('button', { name: 'Discard' }).click();
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByText('No Captures')).toBeVisible();
  });

  test('Home card and Spend badge follow the count', async ({ page }) => {
    await freshInbox(page);
    await page.goto('/');
    const homeCard = page.getByRole('region', { name: 'Inbox' });
    await expect(homeCard.getByText('3 to sort')).toBeVisible();
    await expect(page.getByTestId('spend-inbox-badge')).toHaveText('3');

    await homeCard.getByRole('button', { name: 'Sort Now' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('2 to sort')).toBeVisible();

    await page.goto('/');
    await expect(page.getByTestId('spend-inbox-badge')).toHaveText('2');
  });
});
