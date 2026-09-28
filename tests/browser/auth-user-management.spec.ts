import { expect, test } from '@playwright/test'
import { setup } from './fixtures'

test('admin uses dedicated login, registration, and role management pages', async ({ page }) => {
  test.setTimeout(60_000)
  const mock = await setup(page)
  const users: any[] = [
    {
      id: 'admin-id',
      username: 'admin',
      full_name: 'Administrator',
      role: 'PLATFORM_ADMIN',
      is_active: true,
      row_scope: {},
    },
  ]
  await page.route(/\/api\/v1\/users(?:\/.*)?(?:\?.*)?$/, async (route) => {
    const request = route.request()
    const method = request.method()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    const body = request.postData() ? request.postDataJSON() : undefined
    const ok = (data: unknown) =>
      route.fulfill({ json: { status: 'success', data, meta: {}, errors: [] } })
    if (path === '/users' && method === 'GET') return ok(users)
    if (path === '/users' && method === 'POST') {
      const created = { id: 'analyst-id', ...body, is_active: true }
      users.push(created)
      return ok(created)
    }
    if (path === '/users/analyst-id' && method === 'PATCH') {
      Object.assign(users[1], body)
      return ok(users[1])
    }
    return route.fallback()
  })

  await page.goto('/login?redirect=/register')
  await page.getByLabel('Username', { exact: true }).fill('admin')
  await page.getByLabel('Password', { exact: true }).fill('example-password-123')
  await page.getByRole('button', { name: 'Masuk', exact: true }).click()
  await expect(page).toHaveURL(/\/register$/)

  await page.getByLabel('Username atau email').fill('analyst.finance@kanjabung.com')
  await page.getByLabel('Nama lengkap').fill('Analis Finance')
  await page.getByLabel('Password awal').fill('InitialPassword2026!')
  await page.getByLabel('Role awal').selectOption('ANALYST')
  await page.getByRole('button', { name: 'Daftarkan pengguna' }).click()
  await expect(page.getByRole('status')).toContainText('berhasil didaftarkan')

  await page.getByRole('link', { name: 'Kelola pengguna' }).click()
  await expect(page).toHaveURL(/\/admin\/users$/)
  await page
    .locator('.toolbar')
    .filter({ hasText: 'analyst.finance@kanjabung.com' })
    .getByRole('button', { name: 'Atur role' })
    .click()
  const accessForm = page
    .locator('section.panel')
    .filter({ hasText: 'Akses analyst.finance@kanjabung.com' })
  await accessForm.getByRole('combobox', { name: 'Role' }).selectOption('DATA_STEWARD')
  await accessForm.getByRole('button', { name: 'Simpan pengaturan role' }).click()
  await expect(page.getByRole('status')).toContainText('seluruh token lamanya telah dicabut')

  expect(
    mock.requests.find((request) => request.path === '/auth/login' && request.method === 'POST')
      ?.body,
  ).toEqual({ tenant_code: 'default', username: 'admin', password: 'example-password-123' })
  expect(users[1]).toMatchObject({
    username: 'analyst.finance@kanjabung.com',
    role: 'DATA_STEWARD',
    is_active: true,
  })
  expect(mock.errors).toEqual([])
})
