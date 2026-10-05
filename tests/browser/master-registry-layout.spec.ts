import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('master search and creation action align on desktop and stack on small content areas', async ({
  page,
}) => {
  const mock = await setup(page)
  await page.route('**/api/v1/master-definitions?*', (route) =>
    route.fulfill({ json: { status: 'success', data: [], meta: {}, errors: [] } }),
  )
  await page.goto('/masters')
  await login(page, 'editor')
  const form = page.locator('.master-search-form')
  const input = form.getByLabel('Cari kode, nama, atau alias')
  const create = form.getByRole('link', { name: 'Buat definisi master', exact: true })
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 })
    const formBox = (await form.boundingBox())!
    const boxes = await form.locator('input, button, a').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, bottom: box.bottom, right: box.right, width: box.width }
      }),
    )
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(formBox.x - 1)
      expect(box.right).toBeLessThanOrEqual(formBox.x + formBox.width + 1)
    }
    if (width === 1440) {
      expect(boxes[0]!.width).toBeGreaterThan(500)
      for (const box of boxes) expect(box.bottom).toBeCloseTo(boxes[0]!.bottom, 0)
    } else {
      for (const box of boxes) expect(box.width).toBeCloseTo(formBox.width, 0)
      for (let i = 1; i < boxes.length; i++)
        expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.bottom)
    }
  }
  await input.fill('Cabang & Wilayah')
  const searchRequest = page.waitForRequest((request) => {
    const url = new URL(request.url())
    return (
      url.pathname.endsWith('/master-definitions') &&
      url.searchParams.get('search') === 'Cabang & Wilayah' &&
      url.searchParams.get('offset') === '0'
    )
  })
  await input.press('Enter')
  await searchRequest
  await create.click()
  await expect(page).toHaveURL(/\/masters\/new$/)
  expect(mock.errors).toEqual([])
})
