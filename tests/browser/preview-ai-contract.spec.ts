import { test, expect } from '@playwright/test'
import { setup, login } from './fixtures'

test('separate reviewer reads masked preview, approves its hash and editor obtains apply token', async ({
  page,
}) => {
  const mock = await setup(page)
  let status = 'READY_FOR_APPROVAL',
    revision = 4
  let stale = false
  const review = () => ({
    id: 'batch',
    status,
    revision_no: revision,
    dataset_kind: 'NON_MASTER',
    checkpoint: {},
    dependencies_current: true,
  })
  const requests: Array<{ method: string; path: string; body: any }> = []
  await page.route('**/api/v1/import-reviews/batch**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    const body = route.request().postDataJSON()
    requests.push({ method, path, body })
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
    if (path.endsWith('/batch')) return ok(review())
    if (path.endsWith('/preview')) {
      if (stale)
        return route.fulfill({
          status: 409,
          json: {
            status: 'error',
            data: null,
            errors: [{ code: 'IMPORT_PREVIEW_STALE', message: 'Target berubah' }],
          },
        })
      return ok({
        review: review(),
        target: 'trusted.sales',
        changes: [
          {
            source_row: 2,
            outcome: 'UPDATE',
            before: { salary: '[REDACTED]' },
            after: { salary: '[REDACTED]' },
          },
        ],
        summary: { update: 1 },
        period_closures: [],
        masked_fields: ['salary'],
        preview_hash: 'plan-hash',
        preview_revision: 4,
        can_approve: status === 'READY_FOR_APPROVAL',
        ...(method === 'GET' ? { read_only: true } : { preview_token: 'editor-token' }),
      })
    }
    if (path.endsWith('/approve')) {
      expect(body).toMatchObject({ revision_no: 4, preview_hash: 'plan-hash' })
      status = 'APPROVED'
      revision = 5
      return ok(review())
    }
    if (path.endsWith('/apply')) {
      expect(body).toEqual({ revision_no: 5, preview_token: 'editor-token' })
      status = 'SUCCEEDED'
      return ok({ review: review(), rows_applied: 1 })
    }
    return ok({ items: [], has_more: false })
  })
  await page.goto('/import-reviews/batch')
  await login(page, 'editor')
  await page.getByRole('button', { name: 'Buat preview', exact: true }).click()
  await expect(page.getByText('plan-hash', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Keluar / ganti akun', exact: true }).click()
  await expect(page).toHaveURL(/workspace$/)
  await page.goto('/import-reviews/batch')
  await login(page, 'approver')
  await expect(page.getByRole('button', { name: 'Approve preview', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Baca preview editor', exact: true }).click()
  await expect(page.getByText('Field disamarkan: salary')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply batch', exact: true })).toBeDisabled()
  stale = true
  await page.getByRole('button', { name: 'Baca preview editor', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Target berubah')
  await expect(page.getByText('plan-hash', { exact: false })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Approve preview', exact: true })).toBeDisabled()
  stale = false
  await page.getByRole('button', { name: 'Baca preview editor', exact: true }).click()
  await page.getByRole('button', { name: 'Approve preview', exact: true }).click()
  await expect(page.getByRole('heading', { name: /APPROVED/ })).toBeVisible()
  await page.getByRole('button', { name: 'Baca preview editor', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Approve preview', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Keluar / ganti akun', exact: true }).click()
  await expect(page).toHaveURL(/workspace$/)
  await page.goto('/import-reviews/batch')
  await login(page, 'editor')
  await page.getByRole('button', { name: 'Buat preview', exact: true }).click()
  await page.getByRole('button', { name: 'Apply batch', exact: true }).click()
  await expect(page.getByRole('heading', { name: /SUCCEEDED/ })).toBeVisible()
  expect(requests.filter((r) => r.path.endsWith('/preview') && r.method === 'POST')).toHaveLength(2)
  expect(mock.errors).toEqual([])
})

test('AI correction requires confirmation, preserves code and exposes provider failure without fallback', async ({
  page,
}) => {
  const mock = await setup(page)
  const review = {
    id: 'batch',
    status: 'NEEDS_INPUT',
    revision_no: 9,
    dataset_kind: 'NON_MASTER',
    checkpoint: {},
  }
  const question = {
    id: 'question',
    category: 'TAXONOMY_INVALID',
    status: 'OPEN',
    revision_no: 3,
    prompt: 'Perbaiki kategori',
    allowed_actions: ['APPLY_CORRECTION', 'CORRECT_SOURCE'],
    candidates: [],
    decisions: [],
    mandatory: true,
  }
  const aiBodies: any[] = [],
    answers: any[] = []
  let failure = false
  await page.route('**/api/v1/import-reviews/batch**', async (route) => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = path.endsWith('/batch')
      ? review
      : { items: path.endsWith('/questions') ? [question] : [], has_more: false }
    if (path.endsWith('/answer')) {
      answers.push(route.request().postDataJSON())
      question.status = 'ANSWERED'
      data = { question, review, stale: false }
    }
    return route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
  })
  await page.route('**/api/v1/taxonomies**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/recommend-terms-ai')) {
      aiBodies.push(route.request().postDataJSON())
      if (failure)
        return route.fulfill({
          status: 503,
          json: {
            status: 'error',
            data: null,
            errors: [{ code: 'OPENAI_NOT_CONFIGURED', message: 'Provider belum siap' }],
          },
        })
      return route.fulfill({
        json: {
          status: 'success',
          data: {
            taxonomy_id: 'taxonomy',
            taxonomy_version: 2,
            recommendation_kind: 'GENERATIVE',
            ai_model: 'test-model',
            prompt_version: 'taxonomy_recommend_v1',
            ai_response_id: 'response',
            recommendations: [
              {
                input_index: 0,
                value: 'teh tawar',
                requires_confirmation: true,
                candidates: [{ term: { id: 'term', code: '001', label: 'Tea' }, confidence: 0.8 }],
              },
            ],
          },
          errors: [],
          meta: {},
        },
      })
    }
    expect(path).toBe('/api/v1/taxonomies')
    return route.fulfill({
      json: {
        status: 'success',
        data: [
          { id: 'taxonomy', name: 'Beverages', version: 2, status: 'APPROVED', is_active: true },
        ],
        errors: [],
        meta: {},
      },
    })
  })
  await page.goto('/import-reviews/batch')
  await login(page)
  await page.getByRole('button', { name: 'Muat taxonomy untuk saran AI', exact: true }).click()
  await page
    .getByRole('combobox', { name: 'Taxonomy untuk saran AI', exact: true })
    .selectOption('taxonomy')
  await page.getByLabel('Nilai untuk saran AI (satu per baris)').fill('teh tawar')
  expect(aiBodies).toHaveLength(0)
  await page.getByRole('button', { name: 'Minta saran AI', exact: true }).click()
  await expect(page.getByText('GENERATIVE / model test-model', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Nilai koreksi', { exact: true })).toHaveValue('')
  expect(answers).toHaveLength(0)
  failure = true
  await page.getByRole('button', { name: 'Minta saran AI', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Provider belum siap')
  await expect(page.getByRole('button', { name: 'Konfirmasi kode 001' })).toHaveCount(0)
  failure = false
  await page.getByRole('button', { name: 'Minta saran AI', exact: true }).click()
  await page.getByRole('button', { name: 'Konfirmasi kode 001' }).click()
  await expect(page.getByLabel('Nilai koreksi', { exact: true })).toHaveValue('001')
  expect(answers).toHaveLength(0)
  await page.getByRole('button', { name: 'Simpan jawaban', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Simpan jawaban', exact: true })).toHaveCount(0)
  expect(answers).toEqual([{ revision_no: 3, action: 'APPLY_CORRECTION', corrected_value: '001' }])
  expect(aiBodies[0]).toEqual({ taxonomy_version: 2, values: ['teh tawar'], limit: 3 })
  expect(mock.errors).toEqual([])
})
