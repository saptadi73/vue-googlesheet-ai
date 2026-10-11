import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('guide explains grain and finds Indonesian aliases without calling AI', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/login')
  await login(page)
  await page.goto('/guide#istilah-teknis')
  const glossary = page.locator('#istilah-teknis')
  await glossary.getByRole('searchbox').fill('grain')
  await expect(glossary.getByRole('row')).toHaveCount(2)
  await expect(glossary.getByRole('cell', { name: /Satu baris mewakili apa/ })).toBeVisible()
  await glossary.getByRole('searchbox').fill('kunci bisnis')
  await expect(glossary.getByRole('rowheader', { name: 'Business key', exact: true })).toBeVisible()
  await glossary.getByRole('searchbox').fill('taksonomi')
  await expect(glossary.getByRole('rowheader', { name: 'Taxonomy', exact: true })).toBeVisible()
  expect(mock.requests.some((request) => request.path.includes('/help/ask'))).toBe(false)
  expect(mock.errors).toEqual([])
})

test('mobile helper supports the glossary and returns focus after closing', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await login(page)
  const trigger = page.getByRole('button', { name: 'Buka bantuan halaman' })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await dialog
    .locator('summary')
    .filter({ hasText: 'Istilah teknis dalam bahasa sederhana' })
    .click()
  await dialog
    .getByRole('searchbox', { name: 'Cari istilah teknis, arti, atau contoh' })
    .fill('nullable')
  await expect(
    dialog.getByRole('cell', { name: 'Apakah nilai pada kolom boleh kosong?', exact: true }),
  ).toBeVisible()
  await expect(dialog.getByRole('region', { name: 'Tabel istilah teknis' })).toBeVisible()
  await dialog.getByRole('searchbox').fill('TIDAK_ADA_ISTILAH')
  await expect(dialog.getByText(/Tidak ada istilah yang cocok/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})
