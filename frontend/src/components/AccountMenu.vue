<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import axiosClient from '@/utils/axiosClient'
import { socket } from '@/utils/socket'
import { logout as authLogout } from '@/utils/authGuard'
import { workhub, fetchUserStatus, unlinkAccount } from '@/composables/useWorkhub'
import PersonalInfor from '@/components/PersonalInfor.vue'
import ModelSelectionModal from '@/components/ModelSelectionModal.vue'

/** Nút ảnh đại diện ở thanh trên (như WorkHub): hồ sơ, đổi mật khẩu, xoá tài khoản, kết nối Claude, đăng xuất. */
const router = useRouter()
const user = ref(null)
const open = ref(false)
const showPersonal = ref(false)
const showModels = ref(false)
const root = ref(null)
const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

const avatar = computed(() => {
  const u = user.value?.avatar_url
  if (!u) return ''
  return u.startsWith('http') || u.startsWith('blob:') ? u : `${backend}${u.startsWith('/') ? u : '/' + u}`
})
const initial = computed(() => (user.value?.name || user.value?.email || '?').charAt(0).toUpperCase())

async function load() {
  try {
    user.value = (await axiosClient.get('/api/auth/me')).data?.data ?? null
  } catch { /* chưa đăng nhập: không hiện gì */ }
}
function onDoc(e) { if (open.value && root.value && !root.value.contains(e.target)) open.value = false }
onMounted(() => { load(); fetchUserStatus().catch(() => undefined); document.addEventListener('click', onDoc) })
onBeforeUnmount(() => document.removeEventListener('click', onDoc))

const pick = (fn) => () => { open.value = false; fn() }
const openProfile = pick(() => { showPersonal.value = true })
const openModels = pick(() => { showModels.value = true })
const openClaude = pick(() => router.push('/connect-claude'))
async function signOut() {
  open.value = false
  if (socket?.connected) socket.disconnect()
  await authLogout()
  router.push('/login')
}
async function unlinkWorkhub() {
  open.value = false
  if (!window.confirm('Huỷ liên kết tài khoản WorkHub? Các task và tài liệu đã tạo vẫn nằm ở WorkHub.')) return
  await unlinkAccount().catch(() => undefined)
}
</script>

<template>
  <div v-if="user" ref="root" class="account-menu">
    <button class="account-btn" type="button" aria-haspopup="menu" :aria-expanded="open" @click.stop="open = !open">
      <img v-if="avatar" :src="avatar" alt="Ảnh đại diện" />
      <span v-else>{{ initial }}</span>
    </button>
    <div v-if="open" class="account-panel" role="menu">
      <div class="who">
        <b>{{ user.name || 'Người dùng' }}</b>
        <span>{{ user.email }}</span>
        <small v-if="workhub.linked">WorkHub: {{ workhub.email }}</small>
      </div>
      <button role="menuitem" @click="openProfile"><span class="material-symbols-outlined">person</span> Thông tin cá nhân</button>
      <button role="menuitem" @click="openModels"><span class="material-symbols-outlined">smart_toy</span> Chọn mô hình AI</button>
      <button role="menuitem" @click="openClaude"><span class="material-symbols-outlined">hub</span> Kết nối Claude</button>
      <button v-if="workhub.linked" role="menuitem" @click="unlinkWorkhub"><span class="material-symbols-outlined">link_off</span> Huỷ liên kết WorkHub</button>
      <hr />
      <button role="menuitem" class="danger" @click="signOut"><span class="material-symbols-outlined">logout</span> Đăng xuất</button>
    </div>
    <PersonalInfor v-if="showPersonal" :user="user" @close="showPersonal = false; load()" @avatar-updated="load" />
    <ModelSelectionModal v-model="showModels" />
  </div>
</template>

<style scoped>
.account-menu { position: relative; }
.account-btn { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--border-strong); background: var(--ink); color: var(--ink-text); font-weight: 600; cursor: pointer; overflow: hidden; padding: 0; display: grid; place-items: center; }
.account-btn img { width: 100%; height: 100%; object-fit: cover; }
.account-panel { position: absolute; right: 0; top: calc(100% + 8px); min-width: 250px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-field); box-shadow: var(--shadow-pop); padding: 8px; z-index: 200; display: flex; flex-direction: column; gap: 2px; }
.who { display: flex; flex-direction: column; padding: 8px 10px 10px; gap: 2px; border-bottom: 1px solid var(--border); margin-bottom: 4px; }
.who span, .who small { color: var(--muted); font-size: 0.85rem; overflow-wrap: anywhere; }
.account-panel button { display: flex; align-items: center; gap: 10px; text-align: left; background: none; border: none; border-radius: 10px; padding: 9px 10px; cursor: pointer; color: var(--text); font: inherit; }
.account-panel button:hover { background: var(--sunken); }
.account-panel button.danger { color: var(--danger); }
.account-panel hr { border: none; border-top: 1px solid var(--border); margin: 4px 0; }
</style>
