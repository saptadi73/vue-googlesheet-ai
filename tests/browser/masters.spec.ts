import { test, expect, type Page } from '@playwright/test'
import { setup, login, configId, sourceId, sheetId } from './fixtures'
import { blankDefinition } from '../../src/lib/masters'

async function masterSetup(page: Page) {
  const base = await setup(page)
  base.sheet.dataset_kind = 'MASTER'
  const definition = blankDefinition()
  definition.name = 'Cabang'
  definition.fields = [
    { name: 'branch_code', type: 'text', nullable: false, pii_classification: 'NONE' },
  ]
  definition.business_key = ['branch_code']
  definition.label_field = 'branch_code'
  let master: any = {
    id: 'master-1',
    code: 'branches',
    name: 'Cabang',
    aliases: [],
    definition_json: definition,
    approved_definition_json: structuredClone(definition),
    revision_no: 3,
    approved_version: 1,
    status: 'APPROVED',
    is_active: true,
    created_by: 'editor-id',
    submitted_by: 'editor-id',
    approved_by: 'approver-id',
    approved_at: '2026-09-08T00:00:00Z',
  }
  let binding: any = null
  let showCandidates = true
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace('/api/v1', ''),
      method = request.method(),
      body = request.postData() ? request.postDataJSON() : undefined
    if (!path.startsWith('/master-definitions') && !path.includes('/master-binding'))
      return route.fallback()
    base.requests.push({ path, method, body })
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, meta: {}, errors: [] } })
    const fail = (code: string) =>
      route.fulfill({
        status: 409,
        json: { status: 'error', data: null, meta: {}, errors: [{ code, message: code }] },
      })
    if (path === '/master-definitions/preview')
      return ok({
        creates_master: false,
        candidates: showCandidates
          ? [
              {
                id: 'similar-id',
                code: 'similar',
                name: 'Cabang lama',
                status: 'DRAFT',
                is_active: false,
                score: 0.95,
                reason: 'Periksa nama serupa',
              },
            ]
          : [],
      })
    if (path === '/master-definitions' && method === 'GET') return ok([master])
    if (path === '/master-definitions' && method === 'POST') {
      master = {
        ...master,
        id: 'master-new',
        code: body.code,
        name: body.definition.name,
        definition_json: body.definition,
        approved_definition_json: null,
        status: 'DRAFT',
        revision_no: 1,
        approved_version: 0,
        created_by: 'editor-id',
        submitted_by: null,
      }
      return ok(master)
    }
    if (path === `/master-definitions/${master.id}` && method === 'GET') return ok(master)
    if (path === `/master-definitions/${master.id}` && method === 'PATCH') {
      if (body.revision_no !== master.revision_no) return fail('MASTER_REVISION_CONFLICT')
      master = {
        ...master,
        definition_json: body.definition,
        name: body.definition.name,
        revision_no: master.revision_no + 1,
        status: 'DRAFT',
      }
      return ok(master)
    }
    if (path.startsWith('/master-definitions/') && method === 'POST') {
      if (body.revision_no !== master.revision_no) return fail('MASTER_REVISION_CONFLICT')
      master.revision_no++
      if (path.endsWith('/submit-review')) {
        master.status = 'NEEDS_REVIEW'
        master.submitted_by = 'editor-id'
      }
      if (path.endsWith('/approve')) {
        master.status = 'APPROVED'
        master.approved_version++
        master.approved_definition_json = structuredClone(master.definition_json)
      }
      return ok(master)
    }
    if (path.endsWith('/master-binding') && method === 'PUT') {
      if (body.revision_no !== (binding?.revision_no ?? 0)) return fail('MASTER_BINDING_CONFLICT')
      binding = {
        id: 'binding-1',
        source_sheet_id: sheetId,
        master_definition_id: body.master_definition_id,
        master_version: body.master_version,
        classification_revision: body.classification_revision,
        columns_json: body.columns,
        revision_no: (binding?.revision_no ?? 0) + 1,
        status: 'DRAFT',
        created_by: 'editor-id',
        fingerprint: 'profile-hash',
        snapshot_hash: 'a'.repeat(64),
      }
      return ok({
        binding,
        validation: { valid: true, snapshot_hash: binding.snapshot_hash },
        execution_ready: false,
      })
    }
    if (path.endsWith('/master-binding') && method === 'GET')
      return ok({
        binding,
        metadata_ready: binding?.status === 'APPROVED',
        execution_ready: false,
        blocking_reason: binding ? 'MASTER_RUNTIME_PENDING' : 'MASTER_BINDING_REQUIRED',
        validation: binding
          ? { valid: true, sample_rows_valid: 2, snapshot_hash: 'a'.repeat(64) }
          : undefined,
      })
    if (path.endsWith('/master-binding/approve')) {
      if (body.revision_no !== binding.revision_no) return fail('MASTER_BINDING_CONFLICT')
      binding.status = 'APPROVED'
      binding.revision_no++
      return ok(binding)
    }
    return fail('UNHANDLED_MASTER_TEST')
  })
  return {
    ...base,
    master: () => master,
    noCandidates: () => {
      showCandidates = false
    },
  }
}

test('classification uses its own revision and valid data cannot submit before confirmation', async ({
  page,
}) => {
  const mock = await setup(page)
  mock.sheet.dataset_kind = null
  mock.sheet.classification_status = 'CLASSIFICATION_REQUIRED'
  mock.sheet.classification_revision = 7
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '7. Validasi & persetujuan' }).click()
  for (const input of await page
    .locator('fieldset')
    .filter({ hasText: 'Pernyataan verifikasi' })
    .getByRole('checkbox')
    .all())
    await input.check()
  await expect(page.getByRole('button', { name: /Ajukan review revisi/ })).toBeDisabled()
  await page.getByRole('combobox', { name: 'Jenis tab' }).selectOption('NON_MASTER')
  await page.getByRole('button', { name: 'Konfirmasi klasifikasi' }).click()
  await expect(page.getByText('CONFIRMED · revisi klasifikasi 8')).toBeVisible()
  expect(mock.requests.find((r) => r.method === 'PUT')?.body).toEqual({
    revision_no: 7,
    dataset_kind: 'NON_MASTER',
  })
  await expect(page.getByRole('button', { name: /Ajukan review revisi/ })).toBeDisabled()
  for (const input of await page
    .locator('fieldset')
    .filter({ hasText: 'Pernyataan verifikasi' })
    .getByRole('checkbox')
    .all())
    await input.check()
  await expect(page.getByRole('button', { name: /Ajukan review revisi/ })).toBeEnabled()
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('stale classification evidence disables deployment and source-wide sync catches a master tab', async ({
  page,
}) => {
  const mock = await setup(page)
  mock.record.status = 'APPROVED'
  mock.record.review_state = { classification_revision: 1, dataset_kind: 'NON_MASTER' }
  await page.goto(`/configurations/${configId}/review`)
  await login(page, 'approver')
  await expect(page.getByRole('button', { name: 'Deploy konfigurasi' })).toBeDisabled()
  await page.getByRole('button', { name: 'Keluar / ganti akun' }).click()
  await expect(page).toHaveURL(/\/workspace$/)
  await login(page)
  mock.sheet.dataset_kind = 'MASTER'
  await page.getByRole('link', { name: 'Job & ETL' }).click()
  await page.getByRole('button', { name: 'Jalankan sync', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('MASTER_RUNTIME_PENDING')
  expect(mock.requests.filter((r) => r.path === `/etl-jobs/${sourceId}/run`)).toHaveLength(0)
  expect(mock.errors).toEqual([])
})

test('new master requires candidate review, explicit policy and separate approval revisions', async ({
  page,
}) => {
  const mock = await masterSetup(page)
  await page.goto('/masters/new')
  await login(page)
  await page.getByLabel('Kode master', { exact: true }).fill('locations')
  await page.getByLabel('Nama master', { exact: true }).fill('Lokasi')
  await page.getByLabel('Nama field', { exact: true }).fill('location_code')
  await page.getByRole('checkbox', { name: 'location_code', exact: true }).check()
  await page.getByRole('combobox', { name: 'Field label' }).selectOption('location_code')
  await page.getByRole('button', { name: 'Preview kandidat master' }).click()
  await expect(page.getByRole('button', { name: 'Simpan draft master' })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Sudah diperiksa; definisi ini berbeda' }).check()
  await page
    .getByLabel('Alasan definisi berbeda')
    .fill('Lokasi fisik berbeda dari cabang organisasi.')
  await page.getByRole('button', { name: 'Simpan draft master' }).click()
  await expect(page).toHaveURL(/\/masters\/master-new$/)
  await page.getByRole('button', { name: 'Ajukan review master' }).click()
  const creation = mock.requests.find(
    (r) => r.path === '/master-definitions' && r.method === 'POST',
  )?.body
  expect(creation.reviewed_candidate_ids).toEqual(['similar-id'])
  expect(creation.definition.policy).toMatchObject({
    new_record_policy: 'PROPOSE_INSERT',
    source_conflict_policy: 'REQUIRE_REVIEW',
    missing_record_policy: 'KEEP',
  })
  await page.getByRole('button', { name: 'Keluar / ganti akun' }).click()
  await expect(page).toHaveURL(/\/workspace$/)
  await login(page, 'approver')
  await page.getByRole('link', { name: 'Registry master', exact: true }).click()
  await page.getByRole('link', { name: 'Buka definisi locations' }).click()
  await page.getByRole('button', { name: 'Setujui master', exact: true }).click()
  await expect(page.getByText('APPROVED · revisi 3 · versi approved 1')).toBeVisible()
  expect(
    mock.requests.find((r) => r.path === '/master-definitions/master-new/approve')?.body
      .revision_no,
  ).toBe(2)
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('binding uses approved snapshot and independent revisions without offering runtime load', async ({
  page,
}) => {
  const mock = await masterSetup(page)
  mock.master().definition_json = {
    ...mock.master().definition_json,
    name: 'Draft baru',
    fields: [
      { name: 'wrong_draft_field', type: 'integer', nullable: false, pii_classification: 'NONE' },
    ],
  }
  mock.master().status = 'DRAFT'
  mock.master().revision_no = 4
  await page.goto(`/sources/${sourceId}/sheets/${sheetId}/master-binding`)
  await login(page)
  await page.getByRole('combobox', { name: 'Master tujuan' }).selectOption('master-1')
  await page
    .getByRole('combobox', { name: 'Header sumber untuk branch_code' })
    .selectOption('Cabang')
  await page.getByRole('button', { name: 'Simpan binding & dry-run' }).click()
  await expect(page.getByText('DRAFT · revisi binding 1 · revisi klasifikasi 2')).toBeVisible()
  const payload = mock.requests.find(
    (r) => r.path.endsWith('/master-binding') && r.method === 'PUT',
  )?.body
  expect(payload).toMatchObject({
    revision_no: 0,
    master_version: 1,
    classification_revision: 2,
    columns: [
      {
        target_column: 'branch_code',
        target_type: 'text',
        nullable: false,
        is_business_key: true,
        is_primary_key: false,
      },
    ],
  })
  await page.getByRole('button', { name: 'Keluar / ganti akun' }).click()
  await expect(page).toHaveURL(/\/workspace$/)
  await login(page, 'approver')
  await page.getByRole('combobox', { name: 'Sumber', exact: true }).selectOption(sourceId)
  await page.getByRole('combobox', { name: 'Tab Google Sheet' }).selectOption(sheetId)
  await page.getByRole('link', { name: 'Atur binding master' }).click()
  await page.getByRole('button', { name: 'Setujui binding' }).click()
  await expect(page.getByText('Metadata siap · MASTER_RUNTIME_PENDING')).toBeVisible()
  expect(mock.requests.find((r) => r.path.endsWith('/master-binding/approve'))?.body).toEqual({
    revision_no: 1,
    comment: '',
  })
  expect(mock.requests.some((r) => /\/(sync|deploy)$/.test(r.path))).toBe(false)
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})
