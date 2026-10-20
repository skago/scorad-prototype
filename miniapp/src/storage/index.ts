/**
 * 存储适配器工厂（小程序端）
 * 默认使用 WxStorageAdapter（方案 A，零成本）
 * 升级方案 B 时将 USE_CLOUD 改为 true（CloudStorageAdapter 组合本地存储）
 */
import { WxStorageAdapter } from './WxStorageAdapter'
import { CloudStorageAdapter } from './CloudStorageAdapter'
import type { StorageAdapter } from './types'

// 方案 B 已启用（2026-10-20 开通微信云开发免费环境 cloud1-d1gvx0dpzae6aede6）
const USE_CLOUD = true

let instance: StorageAdapter

export function getStorage(): StorageAdapter {
  if (!instance) {
    instance = USE_CLOUD
      ? new CloudStorageAdapter(new WxStorageAdapter())
      : new WxStorageAdapter()
  }
  return instance
}

export type { StorageAdapter, AssessmentRecord, AssessmentDraft, UserInfo } from './types'
export { WxStorageAdapter } from './WxStorageAdapter'
export { CloudStorageAdapter } from './CloudStorageAdapter'
