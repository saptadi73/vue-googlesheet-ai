import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('private routes redirect anonymous users to login and preserve a safe destination', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/access-requests?status=PENDING')

  await expect(page).toHaveURL('/login?redirect=/access-requests?status=PENDING')
  await expect(page.getByRole('heading', { name: 'Masuk ke Google Sheet AI' })).toBeVisible()

  await login(page, 'viewer')
  await expect(page).toHaveURL(/\/access-requests\?status=PENDING$/)
})

test('role landing and route guard keep users on an authorized page', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  await login(page, 'viewer')
  await expect(page).toHaveURL(/\/dashboard$/)

  await page.evaluate(() => {
    window.history.pushState({}, '', '/admin')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('admin root landing and session clear return to login', async ({ page }) => {
  await setup(page)
  await page.goto('/')
  await login(page, 'admin')
  await expect(page).toHaveURL(/\/admin$/)

  await page.getByRole('button', { name: 'Keluar / ganti akun' }).click()
  await expect(page).toHaveURL('/login?redirect=/admin')
})

test('refreshing the page restores the active session', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/')
  await login(page, 'editor')
  await expect(page).toHaveURL(/\/workspace$/)

  await page.reload()

  await expect(page).toHaveURL(/\/workspace$/)
  await expect(page.getByRole('button', { name: 'Keluar / ganti akun' })).toBeVisible()
  expect(mock.requests.filter((request) => request.path === '/auth/refresh')).toHaveLength(1)
  expect(mock.requests.filter((request) => request.path === '/auth/me')).toHaveLength(2)
})

test('login rejects an external redirect target', async ({ page }) => {
  await setup(page)
  await page.goto('/login?redirect=//example.com/steal-session')
  await login(page, 'admin')

  await expect(page).toHaveURL(/\/admin$/)
})
