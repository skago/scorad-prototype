/**
 * 云存储适配器（方案 B：腾讯云开发 CloudBase Web SDK）
 * 组合模式（与小程序端 CloudStorageAdapter 对齐）：
 * - 匿名登录（零摩擦；微信扫码需网站备案，成本不符）
 * - 读永远走本地（启动时后台 pull 合并，不阻塞 UI）
 * - 写先落本地，再入离线队列后台推送云端
 * - 合并算法与小程序端逐字一致（merge.ts：id upsert，updated_at 大者胜）
 * - 离线队列存 localStorage，online 事件 / 页面回到前台时 flush
 * - envId 走 import.meta.env.VITE_CLOUDBASE_ENV（.env.production 用户填写）
 * - 预期行为：Web 匿名 uid ≠ 小程序 openid，两端数据各自云隔离；
 *   跨端迁移走 CSV/JSON 导入导出（架构文档「风险与对策」已述）
 * - 未配置 envId 时完全退化为纯本地行为
 * - 子路径引入（app/auth/database）控制打包体积
 */
import type { StorageAdapter, AssessmentRecord, AssessmentDraft, UserInfo } from './types'
import { LocalStorageAdapter, KEYS } from './LocalStorageAdapter'
import { mergeRecords } from './merge'

// 子路径动态引入（app/auth/database）：未配置 envId 时 SDK 不进首屏 bundle

const ENV_ID = (import.meta.env.VITE_CLOUDBASE_ENV as string | undefined) || ''
const QUEUE_KEY = 'scorad_sync_queue_v1'
const COLLECTION = 'assessment_records'
const PAGE_SIZE = 100

interface SyncOp {
  op: 'upsert' | 'remove'
  id: string
  payload?: AssessmentRecord
}

/** CloudBase database 句柄（SDK 类型链较深，这里用最小结构约束） */
interface DbHandle {
  collection(name: string): {
    doc(id: string): {
      set(data: Record<string, unknown>): Promise<unknown>
      remove(): Promise<unknown>
    }
    skip(n: number): { limit(n: number): { get(): Promise<{ data: Record<string, unknown>[] }> } }
  }
}

export class CloudStorageAdapter implements StorageAdapter {
  private local: LocalStorageAdapter
  /** 匿名登录 + 首次 pull 的就绪闸门；未配置 envId 时立即 resolve 且不注册任何云端行为 */
  private ready: Promise<void>
  private flushing = false
  private db: DbHandle | null = null

  constructor(local: LocalStorageAdapter) {
    this.local = local
    this.ready = ENV_ID ? this.init() : Promise.resolve()
  }

  // ============ 云端初始化与同步（全部后台静默） ============

  private async init(): Promise<void> {
    try {
      const { default: cloudbase } = await import('@cloudbase/js-sdk/app')
      await import('@cloudbase/js-sdk/auth')
      await import('@cloudbase/js-sdk/database')
      const app = cloudbase.init({ env: ENV_ID })
      this.db = app.database() as unknown as DbHandle
      const auth = app.auth()
      // 匿名登录（v3 API；零摩擦，无需任何用户操作）
      await auth.signInAnonymously({})
      const state = await auth.hasLoginState()
      const uid = state?.user?.uid
      if (uid) {
        // 保留本地 uuid 等字段，仅补充云端 uid（created_by 保持本地 UUID 不变）
        const user = (await this.local.getUser<Record<string, unknown>>()) ?? {}
        await this.local.setUser({ ...user, cloudbase_uid: uid })
      }
    } catch (e) {
      console.warn('[cloud] SDK 加载或匿名登录失败（离线或环境未开通），稍后重试', e)
    }
    this.registerSyncTriggers()
    await this.pullMerge().catch((e) => console.warn('[cloud] 首次 pull 失败', e))
    await this.flushQueue().catch(() => {})
  }

  /** 注册网络恢复 / 页面回前台的同步触发器 */
  private registerSyncTriggers(): void {
    // 网络恢复时同步
    window.addEventListener('online', () => {
      this.pullMerge().catch(() => {})
      this.flushQueue().catch(() => {})
    })
    // 页面回到前台时同步（其他设备可能改过数据）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.pullMerge().catch(() => {})
        this.flushQueue().catch(() => {})
      }
    })
  }

  /** 分页拉取云端本用户全部记录（安全规则按 auth.uid 自动隔离） */
  private async fetchAllFromCloud(): Promise<AssessmentRecord[]> {
    if (!this.db) return []
    const all: AssessmentRecord[] = []
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const res = await this.db.collection(COLLECTION).skip(skip).limit(PAGE_SIZE).get()
      const batch = res.data ?? []
      for (const doc of batch) {
        const { _id, ...rest } = doc
        // 云端 _id 即记录 id（写入时指定）；兼容旧数据回退到文档内 id 字段
        all.push({ ...(rest as unknown as AssessmentRecord), id: String(_id ?? rest.id) })
      }
      if (batch.length < PAGE_SIZE) break
    }
    return all
  }

  /** pull：拉云端 → 与本地合并 → 批量写回本地存储 */
  private async pullMerge(): Promise<void> {
    const cloudRecords = await this.fetchAllFromCloud()
    const localRecords = await this.local.listRecords()
    const merged = mergeRecords(localRecords, cloudRecords)
    localStorage.setItem(KEYS.records, JSON.stringify(merged))
  }

  private readQueue(): SyncOp[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY)
      return raw ? (JSON.parse(raw) as SyncOp[]) : []
    } catch {
      return []
    }
  }

  private writeQueue(queue: SyncOp[]): void {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  }

  private enqueue(op: SyncOp): void {
    const queue = this.readQueue()
    queue.push(op)
    this.writeQueue(queue)
  }

  /** flush：按序推送队列；任一失败即停止并保留剩余，待下次触发 */
  private async flushQueue(): Promise<void> {
    if (this.flushing || !this.db) return
    this.flushing = true
    try {
      const queue = this.readQueue()
      while (queue.length > 0) {
        const item = queue[0]
        try {
          if (item.op === 'upsert' && item.payload) {
            // doc(id).set：存在则更新、不存在则插入（upsert 语义）
            await this.db.collection(COLLECTION).doc(item.id).set({ ...item.payload })
          } else if (item.op === 'remove') {
            await this.db.collection(COLLECTION).doc(item.id).remove()
          }
          queue.shift()
          this.writeQueue(queue)
        } catch (e) {
          console.warn('[cloud] push 失败，保留队列待下次同步', e)
          break
        }
      }
    } finally {
      this.flushing = false
    }
  }

  // ============ StorageAdapter 接口（读走本地，写落本地 + 入队） ============

  async listRecords(): Promise<AssessmentRecord[]> {
    return this.local.listRecords()
  }

  async getRecord(id: string): Promise<AssessmentRecord | null> {
    return this.local.getRecord(id)
  }

  async saveRecord(record: AssessmentRecord): Promise<void> {
    await this.local.saveRecord(record)
    this.enqueue({ op: 'upsert', id: record.id, payload: record })
    this.ready.then(() => this.flushQueue()).catch(() => {})
  }

  async deleteRecord(id: string): Promise<void> {
    await this.local.deleteRecord(id)
    this.enqueue({ op: 'remove', id })
    this.ready.then(() => this.flushQueue()).catch(() => {})
  }

  async getDraft(): Promise<AssessmentDraft | null> {
    return this.local.getDraft()
  }

  async saveDraft(draft: AssessmentDraft): Promise<void> {
    return this.local.saveDraft(draft)
  }

  async clearDraft(): Promise<void> {
    return this.local.clearDraft()
  }

  async getUser<T = UserInfo>(): Promise<T | null> {
    return this.local.getUser<T>()
  }

  async setUser<T = UserInfo>(user: T): Promise<void> {
    return this.local.setUser(user)
  }

  async clearUser(): Promise<void> {
    return this.local.clearUser()
  }

  async getConfig<T = unknown>(key: string): Promise<T | null> {
    return this.local.getConfig<T>(key)
  }

  async setConfig<T = unknown>(key: string, value: T): Promise<void> {
    return this.local.setConfig(key, value)
  }
}
