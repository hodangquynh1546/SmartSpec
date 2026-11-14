// Trường/giá trị kỹ thuật (mã nội bộ) không hiển thị cho người dùng khi xem thay đổi/chi tiết.
const TECH_KEYS = new Set(['id', '_id', '__v', 'lineage_id', 'implementation', 'audit', 'workhub', 'bug', 'position', 'metadata', 'internal',
  'created_by', 'updated_by', 'created_at', 'updated_at', 'invite_token', 'password', 'token'])
const OBJECT_ID = /^[0-9a-f]{24}$/i
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const isIdValue = (v) => typeof v === 'string' && (OBJECT_ID.test(v) || UUID.test(v))
export const isTechnicalKey = (k) => {
  const key = String(k)
  return TECH_KEYS.has(key) || key.startsWith('_') || /_ids?$/.test(key) || /Id$/.test(key)
}
export const isEmptyValue = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
/** Có nên hiện cặp (khoá, giá trị) này không. */
export const isVisibleEntry = (k, v) => !isTechnicalKey(k) && !isIdValue(v) && !(Array.isArray(v) && v.length > 0 && v.every(isIdValue)) && !isEmptyValue(v)
