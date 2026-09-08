import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'
const originalAdapter = axios.defaults.adapter
function response(config: InternalAxiosRequestConfig, data: unknown, status = 200) {
  return { data, status, statusText: String(status), headers: new AxiosHeaders(), config }
}
function unauthorized(config: InternalAxiosRequestConfig, status = 401) {
  return Promise.reject(
    new AxiosError(
      'Rejected',
      undefined,
      config,
      undefined,
      response(
        config,
        {
          status: 'error',
          data: null,
          meta: {},
          errors: [{ code: 'INVALID_TOKEN', message: 'Invalid token' }],
        },
        status,
      ),
    ),
  )
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
beforeEach(() => {
  vi.resetModules()
})
afterEach(() => {
  axios.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})
describe('API session contract', () => {
  it('shares a rotating refresh across concurrent 401 responses and uses both new tokens', async () => {
    let refreshes = 0
    const gate = deferred<void>()
    const adapter: AxiosAdapter = async (config) => {
      if (config.url === '/auth/refresh') {
        refreshes++
        expect(JSON.parse(config.data).refresh_token).toBe('refresh-old')
        await gate.promise
        return response(config, {
          status: 'success',
          data: { access_token: 'new', refresh_token: 'refresh-new' },
        })
      }
      return config.headers.get('Authorization') === 'Bearer new'
        ? response(config, { ok: true })
        : unauthorized(config)
    }
    axios.defaults.adapter = adapter
    const { api, setSession } = await import('../../src/lib/api')
    setSession({ access_token: 'old', refresh_token: 'refresh-old' })
    const requests = [api.get('/sources'), api.get('/jobs')]
    await vi.waitFor(() => expect(refreshes).toBe(1))
    gate.resolve()
    await Promise.all(requests)
    expect(refreshes).toBe(1)
  })
  it('ignores late 401 from the previous access token without another refresh', async () => {
    let refreshes = 0
    const late = deferred<void>()
    axios.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') {
        refreshes++
        return response(config, { data: { access_token: 'new', refresh_token: 'rotated' } })
      }
      if (config.headers.get('Authorization') === 'Bearer new') return response(config, {})
      if (config.url === '/late') await late.promise
      return unauthorized(config)
    }
    const { api, setSession } = await import('../../src/lib/api')
    setSession({ access_token: 'old', refresh_token: 'refresh' })
    const pending = api.get('/late')
    await api.get('/first')
    late.resolve()
    await pending
    expect(refreshes).toBe(1)
  })
  it('clears the session on failed refresh without looping', async () => {
    let refreshes = 0
    axios.defaults.adapter = (config) => {
      if (config.url === '/auth/refresh') refreshes++
      return unauthorized(config)
    }
    const { api, setSession, onSessionCleared } = await import('../../src/lib/api')
    const cleared = vi.fn()
    onSessionCleared(cleared)
    setSession({ access_token: 'old', refresh_token: 'refresh' })
    await expect(api.get('/sources')).rejects.toBeDefined()
    expect(refreshes).toBe(1)
    expect(cleared).toHaveBeenCalledTimes(1)
    expect(api.defaults.headers.common.Authorization).toBeUndefined()
  })
  it.each([403, 422, 429, 503])(
    'does not refresh or retry mutations rejected with %s',
    async (status) => {
      let requests = 0
      axios.defaults.adapter = (config) => {
        requests++
        return unauthorized(config, status)
      }
      const { api, setSession } = await import('../../src/lib/api')
      setSession({ access_token: 'token', refresh_token: 'refresh' })
      await expect(api.post('/configurations', {})).rejects.toBeDefined()
      expect(requests).toBe(1)
    },
  )
  it('does not retry a timed out mutation', async () => {
    let requests = 0
    axios.defaults.adapter = async (config) => {
      requests++
      throw new AxiosError('timeout', 'ECONNABORTED', config)
    }
    const { api, setSession } = await import('../../src/lib/api')
    setSession({ access_token: 'token', refresh_token: 'refresh' })
    await expect(api.post('/sources/google-sheets', {})).rejects.toBeDefined()
    expect(requests).toBe(1)
  })
  it('rejects stale successful responses after switching accounts', async () => {
    const gate = deferred<void>()
    axios.defaults.adapter = async (config) => {
      await gate.promise
      return response(config, { private: 'old tenant' })
    }
    const { api, setSession } = await import('../../src/lib/api')
    setSession({ access_token: 'old', refresh_token: 'old-refresh' })
    const pending = api.get('/users')
    await new Promise((r) => setTimeout(r, 0))
    setSession({ access_token: 'other', refresh_token: 'other-refresh' })
    gate.resolve()
    await expect(pending).rejects.toMatchObject({ code: 'ERR_CANCELED' })
  })
  it('reads JSON errors from binary download responses', async () => {
    axios.defaults.adapter = (config) =>
      Promise.reject(
        new AxiosError(
          'bad workbook',
          undefined,
          config,
          undefined,
          response(
            config,
            new Blob([
              JSON.stringify({
                status: 'error',
                errors: [{ code: 'WORKBOOK_STALE', message: 'Workbook expired' }],
              }),
            ]),
            409,
          ),
        ),
      )
    const { api, getApiErrorMessage } = await import('../../src/lib/api')
    const failure = await api.get('/download', { responseType: 'blob' }).catch((e) => e)
    expect(getApiErrorMessage(failure)).toContain('Workbook expired')
    expect(getApiErrorMessage(failure)).toContain('Unduh workbook')
  })
})
