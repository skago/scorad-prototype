/**
 * 类型定义
 */

/** 评分输入（原始，可能为 string/number/null） */
export interface ScoradInput {
  extent_a: number | string | null
  erythema: number | string | null
  edema_papulation: number | string | null
  oozing_crusting: number | string | null
  excoriation: number | string | null
  lichenification: number | string | null
  dryness: number | string | null
  pruritus: number | string | null
  sleep_loss: number | string | null
}

/** 标准化后的输入（数值型） */
export interface NormalizedInput {
  extent_a: number
  erythema: number
  edema_papulation: number
  oozing_crusting: number
  excoriation: number
  lichenification: number
  dryness: number
  pruritus: number
  sleep_loss: number
}

/** 严重度等级 */
export type Severity = 'mild' | 'moderate' | 'severe'

/** 评分结果 */
export interface ScoradResult {
  // 原始输入
  extent_a: number
  erythema: number
  edema_papulation: number
  oozing_crusting: number
  excoriation: number
  lichenification: number
  dryness: number
  pruritus: number
  sleep_loss: number
  // 派生
  intensity_b: number
  subjective_c: number
  extent_weighted: number
  intensity_weighted: number
  scorad: number
  objective_scorad: number
  scorad_severity: Severity
  // 版本
  scoring_algorithm_version: string
  severity_classification_version: string
  objective_scorad_mode: string
}

/** 校验错误 */
export class ValidationError extends Error {
  field: string
  constructor(field: string, message: string) {
    super(`${field}: ${message}`)
    this.name = 'ValidationError'
    this.field = field
  }
}
