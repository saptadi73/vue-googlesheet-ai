import { test, expect } from '@playwright/test'
import { setup, login, configId } from './fixtures'

test('DQ default values retain scalar types through save/reload and null clears defaults', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '4. Kualitas data' }).click()
  await page.getByRole('button', { name: 'Tambah aturan', exact: true }).click()
  const input = page.getByLabel('Default value (JSON scalar)', { exact: true })
  for (const [text, expected] of [
    ['"0"', '0'],
    ['"false"', 'false'],
    ['"null"', 'null'],
    ['0', 0],
    ['false', false],
    ['""', ''],
    ['null', null],
  ] as const) {
    await input.fill(text)
    await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Draft tersimpan' })).toBeVisible()
    const patch = state.requests.filter((request) => request.method === 'PATCH').at(-1)
    expect(patch?.body.configuration.data_quality_rules[0].default_value).toBe(expected)
    await expect(input).toHaveValue(expected === null ? '' : JSON.stringify(expected))
  }
  expect(state.errors).toEqual([])
})

test('invalid default blocks saving and dry-run until corrected or the rule is removed', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto(`/configurations/${configId}/review`)
  await login(page)
  await page.getByRole('button', { name: '4. Kualitas data' }).click()
  await page.getByRole('button', { name: 'Tambah aturan', exact: true }).click()
  const input = page.getByLabel('Default value (JSON scalar)', { exact: true })
  await page.getByRole('button', { name: 'Simpan draft', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Draft tersimpan' })).toBeVisible()
  const savedRequests = state.requests.filter((request) => request.method === 'PATCH').length
  for (const text of ['[]', '{}', 'broken', '1e999']) {
    await input.fill(text)
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByRole('button', { name: 'Simpan draft', exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Dry-run ulang', exact: true })).toBeDisabled()
    expect(state.requests.filter((request) => request.method === 'PATCH')).toHaveLength(
      savedRequests,
    )
  }
  await input.fill('"fixed"')
  await expect(input).toHaveAttribute('aria-invalid', 'false')
  await expect(page.getByRole('button', { name: 'Simpan draft', exact: true })).toBeEnabled()
  await input.fill('[]')
  await page.getByRole('button', { name: 'Hapus aturan', exact: true }).click()
  await expect(page.locator('[aria-invalid="true"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Simpan draft', exact: true })).toBeEnabled()
  expect(state.errors).toEqual([])
})
