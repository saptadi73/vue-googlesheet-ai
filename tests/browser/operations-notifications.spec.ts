import { expect, test } from '@playwright/test'
import { login, notificationId, setup } from './fixtures'

test('operator sees process summary and acknowledges an operational notification', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/jobs')
  await login(page, 'editor')

  await expect(page.getByText('Batch import memerlukan input', { exact: true })).toBeVisible()
  await expect(page.getByText(/Batch perlu input:/)).toContainText('1')
  await page.getByRole('button', { name: 'Tandai sudah dibaca' }).click()

  await expect(page.getByText('Notifikasi diakui dan audit tersimpan.')).toBeVisible()
  await expect(page.getByText('Tidak ada notifikasi yang perlu ditindaklanjuti.')).toBeVisible()
  expect(
    state.requests.some(
      (request) =>
        request.method === 'POST' &&
        request.path === `/notifications/${notificationId}/acknowledge`,
    ),
  ).toBe(true)
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
