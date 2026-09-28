import { expect, test } from '@playwright/test'
import { login, notificationId, setup } from './fixtures'

test('operator sees process summary and acknowledges an operational notification', async ({
  page,
}) => {
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

test('reviewer opens a targeted access request notification', async ({ page }) => {
  await setup(page)
  await page.route(/\/api\/v1\/notifications(?:\?.*)?$/, (route) =>
    route.fulfill({
      json: {
        status: 'success',
        data: [
          {
            id: 'notification-access-request',
            kind: 'ACCESS_REQUEST_PENDING',
            severity: 'INFO',
            resource_type: 'ACCESS_REQUEST',
            resource_id: 'request-finance',
            title: 'Permintaan akses menunggu keputusan',
            message: 'Tinjau permintaan akses sementara dan periode yang diajukan.',
            details: { request_type: 'ATTRIBUTE', subject_user_id: 'viewer-id' },
            recipient_user_id: 'admin-id',
            acknowledged_by: null,
            acknowledged_at: null,
            created_at: '2026-09-28T00:00:00Z',
          },
        ],
        meta: {},
        errors: [],
      },
    }),
  )
  await page.goto('/jobs')
  await login(page, 'admin')

  await expect(page.getByText('Permintaan akses menunggu keputusan', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Tinjau permintaan akses' }).click()
  await expect(page).toHaveURL(/\/access-requests$/)
})
