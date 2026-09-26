import { expect, test } from '@playwright/test'
import { configId, login, setup } from './fixtures'

test('metric default period is saved in reviewed configuration and invalid days stay local', async ({
  page,
}) => {
  const state = await setup(page)
  state.record.configuration_json.columns.push({
    source_column: 'Tanggal',
    target_column: 'transaction_date',
    target_type: 'date',
    business_name: 'Tanggal',
    nullable: false,
    is_business_key: false,
    is_primary_key: false,
    transformation_codes: [],
    pii_classification: 'NONE',
    confidence: 1,
    reason: '',
  })
  state.record.configuration_json.semantic.dimensions.push('transaction_date')
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '6. Analitik & akses' }).click()

  await page
    .getByRole('combobox', { name: 'Dimensi periode default' })
    .first()
    .selectOption('transaction_date')
  await page.getByRole('spinbutton', { name: 'Jumlah hari default' }).fill('30')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Draft tersimpan' })).toBeVisible()
  expect(
    state.requests.filter((request) => request.method === 'PATCH').at(-1)?.body.configuration
      .semantic.metrics[0].default_period,
  ).toEqual({ dimension: 'transaction_date', days: 30 })

  await page.getByRole('spinbutton', { name: 'Jumlah hari default' }).fill('0')
  const patchCount = state.requests.filter((request) => request.method === 'PATCH').length
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByLabel('Kesalahan parameter konfigurasi')).toContainText('1..3660')
  expect(state.requests.filter((request) => request.method === 'PATCH')).toHaveLength(patchCount)
  expect(state.errors).toEqual([])
})
