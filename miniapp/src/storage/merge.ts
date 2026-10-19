/**
 * 云端-本地记录合并算法（纯函数，无运行时依赖，两端逐字一致）
 * 规则：
 * - 按 id upsert
 * - 同 id 冲突：updated_at（ISO 字典序即时间序）大者胜；相等保留本地（稳定）
 * - created_at / created_by 以首次创建为准（取两方 created_at 较小者的值）
 * 已知局限：云端删除无 tombstone，本地已留存记录会在下次 push 时复活（单设备场景可接受）
 */
import type { AssessmentRecord } from './types'

export function mergeRecords(local: AssessmentRecord[], remote: AssessmentRecord[]): AssessmentRecord[] {
  const map = new Map<string, AssessmentRecord>()
  for (const r of local) map.set(r.id, r)
  for (const r of remote) {
    const existing = map.get(r.id)
    if (!existing) {
      map.set(r.id, r)
      continue
    }
    const winner = r.updated_at > existing.updated_at ? r : existing
    const first = existing.created_at <= r.created_at ? existing : r
    map.set(r.id, { ...winner, created_at: first.created_at, created_by: first.created_by })
  }
  return Array.from(map.values())
}
