/**
 * 云存储适配器（方案 B：微信云开发）
 * 组合模式，内部持有 WxStorageAdapter：
 * - 读永远走本地（启动时后台 pull 合并，不阻塞 UI）
 * - 写先落本地，再入离线队列后台推送云端
 * - 合并：按 id upsert，updated_at 大者胜（见 merge.ts）
 * - 离线队列：sync_queue 存 wx.storage，网络恢复 / onShow 时 flush
 * - 登录：ready 闸门内调 login 云函数拿 OPENID 存 UserInfo.openid；
 *   created_by 保持本地 UUID 不变，云端 _openid 由数据库自动写入做权限隔离
 * - 静默同步：所有云端失败仅 console.warn，绝不影响本地使用
 * - 未配置云环境（ENV_ID 占位符未替换）时完全退化为纯本地行为
 */
import Taro from '@tarojs/taro'
import type { StorageAdapter, AssessmentRecord, AssessmentDraft, UserInfo } from './types'
import { WxStorageAdapter, KEYS } from './WxStorageAdapter'
import { mergeRecords } from './merge'
import { isCloudConfigured } from '@/config/cloud'

const QUEUE_KEY = 'scorad_sync_queue_v1'
const COLLECTION = 'assessment_records'
const PAGE_SIZE = 100

interface SyncOp {
  op: 'upsert' | 'remove'
  id: string
  payload?: AssessmentRecord
}

export class CloudStorageAdapter implements StorageAdapter {
  private local: WxStorageAdapter
  /** 登录 + 首次 pull 的就绪闸门；未配置云环境时立即 resolve 且不注册任何云端行为 */
  private ready: Promise<void>
  private flushing = false

  constructor(local: WxStorageAdapter) {
    this.local = local
    if (isCloudConfigured && Taro.cloud) {
      this.ready = this.init()
    } else {
      this.ready = Promise.resolve()
    }
  }

  // ============ 云端初始化与同步（全部后台静默） ============

  private async init(): Promise<void> {
    try {
      const res = await Taro.cloud!.callFunction({ name: 'login' })
      const openid = (res.result as { openid?: string } | undefined)?.openid
      if (openid) {
        // 保留本地 uuid 等字段，仅补充 openid
        const user = (await this.local.getUser<Record<string, unknown>>()) ?? {}
        await this.local.setUser({ ...user, openid })
      }
    } catch (e) {
      console.warn('[cloud] login 云函数调用失败（离线或未部署），稍后重试', e)
    }
    // 网络恢复时 flush 离线队列
    Taro.onNetworkStatusChange((res) => {
      if (res.isConnected) {
        this.pullMerge().catch(() => {})
        this.flushQueue().catch(() => {})
      }
    })
    // 小程序回到前台时同步一次（其他设备可能改过数据）
    Taro.onAppShow(() => {
      this.pullMerge().catch(() => {})
      this.flushQueue().catch(() => {})
    })
    await this.pullMerge().catch((e) => console.warn('[cloud] 首次 pull 失败', e))
    await this.flushQueue().catch(() => {})
  }

  private db() {
    return Taro.cloud!.database()
  }

  /** 分页拉取云端本用户全部记录（权限「仅创建者可读写」自动按 _openid 过滤） */
  private async fetchAllFromCloud(): Promise<AssessmentRecord[]> {
    const all: AssessmentRecord[] = []
    for (let skip = 0; ; skip += PAGE_SIZE) {
      const res = await this.db().collection(COLLECTION).skip(skip).limit(PAGE_SIZE).get()
      const batch = (res.data as Record<string, unknown>[]) ?? []
      for (const doc of batch) {
        const { _id, _openid, ...rest } = doc
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
    // 批量写回（与 WxStorageAdapter 同一 key）
    Taro.setStorageSync(KEYS.records, JSON.stringify(merged))
  }

  private readQueue(): SyncOp[] {
    try {
      const raw = Taro.getStorageSync(QUEUE_KEY)
      return raw ? (JSON.parse(raw) as SyncOp[]) : []
    } catch {
      return []
    }
  }

  private writeQueue(queue: SyncOp[]): void {
    Taro.setStorageSync(QUEUE_KEY, JSON.stringify(queue))
  }

  private enqueue(op: SyncOp): void {
    const queue = this.readQueue()
    queue.push(op)
    this.writeQueue(queue)
  }

  /** flush：按序推送队列；任一失败即停止并保留剩余，待下次触发 */
  private async flushQueue(): Promise<void> {
    if (this.flushing) return
    this.flushing = true
    try {
      const queue = this.readQueue()
      while (queue.length > 0) {
        const item = queue[0]
        try {
          if (item.op === 'upsert' && item.payload) {
            // doc(id).set：存在则更新、不存在则插入（upsert 语义）
            await this.db().collection(COLLECTION).doc(item.id).set({ data: { ...item.payload } })
          } else if (item.op === 'remove') {
            // Taro 类型定义要求 options 必传（微信原生 API 无参）
            await this.db().collection(COLLECTION).doc(item.id).remove({})
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
