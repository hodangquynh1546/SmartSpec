<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'

/** Danh sách chọn gọn thay cho <select> gốc của hệ điều hành (menu gốc rất to, lệch cỡ và đè lên nội dung). */
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, required: true }, // [{ value, label }]
  disabled: Boolean,
  ariaLabel: { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'change'])
const open = ref(false)
const btn = ref(null)
const pos = ref({ left: 0, top: 0, width: 0, up: false })
const label = computed(() => props.options.find((o) => String(o.value) === String(props.modelValue))?.label ?? '')

async function toggle() {
  if (props.disabled) return
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  const r = btn.value.getBoundingClientRect()
  const h = props.options.length * 32 + 12
  const up = r.bottom + h > window.innerHeight && r.top > h
  pos.value = { left: r.left, top: up ? r.top - 4 : r.bottom + 4, width: Math.max(r.width, 150), up }
  document.addEventListener('click', close, true)
  window.addEventListener('scroll', close, true)
}
function close() { open.value = false; document.removeEventListener('click', close, true); window.removeEventListener('scroll', close, true) }
function pick(v) { close(); if (String(v) !== String(props.modelValue)) { emit('update:modelValue', v); emit('change', v) } }
onBeforeUnmount(close)
</script>

<template>
  <button ref="btn" type="button" class="app-select" :disabled="disabled" :aria-label="ariaLabel" aria-haspopup="listbox" :aria-expanded="open" @click.stop="toggle">
    <span>{{ label }}</span>
    <span class="material-symbols-outlined">expand_more</span>
  </button>
  <Teleport to="body">
    <ul v-if="open" class="app-select-menu" role="listbox" :style="{ left: pos.left + 'px', top: pos.top + 'px', minWidth: pos.width + 'px', transform: pos.up ? 'translateY(-100%)' : 'none' }">
      <li v-for="o in options" :key="o.value" role="option" :aria-selected="String(o.value) === String(modelValue)" :class="{ on: String(o.value) === String(modelValue) }" @click.stop="pick(o.value)">
        <span class="material-symbols-outlined">{{ String(o.value) === String(modelValue) ? 'check' : '' }}</span>{{ o.label }}
      </li>
    </ul>
  </Teleport>
</template>

<style scoped>
.app-select { display: inline-flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; min-height: 30px; padding: 4px 8px 4px 10px; font-size: 12.5px; color: var(--text); background: var(--surface); border: 1px solid var(--border-strong); border-radius: 10px; cursor: pointer; text-align: left; }
.app-select:hover:not(:disabled) { border-color: var(--ink); }
.app-select:disabled { opacity: 0.55; cursor: default; }
.app-select .material-symbols-outlined { font-size: 18px; color: var(--muted); }
</style>
<style>
.app-select-menu { position: fixed; z-index: 3000; margin: 0; padding: 4px; list-style: none; background: var(--surface, #fff); border: 1px solid var(--border, #e4e4e2); border-radius: 12px; box-shadow: 0 12px 32px rgb(0 0 0 / 0.16); }
.app-select-menu li { display: flex; align-items: center; gap: 6px; padding: 6px 10px 6px 4px; font-size: 12.5px; border-radius: 8px; cursor: pointer; color: var(--text, #0a0a0a); }
.app-select-menu li:hover { background: var(--sunken, #efefee); }
.app-select-menu li.on { font-weight: 600; }
.app-select-menu li .material-symbols-outlined { width: 18px; font-size: 16px; }
</style>
