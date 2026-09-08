<script setup lang="ts">
import { ref, watch } from 'vue'
import { call, type Config } from '@/lib/etl'
import { downloadFile } from '@/lib/api'
import { useTask } from '@/lib/tasks'
const props = defineProps<{ config: Config; disabled: boolean }>()
const { busy, error, run } = useTask()
const versions = ref<Config[]>([]),
  against = ref(''),
  diff = ref<Record<string, { before: unknown; after: unknown }> | null>(null)
const artifacts = ref<{ id: string; file_name: string; is_current: boolean }[]>([])
async function load() {
  const result = await Promise.all([
    call<Config[]>('GET', `/source-sheets/${props.config.source_sheet_id}/configurations`),
    call<typeof artifacts.value>('GET', `/configurations/${props.config.id}/artifacts`),
  ])
  versions.value = result[0].filter((c) => c.id !== props.config.id)
  artifacts.value = result[1]
}
async function exportConfig(format: string) {
  const artifact = await call<{ id: string; file_name: string }>(
    'POST',
    `/configurations/${props.config.id}/export`,
    { format },
  )
  await downloadFile(
    `/configurations/${props.config.id}/artifacts/${artifact.id}/download`,
    artifact.file_name,
  )
  await load()
}
watch(
  () => props.config.id,
  () => {
    versions.value = []
    against.value = ''
    diff.value = null
    artifacts.value = []
  },
)
</script>
<template>
  <details class="panel">
    <summary>Riwayat, perbandingan &amp; artifact</summary>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <fieldset :disabled="busy || disabled">
      <button @click="run(load)">Muat versi &amp; artifact</button
      ><label
        >Bandingkan dengan versi pada tab yang sama<select v-model="against">
          <option value="">Pilih versi</option>
          <option v-for="version in versions" :key="version.id" :value="version.id">
            v{{ version.version_no }} · {{ version.status }}
          </option>
        </select></label
      ><button
        :disabled="!against"
        @click="
          run(async () => {
            diff = await call('GET', `/configurations/${config.id}/diff?against=${against}`)
          })
        "
      >
        Bandingkan
      </button>
      <p v-if="diff && !Object.keys(diff).length">Tidak ada perbedaan konfigurasi.</p>
      <div v-for="(change, key) in diff" :key="key" class="card-row">
        <h3>{{ key }}</h3>
        <div class="grid">
          <div>
            <strong>Sebelum</strong>
            <pre>{{ JSON.stringify(change.before, null, 2) }}</pre>
          </div>
          <div>
            <strong>Sesudah</strong>
            <pre>{{ JSON.stringify(change.after, null, 2) }}</pre>
          </div>
        </div>
      </div>
      <div class="toolbar">
        <button @click="run(() => exportConfig('JSON'))">Ekspor JSON</button
        ><button @click="run(() => exportConfig('YAML'))">Ekspor YAML</button>
      </div>
      <div v-for="artifact in artifacts" :key="artifact.id" class="toolbar">
        <span>{{ artifact.file_name }} · {{ artifact.is_current ? 'Terkini' : 'Historis' }}</span
        ><button
          @click="
            run(() =>
              downloadFile(
                `/configurations/${config.id}/artifacts/${artifact.id}/download`,
                artifact.file_name,
              ),
            )
          "
        >
          Unduh artifact
        </button>
      </div>
    </fieldset>
  </details>
</template>
