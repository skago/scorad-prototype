import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { calculate, ValidationError, ADULT_BODY_PARTS, getBsaByAge } from '@/engine'
import type { ScoradResult } from '@/engine'
import { getStorage } from '@/storage'
import type { AssessmentRecord, AssessmentDraft } from '@/storage'
import { generateUUID, getOrCreateUserId } from '@/utils/uuid'

/** B 项体征定义 */
interface BItem {
  key: string
  label: string
  en: string
  special?: string
}
export const B_ITEMS: BItem[] = [
  { key: 'erythema', label: '红斑', en: 'Erythema' },
  { key: 'edema_papulation', label: '水肿/丘疹', en: 'Oedema/Papulation' },
  { key: 'oozing_crusting', label: '渗出/结痂', en: 'Oozing/Crusting' },
  { key: 'excoriation', label: '抓痕/表皮剥脱', en: 'Excoriation' },
  { key: 'lichenification', label: '苔藓化', en: 'Lichenification' },
  { key: 'dryness', label: '干燥', en: 'Dryness', special: '应在非炎症性皮肤区域评价' }
]

const SCORE_LABELS = ['无', '轻', '中', '重']

/** 科研字段列表 */
export const RESEARCH_FIELDS = [
  'research_project_id',
  'center_id',
  'subject_screening_no',
  'evaluator_id',
  'evaluator_qualification',
  'blinding',
  'data_source'
] as const

/**
 * 评估表单 Store（跨步骤共享状态）
 */
export const useAssessStore = defineStore('assess', () => {
  const storage = getStorage()

  // ============ 表单状态 ============
  const assessed_at = ref('')
  const patient_name = ref('')
  const patient_gender = ref('')
  const patient_age = ref('')
  const patient_id = ref('')
  const visit_week = ref('')

  // 科研字段
  const research_project_id = ref('')
  const center_id = ref('')
  const subject_screening_no = ref('')
  const evaluator_id = ref('')
  const evaluator_qualification = ref('')
  const blinding = ref('')
  const data_source = ref('')

  // 皮损面积（各部位）
  const head_neck = ref(0)
  const upper_limbs = ref(0)
  const trunk = ref(0)
  const lower_limbs = ref(0)
  const perineum = ref(0)

  // B 项体征（null = 未评估）
  const erythema = ref<number | null>(null)
  const edema_papulation = ref<number | null>(null)
  const oozing_crusting = ref<number | null>(null)
  const excoriation = ref<number | null>(null)
  const lichenification = ref<number | null>(null)
  const dryness = ref<number | null>(null)

  // C 项主观症状
  const pruritus = ref(0)
  const sleep_loss = ref(0)

  // 计算结果
  const result = ref<ScoradResult | null>(null)

  // 科研模式开关
  const researchMode = ref(false)

  // 体表面积表覆盖：'auto' 按年龄自动，'rule_of_nines' 强制成人，'lund_browder' 强制儿童
  const bsaModeOverride = ref<'auto' | 'rule_of_nines' | 'lund_browder'>('auto')

  // ============ 派生 ============
  const bodyParts = computed(() => {
    if (bsaModeOverride.value === 'rule_of_nines') return ADULT_BODY_PARTS
    if (bsaModeOverride.value === 'lund_browder') {
      const age = parseInt(patient_age.value, 10)
      return Number.isFinite(age) ? getBsaByAge(age) : getBsaByAge(5)
    }
    const age = parseInt(patient_age.value, 10)
    return Number.isFinite(age) ? getBsaByAge(age) : ADULT_BODY_PARTS
  })

  const bsa_mode = computed(() => {
    if (bsaModeOverride.value !== 'auto') return bsaModeOverride.value
    const age = parseInt(patient_age.value, 10)
    return Number.isFinite(age) && age < 14 ? 'lund_browder' : 'rule_of_nines'
  })

  function setBsaMode(mode: 'auto' | 'rule_of_nines' | 'lund_browder') {
    bsaModeOverride.value = mode
  }

  const extent_a = computed(() => {
    const total =
      Number(head_neck.value) +
      Number(upper_limbs.value) +
      Number(trunk.value) +
      Number(lower_limbs.value) +
      Number(perineum.value)
    return Math.round(total * 10) / 10
  })

  const intensity_b = computed(() =>
    [erythema, edema_papulation, oozing_crusting, excoriation, lichenification, dryness]
      .map((r) => r.value)
      .filter((v): v is number => v !== null)
      .reduce((s, v) => s + v, 0)
  )

  const subjective_c = computed(() =>
    Math.round((Number(pruritus.value) + Number(sleep_loss.value)) * 10) / 10
  )

  // ============ 校验 ============
  function validateStep1(): string | null {
    if (!assessed_at.value) return '请填写评估时间'
    return null
  }

  function validateStep2(): string | null {
    for (const part of bodyParts.value) {
      const val = (formValues as Record<string, number>)[part.key]
      if (val === undefined || val === null || Number.isNaN(val)) {
        return `请填写「${part.label}」百分比`
      }
      if (val < 0 || val > part.max) {
        return `「${part.label}」必须在 0–${part.max} 之间`
      }
    }
    return null
  }

  function validateStep3(): string | null {
    for (const item of B_ITEMS) {
      const v = (formValues as Record<string, number | null>)[item.key]
      if (v === null || v === undefined) {
        return `请完成「${item.label}」评分`
      }
    }
    return null
  }

  // 便捷对象（供校验与收集使用）
  const formValues = {
    get head_neck() { return head_neck.value },
    get upper_limbs() { return upper_limbs.value },
    get trunk() { return trunk.value },
    get lower_limbs() { return lower_limbs.value },
    get perineum() { return perineum.value },
    get erythema() { return erythema.value },
    get edema_papulation() { return edema_papulation.value },
    get oozing_crusting() { return oozing_crusting.value },
    get excoriation() { return excoriation.value },
    get lichenification() { return lichenification.value },
    get dryness() { return dryness.value }
  }

  // ============ 计算 ============
  function doCalculate(): ScoradResult {
    const res = calculate({
      extent_a: extent_a.value,
      erythema: erythema.value,
      edema_papulation: edema_papulation.value,
      oozing_crusting: oozing_crusting.value,
      excoriation: excoriation.value,
      lichenification: lichenification.value,
      dryness: dryness.value,
      pruritus: pruritus.value,
      sleep_loss: sleep_loss.value
    })
    result.value = res
    return res
  }

  // ============ 保存 ============
  async function saveRecord(): Promise<void> {
    if (!result.value) return
    const now = new Date().toISOString()
    const record: AssessmentRecord = {
      ...result.value,
      id: generateUUID(),
      assessed_at: assessed_at.value,
      created_at: now,
      updated_at: now,
      created_by: await getOrCreateUserId(),
      patient_name: patient_name.value,
      patient_gender: patient_gender.value,
      patient_age: patient_age.value,
      patient_id: patient_id.value,
      visit_week: visit_week.value,
      research_project_id: research_project_id.value || undefined,
      center_id: center_id.value || undefined,
      subject_screening_no: subject_screening_no.value || undefined,
      evaluator_id: evaluator_id.value || undefined,
      evaluator_qualification: evaluator_qualification.value || undefined,
      blinding: blinding.value || undefined,
      data_source: data_source.value || undefined,
      bsa_mode: bsa_mode.value,
      head_neck: head_neck.value,
      upper_limbs: upper_limbs.value,
      trunk: trunk.value,
      lower_limbs: lower_limbs.value,
      perineum: perineum.value
    }
    await storage.saveRecord(record)
    await storage.clearDraft()
  }

  // ============ 草稿 ============
  async function saveDraft() {
    const draft: AssessmentDraft = {
      assessed_at: assessed_at.value,
      patient_name: patient_name.value,
      patient_gender: patient_gender.value,
      patient_age: patient_age.value,
      patient_id: patient_id.value,
      visit_week: visit_week.value,
      research_project_id: research_project_id.value,
      center_id: center_id.value,
      subject_screening_no: subject_screening_no.value,
      evaluator_id: evaluator_id.value,
      evaluator_qualification: evaluator_qualification.value,
      blinding: blinding.value,
      data_source: data_source.value,
      head_neck: head_neck.value,
      upper_limbs: upper_limbs.value,
      trunk: trunk.value,
      lower_limbs: lower_limbs.value,
      perineum: perineum.value,
      erythema: erythema.value ?? undefined,
      edema_papulation: edema_papulation.value ?? undefined,
      oozing_crusting: oozing_crusting.value ?? undefined,
      excoriation: excoriation.value ?? undefined,
      lichenification: lichenification.value ?? undefined,
      dryness: dryness.value ?? undefined,
      pruritus: pruritus.value,
      sleep_loss: sleep_loss.value
    }
    await storage.saveDraft(draft)
  }

  async function loadDraft(): Promise<boolean> {
    const draft = await storage.getDraft()
    if (!draft) return false
    if (draft.assessed_at) assessed_at.value = draft.assessed_at
    if (draft.patient_name) patient_name.value = draft.patient_name
    if (draft.patient_gender) patient_gender.value = draft.patient_gender
    if (draft.patient_age) patient_age.value = String(draft.patient_age)
    if (draft.patient_id) patient_id.value = draft.patient_id
    if (draft.visit_week) visit_week.value = String(draft.visit_week)
    if (draft.research_project_id) research_project_id.value = draft.research_project_id
    if (draft.center_id) center_id.value = draft.center_id
    if (draft.subject_screening_no) subject_screening_no.value = draft.subject_screening_no
    if (draft.evaluator_id) evaluator_id.value = draft.evaluator_id
    if (draft.evaluator_qualification) evaluator_qualification.value = draft.evaluator_qualification
    if (draft.blinding) blinding.value = draft.blinding
    if (draft.data_source) data_source.value = draft.data_source
    if (draft.head_neck !== undefined) head_neck.value = draft.head_neck
    if (draft.upper_limbs !== undefined) upper_limbs.value = draft.upper_limbs
    if (draft.trunk !== undefined) trunk.value = draft.trunk
    if (draft.lower_limbs !== undefined) lower_limbs.value = draft.lower_limbs
    if (draft.perineum !== undefined) perineum.value = draft.perineum
    if (draft.erythema !== undefined) erythema.value = draft.erythema
    if (draft.edema_papulation !== undefined) edema_papulation.value = draft.edema_papulation
    if (draft.oozing_crusting !== undefined) oozing_crusting.value = draft.oozing_crusting
    if (draft.excoriation !== undefined) excoriation.value = draft.excoriation
    if (draft.lichenification !== undefined) lichenification.value = draft.lichenification
    if (draft.dryness !== undefined) dryness.value = draft.dryness
    if (draft.pruritus !== undefined) pruritus.value = draft.pruritus
    if (draft.sleep_loss !== undefined) sleep_loss.value = draft.sleep_loss
    return true
  }

  // ============ 重置 ============
  function reset() {
    assessed_at.value = ''
    patient_name.value = ''
    patient_gender.value = ''
    patient_age.value = ''
    patient_id.value = ''
    visit_week.value = ''
    research_project_id.value = ''
    center_id.value = ''
    subject_screening_no.value = ''
    evaluator_id.value = ''
    evaluator_qualification.value = ''
    blinding.value = ''
    data_source.value = ''
    head_neck.value = 0
    upper_limbs.value = 0
    trunk.value = 0
    lower_limbs.value = 0
    perineum.value = 0
    erythema.value = null
    edema_papulation.value = null
    oozing_crusting.value = null
    excoriation.value = null
    lichenification.value = null
    dryness.value = null
    pruritus.value = 0
    sleep_loss.value = 0
    result.value = null
    bsaModeOverride.value = 'auto'
  }

  // ============ 从历史记录加载 ============
  function loadRecord(r: AssessmentRecord) {
    assessed_at.value = r.assessed_at
    patient_name.value = r.patient_name || ''
    patient_gender.value = r.patient_gender || ''
    patient_age.value = r.patient_age || ''
    patient_id.value = r.patient_id || ''
    visit_week.value = r.visit_week || ''
    research_project_id.value = r.research_project_id || ''
    center_id.value = r.center_id || ''
    subject_screening_no.value = r.subject_screening_no || ''
    evaluator_id.value = r.evaluator_id || ''
    evaluator_qualification.value = r.evaluator_qualification || ''
    blinding.value = r.blinding || ''
    data_source.value = r.data_source || ''
    head_neck.value = r.head_neck ?? 0
    upper_limbs.value = r.upper_limbs ?? 0
    trunk.value = r.trunk ?? 0
    lower_limbs.value = r.lower_limbs ?? 0
    perineum.value = r.perineum ?? 0
    erythema.value = r.erythema ?? null
    edema_papulation.value = r.edema_papulation ?? null
    oozing_crusting.value = r.oozing_crusting ?? null
    excoriation.value = r.excoriation ?? null
    lichenification.value = r.lichenification ?? null
    dryness.value = r.dryness ?? null
    pruritus.value = r.pruritus ?? 0
    sleep_loss.value = r.sleep_loss ?? 0
    bsaModeOverride.value = r.bsa_mode === 'lund_browder' ? 'lund_browder' : 'auto'
    // 直接复用记录中的计算结果（无需重算）
    result.value = {
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
  }

  // 默认评估时间 = 当前本地时间
  function setDefaultAssessedAt() {
    if (!assessed_at.value) {
      const now = new Date()
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
      assessed_at.value = now.toISOString().slice(0, 16)
    }
  }

  return {
    // 状态
    assessed_at, patient_name, patient_gender, patient_age, patient_id, visit_week,
    research_project_id, center_id, subject_screening_no, evaluator_id,
    evaluator_qualification, blinding, data_source,
    head_neck, upper_limbs, trunk, lower_limbs, perineum,
    erythema, edema_papulation, oozing_crusting, excoriation, lichenification, dryness,
    pruritus, sleep_loss, result, researchMode, bsaModeOverride,
    // 派生
    bodyParts, bsa_mode, extent_a, intensity_b, subjective_c,
    // 常量
    B_ITEMS, SCORE_LABELS, RESEARCH_FIELDS,
    // 方法
    validateStep1, validateStep2, validateStep3,
    doCalculate, saveRecord, saveDraft, loadDraft, reset, setDefaultAssessedAt,
    setBsaMode, loadRecord
  }
})

export { ValidationError }
