import { computed, ref } from 'vue'

const pending = new Map<number, 'read' | 'write'>()
const requestCount = ref(0)
const visible = ref(false)
let nextId = 0
let showTimer: ReturnType<typeof setTimeout> | undefined

export const apiLoading = visible
export const apiRequestCount = requestCount
export const apiLoadingMessage = computed(() => {
  const writes = [...pending.values()].filter((kind) => kind === 'write').length
  if (writes) return 'Memproses perubahan dengan aman...'
  return requestCount.value > 1
    ? `Memuat ${requestCount.value} bagian data...`
    : 'Memuat data terbaru...'
})

export function beginApiActivity(method?: string): number {
  const id = ++nextId
  pending.set(
    id,
    method?.toUpperCase() === 'GET' || method?.toUpperCase() === 'HEAD' ? 'read' : 'write',
  )
  requestCount.value = pending.size
  if (showTimer === undefined && !visible.value) {
    showTimer = setTimeout(() => {
      showTimer = undefined
      if (pending.size) visible.value = true
    }, 180)
  }
  return id
}

export function endApiActivity(id?: number) {
  if (id === undefined || !pending.delete(id)) return
  requestCount.value = pending.size
  if (!pending.size) {
    if (showTimer !== undefined) clearTimeout(showTimer)
    showTimer = undefined
    visible.value = false
  }
}
export async function withApiActivity<T>(method: string, operation: () => Promise<T>): Promise<T> {
  const id = beginApiActivity(method)
  try {
    return await operation()
  } finally {
    endApiActivity(id)
  }
}
