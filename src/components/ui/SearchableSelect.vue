<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

export interface SearchableSelectOption {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  options: SearchableSelectOption[]
  placeholder: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  change: []
}>()

const root = ref<HTMLElement | null>(null)
const query = ref('')
const isOpen = ref(false)
const activeIndex = ref(0)
const listId = `searchable-select-${useId()}`
const selectedOption = computed(() =>
  props.options.find((option) => option.value === props.modelValue),
)
const filteredOptions = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  return search
    ? props.options.filter((option) => option.label.toLocaleLowerCase().includes(search))
    : props.options
})

watch(
  [() => props.modelValue, selectedOption],
  () => {
    query.value = selectedOption.value?.label || ''
  },
  { immediate: true },
)
watch(filteredOptions, () => {
  activeIndex.value = 0
})

function closeMenu() {
  isOpen.value = false
  query.value = selectedOption.value?.label || ''
}

function choose(value: string) {
  if (value !== props.modelValue) {
    emit('update:modelValue', value)
    emit('change')
  }
  const option = props.options.find((item) => item.value === value)
  query.value = option?.label || ''
  isOpen.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' && isOpen.value) {
    event.preventDefault()
    activeIndex.value = Math.min(activeIndex.value + 1, filteredOptions.value.length - 1)
  } else if (event.key === 'ArrowUp' && isOpen.value) {
    event.preventDefault()
    activeIndex.value = Math.max(activeIndex.value - 1, 0)
  } else if (event.key === 'Enter' && isOpen.value && filteredOptions.value.length) {
    event.preventDefault()
    const option = filteredOptions.value[activeIndex.value]
    if (option) choose(option.value)
  } else if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    closeMenu()
  }
}

function onPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) closeMenu()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <div ref="root" class="searchable-select">
    <input
      v-model="query"
      type="text"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="isOpen"
      :aria-controls="listId"
      :aria-activedescendant="isOpen && filteredOptions.length ? `${listId}-${activeIndex}` : undefined"
      :placeholder="placeholder"
      :disabled="disabled"
      @focus="isOpen = true"
      @input="isOpen = true"
      @keydown="onKeydown"
      @blur="closeMenu"
    />
    <div v-if="isOpen" :id="listId" class="searchable-select__list" role="listbox">
      <div
        v-if="modelValue"
        class="searchable-select__option"
        role="option"
        :aria-selected="false"
        @mousedown.prevent
        @click="choose('')"
      >
        {{ placeholder }}
      </div>
      <div
        v-for="(option, index) in filteredOptions"
        :id="`${listId}-${index}`"
        :key="option.value"
        class="searchable-select__option"
        :class="{ 'is-active': index === activeIndex }"
        role="option"
        :aria-selected="option.value === modelValue"
        @mousedown.prevent
        @mousemove="activeIndex = index"
        @click="choose(option.value)"
      >
        {{ option.label }}
      </div>
      <div v-if="!filteredOptions.length" class="searchable-select__empty" role="status">
        Tidak ada pilihan yang cocok.
      </div>
    </div>
  </div>
</template>

<style scoped>
.searchable-select {
  position: relative;
  width: 100%;
}
.searchable-select__list {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  right: 0;
  left: 0;
  max-height: 260px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid #b9cec3;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 8px 24px -8px rgba(18, 45, 35, 0.25);
}
.searchable-select__option,
.searchable-select__empty {
  padding: 8px 10px;
  border-radius: 5px;
}
.searchable-select__option {
  cursor: pointer;
}
.searchable-select__option:hover,
.searchable-select__option.is-active {
  background: #eaf6f0;
  color: #0e5f41;
}
.searchable-select__empty {
  color: #60746a;
}
</style>
