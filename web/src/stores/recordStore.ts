import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getStorage } from '@/storage'
import type { AssessmentRecord } from '@/storage'

/**
 * 评估记录 Store
 * 依赖 StorageAdapter，不直接操作 localStorage
 */
export const useRecordStore = defineStore('record', () => {
  const records = ref<AssessmentRecord[]>([])
  const storage = getStorage()

  async function loadRecords() {
    records.value = await storage.listRecords()
  }

  async function getRecord(id: string) {
    return await storage.getRecord(id)
  }

  async function saveRecord(record: AssessmentRecord) {
    await storage.saveRecord(record)
    await loadRecords()
  }

  async function deleteRecord(id: string) {
    await storage.deleteRecord(id)
    await loadRecords()
  }

  return { records, loadRecords, getRecord, saveRecord, deleteRecord }
})
