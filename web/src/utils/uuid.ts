/**
 * UUID 工具
 * - generateUUID：记录 ID 用，优先 crypto.randomUUID，降级 v4 模板
 * - getOrCreateUserId：本地用户标识（created_by 用），首次启动生成并持久化到 scorad_user_v1
 */
import { getStorage } from '@/storage'

/** 生成 UUID v4（兼容非 HTTPS 环境） */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** 存储在 scorad_user_v1 中的本地用户标识结构 */
interface LocalUser {
  uuid?: string
}

/**
 * 获取（或首次创建）本地用户 UUID
 * 纯本地标识，不关联任何账号；用于记录 created_by 审计字段
 */
export async function getOrCreateUserId(): Promise<string> {
  const storage = getStorage()
  const user = await storage.getUser<LocalUser>()
  if (user?.uuid) return user.uuid
  const uuid = generateUUID()
  await storage.setUser<LocalUser>({ ...user, uuid })
  return uuid
}
