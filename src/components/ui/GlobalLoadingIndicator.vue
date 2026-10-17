<script setup lang="ts">
import { apiLoading, apiLoadingMessage, apiRequestCount } from '@/lib/loading'
</script>

<template>
  <Transition name="network-loading">
    <div
      v-if="apiLoading"
      class="network-loading"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span class="network-loading__mark" aria-hidden="true"><span /><span /><span /></span>
      <span class="network-loading__copy">
        <strong>{{ apiLoadingMessage }}</strong>
        <small>{{
          apiRequestCount > 1
            ? 'Permintaan berjalan bersamaan'
            : 'Sebentar, kami sedang menyiapkan tampilan'
        }}</small>
      </span>
      <span class="network-loading__progress" aria-hidden="true"><span /></span>
      <span class="sr-only">{{ apiLoadingMessage }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.network-loading {
  position: fixed;
  z-index: 1200;
  top: 82px;
  right: 24px;
  display: grid;
  grid-template-columns: 34px minmax(180px, 1fr);
  align-items: center;
  gap: 10px 12px;
  width: min(360px, calc(100vw - 32px));
  padding: 12px 14px 10px;
  border: 1px solid #cfe6d9;
  border-radius: 16px;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 14px 40px rgb(15 45 31 / 14%);
  backdrop-filter: blur(12px);
  pointer-events: none;
}
.network-loading__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: #e7f5ed;
}
.network-loading__mark span {
  width: 4px;
  height: 13px;
  border-radius: 4px;
  background: #0b8053;
  animation: loading-wave 0.85s ease-in-out infinite alternate;
}
.network-loading__mark span:nth-child(2) {
  animation-delay: 0.16s;
  height: 19px;
}
.network-loading__mark span:nth-child(3) {
  animation-delay: 0.32s;
}
.network-loading__copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.network-loading__copy strong {
  color: #17392b;
  font-size: 13px;
  font-weight: 700;
}
.network-loading__copy small {
  color: #698075;
  font-size: 11px;
}
.network-loading__progress {
  grid-column: 1 / -1;
  height: 3px;
  overflow: hidden;
  border-radius: 99px;
  background: #edf3ef;
}
.network-loading__progress span {
  display: block;
  width: 42%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0d8053, #59ce9a, #0d8053);
  background-size: 200% 100%;
  animation: loading-progress 1.4s ease-in-out infinite;
}
.network-loading-enter-active,
.network-loading-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}
.network-loading-enter-from,
.network-loading-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@keyframes loading-wave {
  to {
    transform: scaleY(0.45);
    opacity: 0.55;
  }
}
@keyframes loading-progress {
  from {
    transform: translateX(-110%);
    background-position: 100% 0;
  }
  to {
    transform: translateX(250%);
    background-position: 0 0;
  }
}
@media (max-width: 700px) {
  .network-loading {
    top: 74px;
    right: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .network-loading *,
  .network-loading-enter-active,
  .network-loading-leave-active {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
</style>
