/**
 * UUID 工具（小程序端）
 * 小程序无 crypto.randomUUID，自实现 v4：时间戳 + 随机串
 */
import { getStorage } from '@/storage'

/** 生成 UUID v4（时间戳 + 随机串，满足本地唯一性） */
export function generateUUID(): string {
  const ts = Date.now().toString(16).padStart(12, '0')
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c, i) => {
    // 前 12 位掺入时间戳，降低同毫秒冲突概率
    const useTs = i < 12 && c === 'x'
    const r = useTs ? parseInt(ts[i], 16) : (Math.random() * 16) | 0
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
