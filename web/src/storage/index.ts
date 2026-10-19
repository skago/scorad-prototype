/**
 * 存储适配器工厂
 * 默认使用 LocalStorageAdapter（方案 A，零成本）
 * 升级到方案 B 时，将 USE_CLOUD 置为 true 即可切换
 */
import { LocalStorageAdapter } from './LocalStorageAdapter'
import { CloudStorageAdapter } from './CloudStorageAdapter'
import type { StorageAdapter } from './types'

// 升级方案 B 时改为 true（同时需在 .env.production 配置 VITE_CLOUDBASE_ENV）
const USE_CLOUD = false

let instance: StorageAdapter

export function getStorage(): StorageAdapter {
  if (!instance) {
    instance = USE_CLOUD ? new CloudStorageAdapter(new LocalStorageAdapter()) : new LocalStorageAdapter()
  }
  return instance
}

export type { StorageAdapter, AssessmentRecord, AssessmentDraft, UserInfo } from './types'
export { LocalStorageAdapter } from './LocalStorageAdapter'
