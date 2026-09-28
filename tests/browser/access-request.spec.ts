import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('user requests temporary access and a separate admin approves it', async ({ page }) => {
  test.setTimeout(60_000)
  const mock = await setup(page)
  const requests: any[] = []
  const apiCalls: { method: string; path: string; body: any }[] = []
  const attribute = {
    id: 'attribute-finance',
    kind: 'DEPARTMENT',
    code: 'FINANCE',
    label: 'Finance',
    parent_id: null,
    is_active: true,
    revision: 1,
    attribute_data: {},
  }
  await page.route(
    /\/api\/v1\/access\/(?:request-options|requests)(?:\/.*)?(?:\?.*)?$/,
    async (route) => {
      const request = route.request()
      const method = request.method()
      const path = new URL(request.url()).pathname.replace('/api/v1', '')
      const body = request.postData() ? request.postDataJSON() : undefined
      apiCalls.push({ method, path, body })
      const ok = (data: unknown, status = 200) =>
        route.fulfill({ status, json: { status: 'success', data, meta: {}, errors: [] } })
      if (path === '/access/request-options')
        return ok({
          attributes: [attribute],
          permission_bundles: [],
          requestable_users: [
            { id: 'admin-id', username: 'admin', full_name: 'Admin', role: 'PLATFORM_ADMIN' },
            { id: 'viewer-id', username: 'viewer', full_name: 'Viewer', role: 'VIEWER' },
          ],
          max_duration_days: 366,
        })
      if (path === '/access/requests/mine') return ok([])
      if (path === '/access/requests' && method === 'GET') return ok(requests)
      if (path === '/access/requests' && method === 'POST') {
        const delegated = request.headers()['authorization']?.includes('token-2')
        const created = {
          id: delegated ? 'request-delegated' : 'request-finance',
          requester_id: delegated ? 'admin-id' : 'viewer-id',
          subject_user_id: body.subject_user_id,
          ...body,
          bundle_id: null,
          status: 'PENDING',
          revision: 1,
          decision_note: '',
          assignment_id: null,
          permission_grant_id: null,
          requester: delegated
            ? { id: 'admin-id', username: 'admin', full_name: 'Admin' }
            : { id: 'viewer-id', username: 'viewer', full_name: 'Viewer' },
          subject_user:
            body.subject_user_id === 'viewer-id'
              ? { id: 'viewer-id', username: 'viewer', full_name: 'Viewer', role: 'VIEWER' }
              : { id: 'admin-id', username: 'admin', full_name: 'Admin', role: 'PLATFORM_ADMIN' },
          attribute,
          bundle: null,
        }
        requests.push(created)
        return ok(created, 201)
      }
      if (path === '/access/requests/request-finance/approve' && method === 'POST') {
        requests[0] = {
          ...requests[0],
          status: 'APPROVED',
          revision: 2,
          assignment_id: 'assignment-id',
        }
        return ok(requests[0])
      }
      return route.fallback()
    },
  )

  await page.goto('/access-requests')
  await login(page, 'viewer')
  await page.getByLabel('Target').selectOption(attribute.id)
  await page
    .getByLabel('Alasan bisnis')
    .fill('Membutuhkan laporan finance untuk tugas audit bulanan.')
  await page.getByRole('button', { name: 'Ajukan akses' }).click()
  await expect(page.getByRole('status')).toContainText('belum memberikan akses')
  await expect(page.getByText('PENDING', { exact: false })).toBeVisible()

  await page.getByRole('button', { name: 'Keluar / ganti akun' }).click()
  await page.goto('/access-requests')
  await login(page, 'admin')
  const review = page.locator('article').filter({ hasText: 'Viewer · DEPARTMENT · FINANCE' })
  await review.getByLabel('Catatan keputusan').fill('Kebutuhan audit telah diverifikasi')
  await review.getByRole('button', { name: 'Setujui' }).click()
  await expect(page.getByRole('status')).toContainText('berhasil disetujui')

  await page.getByLabel('Pengguna tujuan').selectOption('viewer-id')
  await page.getByLabel('Target').selectOption(attribute.id)
  await page
    .getByLabel('Alasan bisnis')
    .fill('Delegasi akses finance untuk penugasan audit sementara.')
  await page.getByRole('button', { name: 'Ajukan akses' }).click()
  const delegatedReview = page.locator('article').filter({ hasText: 'Diajukan oleh Admin' })
  await expect(delegatedReview.getByRole('button', { name: 'Setujui' })).toBeDisabled()

  expect(
    apiCalls.find((call) => call.method === 'POST' && call.path === '/access/requests')?.body,
  ).toMatchObject({
    request_type: 'ATTRIBUTE',
    subject_user_id: 'viewer-id',
    attribute_id: attribute.id,
    business_reason: 'Membutuhkan laporan finance untuk tugas audit bulanan.',
  })
  expect(
    apiCalls.find((call) => call.path === '/access/requests/request-finance/approve')?.body,
  ).toEqual({ revision: 1, note: 'Kebutuhan audit telah diverifikasi' })
  expect(
    apiCalls.filter((call) => call.method === 'POST' && call.path === '/access/requests').at(-1)
      ?.body,
  ).toMatchObject({
    subject_user_id: 'viewer-id',
    business_reason: 'Delegasi akses finance untuk penugasan audit sementara.',
  })
  expect(mock.errors).toEqual([])
})
