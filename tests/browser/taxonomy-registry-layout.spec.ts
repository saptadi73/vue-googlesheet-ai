import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('taxonomy creation inputs and button align and remain usable on narrow layouts', async ({
  page,
}) => {
  const mock = await setup(page)
  const taxonomies: {
    id: string
    code: string
    name: string
    status: string
    version: number
    is_active: boolean
  }[] = []
  let created: { code: string; name: string } | undefined
  await page.route('**/api/v1/taxonomies**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/taxonomies') && request.method() === 'POST') {
      created = request.postDataJSON()
      const taxonomy = {
        id: 'layout-taxonomy',
        code: created!.code,
        name: created!.name,
        status: 'DRAFT',
        version: 1,
        is_active: true,
      }
      taxonomies.push(taxonomy)
      return route.fulfill({ json: { status: 'success', data: taxonomy, meta: {}, errors: [] } })
    }
    return route.fulfill({
      json: {
        status: 'success',
        data: path.endsWith('/taxonomies') ? taxonomies : [],
        meta: {},
        errors: [],
      },
    })
  })
  await page.goto('/taxonomies')
  await login(page, 'editor')
  const form = page.locator('.taxonomy-create-form')
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 })
    const rowBox = (await form.locator('.form-action-container').boundingBox())!
    const boxes = await form.locator('input, button').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, bottom: box.bottom, right: box.right, width: box.width }
      }),
    )
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(rowBox.x - 1)
      expect(box.right).toBeLessThanOrEqual(rowBox.x + rowBox.width + 1)
    }
    if (width === 1440) {
      for (const box of boxes) expect(box.bottom).toBeCloseTo(boxes[0]!.bottom, 0)
      expect(boxes[0]!.width).toBeCloseTo(boxes[1]!.width, 0)
      expect(boxes[0]!.width).toBeGreaterThan(300)
    } else {
      for (const box of boxes) expect(box.width).toBeCloseTo(rowBox.width, 0)
      for (let i = 1; i < boxes.length; i++)
        expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.bottom)
    }
  }
  await form.getByLabel('Kode', { exact: true }).fill('layout_taxonomy')
  await form.getByLabel('Nama', { exact: true }).fill('Taxonomy layout')
  await form.getByRole('button', { name: 'Buat taxonomy', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Taxonomy draft dibuat.')
  expect(created).toEqual({ code: 'layout_taxonomy', name: 'Taxonomy layout' })
  await expect(form.getByLabel('Kode', { exact: true })).toHaveValue('')
  expect(mock.errors).toEqual([])
})
