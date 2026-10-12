import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('all five examples and the complete package download from the guide', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/login')
  await login(page)
  await page.goto('/guide#contoh-excel')
  const examples = page.locator('#contoh-excel')
  await expect(examples.getByRole('article')).toHaveCount(5)
  for (const filename of [
    '01_Keluhan_Pelanggan.xlsx',
    '02_Marketing_ATL_BTL.xlsx',
    '03_Kepuasan_Pelanggan_Produk.xlsx',
    '04_Competitiveness_Harga_Layanan.xlsx',
    '05_Plan_Goal_Pencapaian_KPI.xlsx',
    'Paket_5_Contoh_Analitik.zip',
  ]) {
    const link = examples.locator(`a[href$="/${filename}"]`)
    const downloaded = page.waitForEvent('download')
    await link.click()
    const file = await downloaded
    expect(file.suggestedFilename()).toBe(filename)
    const content = await readFile((await file.path())!)
    expect(content.subarray(0, 2).toString()).toBe('PK')
    expect(content.length).toBeGreaterThan(10000)
  }
  expect(mock.errors).toEqual([])
})

test('mobile helper finds the relevant sample and shows import limitations', async ({ page }) => {
  await setup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await login(page)
  const trigger = page.getByRole('button', { name: 'Buka bantuan halaman' })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await dialog
    .locator('summary')
    .filter({ hasText: 'Contoh Excel untuk analitik dan action plan' })
    .click()
  await dialog.getByRole('searchbox', { name: 'Cari contoh Excel' }).fill('competitiveness')
  await expect(dialog.getByRole('article')).toHaveCount(1)
  await expect(
    dialog.getByRole('heading', { name: 'Data competitiveness harga dan layanan' }),
  ).toBeVisible()
  await dialog.locator('summary').filter({ hasText: 'Cara memakai Excel / Google Sheets' }).click()
  await expect(dialog.getByText(/Tanggal contoh berupa teks ISO/)).toBeVisible()
  await expect(dialog.getByText(/UNVERIFIED adalah hipotesis/)).toBeVisible()
  await expect(
    dialog.getByText(/Setiap Excel memuat Formula_Analitik dan Aturan_Action_Plan/),
  ).toBeVisible()
  const guide = dialog.getByRole('link', { name: 'Unduh panduan aturan dan formula' })
  const response = await page.request.get((await guide.getAttribute('href')) || '')
  expect(response.ok()).toBe(true)
  expect(await response.text()).toContain('POST /api/v1/analytics-rules/import-sheet')
  await page.keyboard.press('Escape')
  await expect(trigger).toBeFocused()
})
