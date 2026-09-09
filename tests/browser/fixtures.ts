import { expect, type Page } from '@playwright/test'

export const configId = '77777777-7777-4777-8777-777777777777'
export const sheetId = '22222222-2222-4222-8222-222222222222'
export const sourceId = '11111111-1111-4111-8111-111111111111'
export const jobId = '33333333-3333-4333-8333-333333333333'
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

export async function setup(page: Page) {
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
    dataset_kind: 'NON_MASTER' as string | null,
    classification_status: 'CONFIRMED',
    classification_revision: 2,
    classification_confirmed_by: 'editor-id',
    classification_confirmed_at: '2026-09-08T00:00:00Z',
  }
  function classification() {
    return {
      schema_version: '1.0',
      classification_scope: 'SHEET',
      source_sheet_id: sheetId,
      dataset_kind: sheet.dataset_kind,
      status: sheet.classification_status,
      revision_no: sheet.classification_revision,
      confirmed_by: sheet.classification_confirmed_by,
      confirmed_at: sheet.classification_confirmed_at,
      execution_ready:
        sheet.classification_status === 'CONFIRMED' && sheet.dataset_kind === 'NON_MASTER',
      blocking_reason:
        sheet.classification_status !== 'CONFIRMED'
          ? { code: 'CLASSIFICATION_REQUIRED', message: 'Konfirmasi jenis tab.' }
          : sheet.dataset_kind === 'MASTER'
            ? { code: 'MASTER_RUNTIME_PENDING', message: 'Runtime master belum tersedia.' }
            : null,
    }
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
    if (path === '/configurations/parameter-catalog')
      return ok({ schema_version: '1.0', parameters: [], operations: [], capabilities: {} })
    if (path === `/configurations/${configId}/validate`)
      return ok({ ...validation, ready_for_review: true })
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
    if (path === `/source-sheets/${sheetId}/classification`) {
      if (method === 'PUT') {
        if (body.revision_no !== sheet.classification_revision)
          return fail(409, 'CLASSIFICATION_CONFLICT', 'Revisi klasifikasi berubah')
        if (
          sheet.dataset_kind !== body.dataset_kind ||
          sheet.classification_status !== 'CONFIRMED'
        ) {
          sheet.dataset_kind = body.dataset_kind
          sheet.classification_status = 'CONFIRMED'
          sheet.classification_revision++
        }
      }
      return ok(classification())
    }
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
        validation: { ...validation, ready_for_review: classification().execution_ready },
        classification: classification(),
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
      record.review_state = {
        submitted_revision: record.revision_no,
        submitted_by: 'editor-id',
        classification_revision: sheet.classification_revision,
        dataset_kind: sheet.dataset_kind,
      }
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
    sheet,
    source,
    classification,
    setConflict: () => {
      conflict = true
    },
    setBinaryError: () => {
      binaryError = true
    },
  }
}

export async function login(page: Page, username = 'editor') {
  await page.getByLabel('Tenant', { exact: true }).fill('default')
  await page.getByLabel('Username', { exact: true }).fill(username)
  await page.getByLabel('Password', { exact: true }).fill('example-password-123')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Keluar / ganti akun' })).toBeVisible()
}
