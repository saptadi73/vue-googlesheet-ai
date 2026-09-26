import { expect, test } from '@playwright/test'
import { configId, login, setup } from './fixtures'

test('BE12 edits ordered static transform parameters and saves the reviewed payload', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '3. Cleansing', exact: true }).click()

  await page.getByLabel('Transformasi Cabang urutan 1').selectOption('prefix')
  await page.getByLabel('Nilai prefix Cabang').fill('ID-')
  await page.getByRole('button', { name: 'Tambah langkah' }).first().click()
  await page.getByLabel('Transformasi Cabang urutan 2').selectOption('replace')
  await page.getByLabel('Nilai replace Cabang').fill('lama')
  await page.getByLabel('Replacement Cabang').fill('baru')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Draft tersimpan')

  const column = state.requests.filter((request) => request.method === 'PATCH').at(-1)?.body
    .configuration.columns[0]
  expect(column.transformation_codes).toEqual(['prefix', 'replace'])
  expect(column.transform_parameters).toEqual([
    { operation: 'prefix', value: 'ID-', replacement: null },
    { operation: 'replace', value: 'lama', replacement: 'baru' },
  ])

  await page.getByRole('button', { name: 'Hapus' }).nth(1).click()
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  const updated = state.requests.filter((request) => request.method === 'PATCH').at(-1)?.body
    .configuration.columns[0]
  expect(updated.transformation_codes).toEqual(['prefix'])
  expect(updated.transform_parameters).toEqual([
    { operation: 'prefix', value: 'ID-', replacement: null },
  ])
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
