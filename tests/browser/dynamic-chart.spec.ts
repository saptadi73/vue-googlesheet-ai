import { expect, test } from '@playwright/test'
import { login, setup } from './fixtures'

test('dashboard switches validated chart types and saves visualization with the query template', async ({
  page,
}) => {
  const state = await setup(page)
  state.product.metrics.push({
    code: 'transaction_count',
    label: 'Jumlah transaksi',
    column: 'net_amount',
    aggregation: 'count',
  })
  state.product.dimensions.push('transaction_month')
  await page.goto('/dashboard')
  await login(page)
  await page.getByRole('combobox', { name: 'Produk data' }).selectOption('SALES')
  await page.getByRole('checkbox', { name: 'branch_name' }).check()
  await page.getByRole('checkbox', { name: 'transaction_month' }).check()
  await page.getByRole('checkbox', { name: 'Penjualan bersih' }).check()
  await page.getByRole('checkbox', { name: 'Jumlah transaksi' }).check()
  await page.getByRole('button', { name: 'Jalankan query' }).click()
  await page.getByText('Visualisasi hasil', { exact: true }).click()

  const chartType = page.getByRole('combobox', { name: 'Jenis grafik' })
  await expect(chartType).toHaveValue('line')
  expect(state.errors).toEqual([])
  await chartType.selectOption('combo')
  await page.waitForTimeout(100)
  expect(state.errors).toEqual([])
  await page.getByRole('textbox', { name: 'Judul' }).fill('Penjualan dan transaksi')
  await expect(page.locator('.apexcharts-canvas')).toBeVisible()
  await chartType.selectOption('pie')
  await expect(page.locator('.apexcharts-pie')).toBeVisible()
  expect(state.errors).toEqual([])
  for (const type of ['line', 'area', 'donut', 'scatter', 'heatmap', 'kpi', 'table', 'bar']) {
    await chartType.selectOption(type)
    await page.waitForTimeout(50)
    expect(state.errors).toEqual([])
  }
  await chartType.selectOption('combo')

  await page.getByText('Simpan query saat ini sebagai template').click()
  await page.getByRole('textbox', { name: 'Kode template' }).fill('sales_combo')
  await page.getByRole('textbox', { name: 'Contoh pertanyaan' }).fill('Tampilkan penjualan')
  await page.getByRole('button', { name: 'Simpan draft template' }).click()
  const body = state.requests.find(
    (request) => request.method === 'POST' && request.path === '/semantic/query-templates',
  )?.body
  expect(body.plan.visualization).toEqual({
    type: 'combo',
    title: 'Penjualan dan transaksi',
    x_field: 'branch_name',
    y_field: null,
    series: [
      { field: 'net_sales', type: 'bar', axis: 'left' },
      { field: 'transaction_count', type: 'line', axis: 'right' },
    ],
  })
  expect(state.errors).toEqual([])
})

test('chat renders the validated visualization returned by NL2SQL', async ({ page }) => {
  const state = await setup(page)
  await page.route('**/api/v1/nl2sql/query', (route) =>
    route.fulfill({
      json: {
        status: 'success',
        data: [
          { branch_name: 'Jakarta', net_sales: 150 },
          { branch_name: 'Bandung', net_sales: 50 },
        ],
        meta: {
          query_id: 'query-chart',
          route: 'OPENAI',
          openai_called: true,
          cached: false,
          visualization: {
            type: 'pie',
            title: 'Komposisi penjualan',
            x_field: 'branch_name',
            y_field: null,
            series: [{ field: 'net_sales', type: 'bar', axis: 'left' }],
          },
        },
        errors: [],
      },
    }),
  )
  await page.goto('/chat')
  await login(page)
  await page.getByRole('textbox', { name: 'Pertanyaan Anda' }).fill('Tampilkan komposisi penjualan')
  await page.getByRole('button', { name: 'Tanyakan data' }).click()
  await page.getByText('Visualisasi hasil', { exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Jenis grafik' })).toHaveValue('pie')
  await expect(page.locator('.apexcharts-pie')).toBeVisible()
  expect(state.errors).toEqual([])
})
