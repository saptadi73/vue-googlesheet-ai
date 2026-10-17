import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('global API loading state', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows after a short delay and clears after the final concurrent request', async () => {
    const { apiLoading, apiLoadingMessage, apiRequestCount, beginApiActivity, endApiActivity } =
      await import('../../src/lib/loading')
    const first = beginApiActivity('GET')
    const second = beginApiActivity('GET')

    expect(apiRequestCount.value).toBe(2)
    expect(apiLoading.value).toBe(false)
    expect(apiLoadingMessage.value).toContain('2')

    vi.advanceTimersByTime(180)
    expect(apiLoading.value).toBe(true)

    endApiActivity(first)
    expect(apiLoading.value).toBe(true)
    endApiActivity(second)
    expect(apiLoading.value).toBe(false)
    expect(apiRequestCount.value).toBe(0)
  })

  it('does not flash for fast requests and always clears a failed operation', async () => {
    const { apiLoading, apiRequestCount, beginApiActivity, endApiActivity, withApiActivity } =
      await import('../../src/lib/loading')
    const fast = beginApiActivity('GET')
    endApiActivity(fast)
    vi.advanceTimersByTime(200)
    expect(apiLoading.value).toBe(false)

    await expect(
      withApiActivity('POST', async () => Promise.reject(new Error('failed'))),
    ).rejects.toThrow('failed')
    expect(apiRequestCount.value).toBe(0)
    expect(apiLoading.value).toBe(false)
  })
})
