import { expect, type Page } from '@playwright/test'

export const configId = '77777777-7777-4777-8777-777777777777'
export const sheetId = '22222222-2222-4222-8222-222222222222'
export const sourceId = '11111111-1111-4111-8111-111111111111'
export const jobId = '33333333-3333-4333-8333-333333333333'
export const notificationId = '44444444-4444-4444-8444-444444444444'
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
  let notificationAcknowledged = false
  let reviewScopeValid = true
  let registrationScopesEmpty = false
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
    access_status: 'ACCESS_POLICY_REQUIRED',
    access_revision: 1,
    access_metadata: null as Record<string, string> | null,
    access_metadata_editor_id: null as string | null,
    access_review_status: 'PENDING',
    access_reviewed_by: null as string | null,
    access_review_reason: '',
    approval_revision: 1,
    approval_assignees: null as { metadata_review: string[]; configuration: string[]; import_review: string[] } | null,
    release_policy_revision: 1,
    release_policy: null as { technical_approver_ids: string[]; unit_groups: { unit_id: string; label: string; approver_ids: string[] }[] } | null,
    paused: false,
    sync_schedule: null,
    schedule_timezone: 'UTC',
    concurrency_policy: 'QUEUE_LATEST',
    schedule_revision: 1,
    dependency_source_ids: [] as string[],
  }
  const upstreamSource = {
    ...source,
    id: '99999999-9999-4999-8999-999999999999',
    source_code: 'master_product',
    name: 'Master produk',
    schedule_revision: 1,
    dependency_source_ids: [] as string[],
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
    watermark_source_column: null as string | null,
    watermark_kind: null as 'INTEGER' | 'DECIMAL' | 'DATE' | 'DATETIME' | null,
    watermark_value: null as string | null,
    watermark_updated_at: null as string | null,
    watermark_revision: 1,
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
  const releaseDecisions: Record<string, { decision: string; actor_id: string; comment: string }> = {}
  function releaseStatus() {
    const groups = source.release_policy
      ? [
          { key: 'TECHNICAL', label: 'Pemeriksaan IT', unit_id: null, approver_ids: source.release_policy.technical_approver_ids },
          ...source.release_policy.unit_groups.map((group) => ({ key: `UNIT:${group.unit_id}`, label: group.label, unit_id: group.unit_id, approver_ids: group.approver_ids })),
        ].map((group) => ({ ...group, status: releaseDecisions[group.key]?.decision || 'PENDING',
          decided_by: releaseDecisions[group.key]?.actor_id || null, decided_at: null,
          comment: releaseDecisions[group.key]?.comment || null,
          can_decide: record.status === 'APPROVED' && group.approver_ids.includes(`${username}-id`) && record.created_by !== `${username}-id`,
        }))
      : []
    return { configuration_id: configId, configuration_revision: record.revision_no,
      status: record.status, configured: Boolean(source.release_policy),
      ready: !source.release_policy || groups.every((group) => group.status === 'APPROVED'),
      policy_revision: source.release_policy_revision, groups,
      summary: { name: 'Penjualan cabang', description: 'Data penjualan', product_code: 'SALES', columns: [], metrics: [] },
    }
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
    if (path === '/auth/refresh')
      return ok({
        access_token: `token-${++tokenNumber}`,
        refresh_token: `refresh-${tokenNumber}`,
      })
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
    if (path === '/data-products')
      return ok(
        source.access_metadata && source.access_status !== 'POLICY_APPROVED' ? [] : [product],
      )
    if (path === '/configurations/parameter-catalog')
      return ok({ schema_version: '1.0', parameters: [], operations: [], capabilities: {} })
    if (path === `/configurations/${configId}/validate`)
      return ok({ ...validation, ready_for_review: true })
    if (path === '/semantic/query-templates') return ok([])
    if (path === '/semantic/join-relationships') return ok([])
    if (path === '/data-products/SALES/query') {
      if (source.access_metadata && source.access_status !== 'POLICY_APPROVED')
        return fail(404, 'DATA_PRODUCT_NOT_FOUND', 'Produk data belum tersedia')
      return ok(
        [
          {
            branch_name: 'Jakarta',
            ...(body.dimensions?.includes('transaction_month')
              ? { transaction_month: '2026-08' }
              : {}),
            net_sales: 150,
            ...(body.metrics?.includes('transaction_count') ? { transaction_count: 2 } : {}),
          },
          {
            branch_name: 'Bandung',
            ...(body.dimensions?.includes('transaction_month')
              ? { transaction_month: '2026-09' }
              : {}),
            net_sales: null,
            ...(body.metrics?.includes('transaction_count') ? { transaction_count: 1 } : {}),
          },
        ],
        { row_count: 2, query_source: 'OPERATIONAL', cached: false },
      )
    }
    if (path === '/data-products/SALES/export') {
      if (source.access_metadata && source.access_status !== 'POLICY_APPROVED')
        return fail(404, 'DATA_PRODUCT_NOT_FOUND', 'Produk data belum tersedia')
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
    if (path === `/sources/${sourceId}/schedule` && method === 'PATCH') {
      if (body.revision_no !== source.schedule_revision)
        return fail(409, 'SOURCE_SCHEDULE_CONFLICT', 'Jadwal berubah')
      Object.assign(source, body, { schedule_revision: source.schedule_revision + 1 })
      return ok(source)
    }
    if (path === '/etl-jobs') return ok([source, upstreamSource])
    if (path === '/sources') return ok([source])
    if (path === '/sources/approver-options')
      return ok([{ id: 'admin-id', username: 'admin', role: 'PLATFORM_ADMIN' }])
    if (path === `/sources/${sourceId}/approvers` && method === 'GET')
      return ok({
        source_id: sourceId,
        revision: source.approval_revision || 1,
        configured: Boolean(source.approval_assignees),
        approvers: source.approval_assignees || { metadata_review: [], configuration: [], import_review: [] },
      })
    if (path === `/sources/${sourceId}/approvers` && method === 'PUT') {
      source.approval_assignees = {
        metadata_review: body.metadata_review,
        configuration: body.configuration,
        import_review: body.import_review,
      }
      source.approval_revision = (source.approval_revision || 1) + 1
      return ok({ source_id: sourceId, revision: source.approval_revision,
        configured: true, approvers: source.approval_assignees })
    }
    if (path === '/release-approvals/candidates') return ok([
      { id: 'admin-id', username: 'admin', role: 'PLATFORM_ADMIN', unit_ids: [] },
      { id: 'approver-id', username: 'approver', role: 'TECHNICAL_APPROVER', unit_ids: [] },
      { id: 'viewer-id', username: 'viewer', role: 'VIEWER', unit_ids: [sourceId] },
    ])
    if (path === `/release-approvals/sources/${sourceId}/policy` && method === 'GET')
      return ok({ source_id: sourceId, revision: source.release_policy_revision,
        configured: Boolean(source.release_policy),
        policy: source.release_policy || { technical_approver_ids: [], unit_groups: [] } })
    if (path === `/release-approvals/sources/${sourceId}/policy` && method === 'PUT') {
      source.release_policy_revision++
      source.release_policy = { technical_approver_ids: body.technical_approver_ids,
        unit_groups: body.unit_groups.map((group: { unit_id: string; approver_ids: string[] }) => ({ ...group, label: 'Penjualan' })) }
      return ok({ source_id: sourceId, revision: source.release_policy_revision,
        configured: true, policy: source.release_policy })
    }
    if (path === `/release-approvals/configurations/${configId}` && method === 'GET')
      return ok(releaseStatus())
    if (path === `/release-approvals/configurations/${configId}/decisions` && method === 'POST') {
      const key = body.group_type === 'TECHNICAL' ? 'TECHNICAL' : `UNIT:${body.unit_id}`
      releaseDecisions[key] = { decision: body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        actor_id: `${username}-id`, comment: body.comment }
      return ok(releaseStatus())
    }
    if (path === '/release-approvals/inbox' && method === 'GET')
      return ok(source.release_policy && record.status === 'APPROVED' ? [
        { ...releaseStatus(), source_id: sourceId, source_name: source.name, version_no: 1 },
      ] : [])
    if (path === `/sources/${sourceId}/access-metadata` && method === 'PATCH') {
      if (body.revision_no !== source.access_revision)
        return fail(409, 'SOURCE_ACCESS_REVISION_CONFLICT', 'Metadata berubah')
      source.access_metadata = body.access_metadata
      source.access_metadata_editor_id = `${username}-id`
      source.access_revision++
      source.access_status = 'ACCESS_POLICY_REQUIRED'
      source.access_review_status = 'PENDING'
      source.access_reviewed_by = null
      source.access_review_reason = ''
      return ok(source)
    }
    if (path === `/sources/${sourceId}/access-review-context` && method === 'GET')
      return ok({
        source_id: sourceId,
        can_decide: true,
        access_revision: source.access_revision,
        review_status: source.access_review_status,
        attributes: {
          owner_unit_id: source.access_metadata
            ? { code: 'SALES', label: 'Sales', is_active: reviewScopeValid }
            : null,
          business_domain_id: source.access_metadata
            ? { code: 'COMMERCE', label: 'Commerce', is_active: true }
            : null,
          jurisdiction_id: source.access_metadata
            ? { code: 'JATIM', label: 'Jawa Timur', is_active: true }
            : null,
          purpose_id: source.access_metadata
            ? { code: 'REPORTING', label: 'Reporting', is_active: true }
            : null,
        },
        people: {
          data_owner_user_id: source.access_metadata
            ? { username: 'editor', is_active: true }
            : null,
          data_steward_user_id: source.access_metadata
            ? { username: 'steward', is_active: true }
            : null,
        },
        sensitivity: source.access_metadata?.sensitivity || null,
      })
    if (path === `/sources/${sourceId}/access-review` && method === 'POST') {
      if (body.revision_no !== source.access_revision)
        return fail(409, 'SOURCE_ACCESS_REVISION_CONFLICT', 'Metadata berubah')
      if (source.access_metadata_editor_id === `${username}-id`)
        return fail(403, 'SOURCE_METADATA_SELF_REVIEW', 'Editor tidak dapat mereview')
      source.access_review_status = body.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
      source.access_reviewed_by = `${username}-id`
      source.access_review_reason = body.reason
      source.access_revision++
      return ok(source)
    }
    if (path === `/sources/${sourceId}/access-policy-options` && method === 'GET')
      return ok(
        source.access_review_status === 'APPROVED'
          ? [
              {
                id: '66666666-6666-4666-8666-666666666666',
                code: 'SALES_SOURCE',
                label: 'Sales source policy',
                actions: ['DISCOVER', 'QUERY'],
              },
            ]
          : [],
      )
    if (path === `/sources/${sourceId}/access-activate` && method === 'POST') {
      if (body.revision_no !== source.access_revision)
        return fail(409, 'SOURCE_ACCESS_REVISION_CONFLICT', 'Metadata berubah')
      if (
        source.access_review_status !== 'APPROVED' ||
        body.policy_id !== '66666666-6666-4666-8666-666666666666'
      )
        return fail(409, 'SOURCE_ACCESS_POLICY_REQUIRED', 'Policy tidak siap')
      source.access_status = 'POLICY_APPROVED'
      source.access_revision++
      return ok(source)
    }
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
              {
                source_column: 'Total',
                normalized_name: 'net_amount',
                inferred_type: 'bigint',
                pii_suspected: false,
                null_ratio: 0,
                distinct_ratio: 1,
              },
            ],
          },
        },
      ])
    if (path === `/source-sheets/${sheetId}/configurations`) return ok([record])
    if (path === `/source-sheets/${sheetId}/watermark` && method === 'PATCH') {
      if (body.revision_no !== sheet.watermark_revision)
        return fail(409, 'WATERMARK_REVISION_CONFLICT', 'Watermark berubah')
      Object.assign(sheet, {
        watermark_source_column: body.source_column,
        watermark_kind: body.kind,
        watermark_value: null,
        watermark_updated_at: null,
        watermark_revision: sheet.watermark_revision + 1,
      })
      return ok(sheet)
    }
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
    if (path === '/operations/summary')
      return ok({
        jobs: { FAILED: failedJob ? 1 : 0 },
        import_reviews: { NEEDS_INPUT: 1 },
        unacknowledged_notifications: notificationAcknowledged ? 0 : 1,
        generated_at: '2026-09-27T00:00:00Z',
      })
    if (path === '/notifications' && method === 'GET')
      return ok(
        notificationAcknowledged
          ? []
          : [
              {
                id: notificationId,
                kind: 'IMPORT_NEEDS_INPUT',
                severity: 'WARN',
                resource_type: 'IMPORT_REVIEW',
                resource_id: '55555555-5555-4555-8555-555555555555',
                title: 'Batch import memerlukan input',
                message: 'Periksa pertanyaan dan blocker sebelum batch dapat dilanjutkan.',
                details: { status: 'NEEDS_INPUT' },
                recipient_user_id: null,
                acknowledged_by: null,
                acknowledged_at: null,
                created_at: '2026-09-27T00:00:00Z',
              },
            ],
      )
    if (path === `/notifications/${notificationId}/acknowledge` && method === 'POST') {
      notificationAcknowledged = true
      return ok({ id: notificationId, acknowledged_at: '2026-09-27T00:01:00Z' })
    }
    if (path.startsWith('/jobs/') && path.endsWith('/events') && method === 'GET') {
      const streamedJobId = path.split('/')[2]
      const streamed = {
        id: streamedJobId,
        status: failedJob ? 'FAILED' : 'SUCCEEDED',
        kind: 'ETL',
        source_id: sourceId,
        error_code: failedJob ? 'SOURCE_ACCESS_DENIED' : null,
        error_message: failedJob ? 'Sheet belum dibagikan' : null,
        result: failedJob ? null : { runs: [{ status: 'SKIPPED_DUPLICATE' }] },
      }
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `event: job\ndata: ${JSON.stringify(streamed)}\n\nevent: complete\ndata: ${JSON.stringify(streamed)}\n\n`,
      })
    }
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
    if (path === '/access/registration-options' && method === 'GET')
      return ok({
        scopes: registrationScopesEmpty ? [] : [
          { id: sourceId, kind: 'DEPARTMENT', code: 'SALES', label: 'Sales' },
          { id: sheetId, kind: 'BUSINESS_DOMAIN', code: 'COMMERCE', label: 'Commerce' },
          { id: jobId, kind: 'JURISDICTION', code: 'JATIM', label: 'Jawa Timur' },
        ],
        purposes: [{ id: notificationId, kind: 'PURPOSE', code: 'REPORTING', label: 'Reporting' }],
        people: [
          { id: `${username}-id`, username, role: roles[username] },
          { id: 'steward-id', username: 'steward', role: 'DATA_STEWARD' },
        ],
        sensitivities: ['LOW', 'MEDIUM', 'HIGH'],
      })
    if (path === '/sources/google-sheets' && method === 'POST') return ok({ source, job_id: jobId })
    if (path === '/access/resources' && method === 'GET') return ok([])
    if (path === '/access/attributes' && method === 'GET') return ok([])
    if (path === '/access/permission-bundles' && method === 'GET') return ok([])
    if (path.endsWith('/permission-grants') && method === 'GET') return ok([])
    if (path === '/access/policies' && method === 'GET') return ok([])
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
    product,
    classification,
    setConflict: () => {
      conflict = true
    },
    setBinaryError: () => {
      binaryError = true
    },
    setReviewScopeInvalid: () => {
      reviewScopeValid = false
    },
    setRegistrationScopesEmpty: (value: boolean) => {
      registrationScopesEmpty = value
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
