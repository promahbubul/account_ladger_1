/* global document, window -- these lines run inside the browser page. */
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
  await expect(page).toHaveURL(/\/dashboard$/);
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

test('quick entry modals save and reopen with a clean form', async ({ page }) => {
  await signIn(page);

  await page.getByRole('button', { name: 'Daily Expenses' }).click();
  const bulk = page.locator('form').filter({ hasText: 'Payment Account' });
  await bulk.getByLabel('Category').selectOption({ label: 'Transportation' });
  await bulk.getByLabel('Amount').fill('55');
  await bulk.getByRole('button', { name: /Save Batch/ }).click();
  await expect(bulk).toBeHidden();

  await page.getByRole('button', { name: 'Daily Expenses' }).click();
  await expect(bulk.getByLabel('Amount')).toHaveValue('');
  await bulk.getByRole('button', { name: 'Cancel' }).click();
  await expect(bulk).toBeHidden();

  await page.getByRole('button', { name: 'Income', exact: true }).click();
  const income = page.locator('form');
  await income.locator('input[type="number"]').first().fill('900');
  await income.locator('input[type="text"]').first().fill('E2E salary');
  await income.locator('button[type="submit"]').click();
  await expect(income).toBeHidden();
  await expect(page.getByText('900.00').first()).toBeVisible();
});

test('the expenses page adds, edits and deletes a record, and keeps bulk rows between tabs', async ({ page }) => {
  await signIn(page);
  await page.locator('aside a[href="/expenses"]').click();

  await page.getByRole('button', { name: 'Add Expense' }).click();
  const addForm = page.locator('form').filter({ hasText: 'Payment Account' }).or(page.locator('form')).last();
  await addForm.locator('input[type="number"]').first().fill('321');
  await addForm.locator('input[type="text"]').first().fill('E2E single');
  await addForm.locator('button[type="submit"]').click();
  const row = page.locator('tr').filter({ hasText: 'E2E single' });
  await expect(row).toBeVisible();

  await row.getByRole('button').first().click();
  const editForm = page.locator('form').last();
  await expect(editForm.locator('input[type="number"]').first()).toHaveValue('321');
  await editForm.locator('input[type="number"]').first().fill('400');
  await editForm.locator('button[type="submit"]').click();
  await expect(row).toContainText('400.00');

  await page.getByRole('button', { name: 'Daily Bulk Entry' }).click();
  await page.getByLabel('Amount').first().fill('77');
  await page.getByRole('button', { name: 'Expenses', exact: true }).click();
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: 'Daily Bulk Entry' }).click();
  await expect(page.getByLabel('Amount').first()).toHaveValue('77');

  await page.getByRole('button', { name: '+ Add Bank / Account' }).click();
  const accountForm = page.locator('form').last();
  await accountForm.locator('input[type="text"]').first().fill('E2E Quick Bank');
  await accountForm.locator('button[type="submit"]').click();
  await expect(page.locator('select').filter({ hasText: 'E2E Quick Bank' }).first()).toHaveValue(/.+/);
  const accountSelect = page.locator('select').filter({ hasText: 'E2E Quick Bank' }).first();
  await expect(accountSelect.locator('option:checked')).toContainText('E2E Quick Bank');

  await page.getByRole('button', { name: 'Expenses', exact: true }).click();
  await row.getByRole('button').last().click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(row).toHaveCount(0);
});

test('the download page links to the newest release and has a real QR code', async ({ page }) => {
  await page.goto('/download');
  const link = page.locator('main a[href$=".apk"]').first();
  await expect(link).toHaveAttribute('href', /github\.com\/promahbubul\/account_ladger_1\/releases\/latest\/download\//);
  await expect(page.getByLabel('QR code linking to the Android download')).toBeVisible();
});

test('every website page opens, and fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [href, heading] of [
    ['/', 'Know where your money went.'],
    ['/features', 'Features'],
    ['/download', 'Download for Android'],
    ['/privacy', 'Privacy Policy'],
    ['/terms', 'Terms of Use'],
  ]) {
    await page.goto(href);
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `sideways scroll on ${href}`).toBeLessThanOrEqual(0);
  }
});

test('create account opens the registration form', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[autocomplete="username"]')).toHaveCount(0);
});

test('a signed-in user stays on the website and reaches the app from the account menu', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Know where your money went.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create account' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Profile' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByLabel('Full Name').fill('E2E Profile Name');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('aside').getByText('E2E Profile Name')).toBeVisible();

  await page.goto('/');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.locator('aside').getByRole('link', { name: 'Your profile' }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
});

test('an admin can open users and audit logs', async ({ page }) => {
  await signIn(page, ADMIN);
  await page.locator('aside a[href="/admin/users"]').click();
  await expect(page.getByText('user@example.com').first()).toBeVisible();
  await page.locator('aside a[href="/admin/logs"]').click();
  await expect(page).toHaveURL(/\/admin\/logs$/);
  await expect(page.getByText(/Failed to fetch|Error loading/)).toHaveCount(0);
});

test('an admin can create and delete a user, and save settings', async ({ page }) => {
  await signIn(page, ADMIN);
  await page.locator('aside a[href="/admin/users"]').click();
  await page.getByRole('button', { name: 'Create User' }).first().click();

  const form = page.locator('form').filter({ hasText: 'At least' }).or(page.locator('form').last()).first();
  const stamp = Date.now();
  await form.locator('input[type="text"]').nth(0).fill(`e2e_${stamp}`);
  await form.locator('input[type="email"]').fill(`e2e_${stamp}@test.local`);
  await form.locator('input[type="text"]').nth(1).fill('E2E Person');
  await form.locator('input[type="password"]').fill('E2e-created-password1!');
  await form.locator('button[type="submit"]').click();
  await expect(form).toBeHidden();

  const row = page.locator('tr').filter({ hasText: `e2e_${stamp}@test.local` });
  await expect(row).toBeVisible();
  await row.getByTitle('Edit User').click();
  const editForm = page.locator('form').last();
  await editForm.locator('input[type="text"]').first().fill('E2E Renamed');
  await editForm.getByRole('button', { name: 'Save Changes' }).click();
  await expect(row).toContainText('E2E Renamed');

  await row.getByTitle('Reset Password').click();
  const passwordForm = page.locator('form').last();
  await passwordForm.locator('input[type="password"]').fill('E2e-reset-password1!');
  await passwordForm.locator('button[type="submit"]').click();
  await expect(passwordForm).toBeHidden();

  await row.getByTitle('Delete User').click();
  await page.getByRole('button', { name: 'Delete User' }).last().click();
  await expect(row).toHaveCount(0);

  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByText(/Failed to fetch|Error loading/)).toHaveCount(0);

  await page.locator('aside a[href="/admin/settings"]').click();
  await page.getByRole('button', { name: 'Save Settings' }).click();
  await expect(page.getByText('System settings saved successfully.').first()).toBeVisible();
});

test('a project can be created and opened', async ({ page }) => {
  test.skip(!HAS_POSTGRES, 'Projects need Postgres (set E2E_DATABASE_URL to a throwaway database)');
  await signIn(page);
  await page.locator('aside a[href="/projects"]').click();

  await page.getByRole('button', { name: 'New Project' }).click();
  await page.getByLabel('Project Name *').fill('E2E Office Fit-out');
  await page.getByLabel('Client').fill('E2E Client');
  // The empty project table has its own "Create Project" button, so take the form's submit button.
  await page.locator('form button[type="submit"]', { hasText: 'Create Project' }).click();

  // A new project opens straight away.
  await expect(page.getByRole('button', { name: 'Edit project' })).toBeVisible();
  await expect(page.getByText('E2E Office Fit-out').first()).toBeVisible();
  await expect(failureBanner(page)).toHaveCount(0);

  // It is also listed, and opens again from the list. The open project lives in component state,
  // so go back with the page's own back button rather than the sidebar link.
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const row = page.locator('tr').filter({ hasText: 'E2E Office Fit-out' });
  await expect(row).toBeVisible();
  await expect(row).toContainText('E2E Client');
  await row.click();
  await expect(page.getByRole('button', { name: 'Edit project' })).toBeVisible();
});
