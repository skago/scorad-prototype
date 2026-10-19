/**
 * 严重度分层
 * - 使用精确值比较，禁止先取整
 */
import type { Severity } from './types'

export const SCORAD_ENGINE_VERSION = 'SCORAD_CLASSIC_BASE_1.0'
export const SEVERITY_VERSION = 'SCORAD_LT25_25TO50_GT50_1.0'
export const OSCORAD_MODE = 'BASE_0_83_NO_BONUS'

/** 严重度分层阈值 */
export const SEVERITY_THRESHOLDS = {
  mildUpper: 25, // < 25 → 轻度
  moderateUpper: 50 // 25–50 → 中度；> 50 → 重度
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  mild: '轻度 Mild',
  moderate: '中度 Moderate',
  severe: '重度 Severe'
}

export function classifySeverity(scorad: number): Severity {
  if (scorad < SEVERITY_THRESHOLDS.mildUpper) return 'mild'
  if (scorad <= SEVERITY_THRESHOLDS.moderateUpper) return 'moderate'
  return 'severe'
}
