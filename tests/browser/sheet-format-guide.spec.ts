import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('guide distinguishes required period, measurement and collection time', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/login')
  await login(page)
  await page.goto('/guide#format-google-sheet')
  const guide = page.locator('#format-google-sheet')
  await expect(guide.getByRole('heading', { name: 'Format Google Sheet ideal' })).toBeVisible()
  await guide.getByRole('searchbox').fill('waktu dan periode wajib')
  await expect(guide.getByText(/Setiap record periodik atau berbasis waktu wajib/)).toBeVisible()
  await expect(
    guide.getByRole('cell', { name: 'period_start + period_end', exact: true }),
  ).toBeVisible()
  await expect(
    guide.getByRole('cell', { name: 'data_as_of_at + collected_at', exact: true }),
  ).toBeVisible()
  await guide.getByRole('searchbox').fill('action plan akurat')
  await expect(guide.getByText(/Tidak ada jaminan otomatis/)).toBeVisible()
  await expect(guide.getByRole('cell', { name: /suspected_cause, cause_status/ })).toBeVisible()
  expect(mock.errors).toEqual([])
})

test('page helper provides examples on mobile without losing modal focus', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await login(page)
  const trigger = page.getByRole('button', { name: 'Buka bantuan halaman' })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('summary').filter({ hasText: 'Format Google Sheet ideal' }).click()
  const search = dialog.getByRole('searchbox', { name: 'Cari panduan format Google Sheet' })
  await search.fill('12. Contoh tabel')
  await expect(dialog.getByRole('region', { name: /Tabel 12. Contoh/ }).first()).toBeVisible()
  await expect(dialog.getByRole('cell', { name: 'ACT-001', exact: true })).toBeAttached()
  await search.fill('KATA_TIDAK_ADA')
  await expect(dialog.getByText(/Tidak ada bagian yang cocok/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})
