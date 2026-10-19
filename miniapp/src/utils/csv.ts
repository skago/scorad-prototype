/**
 * CSV 导出工具（小程序端）
 * 与 web 端 utils/csv.ts 保持同一格式：35 列中文表头 + UTF-8 BOM
 * 小程序无 Blob/URL，仅输出字符串，写文件由 utils/fileExport.ts 负责
 */
import type { AssessmentRecord } from '@/storage/types'

export const CSV_HEADERS = [
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

/** 生成完整 CSV 文本（含 BOM，兼容 Excel 中文） */
export function buildCsv(records: AssessmentRecord[], opts: CsvExportOptions = {}): string {
  const headers = opts.deidentified ? CSV_HEADERS.filter((h) => h !== '患者姓名') : CSV_HEADERS
  const rows = [headers.join(','), ...records.map((r) => recordToCsvRow(r, opts))]
  return '\uFEFF' + rows.join('\r\n')
}

/** 序列化为 JSON 文本（完整记录，含全部审计字段），供科研数据归档/迁移 */
export function recordsToJson(records: AssessmentRecord[]): string {
  return JSON.stringify(records, null, 2)
}
