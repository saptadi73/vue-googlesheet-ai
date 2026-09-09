import { test, expect } from '@playwright/test'
import { setup, login, configId } from './fixtures'

test('BE12 blocks invalid cross-field input before PATCH and clears optional parameters as null', async ({
  page,
}) => {
  const mock = await setup(page)
  Object.assign(mock.record.configuration_json.columns[0]!, {
    target_type: 'timestamptz',
    source_timezone: 'Asia/Jakarta',
  })
  Object.assign(mock.record.configuration_json.columns[1]!, {
    numeric_precision: 10,
    numeric_scale: 2,
  })
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '2. Kolom', exact: true }).click()
  await page.getByText('Parameter tipe & presisi (BE-12)', { exact: true }).nth(1).click()
  await page.getByLabel('Precision', { exact: true }).fill('1')
  await page.getByLabel('Precision', { exact: true }).press('Tab')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByLabel('Kesalahan parameter konfigurasi')).toContainText(
    'Scale tidak boleh melebihi precision',
  )
  expect(mock.requests.filter((request) => request.method === 'PATCH')).toHaveLength(0)
  await page.getByLabel('Precision', { exact: true }).fill('10')
  await page.getByLabel('Precision', { exact: true }).press('Tab')
  await page.getByText('Parameter tipe & presisi (BE-12)', { exact: true }).first().click()
  await page.getByLabel('Timezone sumber (IANA)', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft tersimpan')
  expect(
    mock.requests.find((request) => request.method === 'PATCH')?.body.configuration.columns[0]
      .source_timezone,
  ).toBeNull()
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('failed batch polling reports an error and resumes only after explicit reload', async ({
  page,
}) => {
  const mock = await setup(page)
  let reads = 0
  await page.route('**/api/v1/import-reviews/batch**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/batch')) {
      reads++
      if (reads === 2) return route.abort('failed')
      return route.fulfill({
        json: {
          status: 'success',
          data: {
            id: 'batch',
            revision_no: 1,
            status: reads > 2 ? 'NEEDS_INPUT' : 'VALIDATING',
            dataset_kind: 'NON_MASTER',
            checkpoint: {},
          },
          errors: [],
          meta: {},
        },
      })
    }
    return route.fulfill({
      json: { status: 'success', data: { items: [], has_more: false }, errors: [], meta: {} },
    })
  })
  await page.goto('/import-reviews/batch')
  await login(page)
  await expect(
    page.getByText('Pemantauan berhenti karena request gagal.', { exact: false }),
  ).toBeVisible({ timeout: 10000 })
  await expect(page.getByRole('alert')).toBeVisible()
  expect(reads).toBe(2)
  await page.getByRole('button', { name: 'Muat ulang status batch' }).click()
  await expect(page.getByRole('heading', { name: /NEEDS_INPUT/ })).toBeVisible()
  await expect(
    page.getByText('Pemantauan berhenti karena request gagal.', { exact: false }),
  ).toHaveCount(0)
  expect(reads).toBe(3)
  expect(mock.errors).toEqual([])
})

test('technical approver must read preview before approval without making an editor-only request', async ({
  page,
}) => {
  const mock = await setup(page)
  const methods: string[] = []
  await page.route('**/api/v1/import-reviews/batch**', async (route) => {
    methods.push(route.request().method())
    return route.fulfill({
      json: {
        status: 'success',
        data: new URL(route.request().url()).pathname.endsWith('/batch')
          ? {
              id: 'batch',
              revision_no: 1,
              status: 'READY_FOR_APPROVAL',
              dataset_kind: 'NON_MASTER',
              checkpoint: { preview_hash: 'server-hash' },
            }
          : { items: [], has_more: false },
        errors: [],
        meta: {},
      },
    })
  })
  await page.goto('/import-reviews/batch')
  await login(page, 'approver')
  await expect(
    page.getByText('Baca preview editor sebelum menyetujui batch.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Baca preview editor', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Approve preview', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Buat preview', exact: true })).toBeDisabled()
  expect(methods.every((method) => method === 'GET')).toBe(true)
  expect(mock.errors).toEqual([])
})

test('taxonomy similarity suggestions require an explicit choice and manual question uses supplied staging identity', async ({
  page,
}) => {
  const mock = await setup(page)
  const taxonomyId = '11111111-1111-4111-8111-111111111111'
  const stagingId = '22222222-2222-4222-8222-222222222222'
  const term = {
    id: 'term',
    code: 'tea',
    label: 'Tea',
    aliases: [],
    parent_id: null,
    is_active: true,
  }
  let resolutionCalls = 0
  let questionBody: unknown
  await page.route('**/api/v1/taxonomies**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
    if (path.endsWith('/taxonomies'))
      return ok([
        {
          id: taxonomyId,
          code: 'drinks',
          name: 'Drinks',
          version: 2,
          status: 'APPROVED',
          is_active: true,
        },
      ])
    if (path.endsWith('/terms')) return ok([term])
    if (path.endsWith('/recommend-terms')) {
      expect(route.request().postDataJSON()).toEqual({ values: ['Teh'], limit: 3 })
      return ok({
        taxonomy_id: taxonomyId,
        taxonomy_version: 2,
        recommendations: [
          { value: 'Teh', candidates: [{ term, confidence: 0.8 }], requires_confirmation: true },
        ],
      })
    }
    if (path.endsWith('/resolve-term')) {
      resolutionCalls++
      return ok({ status: 'EXACT', term, requires_question: false })
    }
    if (path.endsWith('/ambiguity-question')) {
      questionBody = route.request().postDataJSON()
      return ok({ created: false, resolution: { status: 'EXACT', term, requires_question: false } })
    }
    throw new Error(path)
  })
  await page.route('**/api/v1/import-reviews/batch**', (route) =>
    route.fulfill({
      json: {
        status: 'success',
        data: new URL(route.request().url()).pathname.endsWith('/batch')
          ? {
              id: 'batch',
              revision_no: 1,
              status: 'NEEDS_INPUT',
              dataset_kind: 'NON_MASTER',
              checkpoint: {},
            }
          : { items: [], has_more: false },
        errors: [],
        meta: {},
      },
    }),
  )
  await page.goto('/taxonomies')
  await login(page)
  await page.getByRole('button', { name: 'drinks / v2 / APPROVED' }).click()
  await page.getByLabel('Nilai untuk validasi (satu per baris)').fill('Teh')
  await page.getByRole('button', { name: 'Cari saran kemiripan' }).click()
  await expect(page.getByText('Memerlukan konfirmasi pengguna.', { exact: true })).toBeVisible()
  expect(resolutionCalls).toBe(0)
  await page.getByRole('button', { name: 'Periksa kode tea' }).click()
  await expect(page.getByLabel('Nilai taxonomy', { exact: true })).toHaveValue('tea')
  expect(resolutionCalls).toBe(1)
  // SPA navigation keeps the authenticated session while opening this test batch.
  await page.evaluate(() => {
    history.pushState({}, '', '/import-reviews/batch')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await page.getByText('Buat pertanyaan taxonomy manual', { exact: true }).click()
  await page.getByLabel('UUID taxonomy', { exact: true }).fill(taxonomyId)
  await page.getByLabel('UUID baris staging').fill(stagingId)
  await page.getByLabel('Kolom target taxonomy').fill('category')
  await page.getByLabel('Nilai staging terkini').fill('Teh')
  await page.getByRole('button', { name: 'Buat atau muat pertanyaan taxonomy' }).click()
  await expect(page.getByRole('status')).toContainText('tidak ada pertanyaan baru')
  expect(questionBody).toEqual({
    import_review_id: 'batch',
    staging_row_id: stagingId,
    target_column: 'category',
    value: 'Teh',
  })
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})
