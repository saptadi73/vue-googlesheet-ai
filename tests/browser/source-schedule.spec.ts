import { expect, test } from '@playwright/test'
import { login, setup, sourceId } from './fixtures'

test('editor updates source schedule timezone and concurrency policy', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/jobs')
  await login(page, 'editor')

  await page.getByRole('button', { name: 'Edit jadwal' }).first().click()
  await page.getByLabel('Cron lima field').fill('0 7 * * 1-5')
  await page.getByLabel('Timezone IANA').fill('Asia/Jakarta')
  await page.getByLabel('Saat job masih berjalan').selectOption('SKIP_IF_RUNNING')
  await page
    .getByLabel('Dependency upstream')
    .selectOption('99999999-9999-4999-8999-999999999999')
  await page.getByRole('button', { name: 'Simpan jadwal' }).click()

  await expect(page.getByText('Jadwal sumber diperbarui.')).toBeVisible()
  await expect(page.getByText(/Asia\/Jakarta.*SKIP_IF_RUNNING/)).toBeVisible()
  expect(
    state.requests.find(
      (request) =>
        request.method === 'PATCH' && request.path === `/sources/${sourceId}/schedule`,
    )?.body,
  ).toEqual({
    revision_no: 1,
    sync_schedule: '0 7 * * 1-5',
    schedule_timezone: 'Asia/Jakarta',
    concurrency_policy: 'SKIP_IF_RUNNING',
    dependency_source_ids: ['99999999-9999-4999-8999-999999999999'],
  })
  expect(state.errors).toEqual([])
  expect(state.unexpected).toEqual([])
})
