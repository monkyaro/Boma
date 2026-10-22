import { test, expect } from '@playwright/test';

test('search, verification disclosure and empty results', async ({ page }) => {
  await page.route('http://localhost:8100/workspace/geography', (route) => route.fulfill({ json: { regions: [{ code: 'TEST', name: 'Test region' }], districts: [], wards: [] } }));
  await page.route('http://localhost:8100/listings?**', (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: { items: params.get('q') === 'missing' ? [] : [{ listing_id: 'test-property', title: 'Test family home', region: 'Test region', district: null, listing_type: 'sale', property_type: 'house', price: '1000000', currency: 'TZS', verification_status: 'UNVERIFIED', status: 'published', version: 1 }], total: params.get('q') === 'missing' ? 0 : 1, page: 1 } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Find your place in Tanzania.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Test family home' })).toBeVisible();
  await expect(page.getByText('Unverified property', { exact: true })).toBeVisible();
  await page.getByLabel('What are you looking for?').fill('missing');
  await page.getByRole('button', { name: 'Find properties' }).click();
  await expect(page.getByRole('heading', { name: 'No properties match this search yet' })).toBeVisible();
});

test('marketplace shows a recoverable API failure', async ({ page }) => {
  await page.route('http://localhost:8100/**', (route) => route.fulfill({ status: 503, json: { message: 'BOMA is temporarily unavailable' } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
