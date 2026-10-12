import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('dedicated guide covers mapping, approvals and actual record loading', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/login')
  await login(page)
  await page.goto('/guide#binding-master')
  const guide = page.locator('#binding-master')
  await expect(guide.getByRole('heading', { name: 'Panduan khusus binding master' })).toBeVisible()
  await expect(guide.locator('.binding-steps > li')).toHaveCount(9)
  await expect(guide.getByText(/tidak ada langkah submit terpisah/)).toBeVisible()
  await expect(guide.getByText(/Buat batch review\/import dan pantau/)).toBeVisible()
  await guide.locator('summary').filter({ hasText: 'Contoh mapping Master Bisnis' }).click()
  await expect(guide.getByRole('cell', { name: 'is_active · boolean' })).toBeVisible()
  const response = await page.request.get('/guides/PANDUAN_BINDING_MASTER.md')
  expect(response.ok()).toBe(true)
  expect(await response.text()).toContain('Simpan binding & dry-run')
  expect(mock.errors).toEqual([])
})

test('mobile page helper exposes the full master tutorial and reference distinction', async ({
  page,
}) => {
  await setup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await login(page)
  const trigger = page.getByRole('button', { name: 'Buka bantuan halaman' })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('summary').filter({ hasText: 'Panduan khusus binding master' }).click()
  await expect(dialog.locator('.binding-steps > li')).toHaveCount(9)
  await expect(
    dialog.getByRole('heading', { name: 'Binding kolom referensi master' }),
  ).toBeVisible()
  await dialog.locator('summary').filter({ hasText: 'Jika binding atau pemuatan belum' }).click()
  await expect(
    dialog.getByRole('heading', { name: 'Binding APPROVED tetapi record kosong' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})
