import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getStorage } from '@/storage'
import type { AssessmentDraft } from '@/storage'

/**
 * 草稿 Store
 * 用于防刷新丢数据，每步切换时保存
 */
export const useDraftStore = defineStore('draft', () => {
  const draft = ref<AssessmentDraft | null>(null)
  const storage = getStorage()

  async function loadDraft() {
    draft.value = await storage.getDraft()
    return draft.value
  }

  async function saveDraft(data: AssessmentDraft) {
    draft.value = data
    await storage.saveDraft(data)
  }

  async function clearDraft() {
    draft.value = null
    await storage.clearDraft()
  }

  return { draft, loadDraft, saveDraft, clearDraft }
})
