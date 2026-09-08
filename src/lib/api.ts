import axios, { AxiosHeaders, CanceledError, type InternalAxiosRequestConfig } from 'axios'

export interface ApiErrorDetail {
  code: string
  message: string
  details?: unknown
}

export interface ApiEnvelope<T> {
  status: 'success' | 'error'
  data: T
  meta: Record<string, unknown>
  errors: ApiErrorDetail[]
}

const origin = (import.meta.env.VITE_API_ORIGIN || '').replace(/\/$/, '')
const basePath = import.meta.env.VITE_API_BASE_PATH || '/api/v1'

export const api = axios.create({
  baseURL: `${origin}${basePath}`,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
})

export interface TokenPair {
  access_token: string
  refresh_token: string
}
type SessionConfig = InternalAxiosRequestConfig & { sessionEpoch?: number; retried?: boolean }
let accessToken: string | null = null
let refreshToken: string | null = null
let epoch = 0
let refreshFlight: Promise<void> | null = null
const sessionListeners = new Set<() => void>()
export function onSessionCleared(callback: () => void) {
  sessionListeners.add(callback)
}
export function clearSession() {
  epoch++
  refreshFlight = null
  refreshToken = null
  setAccessToken(null)
  sessionListeners.forEach((callback) => callback())
}
export function setSession(tokens: TokenPair) {
  epoch++
  refreshFlight = null
  refreshToken = tokens.refresh_token
  setAccessToken(tokens.access_token)
}
const authApi = axios.create({ baseURL: `${origin}${basePath}`, timeout: 30_000 })
api.interceptors.request.use((config: SessionConfig) => {
  config.sessionEpoch ??= epoch
  if (config.sessionEpoch !== epoch) throw new CanceledError('Sesi telah berubah.')
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`)
  return config
})
api.interceptors.response.use(
  async (response) => {
    if ((response.config as SessionConfig).sessionEpoch !== epoch)
      throw new CanceledError('Sesi telah berubah.')
    return response
  },
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error
    const config = error.config as SessionConfig | undefined
    if (config && config.sessionEpoch !== epoch) throw new CanceledError('Sesi telah berubah.')
    if (error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text())
      } catch {
        /* Non-JSON download error. */
      }
    }
    if (config && config.sessionEpoch !== epoch) throw new CanceledError('Sesi telah berubah.')
    const publicAuth = /\/auth\/(login|refresh)$/.test(config?.url || '')
    if (error.response?.status !== 401 || !config || publicAuth) throw error
    if (config.retried || !refreshToken) {
      clearSession()
      throw error
    }
    config.retried = true
    // Another request may already have rotated the token while this 401 was in flight.
    if (accessToken && config.headers.get('Authorization') !== `Bearer ${accessToken}`) {
      config.headers.set('Authorization', `Bearer ${accessToken}`)
      return api.request(config)
    }
    if (!refreshFlight) {
      const currentEpoch = epoch
      const token = refreshToken
      const flight = (async () => {
        try {
          const response = await authApi.post<ApiEnvelope<TokenPair>>('/auth/refresh', {
            refresh_token: token,
          })
          if (currentEpoch !== epoch) throw new CanceledError('Sesi telah berubah.')
          refreshToken = response.data.data.refresh_token
          setAccessToken(response.data.data.access_token)
        } catch (failure) {
          if (currentEpoch === epoch) clearSession()
          throw failure
        }
      })()
      refreshFlight = flight
      void flight
        .finally(() => {
          if (refreshFlight === flight) refreshFlight = null
        })
        .catch(() => {})
    }
    await refreshFlight
    config.headers = AxiosHeaders.from(config.headers)
    config.headers.set('Authorization', `Bearer ${accessToken}`)
    return api.request(config)
  },
)

// Keep access tokens in memory; call with null when signing out.
export function setAccessToken(token: string | null) {
  accessToken = token
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`
  else delete api.defaults.headers.common.Authorization
}

export async function downloadFile(path: string, filename: string, body?: unknown) {
  const response = await api.request<Blob>({
    url: path,
    method: body === undefined ? 'GET' : 'POST',
    data: body,
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    const issue = error.response?.data?.errors?.[0]
    const recovery: Record<string, string> = {
      CONFIGURATION_CONFLICT: 'Muat ulang revisi terbaru sebelum menyimpan kembali.',
      WORKBOOK_STALE: 'Unduh workbook dari draft terbaru.',
      WORKBOOK_PREVIEW_STALE: 'Lakukan preview ulang sebelum menerapkan Excel.',
      WORKBOOK_TOKEN_INVALID: 'Lakukan preview ulang dengan akun dan draft yang sama.',
      REVIEW_REQUIRED: 'Ajukan review untuk revisi terbaru.',
      REVIEW_STALE: 'Validasi ulang snapshot; clone jika konfigurasi sudah disetujui.',
      REVIEW_INCOMPLETE: 'Lengkapi seluruh checklist bagian dan kolom.',
      SEPARATE_APPROVER_REQUIRED: 'Gunakan akun approver yang berbeda.',
      TEMPLATE_STALE: 'Minta pengelola memvalidasi dan mengaktifkan ulang template.',
    }
    if (issue?.code && recovery[issue.code]) return `${issue.message}\n${recovery[issue.code]}`
    if (issue?.code === 'VALIDATION_ERROR' && Array.isArray(issue.details)) {
      return [
        issue.message,
        ...issue.details.map(
          (item: { field?: string; message?: string }) =>
            `${item.field || 'Parameter'}: ${item.message || 'Nilai tidak valid'}`,
        ),
      ].join('\n')
    }
    return (
      (issue
        ? `${issue.message}${error.response?.headers['x-request-id'] ? ` (Request: ${error.response.headers['x-request-id']})` : ''}`
        : '') ||
      (error.response
        ? `Permintaan gagal (HTTP ${error.response.status}).`
        : 'Backend belum dapat dihubungi. Periksa server dan konfigurasi koneksi.')
    )
  }
  return error instanceof Error ? error.message : 'Terjadi kesalahan yang tidak diketahui.'
}

export async function checkBackendHealth(): Promise<boolean> {
  // Health is outside /api/v1 and does not require an access token.
  const { data } = await axios.get<ApiEnvelope<{ alive: boolean }>>(`${origin}/health/live`, {
    timeout: 5_000,
    headers: { Accept: 'application/json' },
  })
  return data.status === 'success' && data.data?.alive === true
}
export async function getBackendHealth(kind: 'database' | 'ready') {
  const response = await axios.get<ApiEnvelope<Record<string, unknown>>>(
    `${origin}/health/${kind}`,
    { timeout: 5_000 },
  )
  return response.data.data
}
