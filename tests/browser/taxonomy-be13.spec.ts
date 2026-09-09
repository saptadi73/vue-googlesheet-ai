import { test, expect } from '@playwright/test'
import { setup, login, configId } from './fixtures'

test('approved taxonomy uses version drafts, preserves term identity, shows removals and publishes returned revision', async ({
  page,
}) => {
  const mock = await setup(page)
  const term = {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'tea',
    label: 'Tea',
    parent_id: null,
    aliases: ['Teh'],
    is_active: true,
  }
  const removed = {
    ...term,
    id: '22222222-2222-4222-8222-222222222222',
    code: 'coffee',
    label: 'Coffee',
  }
  const taxonomy = {
    id: 'taxonomy',
    code: 'beverages',
    name: 'Beverages',
    version: 2,
    status: 'APPROVED',
    is_active: true,
  }
  const version = {
    id: 'version-id',
    taxonomy_id: 'taxonomy',
    version: 3,
    base_version: 2,
    revision_no: 7,
    status: 'DRAFT',
    definition_json: { terms: [term, removed] },
  }
  const requests: Array<{ path: string; body: any }> = []
  let conflict = true
  await page.route('**/api/v1/taxonomies**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    const body = route.request().postDataJSON()
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
    requests.push({ path, body })
    if (path === '/taxonomies') return ok([taxonomy])
    if (path.endsWith('/terms')) return ok([term, removed])
    if (path.endsWith('/resolve-term'))
      return ok({ status: 'AMBIGUOUS', candidates: [term, removed], requires_question: true })
    if (path.endsWith('/validate-values')) return ok({ valid: false, invalid_values: ['unknown'] })
    if (path === '/taxonomies/taxonomy/versions')
      return ok(
        route.request().method() === 'POST' ? version : { items: [version], has_more: false },
      )
    if (path.endsWith('/approve')) {
      expect(body.revision_no).toBe(11)
      version.status = 'APPROVED'
      taxonomy.version = 3
      return ok(version)
    }
    if (path === '/taxonomies/versions/version-id') {
      if (route.request().method() === 'PUT') {
        if (conflict) {
          conflict = false
          return route.fulfill({
            status: 409,
            json: {
              status: 'error',
              data: null,
              errors: [{ code: 'REVISION_CONFLICT', message: 'Draft berubah' }],
              meta: {},
            },
          })
        }
        expect(body.revision_no).toBe(7)
        version.definition_json.terms = body.terms
        version.revision_no = 11
      }
      return ok(version)
    }
    throw new Error(path)
  })
  await page.goto('/taxonomies')
  await login(page, 'admin')
  await page.getByRole('button', { name: 'beverages / v2 / APPROVED' }).click()
  await expect(page.getByRole('heading', { name: 'Tambah term', exact: true })).toHaveCount(0)
  await page.getByLabel('Nilai taxonomy', { exact: true }).fill('t')
  await page.getByRole('button', { name: 'Cari term', exact: true }).click()
  await expect(page.getByText('AMBIGUOUS / Memerlukan keputusan pengguna')).toBeVisible()
  await page.getByLabel('Nilai untuk validasi (satu per baris)').fill('unknown')
  await page.getByRole('button', { name: 'Validasi nilai taxonomy' }).click()
  await expect(page.getByText('Nilai belum valid', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Buat draft versi berikutnya' }).click()
  await expect(page.getByLabel('Kode term', { exact: true }).first()).toBeDisabled()
  await page.getByLabel('Alias term (satu per baris)').first().fill('Teh\nTeh tawar')
  const dismissed = new Promise<void>((resolve) =>
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('beforeunload')
      await dialog.dismiss()
      resolve()
    }),
  )
  const cancelledReload = page.reload({ timeout: 3000 }).catch(() => null)
  await dismissed
  await expect(page.getByLabel('Alias term (satu per baris)').first()).toHaveValue('Teh\nTeh tawar')
  await cancelledReload
  await page.getByRole('button', { name: 'Hilangkan term dari versi' }).nth(1).click()
  await expect(
    page.getByRole('cell', { name: 'REMOVE / DEACTIVATE', exact: true }).first(),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Publikasikan versi taxonomy' })).toBeDisabled()
  await page.getByRole('button', { name: 'Simpan seluruh term draft' }).click()
  await expect(page.getByRole('alert')).toContainText('Muat ulang objek')
  expect(requests.filter((request) => request.body?.terms)).toHaveLength(1)
  await page.getByRole('button', { name: 'Muat ulang snapshot / batalkan edit lokal' }).click()
  await expect(page.getByLabel('Alias term (satu per baris)').first()).toHaveValue('Teh')
  await page.getByLabel('Alias term (satu per baris)').first().fill('Teh\nTeh tawar')
  await page.getByRole('button', { name: 'Hilangkan term dari versi' }).nth(1).click()
  await page.getByRole('button', { name: 'Simpan seluruh term draft' }).click()
  await expect(page.getByRole('heading', { name: 'Snapshot 3 / DRAFT / revisi 11' })).toBeVisible()
  expect(requests.find((request) => request.body?.terms)?.body.terms).toEqual([
    { ...term, aliases: ['Teh', 'Teh tawar'] },
  ])
  await page.getByLabel('Saya telah meninjau snapshot draft ini').check()
  await page.getByRole('button', { name: 'Publikasikan versi taxonomy' }).click()
  await expect(page.getByText('Versi dipublikasikan.', { exact: false })).toBeVisible()
  await expect(page.getByLabel('Label term', { exact: true })).toBeDisabled()
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('ETL applies approved taxonomy mapping without losing parameters, supports in_taxonomy and APPEND policy', async ({
  page,
}) => {
  const mock = await setup(page)
  Object.assign(mock.record.configuration_json.columns[1]!, {
    numeric_precision: 20,
    numeric_scale: 4,
  })
  const semantic = structuredClone(mock.record.configuration_json.semantic)
  await page.route('**/api/v1/taxonomies**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path.endsWith('/column-bindings')
      ? [
          {
            id: 'binding',
            source_column: 'Cabang',
            taxonomy_id: 'taxonomy',
            taxonomy_version: 2,
            required: true,
            status: 'APPROVED',
            revision_no: 5,
          },
        ]
      : [{ id: 'taxonomy', version: 2, status: 'APPROVED', is_active: true }]
    return route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
  })
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '2. Kolom', exact: true }).click()
  await page.getByText('Mapping taxonomy', { exact: true }).first().click()
  await page.getByRole('button', { name: 'Gunakan binding approved', exact: true }).first().click()
  await expect(
    page.getByText('Taxonomy taxonomy / versi 2 / wajib', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: '4. Kualitas data', exact: true }).click()
  await page.getByRole('button', { name: 'Tambah aturan', exact: false }).click()
  await page.getByRole('combobox', { name: 'Aturan', exact: true }).selectOption('in_taxonomy')
  await expect(
    page
      .getByRole('combobox', { name: 'Jika gagal' })
      .getByRole('option', { name: 'WARN', exact: true }),
  ).toHaveJSProperty('disabled', true)
  await page.getByRole('combobox', { name: 'Jika gagal' }).selectOption('REQUIRE_REVIEW')
  await page.getByRole('button', { name: '5. Pemuatan', exact: true }).click()
  await page.getByRole('combobox', { name: 'Strategi', exact: true }).selectOption('APPEND')
  await page
    .getByRole('combobox', { name: 'Duplikat identik saat APPEND' })
    .selectOption('REJECT_IDENTICAL')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft tersimpan')
  const saved = mock.requests.find((request) => request.method === 'PATCH')?.body.configuration
  expect(saved).toMatchObject({
    append_duplicate_policy: 'REJECT_IDENTICAL',
    semantic,
    columns: [
      { taxonomy_id: 'taxonomy', taxonomy_version: 2, taxonomy_required: true },
      { numeric_precision: 20, numeric_scale: 4 },
    ],
    data_quality_rules: [{ rule: 'in_taxonomy', value: null, action_on_fail: 'REQUIRE_REVIEW' }],
  })
  await page.getByRole('combobox', { name: 'Strategi', exact: true }).selectOption('FULL_REFRESH')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft tersimpan')
  expect(
    mock.requests.filter((request) => request.method === 'PATCH').at(-1)?.body.configuration
      .append_duplicate_policy,
  ).toBeUndefined()
  let validations = 0
  await page.route(`**/api/v1/configurations/${configId}/validate`, async (route) => {
    validations++
    return route.fulfill(
      validations === 1
        ? {
            json: {
              status: 'success',
              data: { valid: false, ready_for_review: false, sample_rows_invalid: 1 },
              errors: [],
              meta: {},
            },
          }
        : {
            status: 422,
            json: {
              status: 'error',
              data: null,
              errors: [{ code: 'TAXONOMY_VALUE_INVALID', message: 'Kategori tidak valid' }],
              meta: {},
            },
          },
    )
  })
  await page.getByRole('button', { name: '7. Validasi & persetujuan' }).click()
  await page.getByRole('button', { name: 'Dry-run ulang', exact: true }).click()
  await expect(
    page.getByText('Masih ada pertanyaan atau kesalahan', { exact: false }),
  ).toBeVisible()
  for (const checkbox of await page
    .locator('fieldset')
    .filter({ hasText: 'Pernyataan verifikasi' })
    .getByRole('checkbox')
    .all())
    await checkbox.check()
  await expect(page.getByRole('button', { name: /Ajukan review revisi/ })).toBeDisabled()
  await page.getByRole('button', { name: 'Dry-run ulang', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Kategori tidak valid')
  await expect(page.getByRole('button', { name: /Ajukan review revisi/ })).toBeDisabled()
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('taxonomy questions keep text corrections and question revisions, block resume and clear stale state', async ({
  page,
}) => {
  const mock = await setup(page)
  let blocks = ['TAXONOMY_VALUE_INVALID']
  let state = 'NEEDS_INPUT'
  const review = () => ({
    id: 'batch',
    dataset_kind: 'NON_MASTER',
    revision_no: 9,
    generation: 1,
    status: state,
    checkpoint: { blocking_codes: blocks },
  })
  const questions = [
    {
      id: 'question',
      category: 'TAXONOMY_INVALID',
      allowed_actions: ['APPLY_CORRECTION', 'CORRECT_SOURCE'],
      candidates: [],
    },
    {
      id: 'ambiguous',
      category: 'TAXONOMY_AMBIGUOUS',
      allowed_actions: ['SELECT_RECORD', 'CORRECT_SOURCE'],
      candidates: [{ id: 'term-id', label: 'Tea' }],
    },
  ].map((question) => ({
    ...question,
    revision_no: 4,
    prompt: question.id,
    status: 'OPEN',
    mandatory: true,
    decisions: [],
    source_row: 2,
    source_column: 'Kategori',
    target_column: 'category',
  }))
  const answers: any[] = []
  await page.route('**/api/v1/import-reviews/batch**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
    if (path.endsWith('/batch')) return ok(review())
    if (path.endsWith('/findings')) return ok({ items: [], has_more: false })
    if (path.endsWith('/questions')) return ok({ items: questions, has_more: false })
    if (path.endsWith('/answer')) {
      answers.push(route.request().postDataJSON())
      if (path.includes('/ambiguous/')) {
        state = 'STALE_REVIEW'
        return ok({ review: review(), question: null, stale: true })
      }
      questions[0]!.status = 'ANSWERED'
      return ok({ review: review(), question: questions[0], stale: false })
    }
    throw new Error(path)
  })
  await page.goto('/import-reviews/batch')
  await login(page)
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeDisabled()
  await page.getByLabel('Nilai koreksi', { exact: true }).fill('001')
  await page.getByRole('button', { name: 'Simpan jawaban', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Simpan jawaban', exact: true })).toHaveCount(1)
  expect(answers[0]).toEqual({ revision_no: 4, action: 'APPLY_CORRECTION', corrected_value: '001' })
  await expect(page.getByRole('combobox', { name: 'Pilih kandidat', exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Simpan jawaban', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Pilih kandidat')
  expect(answers).toHaveLength(1)
  await page.getByRole('combobox', { name: 'Pilih kandidat', exact: true }).selectOption('term-id')
  await page.getByRole('button', { name: 'Simpan jawaban', exact: true }).click()
  await expect(page.getByRole('heading', { name: /STALE_REVIEW/ })).toBeVisible()
  expect(answers[1]).toEqual({
    revision_no: 4,
    action: 'SELECT_RECORD',
    selected_candidate_id: 'term-id',
  })
  await expect(page.getByRole('button', { name: 'Apply batch', exact: true })).toBeDisabled()
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('workbook preserves BE12 and BE13 candidate values and consumes stale preview tokens', async ({
  page,
}) => {
  const mock = await setup(page)
  const candidate: any = structuredClone(mock.record.configuration_json)
  Object.assign(candidate, { load_strategy: 'APPEND', append_duplicate_policy: 'REJECT_IDENTICAL' })
  Object.assign(candidate.columns[0], {
    taxonomy_id: 'taxonomy',
    taxonomy_version: 2,
    taxonomy_required: false,
  })
  candidate.data_quality_rules = [
    {
      column: 'branch_name',
      rule: 'in_taxonomy',
      value: null,
      action_on_fail: 'REJECT_ROW',
      default_value: false,
      threshold_percent: 0,
    },
  ]
  let token = 0
  const applied: any[] = []
  await page.route('**/api/v1/configurations/*/workbook-*', async (route) => {
    const path = new URL(route.request().url()).pathname
    const body = route.request().postDataJSON()
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, errors: [], meta: {} } })
    if (path.endsWith('/workbook-preview')) {
      expect(body.content_base64).toBe(Buffer.from('mock workbook').toString('base64'))
      token++
      return ok({
        can_apply: true,
        revision_no: 1,
        configuration: candidate,
        question_answers: {},
        preview_token: `workbook-${token}`,
        validation: { valid: false, ready_for_review: false },
        errors: [],
        diff: { taxonomy: { before: null, after: 'taxonomy' } },
      })
    }
    applied.push(body)
    if (token === 1)
      return route.fulfill({
        status: 409,
        json: {
          status: 'error',
          data: null,
          errors: [{ code: 'WORKBOOK_TOKEN_INVALID', message: 'Token kedaluwarsa' }],
          meta: {},
        },
      })
    mock.record.configuration_json = candidate
    mock.record.revision_no = 6
    return ok(mock.record)
  })
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByText('Review melalui Excel (opsional)', { exact: true }).click()
  const file = {
    name: 'configuration.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('mock workbook'),
  }
  await page.locator('input[type=file]').setInputFiles(file)
  await expect(
    page.getByText('Masih diperlukan perbaikan atau jawaban sebelum approval.', { exact: false }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Terima perubahan Excel ke draft' }).click()
  await expect(page.getByRole('alert')).toContainText('Token kedaluwarsa')
  await expect(page.getByRole('button', { name: 'Terima perubahan Excel ke draft' })).toHaveCount(0)
  await page.locator('input[type=file]').setInputFiles(file)
  await page.getByRole('button', { name: 'Terima perubahan Excel ke draft' }).click()
  await expect(page.getByRole('status')).toContainText('Perubahan Excel disimpan sebagai draft')
  expect(applied[1]).toEqual({
    revision_no: 1,
    configuration: candidate,
    question_answers: {},
    preview_token: 'workbook-2',
  })
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})
