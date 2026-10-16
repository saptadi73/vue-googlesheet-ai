import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('guide provides searchable error causes and actions without calling AI', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/login')
  await login(page)
  await page.goto('/guide#error-responses')
  const reference = page.locator('#error-responses')
  await expect(reference.getByRole('heading', { name: 'Tabel error response' })).toBeVisible()
  await reference.getByRole('searchbox').fill('SOURCE_READ_FAILED')
  await expect(reference.getByRole('row')).toHaveCount(2)
  await expect(reference.getByRole('cell', { name: /Temukan tab/ })).toBeVisible()
  await reference.getByRole('searchbox').fill('DEFAULT_DENY')
  await expect(reference.getByText('Alasan keputusan akses', { exact: true })).toBeVisible()
  await expect(
    reference.getByRole('cell', { name: /Semua required attributes berlaku AND/ }),
  ).toBeVisible()
  await reference.getByRole('searchbox').fill('KODE_TIDAK_ADA')
  await expect(reference.getByText(/Tidak ada kode yang cocok/)).toBeVisible()
  expect(mock.requests.some((request) => request.path.includes('/help/ask'))).toBe(false)
  expect(mock.errors).toEqual([])
})

test('page helper exposes the same table on a narrow screen and restores focus', async ({
  page,
}) => {
  await setup(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/login')
  await login(page)
  const trigger = page.getByRole('button', { name: 'Buka bantuan halaman' })
  await trigger.click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('summary').filter({ hasText: 'Tabel error response' }).click()
  await dialog.getByRole('searchbox').fill('REVIEW_STALE')
  await expect(dialog.getByRole('row')).toHaveCount(2)
  await expect(dialog.getByRole('region', { name: 'Tabel error response' })).toBeVisible()
  await expect(
    dialog.getByRole('cell', { name: /Temukan tab dan profiling ulang/ }),
  ).toBeAttached()
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(trigger).toBeFocused()
})
