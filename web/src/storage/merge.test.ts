import { describe, it, expect } from 'vitest'
import { mergeRecords } from './merge'
import type { AssessmentRecord } from './types'

/** 构造一条最小完整记录（合并测试只关心 id / updated_at / created_at / created_by / scorad） */
function makeRecord(overrides: Partial<AssessmentRecord> = {}): AssessmentRecord {
  return {
    id: 'r1',
    assessed_at: '2026-10-17T10:00',
    created_at: '2026-10-17T10:00:00.000Z',
    updated_at: '2026-10-17T10:00:00.000Z',
    created_by: 'user-a',
    patient_name: '张三',
    patient_gender: 'male',
    patient_age: '35',
    patient_id: 'P001',
    visit_week: '第2周',
    bsa_mode: 'rule_of_nines',
    head_neck: 5,
    upper_limbs: 10,
    trunk: 20,
    lower_limbs: 15,
    perineum: 0,
    extent_a: 50,
    erythema: 2,
    edema_papulation: 1,
    oozing_crusting: 1,
    excoriation: 2,
    lichenification: 1,
    dryness: 1,
    intensity_b: 8,
    pruritus: 7,
    sleep_loss: 6,
    subjective_c: 13,
    extent_weighted: 10,
    intensity_weighted: 28,
    scorad: 51,
    objective_scorad: 38,
    scorad_severity: 'severe',
    scoring_algorithm_version: 'v1.0',
    severity_classification_version: 'v1.0',
    objective_scorad_mode: 'standard',
    ...overrides
  }
}

describe('mergeRecords 冲突矩阵', () => {
  it('仅本地有的记录保留', () => {
    const local = makeRecord({ id: 'local-only' })
    const merged = mergeRecords([local], [])
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('local-only')
  })

  it('仅云端有的记录加入本地', () => {
    const remote = makeRecord({ id: 'cloud-only' })
    const merged = mergeRecords([], [remote])
    expect(merged).toHaveLength(1)
    expect(merged[0].id).toBe('cloud-only')
  })

  it('同 id：云端 updated_at 更新 → 数据取云端', () => {
    const local = makeRecord({ scorad: 30, updated_at: '2026-10-17T10:00:00.000Z' })
    const remote = makeRecord({ scorad: 60, updated_at: '2026-10-18T10:00:00.000Z' })
    const merged = mergeRecords([local], [remote])
    expect(merged).toHaveLength(1)
    expect(merged[0].scorad).toBe(60)
  })

  it('同 id：本地 updated_at 更新 → 数据取本地', () => {
    const local = makeRecord({ scorad: 30, updated_at: '2026-10-18T10:00:00.000Z' })
    const remote = makeRecord({ scorad: 60, updated_at: '2026-10-17T10:00:00.000Z' })
    const merged = mergeRecords([local], [remote])
    expect(merged).toHaveLength(1)
    expect(merged[0].scorad).toBe(30)
  })

  it('同 id：updated_at 相等 → 保留本地（稳定，不无意义覆盖）', () => {
    const ts = '2026-10-17T10:00:00.000Z'
    const local = makeRecord({ scorad: 30, updated_at: ts })
    const remote = makeRecord({ scorad: 60, updated_at: ts })
    const merged = mergeRecords([local], [remote])
    expect(merged[0].scorad).toBe(30)
  })

  it('云端赢但本地 created_at 更早 → created_at/created_by 取本地（首次创建为准）', () => {
    const local = makeRecord({
      scorad: 30,
      created_at: '2026-10-01T08:00:00.000Z',
      created_by: 'user-local',
      updated_at: '2026-10-17T10:00:00.000Z'
    })
    const remote = makeRecord({
      scorad: 60,
      created_at: '2026-10-02T08:00:00.000Z',
      created_by: 'user-cloud',
      updated_at: '2026-10-18T10:00:00.000Z'
    })
    const merged = mergeRecords([local], [remote])
    expect(merged[0].scorad).toBe(60) // 数据取云端
    expect(merged[0].created_at).toBe('2026-10-01T08:00:00.000Z') // 审计取更早创建方
    expect(merged[0].created_by).toBe('user-local')
  })

  it('本地赢但云端 created_at 更早 → created_at/created_by 取云端', () => {
    const local = makeRecord({
      scorad: 30,
      created_at: '2026-10-02T08:00:00.000Z',
      created_by: 'user-local',
      updated_at: '2026-10-18T10:00:00.000Z'
    })
    const remote = makeRecord({
      scorad: 60,
      created_at: '2026-10-01T08:00:00.000Z',
      created_by: 'user-cloud',
      updated_at: '2026-10-17T10:00:00.000Z'
    })
    const merged = mergeRecords([local], [remote])
    expect(merged[0].scorad).toBe(30) // 数据取本地
    expect(merged[0].created_at).toBe('2026-10-01T08:00:00.000Z')
    expect(merged[0].created_by).toBe('user-cloud')
  })

  it('多条混合：本地独有 + 云端独有 + 冲突各按规则合并', () => {
    const locals = [
      makeRecord({ id: 'a', scorad: 10, updated_at: '2026-10-17T10:00:00.000Z' }),
      makeRecord({ id: 'b', scorad: 20, updated_at: '2026-10-18T10:00:00.000Z' })
    ]
    const remotes = [
      makeRecord({ id: 'b', scorad: 99, updated_at: '2026-10-17T10:00:00.000Z' }),
      makeRecord({ id: 'c', scorad: 30, updated_at: '2026-10-17T10:00:00.000Z' })
    ]
    const merged = mergeRecords(locals, remotes)
    expect(merged).toHaveLength(3)
    const byId = Object.fromEntries(merged.map((r) => [r.id, r]))
    expect(byId['a'].scorad).toBe(10)
    expect(byId['b'].scorad).toBe(20) // 本地较新
    expect(byId['c'].scorad).toBe(30)
  })

  it('合并结果与输入顺序无关（交换 local/remote 内顺序结果一致）', () => {
    const a = makeRecord({ id: 'a', scorad: 10, updated_at: '2026-10-17T10:00:00.000Z' })
    const bLocal = makeRecord({ id: 'b', scorad: 20, updated_at: '2026-10-18T10:00:00.000Z' })
    const bRemote = makeRecord({ id: 'b', scorad: 99, updated_at: '2026-10-19T10:00:00.000Z' })
    const m1 = mergeRecords([a, bLocal], [bRemote])
    const m2 = mergeRecords([bLocal, a], [bRemote])
    const sort = (list: AssessmentRecord[]) => [...list].sort((x, y) => (x.id < y.id ? -1 : 1))
    expect(sort(m1)).toEqual(sort(m2))
    expect(m1.find((r) => r.id === 'b')?.scorad).toBe(99)
  })
})
