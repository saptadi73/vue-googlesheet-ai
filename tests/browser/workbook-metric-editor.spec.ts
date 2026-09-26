import { test, expect } from '@playwright/test'
import { setup, login, configId } from './fixtures'

test('Excel metric policy stays in the exact signed draft candidate without approval', async ({
  page,
}) => {
  const state = await setup(page)
  const candidate = structuredClone(state.record.configuration_json)
  Object.assign(candidate.semantic.metrics[0]!, { null_handling: 'ZERO_RESULT' })
  await page.route(`**/api/v1/configurations/${configId}/workbook-preview`, (route) =>
    route.fulfill({
      json: {
        status: 'success',
        data: {
          revision_no: 1,
          configuration: candidate,
          question_answers: {},
          preview_token: 'metric-preview-token',
          can_apply: true,
          errors: [],
          validation: { valid: true },
          diff: { null_handling: { before: 'PRESERVE', after: 'ZERO_RESULT' } },
        },
        meta: {},
        errors: [],
      },
    }),
  )
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByText('Review melalui Excel (opsional)', { exact: true }).click()
  await expect(page.getByText('Metadata metrik ada di tab 11:', { exact: false })).toBeVisible()
  await page.locator('input[type=file]').setInputFiles({
    name: 'metrics.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('mock workbook'),
  })
  await expect(page.locator('pre').filter({ hasText: 'ZERO_RESULT' })).toBeVisible()
  await page.getByRole('button', { name: 'Terima perubahan Excel ke draft' }).click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Perubahan Excel disimpan' }),
  ).toBeVisible()
  expect(state.requests.find((r) => r.path.endsWith('/workbook-apply'))?.body).toEqual({
    revision_no: 1,
    configuration: candidate,
    question_answers: {},
    preview_token: 'metric-preview-token',
  })
  expect(
    state.requests.some((r) => r.path.endsWith('/approve') || r.path.endsWith('/deploy')),
  ).toBe(false)
  expect(state.errors).toEqual([])
})
