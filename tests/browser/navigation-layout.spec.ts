import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('admin navigation remains one row at desktop, tablet and mobile widths', async ({ page }) => {
  const mock = await setup(page)
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      json: {
        status: 'success',
        data: {
          id: 'admin-id',
          username: 'administrator.with.a.very.long.name@kanjabung.com',
          role: 'PLATFORM_ADMIN',
        },
        meta: {},
        errors: [],
      },
    }),
  )
  await page.goto('/login?redirect=/dashboard')
  await login(page, 'admin')

  for (const width of [1819, 1536, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    const navbar = page.locator('.app-navbar')
    await expect(navbar).toHaveCSS('height', '72px')
    const geometry = await navbar.evaluate((element) => {
      const children = [...element.children].filter(
        (child) => getComputedStyle(child).display !== 'none',
      )
      const bounds = element.getBoundingClientRect()
      return {
        overflow: element.scrollWidth > element.clientWidth,
        children: children.map((child) => ({
          tag: child.tagName,
          className: child.className,
          top: child.getBoundingClientRect().top,
          bottom: child.getBoundingClientRect().bottom,
          right: child.getBoundingClientRect().right,
        })),
        withinRow: children.every((child) => {
          const box = child.getBoundingClientRect()
          return box.top >= bounds.top && box.bottom <= bounds.bottom && box.right <= bounds.right
        }),
      }
    })
    expect(geometry, `navbar at ${width}px`).toMatchObject({ overflow: false, withinRow: true })
    const sidebar = page.getByRole('navigation', { name: 'Operasional', exact: true })
    if (width >= 1024) {
      await expect(sidebar).toBeVisible()
      await expect(sidebar.getByRole('link', { name: 'Workspace ETL' })).toBeVisible()
      const sidebarBox = await page.locator('.app-sidebar').boundingBox()
      const contentBox = await page.locator('main').boundingBox()
      expect(contentBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x + sidebarBox!.width)
    } else {
      await expect(sidebar).toBeHidden()
      await expect(page.getByRole('button', { name: 'Buka menu operasional' })).toBeVisible()
    }
  }
  expect(mock.errors).toEqual([])
})

test('mobile drawer traps focus, closes with Escape, backdrop and navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const mock = await setup(page)
  await page.goto('/login?redirect=/dashboard')
  await login(page, 'admin')
  const toggle = page.getByRole('button', { name: 'Buka menu operasional' })
  const drawer = page.getByRole('dialog', { name: 'Menu operasional' })
  await toggle.click()
  await expect(drawer).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Tutup menu operasional' }).focus()
  await page.keyboard.press('Shift+Tab')
  expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(toggle).toBeFocused()
  await expect(page.locator('body')).not.toHaveClass(/app-drawer-open/)

  await toggle.click()
  await page.mouse.click(370, 400)
  await expect(drawer).toBeHidden()

  await toggle.click()
  await drawer.getByRole('link', { name: 'Chat data', exact: true }).click()
  await expect(page).toHaveURL(/\/chat$/)
  await expect(drawer).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await page.getByLabel('Menu administrasi', { exact: true }).click()
  const menuBox = await page.locator('.app-menu-dropdown[open] .app-menu-panel').boundingBox()
  expect(menuBox!.x).toBeGreaterThanOrEqual(0)
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(390)
  await page
    .getByRole('navigation', { name: 'Administrasi dan akun' })
    .getByRole('link', { name: 'Registrasi', exact: true })
    .click()
  await expect(page).toHaveURL(/\/register$/)
  await expect(page.locator('.app-menu-dropdown[open]')).toHaveCount(0)
  await page.getByLabel('Menu administrasi', { exact: true }).click()
  const adminMenu = page.getByRole('navigation', { name: 'Administrasi dan akun' })
  await expect(adminMenu.locator('a[aria-current="page"]:visible')).toHaveCount(1)
  await expect(adminMenu.getByRole('link', { name: 'Registrasi', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Menu administrasi', { exact: true })).toBeFocused()
  await expect(page.locator('.app-menu-dropdown[open]')).toHaveCount(0)
  expect(mock.errors).toEqual([])
})

test('viewer only sees authorized operational and account menus', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/login')
  await login(page, 'viewer')
  const operations = page.getByRole('navigation', { name: 'Operasional', exact: true })
  await expect(operations.getByRole('link')).toHaveCount(3)
  await expect(operations.getByRole('link', { name: 'Panduan penggunaan', exact: true })).toBeVisible()
  await expect(operations.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(operations.getByRole('link', { name: 'Chat data', exact: true })).toBeVisible()
  const navbar = page.getByRole('navigation', { name: 'Administrasi dan akun' })
  await expect(navbar.getByRole('link', { name: 'Administrasi', exact: true })).toHaveCount(0)
  await expect(navbar.getByRole('link', { name: 'Pengguna', exact: true })).toHaveCount(0)
  await expect(navbar.getByRole('link', { name: 'Registrasi', exact: true })).toHaveCount(0)
  await expect(navbar.getByRole('link', { name: 'Akun', exact: true })).toBeVisible()
  await expect(navbar.getByRole('link', { name: 'Permintaan akses', exact: true })).toBeVisible()
  expect(mock.errors).toEqual([])
})

test('contextual help follows the active page and supports keyboard closing', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/login')
  const helpButton = page.getByRole('button', { name: 'Buka bantuan halaman' })
  await helpButton.click()
  let dialog = page.getByRole('dialog', { name: 'Masuk ke aplikasi' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('Fungsi halaman')).toBeVisible()
  await expect(dialog.getByText('Cara menggunakan')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(helpButton).toBeFocused()
  await helpButton.click()
  dialog = page.getByRole('dialog', { name: 'Masuk ke aplikasi' })
  await dialog.getByRole('link', { name: 'Panduan lengkap' }).click()
  await expect(page).toHaveURL(/\/guide$/)
  await expect(page.getByRole('heading', { name: 'Dari Google Sheet sampai dashboard' })).toBeVisible()
  await page.goto('/login')

  await login(page, 'viewer')
  await expect(page).toHaveURL(/\/dashboard$/)
  await helpButton.click()
  dialog = page.getByRole('dialog', { name: 'Dashboard dan pencarian data' })
  await expect(dialog).toContainText('Tanyakan data dengan bahasa alami')
  await dialog.getByRole('button', { name: 'Saya mengerti' }).click()
  await expect(dialog).toBeHidden()
  expect(mock.errors).toEqual([])
})
test('general guide presents the full Google Sheet to dashboard workflow', async ({ page }) => {
  const mock = await setup(page)
  await page.goto('/login')
  await login(page, 'viewer')
  await page
    .getByRole('navigation', { name: 'Operasional', exact: true })
    .getByRole('link', { name: 'Panduan penggunaan', exact: true })
    .click()
  await expect(page).toHaveURL(/\/guide$/)
  await expect(page.getByRole('heading', { name: 'Dari Google Sheet sampai dashboard' })).toBeVisible()
  await expect(page.getByText('Siapkan organisasi, akun, dan akses')).toBeVisible()
  await expect(page.getByText('Daftarkan Google Sheet')).toBeVisible()
  await expect(page.getByText('Siapkan master data bila diperlukan')).toBeVisible()
  await expect(page.getByText('Siapkan taxonomy untuk kategori baku')).toBeVisible()
  await expect(page.getByText('Tampilkan data di dashboard dan chart')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Jika data belum muncul di dashboard' })).toBeVisible()
  await page.getByRole('button', { name: 'Buka bantuan halaman' }).click()
  await expect(page.getByRole('dialog', { name: 'Panduan umum awal sampai akhir' })).toBeVisible()
  expect(mock.errors).toEqual([])
})
