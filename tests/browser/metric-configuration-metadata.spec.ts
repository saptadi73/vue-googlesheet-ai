import { expect, test } from '@playwright/test'
import { configId, login, setup } from './fixtures'

test('metric metadata is saved in the reviewed ETL configuration and conflicts stay local', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '6. Analitik & akses' }).click()

  await page.getByRole('textbox', { name: 'Definisi bisnis' }).fill(' Total setelah diskon ')
  await page.getByRole('textbox', { name: 'Unit', exact: true }).fill(' IDR ')
  await page
    .getByRole('textbox', { name: 'Sinonim, satu per baris' })
    .fill('Pendapatan   bersih\nNet revenue')
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Draft tersimpan' })).toBeVisible()

  const metric = state.requests.filter((request) => request.method === 'PATCH').at(-1)?.body
    .configuration.semantic.metrics[0]
  expect(metric).toMatchObject({
    description: 'Total setelah diskon',
    unit: 'IDR',
    synonyms: ['Pendapatan bersih', 'Net revenue'],
  })
  await expect(page.getByRole('textbox', { name: 'Definisi bisnis' })).toHaveValue(
    'Total setelah diskon',
  )

  await page.getByRole('button', { name: 'Tambah metrik' }).click()
  const codes = page.getByRole('textbox', { name: 'Kode metrik' })
  const labels = page.getByRole('textbox', { name: 'Label', exact: true })
  await codes.nth(1).fill('other_metric')
  await labels.nth(1).fill('Net revenue')
  const patchCount = state.requests.filter((request) => request.method === 'PATCH').length
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByLabel('Kesalahan parameter konfigurasi')).toContainText(
    'juga mengidentifikasi metrik',
  )
  expect(state.requests.filter((request) => request.method === 'PATCH')).toHaveLength(patchCount)
  expect(state.errors).toEqual([])
})
