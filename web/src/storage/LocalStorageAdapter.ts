/**
 * LocalStorage 适配器（方案 A 默认）
 * 数据全部存储在浏览器 localStorage，不上传任何服务器
 */
import type { StorageAdapter, AssessmentRecord, AssessmentDraft, UserInfo } from './types'

export const KEYS = {
  records: 'scorad_records_v1',
  draft: 'scorad_draft_v1',
  user: 'scorad_user_v1'
} as const

export class LocalStorageAdapter implements StorageAdapter {
  // ============ 评估记录 ============
  async listRecords(): Promise<AssessmentRecord[]> {
    try {
      const raw = localStorage.getItem(KEYS.records)
      return raw ? (JSON.parse(raw) as AssessmentRecord[]) : []
    } catch {
      return []
    }
  }

  async getRecord(id: string): Promise<AssessmentRecord | null> {
    const list = await this.listRecords()
    return list.find((r) => r.id === id) ?? null
  }

  async saveRecord(record: AssessmentRecord): Promise<void> {
    const list = await this.listRecords()
    const idx = list.findIndex((r) => r.id === record.id)
    if (idx >= 0) {
      list[idx] = record
    } else {
      list.push(record)
    }
    localStorage.setItem(KEYS.records, JSON.stringify(list))
  }

  async deleteRecord(id: string): Promise<void> {
    const list = await this.listRecords()
    const filtered = list.filter((r) => r.id !== id)
    localStorage.setItem(KEYS.records, JSON.stringify(filtered))
  }

  // ============ 草稿 ============
  async getDraft(): Promise<AssessmentDraft | null> {
    try {
      const raw = localStorage.getItem(KEYS.draft)
      return raw ? (JSON.parse(raw) as AssessmentDraft) : null
    } catch {
      return null
    }
  }

  async saveDraft(draft: AssessmentDraft): Promise<void> {
    localStorage.setItem(KEYS.draft, JSON.stringify(draft))
  }

  async clearDraft(): Promise<void> {
    localStorage.removeItem(KEYS.draft)
  }

  // ============ 用户态 ============
  async getUser<T = UserInfo>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem(KEYS.user)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  async setUser<T = UserInfo>(user: T): Promise<void> {
    localStorage.setItem(KEYS.user, JSON.stringify(user))
  }

  async clearUser(): Promise<void> {
    localStorage.removeItem(KEYS.user)
  }

  // ============ 通用配置 ============
  async getConfig<T = unknown>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  }

  async setConfig<T = unknown>(key: string, value: T): Promise<void> {
    localStorage.setItem(key, JSON.stringify(value))
  }
}
