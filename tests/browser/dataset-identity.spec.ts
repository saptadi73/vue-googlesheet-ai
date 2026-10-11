import { expect, test } from '@playwright/test'
import { configId, login, setup, sheetId, sourceId } from './fixtures'

test('reviewer declares the date serial format in the saved mapping', async ({ page }) => {
  const state = await setup(page)
  Object.assign(state.record.configuration_json.columns[0], {
    target_type: 'date', transformation_codes: ['parse_date_id'], date_input_format: null,
  })
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '3. Cleansing', exact: true }).click()
  await page.getByRole('combobox', { name: /^Format nilai tanggal/ }).selectOption('GOOGLE_SHEETS_SERIAL')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect.poll(() => state.requests.filter(r => r.method === 'PATCH').length).toBe(1)
  expect(state.requests.find(r => r.method === 'PATCH')?.body.configuration.columns[0].date_input_format).toBe('GOOGLE_SHEETS_SERIAL')
  expect(state.errors).toEqual([])
})

test('schema changes require explicit preview confirmation before submission', async ({ page }) => {
  const state = await setup(page)
  const migration = {
    fingerprint: 'b'.repeat(64), allowed: true, requires_migration: true, rows_existing: 40,
    operations: [{ action: 'SERIAL_TO_DATE', column: 'start_date', from: 'bigint', type: 'date',
      conversion: 'GOOGLE_SHEETS_SERIAL_1899_12_30', examples: [{ before: 46023, after: '2026-01-01' }],
      validation: { checked: 40, convertible: 40, invalid: 0, declared: true } }],
    comparison: {
      target: 'trusted.events',
      columns: [{ column: 'start_date', before: { name: 'start_date', type: 'bigint', nullable: false },
        after: { name: 'start_date', type: 'date', nullable: false }, changes: ['TYPE'] }],
      keys: { before: [['_tenant_id', '_row_hash']], after: [['_tenant_id', '_row_hash']], changed: false },
      view: { name: 'semantic.v_events', before_target: ['trusted.events'], after_target: 'trusted.events',
        before_columns: [{ name: 'start_date', type: 'bigint' }], after_columns: [{ name: 'start_date', type: 'date' }],
        exists: true, recreate: true, dependencies: [], grants_preserved: true },
    },
    blockers: [], policy: 'REVIEWED_NON_DESTRUCTIVE_EVOLUTION',
  }
  state.validation.deployment_plan = { migration }
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: /^7\./ }).click()
  const preview = page.getByRole('region', { name: 'Preview perubahan schema' })
  await expect(preview).toContainText('40 record lama')
  const comparison = page.getByRole('region', { name: 'Perbandingan schema lama dan baru' })
  await expect(comparison).toContainText('bigint')
  await expect(comparison).toContainText('date')
  await expect(comparison).toContainText('trusted.events')
  await expect(comparison).toContainText('start_date')
  await expect(preview).toContainText('46023 → 2026-01-01')
  const checklist = page.locator('fieldset').filter({ hasText: 'Pernyataan verifikasi' })
  for (const checkbox of await checklist.getByRole('checkbox').all()) await checkbox.check()
  await expect(page.getByRole('button', { name: /Ajukan review revisi/ })).toBeDisabled()
  await preview.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Dry-run ulang', exact: true }).click()
  await expect(preview.getByRole('checkbox')).not.toBeChecked()
  for (const checkbox of await checklist.getByRole('checkbox').all()) await checkbox.check()
  await preview.getByRole('checkbox').check()
  await page.getByRole('button', { name: /Ajukan review revisi/ }).click()
  await expect.poll(() => state.requests.some(r => r.path.endsWith('/submit-review'))).toBe(true)
  expect(state.requests.find(r => r.path.endsWith('/submit-review'))?.body.reviewed_schema_fingerprint).toBe(migration.fingerprint)
  expect(state.errors).toEqual([])
})

test('unsafe schema blockers prevent confirming and submitting the review', async ({ page }) => {
  const state = await setup(page)
  state.validation.deployment_plan = { migration: {
    fingerprint: 'c'.repeat(64), allowed: false, requires_migration: true, rows_existing: 40,
    operations: [{ action: 'RECREATE_VIEW', column: 'v_example' }],
    blockers: ['Kolom baru end_date wajib tetapi 40 record lama belum memiliki nilai.'],
    policy: 'REVIEWED_NON_DESTRUCTIVE_EVOLUTION',
  } }
  state.validation.valid = false
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: /^7\./ }).click()
  const preview = page.getByRole('region', { name: 'Preview perubahan schema' })
  await expect(preview).toContainText('40 record lama belum memiliki nilai')
  await expect(preview.getByRole('checkbox')).toBeDisabled()
  await expect(page.getByRole('button', { name: /Ajukan review revisi/ })).toBeDisabled()
  expect(state.requests.filter(r => r.path.endsWith('/submit-review'))).toHaveLength(0)
  expect(state.errors).toEqual([])
})

for (const requiresMigration of [true, false]) {
test(`approver cannot approve a changed fingerprint with requires_migration=${requiresMigration}`, async ({ page }) => {
  const state = await setup(page)
  state.record.status = 'NEEDS_REVIEW'
  state.record.review_state = { submitted_revision: 1, schema_migration: {
    fingerprint: 'b'.repeat(64), operations: [{ action: 'ALTER_TYPE', column: 'start_date' }],
  } }
  state.validation.deployment_plan = { migration: {
    fingerprint: 'c'.repeat(64), allowed: true, requires_migration: requiresMigration, rows_existing: 40,
    operations: requiresMigration ? [{ action: 'SERIAL_TO_DATE', column: 'start_date', from: 'bigint', type: 'date' }] : [],
    blockers: [], policy: 'REVIEWED_NON_DESTRUCTIVE_EVOLUTION',
  } }
  await page.goto(`/configurations/${configId}/review`)
  await login(page, 'approver')
  await page.getByRole('button', { name: /^7\./ }).click()
  const preview = page.getByRole('region', { name: 'Preview perubahan schema' })
  await expect(preview.getByRole('alert')).toContainText('Editor perlu')
  await preview.getByText('Bukti rencana schema yang diajukan', { exact: true }).click()
  await expect(preview.locator('pre')).toContainText('b'.repeat(64))
  await expect(page.getByRole('button', { name: 'Setujui konfigurasi', exact: true })).toBeDisabled()
  expect(state.requests.filter(r => r.path.endsWith('/approve'))).toHaveLength(0)
  expect(state.errors).toEqual([])
})
}

test('date review guidance covers serial parsing, view migration and correct deployment version', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/guide#review-ulang-tanggal')
  const guide = page.locator('#review-ulang-tanggal')
  await expect(guide).toContainText('parse_date_id')
  await expect(guide).toContainText('SCHEMA_MIGRATION_STALE')
  await expect(guide).toContainText('configuration_id')
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  for (const [step, content] of [
    ['Petunjuk langkah 3: Cleansing', ['parse_date_id', '46023', 'Pola tanggal']],
    ['Petunjuk langkah 5: Pemuatan', ['ID tab', 'Preview perubahan schema']],
    ['Petunjuk langkah 7: Validasi dan persetujuan', ['configuration_id', 'SCHEMA_MIGRATION_STALE']],
  ] as const) {
    await page.getByRole('button', { name: step, exact: true }).click()
    const dialog = page.getByRole('dialog')
    for (const text of content) await expect(dialog).toContainText(text)
    await dialog.getByRole('button', { name: 'Mengerti', exact: true }).click()
  }
  expect(state.requests.filter(request => request.method === 'PATCH' || request.path.endsWith('/deploy') || request.path.endsWith('/approve'))).toHaveLength(0)
  expect(state.errors).toEqual([])
})

for (const scenario of [
  { strategy: 'APPEND', keyed: true },
  { strategy: 'APPEND', keyed: false },
  { strategy: 'UPSERT', keyed: true },
  { strategy: 'FULL_REFRESH', keyed: true },
] as const) {
  test(`manual ${scenario.strategy} draft with keyed=${scenario.keyed} sends a valid duplicate policy`, async ({ page }) => {
    const state = await setup(page)
    Object.assign(state.sheet, { is_present: true })
    await page.route(`**/api/v1/sources/${sourceId}/profiling-runs`, route => route.fulfill({
      json: { status: 'success', data: [{
        id: 'profile', source_sheet_id: sheetId, status: 'SUCCEEDED', created_at: '2026-10-11T00:00:00Z',
        profile_json: {
          spreadsheet_title: 'Data pelanggan', sheet_name: 'Sales', row_count: 2, warnings: [],
          columns: [{ source_column: 'Kode', normalized_name: 'kode', inferred_type: 'text', pii_suspected: false, null_ratio: 0, distinct_ratio: 1 }],
        },
      }], meta: {}, errors: [] },
    }))
    await page.goto(`/workspace?source_id=${sourceId}`)
    await login(page, 'admin')
    await page.getByRole('combobox', { name: 'Tab Google Sheet', exact: true }).click()
    await page.getByRole('option', { name: 'Sales', exact: true }).click()
    const key = page.getByLabel('Business key', { exact: true })
    await expect(key).toBeChecked()
    await key.setChecked(scenario.keyed)
    await page.getByRole('combobox', { name: /^Template pemuatan/ }).selectOption(scenario.strategy)
    if (scenario.strategy === 'APPEND') {
      await expect(page.getByText(scenario.keyed ? 'APPEND memakai key yang dipilih.' : 'APPEND tanpa key memakai SKIP_IDENTICAL', { exact: false })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Buat draft manual & buka review', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/configurations/${configId}/review$`))
    const saved = state.requests.find(request => request.method === 'POST' && request.path === '/configurations')?.body.configuration
    expect(saved.load_strategy).toBe(scenario.strategy)
    expect(saved.columns[0]).toMatchObject({ is_business_key: scenario.keyed, is_primary_key: scenario.keyed })
    expect(saved.append_duplicate_policy).toBe(scenario.strategy === 'APPEND' && !scenario.keyed ? 'SKIP_IDENTICAL' : null)
    expect(state.requests.some(request => request.path.endsWith('/ai-configurations'))).toBe(false)
    expect(state.errors).toEqual([])
    expect(state.unexpected).toEqual([])
  })
}

test('review removes stale duplicate policy when an APPEND key or FULL_REFRESH is selected', async ({ page }) => {
  const state = await setup(page)
  Object.assign(state.record.configuration_json, { append_duplicate_policy: 'REJECT_IDENTICAL' })
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: /^2\./ }).click()
  await page.getByLabel('Business key', { exact: true }).first().check()
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Draft tersimpan' })).toBeVisible()
  const keyed = state.requests.filter(request => request.method === 'PATCH').at(-1)?.body.configuration
  expect(keyed.append_duplicate_policy).toBeUndefined()
  expect(keyed.columns[0].is_business_key).toBe(true)
  await page.getByRole('button', { name: '5. Pemuatan', exact: true }).click()
  await page.getByRole('combobox', { name: 'Strategi', exact: true }).selectOption('FULL_REFRESH')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect.poll(() => state.requests.filter(request => request.method === 'PATCH').length).toBe(2)
  const refreshed = state.requests.filter(request => request.method === 'PATCH').at(-1)?.body.configuration
  expect(refreshed.load_strategy).toBe('FULL_REFRESH')
  expect(refreshed.append_duplicate_policy).toBeUndefined()
  expect(state.errors).toEqual([])
})

test('manual draft prefills file/tab identity and preserves edits during tracking reload', async ({ page }) => {
  const state = await setup(page)
  state.source.name = 'Nama sumber kustom'
  state.sheet.sheet_name = 'REKAP JENIS KELUHAN'
  Object.assign(state.sheet, { is_present: true })
  await page.route(`**/api/v1/sources/${sourceId}/profiling-runs`, (route) => route.fulfill({
    json: { status: 'success', data: [{
      id: 'profile', source_sheet_id: sheetId, status: 'SUCCEEDED', created_at: '2026-10-11T00:00:00Z',
      profile_json: {
        spreadsheet_title: 'Keluhan KAN Jabung 2026', sheet_name: 'REKAP JENIS KELUHAN',
        row_count: 2, warnings: [],
        columns: [{ source_column: 'Cabang', normalized_name: 'branch_name', inferred_type: 'text', pii_suspected: false, null_ratio: 0, distinct_ratio: 1 }],
      },
    }], meta: {}, errors: [] },
  }))
  await page.goto(`/workspace?source_id=${sourceId}`)
  await login(page, 'admin')
  await page.getByRole('combobox', { name: 'Tab Google Sheet', exact: true }).click()
  await page.getByRole('option', { name: 'REKAP JENIS KELUHAN', exact: true }).click()
  await expect(page.getByLabel('Nama dataset', { exact: true })).toHaveValue('Keluhan KAN Jabung 2026 / REKAP JENIS KELUHAN')
  await expect(page.getByLabel('Kode analitik', { exact: true })).toHaveValue('keluhan_kan_jabung_2026_rekap_jenis_keluhan')
  await page.getByLabel('Nama dataset', { exact: true }).fill('Nama saya')
  await page.getByRole('button', { name: 'Muat ulang tracking sumber', exact: true }).click()
  await expect(page.getByLabel('Nama dataset', { exact: true })).toHaveValue('Nama saya')
  expect(state.errors).toEqual([])
})

test('existing review keeps saved identity until explicit file/tab suggestion is chosen', async ({ page }) => {
  const state = await setup(page)
  state.source.name = 'Keluhan KAN Jabung 2026'
  state.sheet.sheet_name = 'REKAP JENIS KELUHAN'
  const original = state.record.configuration_json.dataset_business_name
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await expect(page.getByLabel('Nama bisnis', { exact: true })).toHaveValue(original)
  await page.getByRole('button', { name: 'Gunakan nama file dan tab', exact: true }).click()
  await expect(page.getByLabel('Nama bisnis', { exact: true })).toHaveValue('Keluhan KAN Jabung 2026 / REKAP JENIS KELUHAN')
  const code = page.getByLabel('Kode produk data', { exact: true })
  await expect(code).toHaveValue('keluhan_kan_jabung_2026_rekap_jenis_keluhan')
  expect(await code.evaluate((input: HTMLInputElement) => input.checkValidity())).toBe(true)
  expect(state.requests.filter((request) => request.method === 'PATCH' || request.path.endsWith('/approve'))).toHaveLength(0)
  expect(state.errors).toEqual([])
})

test('review automatically repairs pasted invalid code before save without changing business name', async ({ page }) => {
  const state = await setup(page)
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  const businessName = state.record.configuration_json.dataset_business_name
  const code = page.getByLabel('Kode produk data', { exact: true })
  await code.fill('Keluhan KAN Jabung 2026 / ANGGOTA NON ANGGOTA')
  await page.getByLabel('Nama bisnis', { exact: true }).click()
  await expect(code).toHaveValue('keluhan_kan_jabung_2026_anggota_non_anggota')
  await expect(page.getByRole('status').filter({ hasText: 'Kode produk data dirapikan otomatis' })).toBeVisible()
  await expect(page.getByLabel('Nama bisnis', { exact: true })).toHaveValue(businessName)
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  const saved = state.requests.find(request => request.method === 'PATCH')
  expect(saved?.body.configuration.semantic.code).toBe('keluhan_kan_jabung_2026_anggota_non_anggota')
  expect(state.errors).toEqual([])
})
