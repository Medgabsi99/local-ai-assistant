// ============================================================
// End-to-End Tests — Playwright
// Tests the full app shell rendering and navigation
// ============================================================

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('App Shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('renders the app with sidebar and title', async ({ page }) => {
    await expect(page.getByText('Local AI')).toBeVisible();
    await expect(page.getByText('New Chat')).toBeVisible();
  });

  test('sidebar has new chat and settings buttons', async ({ page }) => {
    await expect(page.getByLabel('New Chat').first()).toBeVisible();
    await expect(page.getByLabel('Settings').first()).toBeVisible();
  });

  test('can toggle sidebar collapse', async ({ page }) => {
    const collapseBtn = page.getByLabel('Collapse sidebar');
    if (await collapseBtn.isVisible()) {
      await collapseBtn.click();
      await expect(page.getByLabel('Expand sidebar')).toBeVisible();
      await page.getByLabel('Expand sidebar').click();
      await expect(page.getByLabel('Collapse sidebar')).toBeVisible();
    }
  });

  test('can open settings modal', async ({ page }) => {
    await page.getByLabel('Settings').first().click();
    await expect(page.getByText('Language')).toBeVisible();
    await expect(page.getByText('English')).toBeVisible();
  });

  test('displays empty chat state when no conversation', async ({ page }) => {
    await expect(page.getByText('All data stays on your device')).toBeVisible();
  });
});

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('chat input area is present when conversation exists', async ({ page }) => {
    // Click New Chat to create a conversation
    await page.getByText('New Chat').first().click();
    // Wait for the chat area to load
    await page.waitForTimeout(1000);
    // The input placeholder should be visible
    await expect(page.getByPlaceholder(/Type a message/i)).toBeVisible();
  });
});

test.describe('Document Pane', () => {
  test('can switch to documents view', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.getByText('Documents').click();
    await expect(page.getByText('No documents yet')).toBeVisible();
    await expect(page.getByText('Upload')).toBeVisible();
  });
});

test.describe('Keyboard Shortcuts', () => {
  test('Ctrl+N creates new conversation', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.keyboard.press('Control+n');
    await page.waitForTimeout(500);
    // Should show the chat interface
    await expect(page.getByPlaceholder(/Type a message|Ask about/i)).toBeVisible();
  });

  test('Ctrl+1 switches to chat view', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.getByText('Documents').click();
    await page.keyboard.press('Control+1');
    await page.waitForTimeout(500);
    // Should show chat tab as active
    await expect(page.getByRole('tab', { name: /Chat/i })).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('app shell should have no critical or serious accessibility violations', async ({ page }) => {
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(violations.length).toBe(0);
  });

  test('settings modal should have no critical or serious accessibility violations', async ({ page }) => {
    await page.getByLabel('Settings').first().click();
    await page.waitForTimeout(500);
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(violations.length).toBe(0);
  });
});
