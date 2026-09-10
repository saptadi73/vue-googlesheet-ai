import { test, expect } from '@playwright/test'
import { setup, login } from './fixtures'

test('reviewer confirms all source conflicts with reason and current hash; replacement preview resets consent', async ({
  page,
}) => {
  const state = await setup(page)
  let status = 'READY_FOR_APPROVAL'
  let hash = 'first-hash'
  let blocked = false
  const approvals: unknown[] = []
  const review = () => ({
    id: 'batch',
    status,
    revision_no: 3,
    dataset_kind: 'MASTER',
    checkpoint: {},
    dependencies_current: true,
  })
  await page.route('**/api/v1/import-reviews/batch**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
    if (path.endsWith('/batch')) return ok(review())
    if (path.endsWith('/preview'))
      return ok({
        review: review(),
        preview_hash: hash,
        read_only: true,
        can_approve: !blocked,
        target: 'master',
        summary: { insert_proposed: 1 },
        changes: [
          {
            outcome: blocked ? 'KEY_CONFLICT' : 'INSERT_PROPOSED',
            reason_code: blocked ? 'MASTER_SOURCE_FORBIDDEN' : null,
          },
        ],
        blocking_codes: blocked ? ['KEY_CONFLICT'] : [],
        requires_source_confirmation: true,
        source_conflicts: [
          { source_row: 2, record_id: 'existing' },
          { record_id: 'old-period', action: 'CLOSE_PERIOD' },
        ],
      })
    if (path.endsWith('/approve')) {
      approvals.push(route.request().postDataJSON())
      status = 'APPROVED'
      return ok(review())
    }
    return ok({ items: [], has_more: false })
  })
  await page.goto('/import-reviews/batch')
  await login(page, 'approver')
  const read = page.getByRole('button', { name: 'Baca preview editor', exact: true })
  const approve = page.getByRole('button', { name: 'Approve preview', exact: true })
  const consent = page.getByLabel('Saya menyetujui seluruh konflik sumber pada preview ini')
  await read.click()
  await expect(page.getByRole('cell', { name: 'CLOSE_PERIOD', exact: true })).toBeVisible()
  await consent.check()
  await page.getByLabel('Catatan aksi').fill('   ')
  await expect(approve).toBeDisabled()
  await page.getByLabel('Catatan aksi').fill('Sumber kedua sudah diverifikasi.')
  await expect(approve).toBeEnabled()
  hash = 'second-hash'
  await read.click()
  await expect(consent).not.toBeChecked()
  await expect(approve).toBeDisabled()
  blocked = true
  await read.click()
  await consent.check()
  await expect(page.getByText('Blocker preview:', { exact: false })).toContainText('KEY_CONFLICT')
  await expect(approve).toBeDisabled()
  blocked = false
  await read.click()
  await consent.check()
  await approve.click()
  await expect(page.getByRole('heading', { name: /APPROVED/ })).toBeVisible()
  expect(approvals).toEqual([
    {
      revision_no: 3,
      preview_hash: 'second-hash',
      accept_source_conflicts: true,
      comment: 'Sumber kedua sudah diverifikasi.',
    },
  ])
  expect(state.errors).toEqual([])
})

for (const resolution of ['EXACT', 'ALIAS', 'EMPTY', 'CANDIDATE', 'AMBIGUOUS', 'NOT_FOUND']) {
  test(`reference ${resolution} sends binding context and refreshes revision only on staging write`, async ({
    page,
  }) => {
    const state = await setup(page)
    let revision = 5
    const writes = ['EXACT', 'ALIAS', 'EMPTY'].includes(resolution)
    const bodies: any[] = []
    const review = () => ({
      id: 'batch',
      status: 'READY_FOR_APPROVAL',
      revision_no: revision,
      dataset_kind: 'NON_MASTER',
      checkpoint: {},
      dependencies_current: true,
    })
    await page.route('**/api/v1/import-reviews/batch**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const ok = (data: unknown) =>
        route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
      if (path.endsWith('/batch')) return ok(review())
      if (path.endsWith('/resolve-reference')) {
        bodies.push(route.request().postDataJSON())
        if (writes) revision++
        return ok({
          status: resolution,
          master_id: 'master',
          staging_updated: writes,
          revision_no: revision,
          requires_question: !writes,
        })
      }
      if (path.endsWith('/preview')) {
        bodies.push(route.request().postDataJSON())
        return ok({
          review: review(),
          target: 'target',
          changes: [],
          summary: {},
          preview_hash: 'new',
          can_approve: true,
        })
      }
      return ok({ items: [], has_more: false })
    })
    await page.goto('/import-reviews/batch')
    await login(page)
    await page.getByLabel('Master ID', { exact: true }).fill('master')
    await page.getByLabel('Kolom sumber referensi', { exact: true }).fill('Kode Produk')
    await page.getByLabel('Value', { exact: true }).fill(resolution === 'EMPTY' ? '' : '001')
    await page.getByLabel('UUID staging referensi').fill('row')
    await page.getByRole('button', { name: 'Resolve reference', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('harus diisi bersama')
    expect(bodies).toHaveLength(0)
    await page.getByLabel('Kolom target referensi').fill('product_id')
    await page.getByRole('button', { name: 'Resolve reference', exact: true }).click()
    await expect(page.getByText(`Reference ${resolution}`, { exact: false })).toBeVisible()
    expect(bodies[0]).toEqual({
      revision_no: 5,
      master_definition_id: 'master',
      source_column: 'Kode Produk',
      value: resolution === 'EMPTY' ? '' : '001',
      staging_row_id: 'row',
      target_column: 'product_id',
    })
    if (!writes)
      await expect(
        page.getByText('Selesaikan melalui pertanyaan batch.', { exact: false }),
      ).toBeVisible()
    await page.getByRole('button', { name: 'Buat preview', exact: true }).click()
    await expect(page.getByText('hash new', { exact: false })).toBeVisible()
    expect(bodies[1].revision_no).toBe(writes ? 6 : 5)
    expect(state.errors).toEqual([])
  })
}

test('reviewer and approved editor resolve read-only without staging fields', async ({ page }) => {
  const state = await setup(page)
  const bodies: any[] = []
  await page.route('**/api/v1/import-reviews/batch**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = { items: [], has_more: false }
    if (path.endsWith('/batch'))
      data = {
        id: 'batch',
        status: 'APPROVED',
        revision_no: 7,
        dataset_kind: 'NON_MASTER',
        checkpoint: {},
      }
    if (path.endsWith('/resolve-reference')) {
      bodies.push(route.request().postDataJSON())
      data = { status: 'EXACT', master_id: 'master', staging_updated: false }
    }
    return route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
  })
  for (const role of ['approver', 'editor']) {
    await page.goto('/import-reviews/batch')
    await login(page, role)
    await expect(page.getByRole('heading', { name: /APPROVED/ })).toBeVisible()
    await expect(page.getByLabel('UUID staging referensi')).toHaveCount(0)
    await expect(page.getByLabel('Isi staging (opsional)')).toBeDisabled()
    await page.getByLabel('Master ID', { exact: true }).fill('master')
    await page.getByLabel('Kolom sumber referensi').fill('Kode Produk')
    await page.getByLabel('Value', { exact: true }).fill('001')
    await page.getByRole('button', { name: 'Resolve reference', exact: true }).click()
    await expect(page.getByText('Reference EXACT', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Keluar / ganti akun', exact: true }).click()
    await expect(page).toHaveURL(/workspace$/)
  }
  expect(bodies).toEqual(
    Array(2).fill({
      revision_no: 7,
      master_definition_id: 'master',
      source_column: 'Kode Produk',
      value: '001',
    }),
  )
  expect(state.errors).toEqual([])
})
