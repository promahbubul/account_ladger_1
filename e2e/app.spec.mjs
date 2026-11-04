// Browser tests for the main web flows: login, moving between pages, bulk expenses, reports and projects.
// They run against the throwaway API started by playwright.config.mjs, signed in as the seeded demo user.
import { test, expect } from '@playwright/test';

const USER = { email: 'user@example.com', password: 'E2e-user-password1!' };
const ADMIN = { email: 'mahbub@gmail.com', password: 'E2e-admin-password1!' };
// Projects only work on Postgres, which CI provides through E2E_DATABASE_URL.
const HAS_POSTGRES = Boolean(process.env.E2E_DATABASE_URL);

const PAGES = [
  ['/dashboard', 'Liquid Balance'],
  ['/accounts', 'Accounts'],
  ['/income', 'Income'],
  ['/expenses', 'Expenses'],
  ['/budgets', 'Monthly Budget'],
  ['/transfers', 'Transfers'],
  ['/loans', 'Loans'],
  ...(HAS_POSTGRES ? [['/projects', 'New Project']] : []),
  ['/categories', 'Categories'],
  ['/transactions', 'Transactions'],
  ['/reports', 'Total Inflows'],
  ['/settings', 'Settings'],
];

async function signIn(page, who = USER) {
  await page.goto('/login');
  await page.locator('input[autocomplete="username"]').fill(who.email);
  await page.locator('input[autocomplete="current-password"]').fill(who.password);
  // The tab above the form is also labelled "Sign In", so take the form's submit button.
  await page.locator('form button[type="submit"]').click();
  if (who === USER) await expect(page.getByText('Liquid Balance')).toBeVisible();
}

const failureBanner = (page) => page.getByText(/^Could not load/);

test('signing in shows the dashboard without loading the whole ledger', async ({ page }) => {
  const fullLedgerRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/transactions') && request.url().includes('all=true')) {
      fullLedgerRequests.push(request.url());
    }
  });

  await signIn(page);
  await expect(page.getByText('Recent Transactions')).toBeVisible();
  await expect(failureBanner(page)).toHaveCount(0);
  expect(fullLedgerRequests).toEqual([]);
});

test('every page in the sidebar opens without an error', async ({ page }) => {
  await signIn(page);
  for (const [href, marker] of PAGES) {
    await page.locator(`aside a[href="${href}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByText(marker, { exact: false }).first()).toBeVisible();
    await expect(failureBanner(page), `error shown on ${href}`).toHaveCount(0);
  }
});

test('a bulk expense batch is saved and shows up in the dashboard and reports', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Daily Expenses' }).click();
  const modal = page.locator('form').filter({ hasText: 'Payment Account' });
  await modal.getByLabel('Category').selectOption({ label: 'Food & Dining' });
  await modal.getByLabel('Description').fill('E2E lunch');
  await modal.getByLabel('Amount').fill('120.50');
  await modal.getByRole('button', { name: 'Add expense' }).click();
  await modal.getByLabel('Description').nth(1).fill('E2E dinner');
  await modal.getByLabel('Amount').nth(1).fill('79.50');
  await modal.getByRole('button', { name: /Save Batch/ }).click();
  await expect(modal).toBeHidden();

  // The dashboard refetches its period totals and newest rows after the save.
  await expect(page.getByText('E2E dinner')).toBeVisible();
  await expect(page.getByText('E2E lunch')).toBeVisible();

  await page.locator('aside a[href="/reports"]').click();
  const categories = page.locator('table').filter({ hasText: 'Share of Outflow' });
  const food = categories.locator('tr').filter({ hasText: 'Food & Dining' });
  await expect(food).toContainText('200.00');
  await expect(food).toContainText('2');
});

test('an admin can open users and audit logs', async ({ page }) => {
  await signIn(page, ADMIN);
  await page.locator('aside a[href="/admin/users"]').click();
  await expect(page.getByText('user@example.com').first()).toBeVisible();
  await page.locator('aside a[href="/admin/logs"]').click();
  await expect(page).toHaveURL(/\/admin\/logs$/);
  await expect(page.getByText(/Failed to fetch|Error loading/)).toHaveCount(0);
});

test('a project can be created and opened', async ({ page }) => {
  test.skip(!HAS_POSTGRES, 'Projects need Postgres (set E2E_DATABASE_URL to a throwaway database)');
  await signIn(page);
  await page.locator('aside a[href="/projects"]').click();

  await page.getByRole('button', { name: 'New Project' }).click();
  await page.getByLabel('Project Name *').fill('E2E Office Fit-out');
  await page.getByLabel('Client').fill('E2E Client');
  await page.getByRole('button', { name: 'Create Project' }).click();

  const row = page.locator('tr').filter({ hasText: 'E2E Office Fit-out' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('E2E Client');
  await row.click();
  await expect(page.getByRole('button', { name: 'Edit project' })).toBeVisible();
  await expect(failureBanner(page)).toHaveCount(0);
});
