import { test, expect } from '@playwright/test'
import { setup, login, configId } from './fixtures'

test('metric null policy stays in reviewed ETL configuration and rejects nonnumeric results', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '6. Analitik & akses' }).click()
  const policy = page.getByRole('combobox', { name: 'Hasil agregat null', exact: true }).first()
  await expect(policy).toHaveValue('PRESERVE')
  await policy.selectOption('ZERO_RESULT')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Draft tersimpan' })).toBeVisible()
  expect(
    state.requests.filter((r) => r.method === 'PATCH').at(-1)?.body.configuration.semantic
      .metrics[0],
  ).toMatchObject({ aggregation: 'sum', column: 'net_amount', null_handling: 'ZERO_RESULT' })
  await expect(policy).toHaveValue('ZERO_RESULT')
  await page.getByRole('combobox', { name: 'Agregasi', exact: true }).first().selectOption('min')
  await page
    .getByRole('combobox', { name: 'Kolom', exact: true })
    .first()
    .selectOption('branch_name')
  const count = state.requests.filter((r) => r.method === 'PATCH').length
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByLabel('Kesalahan parameter konfigurasi')).toContainText(
    'hasil agregat numerik',
  )
  expect(state.requests.filter((r) => r.method === 'PATCH')).toHaveLength(count)
  await policy.selectOption('PRESERVE')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Draft tersimpan' })).toBeVisible()
  expect(
    state.requests.filter((r) => r.method === 'PATCH').at(-1)?.body.configuration.semantic
      .metrics[0].null_handling,
  ).toBe('PRESERVE')
  expect(state.errors).toEqual([])
})
