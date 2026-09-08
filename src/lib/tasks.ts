import { onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'
import { user } from './etl'
import { getApiErrorMessage } from './api'

export function useTask() {
  const busy = ref(false),
    error = ref(''),
    notice = ref('')
  let generation = 0
  const stop = watch(user, () => {
    generation++
    error.value = ''
    notice.value = ''
    busy.value = false
  })
  onBeforeUnmount(() => {
    generation++
    stop()
  })
  async function run(action: () => Promise<void>) {
    if (busy.value) return
    const current = generation
    busy.value = true
    error.value = ''
    notice.value = ''
    try {
      await action()
    } catch (e) {
      if (current === generation && !axios.isCancel(e)) error.value = getApiErrorMessage(e)
    } finally {
      if (current === generation) busy.value = false
    }
  }
  return { busy, error, notice, run }
}
