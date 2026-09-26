import { expect, test } from '@playwright/test'
import { configId, login, setup } from './fixtures'

test('reviewed metric filter saves structured allowlisted values and blocks invalid ranges', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '6. Analitik & akses' }).click()
  await page.getByRole('button', { name: 'Tambah filter metrik' }).first().click()
  await page.getByRole('combobox', { name: 'Kolom filter' }).selectOption('branch_name')
  await page.getByRole('combobox', { name: 'Operator filter' }).selectOption('in')
  await page.getByRole('textbox', { name: 'Nilai filter' }).fill('["Jakarta","Bandung"]')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Draft tersimpan' })).toBeVisible()
  expect(
    state.requests.filter((request) => request.method === 'PATCH').at(-1)?.body.configuration
      .semantic.metrics[0].filters,
  ).toEqual([{ field: 'branch_name', operator: 'in', value: ['Jakarta', 'Bandung'] }])

  await page.getByRole('combobox', { name: 'Operator filter' }).selectOption('between')
  await page.getByRole('textbox', { name: 'Nilai filter' }).fill('["Jakarta"]')
  const patchCount = state.requests.filter((request) => request.method === 'PATCH').length
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByLabel('Kesalahan parameter konfigurasi')).toContainText(
    'between tepat dua nilai',
  )
  expect(state.requests.filter((request) => request.method === 'PATCH')).toHaveLength(patchCount)
  expect(state.errors).toEqual([])
})
