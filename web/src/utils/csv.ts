/**
 * CSV 导出工具（UTF-8 BOM，兼容 Excel 中文）
 */
import type { AssessmentRecord } from '@/storage'

const CSV_HEADERS = [
  '评估时间', '患者姓名', '性别', '年龄', '患者编号', '就诊周次',
  '研究项目编号', '中心编号', '受试者筛选号', '评估者ID', '评估者资质',
  '盲法标记', '数据来源', '体表面积表',
  '头颈部%', '双上肢%', '躯干%', '双下肢%', '会阴%', '皮损面积A',
  '红斑', '水肿/丘疹', '渗出/结痂', '抓痕', '苔藓化', '干燥', '强度B',
  '瘙痒', '睡眠影响', '主观C',
  'A加权', 'B加权', 'SCORAD', 'oSCORAD', '严重度'
]

function escape(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** CSV 导出选项：deidentified 时去掉「患者姓名」列（科研去标识符导出，34 列） */
export interface CsvExportOptions {
  deidentified?: boolean
}

export function recordToCsvRow(r: AssessmentRecord, opts: CsvExportOptions = {}): string {
  const fields: unknown[] = [
    r.assessed_at, r.patient_name, r.patient_gender, r.patient_age, r.patient_id, r.visit_week,
    r.research_project_id, r.center_id, r.subject_screening_no, r.evaluator_id, r.evaluator_qualification,
    r.blinding, r.data_source, r.bsa_mode,
    r.head_neck, r.upper_limbs, r.trunk, r.lower_limbs, r.perineum, r.extent_a,
    r.erythema, r.edema_papulation, r.oozing_crusting, r.excoriation, r.lichenification, r.dryness, r.intensity_b,
    r.pruritus, r.sleep_loss, r.subjective_c,
    r.extent_weighted, r.intensity_weighted, r.scorad, r.objective_scorad, r.scorad_severity
  ]
  if (opts.deidentified) fields.splice(1, 1) // 患者姓名
  return fields.map(escape).join(',')
}

/** 触发浏览器下载 */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportRecordsCsv(records: AssessmentRecord[], filename = 'scorad_records.csv', opts: CsvExportOptions = {}) {
  const headers = opts.deidentified ? CSV_HEADERS.filter((h) => h !== '患者姓名') : CSV_HEADERS
  const rows = [headers.join(','), ...records.map((r) => recordToCsvRow(r, opts))]
  const csv = '\uFEFF' + rows.join('\r\n') // UTF-8 BOM
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename)
}

/** 序列化为 JSON 文本（完整记录，含全部审计字段） */
export function recordsToJson(records: AssessmentRecord[]): string {
  return JSON.stringify(records, null, 2)
}

/** JSON 导出：完整记录（含全部审计字段），供科研数据归档/迁移 */
export function downloadJson(records: AssessmentRecord[], filename = 'scorad_records.json') {
  downloadBlob(new Blob([recordsToJson(records)], { type: 'application/json;charset=utf-8;' }), filename)
}

/**
 * 解析 CSV 文本为记录数组
 * 支持带/不带 BOM、引号转义、逗号/换行在引号内
 */
function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\r') { /* skip */ }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else field += ch
    }
  }
  // 最后一行
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

const HEADER_INDEX: Record<string, number> = {}
CSV_HEADERS.forEach((h, i) => { HEADER_INDEX[h] = i })

function num(v: string): number {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function parseSeverity(v: string): 'mild' | 'moderate' | 'severe' {
  if (v === 'moderate' || v === '中度') return 'moderate'
  if (v === 'severe' || v === '重度') return 'severe'
  return 'mild'
}

/**
 * 将 CSV 文本导入为 AssessmentRecord[]
 * 缺失字段用默认值填充；id 为空时自动生成
 * createdBy：审计字段 created_by，默认 'csv_import'，调用方应传入本地用户 UUID
 */
export function importRecordsFromCsv(text: string, createdBy = 'csv_import'): AssessmentRecord[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const now = new Date().toISOString()
  const records: AssessmentRecord[] = []
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]
    const get = (name: string) => r[HEADER_INDEX[name]] ?? ''
    records.push({
      id: `imp_${Date.now()}_${i}`,
      assessed_at: get('评估时间'),
      created_at: now,
      updated_at: now,
      created_by: createdBy,
      patient_name: get('患者姓名'),
      patient_gender: get('性别') || 'unknown',
      patient_age: get('年龄'),
      patient_id: get('患者编号'),
      visit_week: get('就诊周次'),
      research_project_id: get('研究项目编号') || undefined,
      center_id: get('中心编号') || undefined,
      subject_screening_no: get('受试者筛选号') || undefined,
      evaluator_id: get('评估者ID') || undefined,
      evaluator_qualification: get('评估者资质') || undefined,
      blinding: get('盲法标记') || undefined,
      data_source: get('数据来源') || undefined,
      bsa_mode: get('体表面积表') || 'rule_of_nines',
      head_neck: num(get('头颈部%')),
      upper_limbs: num(get('双上肢%')),
      trunk: num(get('躯干%')),
      lower_limbs: num(get('双下肢%')),
      perineum: num(get('会阴%')),
      extent_a: num(get('皮损面积A')),
      erythema: num(get('红斑')),
      edema_papulation: num(get('水肿/丘疹')),
      oozing_crusting: num(get('渗出/结痂')),
      excoriation: num(get('抓痕')),
      lichenification: num(get('苔藓化')),
      dryness: num(get('干燥')),
      intensity_b: num(get('强度B')),
      pruritus: num(get('瘙痒')),
      sleep_loss: num(get('睡眠影响')),
      subjective_c: num(get('主观C')),
      extent_weighted: num(get('A加权')),
      intensity_weighted: num(get('B加权')),
      scorad: num(get('SCORAD')),
      objective_scorad: num(get('oSCORAD')),
      scorad_severity: parseSeverity(get('严重度')),
      scoring_algorithm_version: 'v1.0',
      severity_classification_version: 'v1.0',
      objective_scorad_mode: 'standard'
    })
  }
  return records
}

/**
 * 数据校验：逐条比对导入记录的 SCORAD 与按公式重算值是否一致
 * 返回校验结果列表
 */
export interface ValidationIssue {
  row: number
  field: string
  expected: string
  actual: string
  message: string
}

export function validateRecords(records: AssessmentRecord[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  records.forEach((r, idx) => {
    const row = idx + 2 // CSV 行号（含表头）
    // 校验 A
    const aSum = r.head_neck + r.upper_limbs + r.trunk + r.lower_limbs + r.perineum
    if (Math.abs(aSum - r.extent_a) > 0.1) {
      issues.push({ row, field: '皮损面积A', expected: aSum.toFixed(1), actual: String(r.extent_a), message: 'A 值与各部位之和不一致' })
    }
    // 校验 B
    const bSum = r.erythema + r.edema_papulation + r.oozing_crusting + r.excoriation + r.lichenification + r.dryness
    if (bSum !== r.intensity_b) {
      issues.push({ row, field: '强度B', expected: String(bSum), actual: String(r.intensity_b), message: 'B 值与各项之和不一致' })
    }
    // 校验 C
    const cSum = Math.round((r.pruritus + r.sleep_loss) * 10) / 10
    if (Math.abs(cSum - r.subjective_c) > 0.1) {
      issues.push({ row, field: '主观C', expected: cSum.toFixed(1), actual: String(r.subjective_c), message: 'C 值与瘙痒+睡眠之和不一致' })
    }
    // 校验 SCORAD = A/5 + 7B/2 + C
    const expectedScorad = Math.round((r.extent_weighted + r.intensity_weighted + r.subjective_c) * 100) / 100
    if (Math.abs(expectedScorad - r.scorad) > 0.02) {
      issues.push({ row, field: 'SCORAD', expected: expectedScorad.toFixed(2), actual: String(r.scorad), message: 'SCORAD 与公式计算不一致' })
    }
    // 校验 oSCORAD = A/5 + 7B/2
    const expectedObj = Math.round((r.extent_weighted + r.intensity_weighted) * 100) / 100
    if (Math.abs(expectedObj - r.objective_scorad) > 0.02) {
      issues.push({ row, field: 'oSCORAD', expected: expectedObj.toFixed(2), actual: String(r.objective_scorad), message: 'oSCORAD 与公式计算不一致' })
    }
  })
  return issues
}
