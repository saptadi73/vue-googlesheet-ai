import { test, expect, type Page } from '@playwright/test'

const configId = '77777777-7777-4777-8777-777777777777'
const sheetId = '22222222-2222-4222-8222-222222222222'
const sourceId = '11111111-1111-4111-8111-111111111111'
const jobId = '33333333-3333-4333-8333-333333333333'
const product = {
  id: 'product-id',
  code: 'SALES',
  name: 'Penjualan',
  description: 'Data penjualan cabang',
  columns: [],
  dimensions: ['branch_name'],
  metrics: [
    { code: 'net_sales', label: 'Penjualan bersih', column: 'net_amount', aggregation: 'sum' },
  ],
  allowed_roles: ['PLATFORM_ADMIN', 'DATA_STEWARD', 'VIEWER'],
  status: 'ACTIVE',
  version: 1,
  freshness_version: 2,
}

async function setup(page: Page) {
  const errors: string[] = [],
    unexpected: string[] = []
  const requests: { method: string; path: string; body: any }[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  let username = 'editor'
  let tokenNumber = 0
  let conflict = false
  let binaryError = false
  let failedJob = true
  const roles: Record<string, string> = {
    editor: 'DATA_STEWARD',
    approver: 'TECHNICAL_APPROVER',
    admin: 'PLATFORM_ADMIN',
    viewer: 'VIEWER',
  }
  const source = {
    id: sourceId,
    source_code: 'sales',
    name: 'Penjualan cabang',
    status: 'ACTIVE',
    paused: false,
    sync_schedule: null,
  }
  const sheet = {
    id: sheetId,
    sheet_name: 'Sales',
    range_a1: 'A:C',
    header_row: 1,
    data_start_row: 2,
    enabled: true,
    last_fingerprint: 'profile-hash',
    active_configuration_id: null,
  }
  const configuration = {
    schema_version: '1.0',
    dataset_business_name: 'Penjualan',
    dataset_description: '',
    grain: 'Satu baris per transaksi',
    target_schema: 'trusted',
    target_table: 'sales',
    load_strategy: 'APPEND',
    columns: [
      {
        source_column: 'Cabang',
        target_column: 'branch_name',
        target_type: 'text',
        business_name: 'Cabang',
        nullable: false,
        is_business_key: false,
        is_primary_key: false,
        transformation_codes: ['trim'],
        pii_classification: 'NONE',
        confidence: 1,
        reason: '',
      },
      {
        source_column: 'Total',
        target_column: 'net_amount',
        target_type: 'numeric',
        business_name: 'Total',
        nullable: false,
        is_business_key: false,
        is_primary_key: false,
        transformation_codes: ['parse_decimal_id'],
        pii_classification: 'NONE',
        confidence: 1,
        reason: '',
      },
    ],
    data_quality_rules: [],
    semantic: {
      code: 'SALES',
      dimensions: ['branch_name'],
      metrics: product.metrics,
      allowed_roles: product.allowed_roles,
    },
    unresolved_questions: [],
    overall_confidence: 1,
  }
  const record = {
    id: configId,
    source_id: sourceId,
    source_sheet_id: sheetId,
    status: 'AI_DRAFT',
    version_no: 1,
    revision_no: 1,
    created_by: 'editor-id',
    configuration_json: configuration,
    review_state: {} as Record<string, unknown>,
  }
  const validation = {
    valid: true,
    snapshot_hash: 'a'.repeat(64),
    sample_rows_valid: 2,
    sample_rows_invalid: 0,
    row_previews: [
      { source_row: 2, before: { Cabang: ' Jakarta ' }, after: { branch_name: 'Jakarta' } },
    ],
    issues: [],
    warnings: [],
    unresolved_questions: [],
    deployment_plan: {},
  }
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      method = req.method(),
      path = new URL(req.url()).pathname.replace('/api/v1', '')
    const body = req.postData() ? req.postDataJSON() : undefined
    requests.push({ method, path, body })
    const ok = (data: unknown, meta: object = {}) =>
      route.fulfill({ json: { status: 'success', data, meta, errors: [] } })
    const fail = (status: number, code: string, message: string) =>
      route.fulfill({
        status,
        json: { status: 'error', data: null, meta: {}, errors: [{ code, message }] },
      })
    if (path === '/auth/login') {
      username = body.username
      return ok({ access_token: `token-${++tokenNumber}`, refresh_token: `refresh-${tokenNumber}` })
    }
    if (path === '/auth/me')
      return ok({
        id: `${username}-id`,
        username,
        role: roles[username],
        full_name: username,
        is_active: true,
        row_scope: {},
      })
    if (path === '/auth/logout' || path === '/auth/change-password') return ok({ message: 'OK' })
    if (path === '/data-products') return ok([product])
    if (path === '/semantic/query-templates') return ok([])
    if (path === '/data-products/SALES/query')
      return ok(
        [
          { branch_name: 'Jakarta', net_sales: 150 },
          { branch_name: 'Bandung', net_sales: null },
        ],
        { row_count: 2, query_source: 'OPERATIONAL', cached: false },
      )
    if (path === '/data-products/SALES/export') {
      if (binaryError) return fail(403, 'FORBIDDEN', 'Ekspor tidak diizinkan')
      return route.fulfill({
        contentType: 'text/csv',
        body: '\ufeffbranch_name,net_sales\nJakarta,150',
      })
    }
    if (path === '/nl2sql/query')
      return ok([], {
        query_id: 'query-parent',
        clarification_required: true,
        question: 'Pilih produk dan periode yang dimaksud.',
      })
    if (path === '/nl2sql/clarifications/query-parent')
      return ok([{ branch_name: 'Jakarta', net_sales: 150 }], {
        query_id: 'query-child',
        parent_request_id: 'query-parent',
        route: 'OPENAI',
        openai_called: true,
        cached: false,
      })
    if (path.endsWith('/feedback')) return ok({ recorded: true })
    if (path === '/sources' || path === '/etl-jobs') return ok([source])
    if (path === `/sources/${sourceId}/sheets`) return ok([sheet])
    if (path === `/sources/${sourceId}/profiling-runs`)
      return ok([
        {
          id: 'profile',
          source_sheet_id: sheetId,
          created_at: '2026-09-08T00:00:00Z',
          status: 'SUCCEEDED',
          profile_json: {
            row_count: 2,
            warnings: [],
            columns: [
              {
                source_column: 'Cabang',
                normalized_name: 'branch_name',
                inferred_type: 'text',
                pii_suspected: false,
                null_ratio: 0,
                distinct_ratio: 1,
              },
            ],
          },
        },
      ])
    if (path === `/source-sheets/${sheetId}/configurations`) return ok([record])
    if (path === `/source-sheets/${sheetId}` && method === 'PATCH') {
      Object.assign(sheet, body, { last_fingerprint: null })
      return ok(sheet)
    }
    if (path === '/configurations' && method === 'POST') {
      record.configuration_json = body.configuration
      return ok(record)
    }
    if (path === `/configurations/${configId}/review`)
      return ok({
        configuration: record,
        source,
        sheet,
        profile: { columns: [] },
        validation,
        capabilities: { unsupported: [], max_workbook_bytes: 2_000_000 },
      })
    if (path === `/configurations/${configId}` && method === 'PATCH') {
      if (conflict) return fail(409, 'CONFIGURATION_CONFLICT', 'Revisi telah berubah')
      if (body.revision_no !== record.revision_no)
        return fail(409, 'CONFIGURATION_CONFLICT', 'Revision mismatch')
      record.configuration_json = body.configuration
      record.revision_no++
      record.review_state = {}
      return ok(record)
    }
    if (path.endsWith('/submit-review')) {
      if (body.revision_no !== record.revision_no || body.snapshot_hash !== 'a'.repeat(64))
        return fail(409, 'REVIEW_STALE', 'Review stale')
      record.revision_no++
      record.status = 'NEEDS_REVIEW'
      record.review_state = { submitted_revision: record.revision_no, submitted_by: 'editor-id' }
      return ok(record)
    }
    if (path.endsWith('/approve')) {
      if (username !== 'approver' || body.revision_no !== record.revision_no)
        return fail(403, 'FORBIDDEN', 'Wrong approver/revision')
      record.status = 'APPROVED'
      record.revision_no++
      return ok(record)
    }
    if (path.endsWith('/workbook-preview'))
      return ok({
        can_apply: true,
        revision_no: record.revision_no,
        configuration: record.configuration_json,
        question_answers: {},
        diff: {},
        errors: [],
        validation,
        preview_token: 'signed-preview-token',
      })
    if (path.endsWith('/workbook-apply')) {
      record.revision_no++
      record.review_state = {}
      return ok(record)
    }
    if (path === '/jobs')
      return ok([
        { id: jobId, status: failedJob ? 'FAILED' : 'SUCCEEDED', kind: 'ETL', source_id: sourceId },
      ])
    if (path === `/jobs/${jobId}`)
      return ok({
        id: jobId,
        status: failedJob ? 'FAILED' : 'SUCCEEDED',
        kind: 'ETL',
        error_code: failedJob ? 'SOURCE_ACCESS_DENIED' : null,
        error_message: failedJob ? 'Sheet belum dibagikan' : null,
        result: failedJob ? null : { runs: [{ status: 'SKIPPED_DUPLICATE' }] },
      })
    if (path === `/jobs/${jobId}/retry`) {
      failedJob = false
      return ok({ job_id: jobId })
    }
    if (path === '/etl-runs') return ok([])
    if (path === '/data-quality/issues')
      return ok([
        {
          id: 'issue-1',
          source_id: sourceId,
          source_row: 2,
          status: 'OPEN',
          errors: [{ code: 'TYPE_OR_NULL_ERROR' }],
        },
      ])
    if (path.endsWith('/resolve')) return ok({ status: 'RESOLVED' })
    if (path === `/quarantine/${sourceId}/rows`) return ok([])
    if (path === '/users' && method === 'GET')
      return ok([
        { id: 'viewer-id', username: 'viewer', role: 'VIEWER', is_active: true, row_scope: {} },
      ])
    if (path === '/users' && method === 'POST')
      return ok({ id: 'new-user', ...body, password: undefined })
    if (path === '/admin/audit-events')
      return ok([{ event: 'auth.login', user_id: 'admin-id', details: {} }])
    if (path.startsWith('/admin/ai-usage/')) return ok([{ requests: 0, estimated_cost_usd: null }])
    unexpected.push(`${method} ${path}`)
    return fail(404, 'TEST_UNHANDLED', `Unhandled ${path}`)
  })
  return {
    errors,
    unexpected,
    requests,
    record,
    setConflict: () => {
      conflict = true
    },
    setBinaryError: () => {
      binaryError = true
    },
  }
}

async function login(page: Page, username = 'editor') {
  await page.getByLabel('Tenant', { exact: true }).fill('default')
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill('example-password-123')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Keluar / ganti akun' })).toBeVisible()
}

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
  await expect(page.getByText('Akun ini tidak memiliki akses', { exact: false })).toBeVisible()
  expect(
    mock.requests.filter((r) => r.path.startsWith('/admin/') || r.path === '/users'),
  ).toHaveLength(0)
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
  await expect(page.getByRole('status')).toContainText('Draft tersimpan')
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
  await expect(page).toHaveURL(/\/workspace$/)
  await login(page, 'approver')
  await page.getByRole('combobox', { name: 'Sumber', exact: true }).selectOption(sourceId)
  await page.getByRole('combobox', { name: 'Tab Google Sheet', exact: true }).selectOption(sheetId)
  await page.getByRole('link', { name: 'Buka review', exact: true }).click()
  await page.getByRole('button', { name: '7. Validasi & persetujuan' }).click()
  await page.getByRole('button', { name: 'Setujui konfigurasi' }).click()
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
      columns: [{ source_column: 'Cabang', target_column: 'branch_name', target_type: 'text' }],
    },
  })
  expect(mock.requests.some((r) => r.path.endsWith('/ai-configurations'))).toBe(false)
  expect(mock.errors).toEqual([])
  expect(mock.unexpected).toEqual([])
})
