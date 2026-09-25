import { test, expect } from '@playwright/test'
import { setup, login } from './fixtures'

test('ambiguous templates require explicit selection and send the chosen code on clarification', async ({
  page,
}) => {
  const state = await setup(page)
  const bodies: any[] = []
  await page.route('**/api/v1/nl2sql/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: {
          status: 'success',
          data: { status: 'CLARIFICATION_REQUIRED', plan: {} },
          errors: [],
          meta: {},
        },
      })
    bodies.push(route.request().postDataJSON())
    if (path.endsWith('/query'))
      return route.fulfill({
        json: {
          status: 'success',
          data: [],
          errors: [],
          meta: {
            query_id: 'clarify',
            clarification_required: true,
            question: 'Pilih template yang dimaksud.',
            template_candidates: [
              { code: 'daily_sales', data_product_code: 'SALES' },
              { code: 'monthly_sales', data_product_code: 'SALES' },
            ],
            template_candidates_more: false,
            openai_called: false,
          },
        },
      })
    return route.fulfill({
      json: {
        status: 'success',
        data: [{ total: 10 }],
        errors: [],
        meta: { route: 'SAVED_QUERY', openai_called: false },
      },
    })
  })
  await page.goto('/chat')
  await login(page, 'viewer')
  await page.getByLabel('Pertanyaan Anda').fill('Berapa penjualan?')
  await page.getByRole('button', { name: 'Tanyakan data' }).click()
  const choice = page.getByRole('button', {
    name: 'Pilih template monthly_sales / SALES',
    exact: true,
  })
  await choice.click()
  expect(bodies).toHaveLength(1)
  await expect(page.getByText('Template dipilih: monthly_sales.', { exact: false })).toBeVisible()
  await page.getByLabel('Pertanyaan yang diperjelas').fill('Pertanyaan lain')
  await expect(page.getByText('Template dipilih:', { exact: false })).toHaveCount(0)
  await choice.click()
  await page.getByRole('button', { name: 'Kirim klarifikasi' }).click()
  expect(bodies[1]).toEqual({
    question: 'Berapa penjualan?',
    data_product_code: 'SALES',
    saved_query_code: 'monthly_sales',
  })
  await expect(page.getByRole('cell', { name: '10', exact: true })).toBeVisible()
  await expect(choice).toHaveCount(0)
  expect(state.errors).toEqual([])
})
