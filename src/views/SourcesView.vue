<script setup lang="ts">
import { useRouter } from 'vue-router'
import EtlShell from '@/components/EtlShell.vue'
import SourceRegistry from '@/components/SourceRegistry.vue'
import { user, type Source } from '@/lib/etl'

const router = useRouter()
function openSource(source: Source) {
  void router.push({ path: '/workspace', query: { source_id: source.id } })
}
</script>

<template>
  <EtlShell>
    <p class="eyebrow">REGISTRASI, PEMROSESAN, DAN TANGGUNG JAWAB</p>
    <h1>Sumber data &amp; tracking</h1>
    <p class="muted">
      Daftar ini menjadi titik awal untuk mencari sumber dan mengikuti tahapannya: discovery, profiling,
      konfigurasi atau binding master, lalu pemuatan ke database. Pilih Buka untuk melanjutkan pekerjaan
      di Workspace ETL. Status steward dan review akses juga ditampilkan di sini.
    </p>
    <p><RouterLink to="/workspace">Daftarkan Google Sheet atau lanjutkan Workspace ETL</RouterLink></p>
    <SourceRegistry :can-manage="user?.role === 'PLATFORM_ADMIN'" @open-source="openSource" />
  </EtlShell>
</template>
