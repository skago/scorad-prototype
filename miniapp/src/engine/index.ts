/**
 * SCORAD 评分引擎（对外 API）
 * 与 UI 完全解耦的纯计算模块，Web / 小程序 / 后端共用
 */
export { calculate } from './calculate'
export { normalizeInput } from './normalize'
export { classifySeverity, SEVERITY_LABEL, SEVERITY_THRESHOLDS, SCORAD_ENGINE_VERSION, SEVERITY_VERSION, OSCORAD_MODE } from './severity'
export { ADULT_BODY_PARTS, LUND_BROWDER_TABLE, getBsaByAge } from './bsa'
export type { BodyPart, BsaMode } from './bsa'
export type { ScoradInput, NormalizedInput, ScoradResult, Severity } from './types'
export { ValidationError } from './types'
