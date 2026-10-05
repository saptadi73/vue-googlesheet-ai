<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CircleHelp, X } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { getPageHelp } from '@/lib/pageHelp'

const route = useRoute()
const open = ref(false)
const helpButton = ref<HTMLButtonElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const dialog = ref<HTMLElement | null>(null)
const content = computed(() => getPageHelp(route.path))

async function show() {
  open.value = true
  await nextTick()
  closeButton.value?.focus()
}
async function close() {
  open.value = false
  await nextTick()
  helpButton.value?.focus()
}
function onKeydown(event: KeyboardEvent) {
  if (!open.value) return
  if (event.key === 'Escape') {
    void close()
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (element) => !element.hasAttribute('disabled'),
  )
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last?.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first?.focus()
  }
}
watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <button
    ref="helpButton"
    type="button"
    class="page-help-trigger"
    aria-label="Buka bantuan halaman"
    :aria-expanded="open"
    aria-controls="page-help-dialog"
    @click="show"
  >
    <CircleHelp :size="20" aria-hidden="true" />
    <span>Bantuan</span>
  </button>
  <Teleport to="body">
    <div v-if="open" class="page-help-backdrop" @click.self="close">
      <section
        ref="dialog"
        id="page-help-dialog"
        class="page-help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-help-title"
      >
        <header>
          <div>
            <p class="page-help-eyebrow">PETUNJUK HALAMAN</p>
            <h2 id="page-help-title">{{ content.title }}</h2>
          </div>
          <button ref="closeButton" type="button" aria-label="Tutup bantuan" @click="close">
            <X :size="20" aria-hidden="true" />
          </button>
        </header>
        <div class="page-help-body">
          <section>
            <h3>Fungsi halaman</h3>
            <p>{{ content.purpose }}</p>
          </section>
          <section>
            <h3>Cara menggunakan</h3>
            <ol>
              <li v-for="step in content.steps" :key="step">{{ step }}</li>
            </ol>
          </section>
          <section v-if="content.notes?.length" class="page-help-notes">
            <h3>Perlu diperhatikan</h3>
            <ul>
              <li v-for="note in content.notes" :key="note">{{ note }}</li>
            </ul>
          </section>
        </div>
        <footer>
          <RouterLink class="page-help-guide" to="/guide" @click="close">Panduan lengkap</RouterLink>
          <button type="button" class="page-help-done" @click="close">Saya mengerti</button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.page-help-trigger {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 80;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.75rem;
  padding: 0.65rem 0.9rem;
  border: 1px solid #047857;
  border-radius: 999px;
  background: #047857;
  color: #fff;
  font: inherit;
  font-weight: 700;
  box-shadow: 0 8px 24px rgb(15 23 42 / 0.22);
  cursor: pointer;
}
.page-help-trigger:hover,
.page-help-trigger:focus-visible {
  background: #065f46;
  outline: 3px solid rgb(16 185 129 / 0.3);
  outline-offset: 2px;
}
.page-help-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(15 23 42 / 0.55);
}
.page-help-dialog {
  width: min(44rem, 100%);
  max-height: min(46rem, calc(100vh - 2rem));
  overflow: auto;
  border-radius: 1rem;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 24px 64px rgb(15 23 42 / 0.35);
}
.page-help-dialog > header {
  position: sticky;
  top: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #dbe5e1;
  background: #fff;
}
.page-help-dialog h2,
.page-help-dialog h3,
.page-help-dialog p {
  margin-top: 0;
}
.page-help-dialog h2 {
  margin-bottom: 0;
  font-size: 1.45rem;
}
.page-help-dialog h3 {
  margin-bottom: 0.45rem;
  font-size: 1rem;
  color: #065f46;
}
.page-help-dialog header button {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.65rem;
  background: #fff;
  color: #334155;
  cursor: pointer;
}
.page-help-eyebrow {
  margin-bottom: 0.25rem;
  color: #047857;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}
.page-help-body {
  display: grid;
  gap: 1.2rem;
  padding: 1.4rem 1.5rem;
  line-height: 1.6;
}
.page-help-body section,
.page-help-body ol,
.page-help-body ul {
  margin: 0;
}
.page-help-body ol,
.page-help-body ul {
  display: grid;
  gap: 0.55rem;
  padding-left: 1.35rem;
}
.page-help-notes {
  padding: 1rem;
  border-left: 4px solid #d97706;
  border-radius: 0.5rem;
  background: #fffbeb;
}
.page-help-dialog > footer {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  padding: 1rem 1.5rem;
  border-top: 1px solid #dbe5e1;
  background: #f8fafc;
}
.page-help-guide {
  align-self: center;
  margin-right: auto;
  color: #047857;
  font-weight: 700;
}
.page-help-done {
  min-height: 2.5rem;
  padding: 0.55rem 1rem;
  border: 1px solid #047857;
  border-radius: 0.6rem;
  background: #047857;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
@media (max-width: 640px) {
  .page-help-trigger {
    right: 0.8rem;
    bottom: 0.8rem;
  }
  .page-help-trigger span {
    display: none;
  }
  .page-help-dialog > header,
  .page-help-body,
  .page-help-dialog > footer {
    padding-right: 1rem;
    padding-left: 1rem;
  }
}
@media (prefers-reduced-motion: reduce) {
  .page-help-trigger {
    scroll-behavior: auto;
  }
}
</style>