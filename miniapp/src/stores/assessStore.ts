/**
 * 小程序端评估状态管理
 * 模块级单例 + useSyncExternalStore 订阅，跨页面持久化
 * 实时合计（extent_a / intensity_b / subjective_c）直接派生自 state
 */
import { useSyncExternalStore } from 'react'
import { calculate, ADULT_BODY_PARTS, getBsaByAge, type ScoradResult, type BodyPart } from '@/engine'
import { getStorage } from '@/storage'
import type { AssessmentRecord } from '@/storage/types'
import { generateUUID, getOrCreateUserId } from '@/utils/uuid'

/** 6 项客观体征 */
interface BItem {
  key: keyof AssessState
  label: string
  en: string
  special?: string
}

const B_ITEMS: BItem[] = [
  { key: 'erythema', label: '红斑', en: 'Erythema' },
  { key: 'edema_papulation', label: '水肿/丘疹', en: 'Oedema/Papulation' },
  { key: 'oozing_crusting', label: '渗出/结痂', en: 'Oozing/Crusting' },
  { key: 'excoriation', label: '抓痕/表皮剥脱', en: 'Excoriation' },
  { key: 'lichenification', label: '苔藓化', en: 'Lichenification' },
  { key: 'dryness', label: '干燥', en: 'Dryness', special: '应在非炎症性皮肤区域评价' }
]

const SCORE_LABELS = ['无', '轻', '中', '重']

interface AssessState {
  // Step1
  assessed_at: string
  patient_name: string
  patient_gender: string
  patient_age: string
  patient_id: string
  visit_week: string
  // 科研字段（选填）
  research_mode: boolean
  research_project_id: string
  center_id: string
  subject_screening_no: string
  evaluator_id: string
  evaluator_qualification: string
  blinding: string
  data_source: string
  // Step2
  bsa_mode: string
  bsa_mode_override: 'auto' | 'rule_of_nines' | 'lund_browder'
  head_neck: number
  upper_limbs: number
  trunk: number
  lower_limbs: number
  perineum: number
  // Step3
  erythema: number | null
  edema_papulation: number | null
  oozing_crusting: number | null
  excoriation: number | null
  lichenification: number | null
  dryness: number | null
  // Step4
  pruritus: number
  sleep_loss: number
  // 结果
  result: ScoradResult | null
}

function createInitialState(): AssessState {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    assessed_at: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
    patient_name: '',
    patient_gender: 'male',
    patient_age: '',
    patient_id: '',
    visit_week: '',
    research_mode: false,
    research_project_id: '',
    center_id: '',
    subject_screening_no: '',
    evaluator_id: '',
    evaluator_qualification: '',
    blinding: '',
    data_source: '',
    bsa_mode: 'rule_of_nines',
    bsa_mode_override: 'auto',
    head_neck: 0,
    upper_limbs: 0,
    trunk: 0,
    lower_limbs: 0,
    perineum: 0,
    erythema: null,
    edema_papulation: null,
    oozing_crusting: null,
    excoriation: null,
    lichenification: null,
    dryness: null,
    pruritus: 0,
    sleep_loss: 0,
    result: null
  }
}

let state: AssessState = createInitialState()
const listeners = new Set<() => void>()

function setState(patch: Partial<AssessState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot() {
  return state
}

/** 根据当前覆盖模式与年龄计算身体部位列表 */
function getBodyParts(): BodyPart[] {
  if (state.bsa_mode_override === 'rule_of_nines') return ADULT_BODY_PARTS
  if (state.bsa_mode_override === 'lund_browder') {
    const age = parseInt(state.patient_age, 10)
    return Number.isFinite(age) ? getBsaByAge(age) : getBsaByAge(5)
  }
  const age = parseInt(state.patient_age, 10)
  return Number.isFinite(age) ? getBsaByAge(age) : ADULT_BODY_PARTS
}

/** 当前生效的体表面积表模式 */
function getBsaMode(): string {
  if (state.bsa_mode_override !== 'auto') return state.bsa_mode_override
  const age = parseInt(state.patient_age, 10)
  return Number.isFinite(age) && age < 14 ? 'lund_browder' : 'rule_of_nines'
}

/** 切换体表面积表 */
function setBsaMode(mode: 'auto' | 'rule_of_nines' | 'lund_browder') {
  setState({ bsa_mode_override: mode })
}

/** 皮损面积 A 合计 */
function getExtentA(): number {
  return Math.round((state.head_neck + state.upper_limbs + state.trunk + state.lower_limbs + state.perineum) * 10) / 10
}

/** 客观强度 B 合计（仅统计已评估项） */
function getIntensityB(): number {
  return (
    (state.erythema ?? 0) +
    (state.edema_papulation ?? 0) +
    (state.oozing_crusting ?? 0) +
    (state.excoriation ?? 0) +
    (state.lichenification ?? 0) +
    (state.dryness ?? 0)
  )
}

/** 主观症状 C 合计 */
function getSubjectiveC(): number {
  return Math.round((state.pruritus + state.sleep_loss) * 10) / 10
}

// ============ 校验 ============
function validateStep1(): string | null {
  if (!state.assessed_at) return '请填写评估时间'
  return null
}

function validateStep2(): string | null {
  if (getExtentA() <= 0) return '请填写至少一个部位的皮损面积'
  for (const part of getBodyParts()) {
    const val = (state as unknown as Record<string, number>)[part.key]
    if (val < 0 || val > part.max) {
      return `${part.label} 应在 0–${part.max}% 之间`
    }
  }
  return null
}

function validateStep3(): string | null {
  const missing = B_ITEMS.filter((item) => (state[item.key] as number | null) === null)
  if (missing.length > 0) {
    return `请完成以下体征评估：${missing.map((m) => m.label).join('、')}`
  }
  return null
}

// ============ 方法 ============
function doCalculate(): ScoradResult {
  const result = calculate({
    extent_a: getExtentA(),
    erythema: state.erythema,
    edema_papulation: state.edema_papulation,
    oozing_crusting: state.oozing_crusting,
    excoriation: state.excoriation,
    lichenification: state.lichenification,
    dryness: state.dryness,
    pruritus: state.pruritus,
    sleep_loss: state.sleep_loss
  })
  setState({ result })
  return result
}

async function saveRecord(): Promise<void> {
  if (!state.result) throw new Error('尚未计算结果')
  const now = new Date().toISOString()
  const record: AssessmentRecord = {
    ...state.result,
    id: generateUUID(),
    assessed_at: state.assessed_at,
    created_at: now,
    updated_at: now,
    created_by: await getOrCreateUserId(),
    patient_name: state.patient_name,
    patient_gender: state.patient_gender,
    patient_age: state.patient_age,
    patient_id: state.patient_id,
    visit_week: state.visit_week,
    bsa_mode: getBsaMode(),
    head_neck: state.head_neck,
    upper_limbs: state.upper_limbs,
    trunk: state.trunk,
    lower_limbs: state.lower_limbs,
    perineum: state.perineum,
    ...(state.research_mode ? {
      research_project_id: state.research_project_id,
      center_id: state.center_id,
      subject_screening_no: state.subject_screening_no,
      evaluator_id: state.evaluator_id,
      evaluator_qualification: state.evaluator_qualification,
      blinding: state.blinding,
      data_source: state.data_source
    } : {})
  }
  const storage = getStorage()
  await storage.saveRecord(record)
  await storage.clearDraft()
}

async function saveDraft(): Promise<void> {
  const draft: Record<string, unknown> = { ...state }
  delete draft.result
  const storage = getStorage()
  await storage.saveDraft(draft as never)
}

/** 草稿白名单字段（防旧版草稿污染 state） */
const DRAFT_KEYS: (keyof AssessState)[] = [
  'assessed_at', 'patient_name', 'patient_gender', 'patient_age', 'patient_id', 'visit_week',
  'research_mode', 'research_project_id', 'center_id', 'subject_screening_no', 'evaluator_id',
  'evaluator_qualification', 'blinding', 'data_source',
  'bsa_mode', 'bsa_mode_override', 'head_neck', 'upper_limbs', 'trunk', 'lower_limbs', 'perineum',
  'erythema', 'edema_papulation', 'oozing_crusting', 'excoriation', 'lichenification', 'dryness',
  'pruritus', 'sleep_loss'
]

async function loadDraft(): Promise<boolean> {
  const storage = getStorage()
  const draft = await storage.getDraft()
  if (!draft) return false
  // 字段白名单过滤：仅恢复已知字段，忽略草稿中的多余键
  const patch: Partial<AssessState> = {}
  for (const k of DRAFT_KEYS) {
    const v = (draft as Record<string, unknown>)[k]
    if (v !== undefined) (patch as Record<string, unknown>)[k] = v
  }
  setState(patch)
  return true
}

/** 从历史记录加载（全字段回写 state，result 直接复用记录值） */
function loadRecord(r: AssessmentRecord): void {
  setState({
    assessed_at: r.assessed_at,
    patient_name: r.patient_name || '',
    patient_gender: r.patient_gender || 'male',
    patient_age: r.patient_age || '',
    patient_id: r.patient_id || '',
    visit_week: r.visit_week || '',
    research_mode: !!(
      r.research_project_id || r.center_id || r.subject_screening_no ||
      r.evaluator_id || r.evaluator_qualification || r.blinding || r.data_source
    ),
    research_project_id: r.research_project_id || '',
    center_id: r.center_id || '',
    subject_screening_no: r.subject_screening_no || '',
    evaluator_id: r.evaluator_id || '',
    evaluator_qualification: r.evaluator_qualification || '',
    blinding: r.blinding || '',
    data_source: r.data_source || '',
    bsa_mode_override: r.bsa_mode === 'lund_browder' ? 'lund_browder' : 'auto',
    head_neck: r.head_neck ?? 0,
    upper_limbs: r.upper_limbs ?? 0,
    trunk: r.trunk ?? 0,
    lower_limbs: r.lower_limbs ?? 0,
    perineum: r.perineum ?? 0,
    erythema: r.erythema ?? null,
    edema_papulation: r.edema_papulation ?? null,
    oozing_crusting: r.oozing_crusting ?? null,
    excoriation: r.excoriation ?? null,
    lichenification: r.lichenification ?? null,
    dryness: r.dryness ?? null,
    pruritus: r.pruritus ?? 0,
    sleep_loss: r.sleep_loss ?? 0,
    result: {
      extent_a: r.extent_a,
      intensity_b: r.intensity_b,
      subjective_c: r.subjective_c,
      scorad: r.scorad,
      objective_scorad: r.objective_scorad,
      scorad_severity: r.scorad_severity,
      extent_weighted: r.extent_weighted,
      intensity_weighted: r.intensity_weighted,
      erythema: r.erythema ?? 0,
      edema_papulation: r.edema_papulation ?? 0,
      oozing_crusting: r.oozing_crusting ?? 0,
      excoriation: r.excoriation ?? 0,
      lichenification: r.lichenification ?? 0,
      dryness: r.dryness ?? 0,
      pruritus: r.pruritus ?? 0,
      sleep_loss: r.sleep_loss ?? 0,
      scoring_algorithm_version: r.scoring_algorithm_version,
      severity_classification_version: r.severity_classification_version,
      objective_scorad_mode: r.objective_scorad_mode
    }
  })
}

function reset(): void {
  state = createInitialState()
  listeners.forEach((l) => l())
}

/** React hook：订阅 store 变化并返回状态 + 方法 */
export function useAssessStore() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return {
    state: s,
    set: setState,
    bodyParts: getBodyParts(),
    bsa_mode: getBsaMode(),
    B_ITEMS,
    SCORE_LABELS,
    extent_a: getExtentA(),
    intensity_b: getIntensityB(),
    subjective_c: getSubjectiveC(),
    validateStep1,
    validateStep2,
    validateStep3,
    doCalculate,
    saveRecord,
    saveDraft,
    loadDraft,
    loadRecord,
    reset,
    setBsaMode
  }
}
