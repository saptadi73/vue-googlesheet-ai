import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'
import { blankDefinition } from '../../src/lib/masters'

for (const phase of ['initial', 'deployed', 'previously-deployed'] as const) {
  test(`master review explains schema corrections in ${phase} state`, async ({ page }) => {
    const mock = await setup(page)
    const definition = blankDefinition()
    definition.name = 'Master Bisnis'
    definition.fields = [
      { name: 'bisnis_code', type: 'text', nullable: false, pii_classification: 'LOW' },
      { name: 'bisnis', type: 'text', nullable: false, pii_classification: 'LOW' },
      { name: 'is_active', type: 'boolean', nullable: false, pii_classification: 'LOW' },
    ]
    definition.business_key = ['bisnis_code']
    definition.label_field = 'bisnis'
    const master = {
      id: 'initial-master',
      code: 'master_business',
      name: definition.name,
      aliases: [],
      definition_json: definition,
      approved_definition_json: definition,
      revision_no: 6,
      approved_version: 1,
      status: 'NEEDS_REVIEW',
      is_active: true,
      created_by: 'editor-id',
      submitted_by: 'editor-id',
      approved_by: 'approver-id',
      approved_at: null,
    }
    await page.route('**/api/v1/master-definitions/initial-master', (route) =>
      route.fulfill({
        json: { status: 'success', data: master, errors: [], meta: {} },
      }),
    )
    await page.route('**/api/v1/master-definitions/initial-master/storage-plan', (route) =>
      route.fulfill({
        json: {
          status: 'success',
          data: {
            storage_exists: phase === 'deployed',
            storage_deployed_before: phase !== 'initial',
            initial_definition_correction_allowed: phase === 'initial',
          },
          errors: [],
          meta: {},
        },
      }),
    )
    await page.goto('/login')
    await login(page, 'approver')
    await page.goto('/masters/initial-master')
    if (phase === 'initial') {
      await expect(
        page.getByText('Storage belum dibuat dan belum pernah dideploy.', { exact: false }),
      ).toBeVisible()
      await expect(page.getByText(/deployment pertama dapat diajukan/)).toBeVisible()
    } else {
      await expect(page.getByText(/Storage sudah ada atau pernah dideploy/)).toBeVisible()
      await expect(page.getByText(/Jangan hapus atau buat ulang tabel/)).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Setujui master' })).toBeEnabled()
    expect(mock.errors).toEqual([])
  })
}
