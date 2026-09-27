import { expect, test } from '@playwright/test'
import { login, setup, sheetId, sourceId } from './fixtures'

test('editor configures an incremental watermark from profiled columns', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/workspace')
  await login(page, 'editor')
  await page.getByRole('combobox', { name: 'Sumber', exact: true }).selectOption(sourceId)
  await page
    .getByRole('combobox', { name: 'Tab Google Sheet', exact: true })
    .selectOption(sheetId)
  await page.getByText('Incremental watermark', { exact: true }).click()
  await page.getByLabel('Kolom watermark').selectOption('Total')
  await page.getByLabel('Jenis watermark').selectOption('INTEGER')
  await page.getByRole('button', { name: 'Simpan watermark' }).click()

  await expect(page.getByText('Incremental watermark diperbarui')).toBeVisible()
  expect(
    state.requests.find(
      (request) =>
        request.method === 'PATCH' &&
        request.path === `/source-sheets/${sheetId}/watermark`,
    )?.body,
  ).toEqual({ revision_no: 1, source_column: 'Total', kind: 'INTEGER' })
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
