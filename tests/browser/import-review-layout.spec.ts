import { expect, test } from '@playwright/test'
import { configId, login, setup, sheetId, sourceId } from './fixtures'

test('batch creation fields fill the form and align with the action across dataset types', async ({
  page,
}) => {
  const mock = await setup(page)
  let kind: string | null = 'NON_MASTER'
  await page.route('**/api/v1/import-reviews?*', (route) =>
    route.fulfill({
      json: { status: 'success', data: { items: [], has_more: false }, meta: {}, errors: [] },
    }),
  )
  await page.route(`**/api/v1/sources/${sourceId}/sheets`, (route) =>
    route.fulfill({
      json: {
        status: 'success',
        data: [
          {
            id: sheetId,
            sheet_name: 'Tab dengan nama panjang untuk review batch',
            enabled: true,
            dataset_kind: kind,
          },
        ],
        meta: {},
        errors: [],
      },
    }),
  )
  await page.route(`**/api/v1/source-sheets/${sheetId}/configurations`, (route) =>
    route.fulfill({
      json: {
        status: 'success',
        data: [
          {
            id: configId,
            status: 'APPROVED',
            revision_no: 1,
            configuration_json: {
              dataset_business_name: 'Konfigurasi approved dengan nama panjang',
            },
          },
        ],
        meta: {},
        errors: [],
      },
    }),
  )
  await page.goto('/import-reviews')
  await login(page, 'editor')
  const form = page.locator('.batch-create-form')
  const source = form.getByLabel(/^Sumber/)
  const sheet = form.getByLabel(/^Tab/)
  const action = form.getByRole('button', { name: 'Buat batch', exact: true })

  async function checkLayout(stacked: boolean) {
    const boxes = await form.locator('select, button').evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect()
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width }
      }),
    )
    const formBox = (await form.boundingBox())!
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(formBox.x - 1)
      expect(box.right).toBeLessThanOrEqual(formBox.x + formBox.width + 1)
    }
    if (stacked) {
      for (const box of boxes) expect(box.width).toBeCloseTo(formBox.width, 0)
      for (let i = 1; i < boxes.length; i++)
        expect(boxes[i]!.y).toBeGreaterThan(boxes[i - 1]!.bottom)
    } else {
      for (const box of boxes) expect(box.bottom).toBeCloseTo(boxes[0]!.bottom, 0)
      for (const box of boxes.slice(0, -1)) expect(box.width).toBeGreaterThan(220)
    }
  }

  await page.setViewportSize({ width: 1440, height: 960 })
  await expect(action).toBeDisabled()
  await checkLayout(false)
  await source.selectOption(sourceId)
  await sheet.selectOption(sheetId)
  await form.getByLabel('Konfigurasi approved/active').selectOption(configId)
  await expect(action).toBeEnabled()
  await checkLayout(false)
  for (const width of [1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 })
    await checkLayout(true)
  }
  await page.setViewportSize({ width: 1440, height: 960 })
  for (const datasetKind of ['MASTER', null]) {
    kind = datasetKind
    await source.selectOption('')
    await source.selectOption(sourceId)
    await sheet.selectOption(sheetId)
    await expect(form.getByLabel('Konfigurasi approved/active')).toHaveCount(0)
    const hint = form.locator('.batch-create-hint')
    await expect(hint).toContainText(
      datasetKind ? 'MASTER memakai binding approved' : 'Konfirmasi klasifikasi',
    )
    if (datasetKind) await expect(action).toBeEnabled()
    else await expect(action).toBeDisabled()
    await checkLayout(false)
    const hintBox = (await hint.boundingBox())!
    const actionBox = (await action.boundingBox())!
    expect(hintBox.y).toBeGreaterThan(actionBox.y + actionBox.height)
  }
  expect(mock.errors).toEqual([])
})
