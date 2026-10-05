import { test, expect } from '@playwright/test'
import { setup, login, configId, sheetId, sourceId, jobId } from './fixtures'

test('dashboard sends catalog query, charts nulls and handles authenticated download errors', async ({
  page,
}) => {
  const mock = await setup(page)
  await page.goto('/dashboard')
  await login(page, 'viewer')
  await page.getByRole('combobox', { name: 'Produk data', exact: true }).selectOption('SALES')
  await page.getByLabel('branch_name', { exact: true }).check()
  await page.getByLabel('Penjualan bersih', { exact: true }).check()
  await page.getByRole('button', { name: 'Jalankan query', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Jakarta', exact: true })).toBeVisible()
  const request = mock.requests.find((r) => r.path === '/data-products/SALES/query')
  expect(request?.body).toMatchObject({
    metrics: ['net_sales'],
    dimensions: ['branch_name'],
    limit: 100,
    offset: 0,
  })
  await page.getByText('Visualisasi hasil', { exact: true }).click()
  await expect(page.locator('.apexcharts-canvas')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Administrasi', exact: true })).toHaveCount(0)
  mock.setBinaryError()
  await page.getByRole('button', { name: 'Ekspor halaman CSV' }).click()
  await expect(page.getByRole('alert')).toContainText('Ekspor tidak diizinkan')
  await page.getByRole('link', { name: 'Chat data', exact: true }).click()
  await page.goto('/admin')
  await login(page, 'viewer')
  await expect(page).toHaveURL(/\/dashboard$/)
  expect(
    mock.requests.filter((r) => r.path.startsWith('/admin/') || r.path === '/users'),
  ).toHaveLength(0)
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('editor registers a source with assigned BE16 metadata', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/workspace')
  await login(page)
  await page.getByText('Hubungkan Google Sheet baru').click()
  await page.getByLabel('Kode sumber').fill('scoped_sales')
  await page.getByLabel('Nama sumber').fill('Penjualan scoped')
  await page.getByLabel('URL / ID spreadsheet').fill('fake_sheet_12345')
  await page.getByLabel('Unit pemilik').selectOption(sourceId)
  await page.getByLabel('Domain bisnis').selectOption(sheetId)
  await page.getByLabel('Yurisdiksi').selectOption(jobId)
  await page.getByLabel('Purpose').selectOption('44444444-4444-4444-8444-444444444444')
  await page.getByLabel('Data owner').selectOption('editor-id')
  await page.getByLabel('Data steward').selectOption('steward-id')
  await page.getByLabel('Sensitivitas').selectOption('MEDIUM')
  await page.getByRole('button', { name: 'Hubungkan & profiling' }).click()
  expect(
    mock.requests.find((request) => request.path === '/sources/google-sheets')?.body,
  ).toMatchObject({
    source_code: 'scoped_sales',
    access_metadata: {
      owner_unit_id: sourceId,
      business_domain_id: sheetId,
      jurisdiction_id: jobId,
      purpose_id: '44444444-4444-4444-8444-444444444444',
      data_owner_user_id: 'editor-id',
      data_steward_user_id: 'steward-id',
      sensitivity: 'MEDIUM',
    },
  })
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('editor repairs legacy source metadata without approving access', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/workspace')
  await login(page)
  await page.getByRole('combobox', { name: 'Sumber', exact: true }).selectOption(sourceId)
  await page.getByLabel('Unit pemilik sumber').selectOption(sourceId)
  await page.getByLabel('Domain bisnis sumber').selectOption(sheetId)
  await page.getByLabel('Yurisdiksi sumber').selectOption(jobId)
  await page.getByLabel('Purpose sumber').selectOption('44444444-4444-4444-8444-444444444444')
  await page.getByLabel('Data owner sumber').selectOption('editor-id')
  await page.getByLabel('Data steward sumber').selectOption('steward-id')
  await page.getByLabel('Sensitivitas sumber').selectOption('HIGH')
  await page.getByRole('button', { name: 'Simpan metadata akses' }).click()
  expect(
    mock.requests.find((request) => request.path === `/sources/${sourceId}/access-metadata`)?.body,
  ).toEqual({
    revision_no: 1,
    access_metadata: {
      owner_unit_id: sourceId,
      business_domain_id: sheetId,
      jurisdiction_id: jobId,
      purpose_id: '44444444-4444-4444-8444-444444444444',
      data_owner_user_id: 'editor-id',
      data_steward_user_id: 'steward-id',
      sensitivity: 'HIGH',
    },
  })
  await expect(
    page.getByRole('status').filter({ hasText: 'Metadata akses sumber tersimpan' }),
  ).toBeVisible()
  await expect(page.getByText('Status akses: Perlu policy akses')).toBeVisible()
  mock.source.access_revision++
  await page.getByLabel('Sensitivitas sumber').selectOption('MEDIUM')
  await page.getByRole('button', { name: 'Simpan metadata akses' }).click()
  await expect(page.getByRole('alert')).toContainText('Metadata berubah')
  await expect(page.getByLabel('Sensitivitas sumber')).toHaveValue('MEDIUM')
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('separate admin reviews source metadata without granting data access', async ({ page }) => {
  const mock = await setup(page)
  mock.source.access_metadata = {
    owner_unit_id: sourceId,
    business_domain_id: sheetId,
    jurisdiction_id: jobId,
    purpose_id: '44444444-4444-4444-8444-444444444444',
    data_owner_user_id: 'editor-id',
    data_steward_user_id: 'steward-id',
    sensitivity: 'HIGH',
  }
  mock.source.access_metadata_editor_id = 'editor-id'
  mock.source.access_revision = 2
  await page.goto('/workspace')
  await login(page, 'admin')
  await page.getByRole('combobox', { name: 'Sumber', exact: true }).selectOption(sourceId)
  await page.getByRole('button', { name: 'Tinjau metadata' }).click()
  await expect(page.locator('dd').filter({ hasText: 'REPORTING · Reporting' })).toBeVisible()
  await page.getByRole('button', { name: 'Setujui metadata' }).click()
  expect(
    mock.requests.find(
      (request) =>
        request.path === `/sources/${sourceId}/access-review` && request.method === 'POST',
    )?.body,
  ).toEqual({
    revision_no: 2,
    decision: 'APPROVE',
    reason: 'METADATA_VERIFIED',
  })
  await expect(page.getByText('Review metadata: APPROVED')).toBeVisible()
  await expect(page.getByText('Status akses: Perlu policy akses')).toBeVisible()
  await page.getByRole('button', { name: 'Muat policy SOURCE' }).click()
  await page.getByLabel('Policy sumber').selectOption('66666666-6666-4666-8666-666666666666')
  await page.getByRole('button', { name: 'Aktifkan policy sumber' }).click()
  expect(
    mock.requests.find((request) => request.path === `/sources/${sourceId}/access-activate`)?.body,
  ).toEqual({
    revision_no: 3,
    policy_id: '66666666-6666-4666-8666-666666666666',
  })
  await expect(page.getByText('Status akses: Policy approved')).toBeVisible()
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('reviewer rejects invalid source scope without granting access', async ({ page }) => {
  const mock = await setup(page)
  mock.source.access_metadata = {
    owner_unit_id: sourceId,
    business_domain_id: sheetId,
    jurisdiction_id: jobId,
    purpose_id: '44444444-4444-4444-8444-444444444444',
    data_owner_user_id: 'editor-id',
    data_steward_user_id: 'steward-id',
    sensitivity: 'HIGH',
  }
  mock.source.access_metadata_editor_id = 'editor-id'
  mock.setReviewScopeInvalid()
  await page.goto('/workspace')
  await login(page, 'admin')
  await page.getByRole('combobox', { name: 'Sumber', exact: true }).selectOption(sourceId)
  await page.getByRole('button', { name: 'Tinjau metadata' }).click()
  await expect(page.getByRole('button', { name: 'Setujui metadata' })).toBeDisabled()
  await page.getByLabel('Alasan penolakan').selectOption('SCOPE_MISMATCH')
  await page.getByRole('button', { name: 'Tolak metadata' }).click()
  expect(
    mock.requests.find(
      (request) =>
        request.path === `/sources/${sourceId}/access-review` && request.method === 'POST',
    )?.body,
  ).toEqual({
    revision_no: 1,
    decision: 'REJECT',
    reason: 'SCOPE_MISMATCH',
  })
  await expect(page.getByText(/Review metadata: REJECTED/)).toBeVisible()
  await expect(page.getByText('Status akses: Perlu policy akses')).toBeVisible()
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('pending BE16 source is absent from data product choices', async ({ page }) => {
  const mock = await setup(page)
  mock.source.access_metadata = {
    owner_unit_id: sourceId,
    business_domain_id: sheetId,
    jurisdiction_id: jobId,
    purpose_id: '44444444-4444-4444-8444-444444444444',
    data_owner_user_id: 'editor-id',
    data_steward_user_id: 'steward-id',
    sensitivity: 'HIGH',
  }
  await page.goto('/workspace')
  await login(page)
  await page.getByRole('combobox', { name: 'Sumber', exact: true }).selectOption(sourceId)
  await expect(
    page.getByText('Produk data sumber ini belum tersedia sampai policy akses disetujui.'),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click()
  await expect
    .poll(() => mock.requests.filter((request) => request.path === '/data-products').length)
    .toBeGreaterThan(0)
  await expect(
    page
      .getByRole('combobox', { name: 'Produk data', exact: true })
      .getByRole('option', { name: /SALES/ }),
  ).toHaveCount(0)
  await page.getByRole('link', { name: 'Chat data', exact: true }).click()
  await expect
    .poll(() => mock.requests.filter((request) => request.path === '/data-products').length)
    .toBeGreaterThan(1)
  await expect(
    page
      .getByRole('combobox', { name: 'Produk data', exact: true })
      .getByRole('option', { name: /SALES/ }),
  ).toHaveCount(0)
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('chat treats clarification as a successful conversation step and sends a full question', async ({
  page,
}) => {
  const mock = await setup(page)
  await page.goto('/chat')
  await login(page, 'viewer')
  await page.getByLabel('Pertanyaan Anda').fill('Berapa penjualan?')
  await page.getByRole('button', { name: 'Tanyakan data' }).click()
  await expect(page.getByText('Pilih produk dan periode yang dimaksud.')).toBeVisible()
  await expect(page.getByText('Belum ada data untuk pilihan ini.')).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Produk data', exact: true }).selectOption('SALES')
  await page
    .getByLabel('Pertanyaan yang diperjelas')
    .fill('Berapa penjualan cabang pada September 2026?')
  await page.getByRole('button', { name: 'Kirim klarifikasi' }).click()
  await expect(page.getByRole('cell', { name: 'Jakarta' })).toBeVisible()
  expect(mock.requests.find((r) => r.path.includes('/clarifications/'))?.body).toEqual({
    question: 'Berapa penjualan cabang pada September 2026?',
    data_product_code: 'SALES',
  })
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('ETL review saves full draft, resets checklist and approves with a separate account', async ({
  page,
}) => {
  const mock = await setup(page)
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByLabel('Nama bisnis', { exact: true }).fill('Penjualan diperiksa')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Draft tersimpan' })).toBeVisible()
  expect(mock.requests.find((r) => r.method === 'PATCH')?.body).toMatchObject({
    revision_no: 1,
    question_answers: {},
    configuration: { dataset_business_name: 'Penjualan diperiksa', columns: expect.any(Array) },
  })
  await page.getByRole('button', { name: '7. Validasi & persetujuan' }).click()
  const submit = page.getByRole('button', { name: /Ajukan review revisi/ })
  await expect(submit).toBeDisabled()
  for (const checkbox of await page
    .locator('fieldset')
    .filter({ hasText: 'Pernyataan verifikasi' })
    .getByRole('checkbox')
    .all())
    await checkbox.check()
  await submit.click()
  await expect(page.getByText('Revisi ini sudah diajukan untuk review.')).toBeVisible()
  const submission = mock.requests.find((r) => r.path.endsWith('/submit-review'))?.body
  expect(submission).toEqual({
    revision_no: 2,
    snapshot_hash: 'a'.repeat(64),
    reviewed_columns: ['branch_name', 'net_amount'],
    reviewed_sections: ['identity', 'columns', 'cleansing', 'quality', 'load', 'semantic'],
  })
  await page.getByRole('button', { name: 'Keluar / ganti akun' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await login(page, 'approver')
  await page.getByRole('link', { name: 'Workspace ETL', exact: true }).click()
  await page.getByRole('combobox', { name: 'Sumber', exact: true }).selectOption(sourceId)
  await expect(
    page.getByRole('status').filter({ hasText: 'Status akses: Perlu policy akses' }),
  ).toBeVisible()
  await page.getByRole('combobox', { name: 'Tab Google Sheet', exact: true }).selectOption(sheetId)
  await page.getByRole('link', { name: 'Buka review', exact: true }).click()
  await page.getByRole('button', { name: '7. Validasi & persetujuan' }).click()
  await page.getByRole('button', { name: 'Setujui konfigurasi' }).click()
  await page.getByRole('button', { name: 'Konfirmasi setuju' }).click()
  await expect(page.getByRole('button', { name: 'Deploy konfigurasi' })).toBeVisible()
  expect(mock.requests.find((r) => r.path.endsWith('/approve'))?.body.revision_no).toBe(3)
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('revision conflict preserves unsaved draft and offers reload guidance', async ({ page }) => {
  const mock = await setup(page)
  mock.setConflict()
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByLabel('Nama bisnis', { exact: true }).fill('Perubahan lokal')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Muat ulang revisi terbaru')
  await expect(page.getByLabel('Nama bisnis', { exact: true })).toHaveValue('Perubahan lokal')
  expect(mock.requests.filter((r) => r.method === 'PATCH')).toHaveLength(1)
  expect(mock.errors).toEqual([])
})

test('workbook applies the exact signed preview without implicit approval', async ({ page }) => {
  const mock = await setup(page)
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByText('Review melalui Excel (opsional)', { exact: true }).click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'review.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('mock workbook'),
  })
  await page.getByRole('button', { name: 'Terima perubahan Excel ke draft' }).click()
  await expect(page.getByRole('status')).toContainText('Perubahan Excel disimpan')
  const applied = mock.requests.find((r) => r.path.endsWith('/workbook-apply'))?.body
  expect(applied).toMatchObject({
    revision_no: 1,
    preview_token: 'signed-preview-token',
    question_answers: {},
    configuration: mock.record.configuration_json,
  })
  expect(mock.requests.some((r) => r.path.endsWith('/approve') || r.path.endsWith('/deploy'))).toBe(
    false,
  )
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('job FAILED inside HTTP 200 displays worker error and explicit retry result', async ({
  page,
}) => {
  const mock = await setup(page)
  await page.goto(`/jobs?job=${jobId}`)
  await login(page)
  await expect(page.getByText('SOURCE_ACCESS_DENIED: Sheet belum dibagikan')).toBeVisible()
  await page.getByRole('button', { name: 'Retry job gagal' }).click()
  await expect(page.getByText('ETL · SUCCEEDED', { exact: true })).toBeVisible()
  await expect(page.locator('pre')).toContainText('SKIPPED_DUPLICATE')
  expect(mock.requests.filter((r) => r.path.endsWith('/retry'))).toHaveLength(1)
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('admin creates a scoped user and quality resolve sends only a resolution', async ({
  page,
}) => {
  const mock = await setup(page)
  await page.goto('/admin')
  await login(page, 'admin')
  await page
    .locator('summary')
    .filter({ hasText: /^Buat pengguna$/ })
    .click()
  await page.getByLabel('Username', { exact: true }).fill('viewer_baru')
  await page.getByLabel('Nama lengkap', { exact: true }).fill('Viewer Baru')
  await page.getByLabel('Password awal', { exact: true }).fill('secure-example-password')
  await page.getByRole('button', { name: 'Tambah batasan baris' }).click()
  await page.getByLabel('Kode produk', { exact: true }).fill('SALES')
  await page.getByLabel('Dimensi', { exact: true }).fill('branch_name')
  await page.getByLabel('Nilai yang diizinkan (satu per baris)').fill('Jakarta')
  await page.getByRole('button', { name: 'Terapkan batasan ke form' }).click()
  await page.getByRole('button', { name: 'Buat pengguna', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Pengguna dibuat' })).toBeVisible()
  expect(mock.requests.find((r) => r.path === '/users' && r.method === 'POST')?.body).toMatchObject(
    { role: 'VIEWER', row_scope: { SALES: { branch_name: ['Jakarta'] } } },
  )
  await page.getByRole('link', { name: 'Kualitas data', exact: true }).click()
  await page.getByLabel('Catatan penyelesaian').fill('Tanggal sudah diperbaiki di sumber.')
  await page.getByRole('button', { name: 'Tandai selesai' }).click()
  await expect(page.getByRole('status')).toContainText('Catatan tersimpan')
  expect(mock.requests.find((r) => r.path.endsWith('/resolve'))?.body).toEqual({
    resolution: 'Tanggal sudah diperbaiki di sumber.',
  })
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('source tab profile enables manual draft creation without an AI call', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/workspace')
  await login(page)
  await page.getByRole('combobox', { name: 'Sumber', exact: true }).selectOption(sourceId)
  await page.getByRole('combobox', { name: 'Tab Google Sheet', exact: true }).selectOption(sheetId)
  await page.getByText('Buat draft manual tanpa AI', { exact: true }).click()
  await page.getByLabel('Nama dataset', { exact: true }).fill('Draft manual')
  await page.getByLabel('Grain / arti satu baris').fill('Satu baris per cabang')
  await page.getByLabel('Nama dasar tabel').fill('sales_manual')
  await page.getByLabel('Kode produk analitik').fill('SALES_MANUAL')
  await page.getByRole('button', { name: 'Buat draft & buka review' }).click()
  await expect(page.getByRole('heading', { name: 'Verifikasi konfigurasi ETL' })).toBeVisible()
  expect(mock.requests.find((r) => r.path === '/configurations')?.body).toMatchObject({
    source_sheet_id: sheetId,
    configuration: {
      columns: [
        { source_column: 'Cabang', target_column: 'branch_name', target_type: 'text' },
        { source_column: 'Total', target_column: 'net_amount', target_type: 'text' },
      ],
    },
  })
  expect(mock.requests.some((r) => r.path.endsWith('/ai-configurations'))).toBe(false)
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})

test('dashboard runs natural-language NL2SQL and renders its chart', async ({ page }) => {
  const mock = await setup(page)
  let nl2sqlBody: Record<string, unknown> | undefined
  await page.route('**/api/v1/nl2sql/query', (route) => {
    nl2sqlBody = route.request().postDataJSON()
    return route.fulfill({
      json: {
        status: 'success',
        data: [
          { branch_name: 'Jakarta', net_sales: 150 },
          { branch_name: 'Bandung', net_sales: 50 },
        ],
        meta: {
          query_id: 'dashboard-natural-language',
          route: 'OPENAI',
          openai_called: true,
          cached: false,
          visualization: {
            type: 'bar',
            title: 'Penjualan per cabang',
            x_field: 'branch_name',
            y_field: null,
            series: [{ field: 'net_sales', type: 'bar', axis: 'left' }],
          },
        },
        errors: [],
      },
    })
  })
  await page.goto('/dashboard')
  await login(page, 'viewer')
  await page
    .getByRole('textbox', { name: 'Pertanyaan Anda' })
    .fill('Tampilkan penjualan per cabang')
  await page.getByRole('button', { name: 'Tanyakan data' }).click()
  await expect(page.getByRole('cell', { name: 'Jakarta', exact: true })).toBeVisible()
  await page.getByText('Visualisasi hasil', { exact: true }).click()
  await expect(page.locator('.apexcharts-canvas')).toBeVisible()
  expect(nl2sqlBody).toMatchObject({
    question: 'Tampilkan penjualan per cabang',
    data_product_code: null,
  })
  expect(mock.errors).toEqual([])
})