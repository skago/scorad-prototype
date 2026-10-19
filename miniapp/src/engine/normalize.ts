/**
 * 输入校验与标准化
 * - 非法输入抛出 ValidationError，不自动修正
 * - 0 与 null 严格区分：0 = 已评估无体征，null = 未评估
 */
import type { ScoradInput, NormalizedInput } from './types'
import { ValidationError } from './types'

const REQUIRED_INT: Record<string, { min: number; max: number; label: string }> = {
  erythema: { min: 0, max: 3, label: '红斑 B1' },
  edema_papulation: { min: 0, max: 3, label: '水肿/丘疹 B2' },
  oozing_crusting: { min: 0, max: 3, label: '渗出/结痂 B3' },
  excoriation: { min: 0, max: 3, label: '抓痕/表皮剥脱 B4' },
  lichenification: { min: 0, max: 3, label: '苔藓化 B5' },
  dryness: { min: 0, max: 3, label: '干燥 B6' }
}

const DECIMAL_FIELDS: Record<string, { label: string }> = {
  pruritus: { label: '瘙痒' },
  sleep_loss: { label: '睡眠影响' }
}

export function normalizeInput(raw: ScoradInput): NormalizedInput {
  const out: Partial<NormalizedInput> = {}

  // 必填核心字段（整数 0-3）
  for (const [key, rule] of Object.entries(REQUIRED_INT)) {
    const v = (raw as unknown as Record<string, unknown>)[key]
    if (v === null || v === undefined || v === '') {
      throw new ValidationError(key, `${rule.label} 未评估（null）`)
    }
    const n = Number(v)
    if (!Number.isInteger(n)) {
      throw new ValidationError(key, `${rule.label} 必须为整数`)
    }
    if (n < rule.min || n > rule.max) {
      throw new ValidationError(key, `${rule.label} 必须在 ${rule.min}–${rule.max} 之间`)
    }
    ;(out as Record<string, number>)[key] = n
  }

  // 皮损面积 A：0-100，步长 0.1
  const ea = raw.extent_a
  if (ea === null || ea === undefined || ea === '') {
    throw new ValidationError('extent_a', '皮损面积 A 未评估（null）')
  }
  const eaNum = Number(ea)
  if (Number.isNaN(eaNum)) {
    throw new ValidationError('extent_a', '皮损面积 A 必须为数字')
  }
  if (eaNum < 0 || eaNum > 100) {
    throw new ValidationError('extent_a', '皮损面积 A 必须在 0–100 之间')
  }
  out.extent_a = Math.round(eaNum * 10) / 10

  // 主观症状：0-10，步长 0.1
  for (const [key, rule] of Object.entries(DECIMAL_FIELDS)) {
    const v = (raw as unknown as Record<string, unknown>)[key]
    if (v === null || v === undefined || v === '') {
      throw new ValidationError(key, `${rule.label} 未评估（null）`)
    }
    const n = Number(v)
    if (Number.isNaN(n)) {
      throw new ValidationError(key, `${rule.label} 必须为数字`)
    }
    if (n < 0 || n > 10) {
      throw new ValidationError(key, `${rule.label} 必须在 0–10 之间`)
    }
    ;(out as Record<string, number>)[key] = Math.round(n * 10) / 10
  }

  return out as NormalizedInput
}
