import { describe, it, expect } from 'vitest'
import { recordToCsvRow, importRecordsFromCsv, validateRecords, recordsToJson } from './csv'
import type { AssessmentRecord } from '@/storage'

/** 构造一条完整的测试记录 */
function makeRecord(overrides: Partial<AssessmentRecord> = {}): AssessmentRecord {
  return {
    id: 'test-1',
    assessed_at: '2026-10-17T10:00',
    created_at: '2026-10-17T10:00:00.000Z',
    updated_at: '2026-10-17T10:00:00.000Z',
    created_by: 'test-user',
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

/** 构造一行 CSV（35 列，与表头严格对齐） */
function buildRow(fields: Record<string, string>): string {
  const cols = [
    fields['评估时间'] ?? '',
    fields['患者姓名'] ?? '',
    fields['性别'] ?? 'male',
    fields['年龄'] ?? '30',
    fields['患者编号'] ?? 'P1',
    fields['就诊周次'] ?? '第1周',
    fields['研究项目编号'] ?? '',
    fields['中心编号'] ?? '',
    fields['受试者筛选号'] ?? '',
    fields['评估者ID'] ?? '',
    fields['评估者资质'] ?? '',
    fields['盲法标记'] ?? '',
    fields['数据来源'] ?? '',
    fields['体表面积表'] ?? 'rule_of_nines',
    fields['头颈部%'] ?? '0',
    fields['双上肢%'] ?? '0',
    fields['躯干%'] ?? '0',
    fields['双下肢%'] ?? '0',
    fields['会阴%'] ?? '0',
    fields['皮损面积A'] ?? '0',
    fields['红斑'] ?? '0',
    fields['水肿/丘疹'] ?? '0',
    fields['渗出/结痂'] ?? '0',
    fields['抓痕'] ?? '0',
    fields['苔藓化'] ?? '0',
    fields['干燥'] ?? '0',
    fields['强度B'] ?? '0',
    fields['瘙痒'] ?? '0',
    fields['睡眠影响'] ?? '0',
    fields['主观C'] ?? '0',
    fields['A加权'] ?? '0',
    fields['B加权'] ?? '0',
    fields['SCORAD'] ?? '0',
    fields['oSCORAD'] ?? '0',
    fields['严重度'] ?? 'mild'
  ]
  return cols.join(',')
}

const HEADER = '评估时间,患者姓名,性别,年龄,患者编号,就诊周次,研究项目编号,中心编号,受试者筛选号,评估者ID,评估者资质,盲法标记,数据来源,体表面积表,头颈部%,双上肢%,躯干%,双下肢%,会阴%,皮损面积A,红斑,水肿/丘疹,渗出/结痂,抓痕,苔藓化,干燥,强度B,瘙痒,睡眠影响,主观C,A加权,B加权,SCORAD,oSCORAD,严重度'

describe('CSV 工具 - 导入导出往返', () => {
  it('导出再导入应还原关键字段', () => {
    const record = makeRecord()
    const csv = '\uFEFF' + [HEADER, recordToCsvRow(record)].join('\r\n')

    const imported = importRecordsFromCsv(csv)
    expect(imported).toHaveLength(1)
    const r = imported[0]
    expect(r.assessed_at).toBe('2026-10-17T10:00')
    expect(r.patient_name).toBe('张三')
    expect(r.patient_gender).toBe('male')
    expect(r.patient_age).toBe('35')
    expect(r.patient_id).toBe('P001')
    expect(r.head_neck).toBe(5)
    expect(r.upper_limbs).toBe(10)
    expect(r.trunk).toBe(20)
    expect(r.lower_limbs).toBe(15)
    expect(r.perineum).toBe(0)
    expect(r.extent_a).toBe(50)
    expect(r.erythema).toBe(2)
    expect(r.intensity_b).toBe(8)
    expect(r.pruritus).toBe(7)
    expect(r.sleep_loss).toBe(6)
    expect(r.subjective_c).toBe(13)
    expect(r.scorad).toBe(51)
    expect(r.objective_scorad).toBe(38)
    expect(r.scorad_severity).toBe('severe')
  })

  it('空 CSV 返回空数组', () => {
    expect(importRecordsFromCsv('')).toHaveLength(0)
    expect(importRecordsFromCsv(HEADER + '\n')).toHaveLength(0)
  })

  it('缺失数值字段默认为 0', () => {
    const row = buildRow({ '评估时间': '2026-10-17T10:00', '患者姓名': '李四', '性别': 'female', '年龄': '28', '患者编号': 'P002', '就诊周次': '第1周' })
    const r = importRecordsFromCsv('\uFEFF' + [HEADER, row].join('\r\n'))[0]
    expect(r.head_neck).toBe(0)
    expect(r.scorad).toBe(0)
    expect(r.patient_name).toBe('李四')
  })

  it('严重度中文正确映射', () => {
    const row = buildRow({ '严重度': '轻度' })
    const r = importRecordsFromCsv('\uFEFF' + [HEADER, row].join('\r\n'))[0]
    expect(r.scorad_severity).toBe('mild')
  })

  it('严重度中英文均支持：中度/moderate → moderate，重度/severe → severe', () => {
    const expectSev = (csvSev: string, expected: string) => {
      const row = buildRow({ '严重度': csvSev })
      expect(importRecordsFromCsv('\uFEFF' + [HEADER, row].join('\r\n'))[0].scorad_severity).toBe(expected)
    }
    expectSev('中度', 'moderate')
    expectSev('重度', 'severe')
    expectSev('moderate', 'moderate')
    expectSev('severe', 'severe')
  })

  it('引号内的逗号不被当作分隔符', () => {
    // 患者姓名 "李,四" 含逗号，需用引号包裹
    const row = buildRow({ '患者姓名': '"李,四"' })
    const r = importRecordsFromCsv('\uFEFF' + [HEADER, row].join('\r\n'))[0]
    expect(r.patient_name).toBe('李,四')
  })

  it('引号内的换行符被保留为字段内容', () => {
    const row = buildRow({ '患者姓名': '"张\n三"' })
    const r = importRecordsFromCsv('\uFEFF' + [HEADER, row].join('\r\n'))[0]
    expect(r.patient_name).toBe('张\n三')
  })

  it('引号内转义的双引号（""）还原为单个双引号', () => {
    const row = buildRow({ '患者姓名': '"他说""你好"""' })
    const r = importRecordsFromCsv('\uFEFF' + [HEADER, row].join('\r\n'))[0]
    expect(r.patient_name).toBe('他说"你好"')
  })

  it('多条记录一次性导入，条数与字段均正确', () => {
    const record1 = makeRecord({ id: 'r1', patient_id: 'P001', patient_name: '张三' })
    const record2 = makeRecord({ id: 'r2', patient_id: 'P002', patient_name: '李四', scorad: 25, objective_scorad: 18, scorad_severity: 'moderate' })
    const csv = '\uFEFF' + [HEADER, recordToCsvRow(record1), recordToCsvRow(record2)].join('\r\n')
    const imported = importRecordsFromCsv(csv)
    expect(imported).toHaveLength(2)
    expect(imported[0].patient_name).toBe('张三')
    expect(imported[1].patient_name).toBe('李四')
    expect(imported[1].scorad).toBe(25)
    expect(imported[1].scorad_severity).toBe('moderate')
  })

  it('科研字段正确导入（研究项目编号、中心编号等）', () => {
    const row = buildRow({
      '评估时间': '2026-10-17T10:00', '患者姓名': '张三', '性别': 'male', '年龄': '35',
      '患者编号': 'P001', '就诊周次': '第2周',
      '研究项目编号': 'PROJ001', '中心编号': 'CENTER02', '受试者筛选号': 'SUBJ003',
      '评估者ID': 'EVAL04', '评估者资质': '皮肤科医师', '盲法标记': '双盲', '数据来源': '门诊',
      '头颈部%': '5', '双上肢%': '10', '躯干%': '20', '双下肢%': '15', '会阴%': '0',
      '皮损面积A': '50', '红斑': '2', '水肿/丘疹': '1', '渗出/结痂': '1', '抓痕': '2',
      '苔藓化': '1', '干燥': '1', '强度B': '8', '瘙痒': '7', '睡眠影响': '6', '主观C': '13',
      'A加权': '10', 'B加权': '28', 'SCORAD': '51', 'oSCORAD': '38', '严重度': 'severe'
    })
    const r = importRecordsFromCsv('\uFEFF' + [HEADER, row].join('\r\n'))[0]
    expect(r.research_project_id).toBe('PROJ001')
    expect(r.center_id).toBe('CENTER02')
    expect(r.subject_screening_no).toBe('SUBJ003')
    expect(r.evaluator_id).toBe('EVAL04')
    expect(r.evaluator_qualification).toBe('皮肤科医师')
    expect(r.blinding).toBe('双盲')
    expect(r.data_source).toBe('门诊')
  })

  it('导入记录自动生成 imp_ 前缀的 id，互不重复', () => {
    const row1 = buildRow({ '患者姓名': 'A' })
    const row2 = buildRow({ '患者姓名': 'B' })
    const csv = '\uFEFF' + [HEADER, row1, row2].join('\r\n')
    const imported = importRecordsFromCsv(csv)
    expect(imported[0].id).toMatch(/^imp_/)
    expect(imported[1].id).toMatch(/^imp_/)
    expect(imported[0].id).not.toBe(imported[1].id)
  })

  it('不带 BOM 的 CSV 也能正确解析（LF 换行）', () => {
    const row = buildRow({
      '评估时间': '2026-10-17T10:00', '患者姓名': '张三', '性别': 'male', '年龄': '35',
      '患者编号': 'P001', '就诊周次': '第2周',
      '头颈部%': '5', '双上肢%': '10', '躯干%': '20', '双下肢%': '15', '会阴%': '0',
      '皮损面积A': '50', '强度B': '8', '瘙痒': '7', '睡眠影响': '6', '主观C': '13',
      'A加权': '10', 'B加权': '28', 'SCORAD': '51', 'oSCORAD': '38', '严重度': 'severe'
    })
    const r = importRecordsFromCsv([HEADER, row].join('\n'))[0]
    expect(r.patient_name).toBe('张三')
    expect(r.scorad).toBe(51)
  })

  it('bsa_mode 字段可导入为 lund_browder（儿童）', () => {
    const row = buildRow({
      '评估时间': '2026-10-17T10:00', '患者姓名': '儿童A', '性别': 'male', '年龄': '5',
      '患者编号': 'C001', '就诊周次': '第1周',
      '体表面积表': 'lund_browder', '头颈部%': '10', '双上肢%': '5', '躯干%': '15',
      '双下肢%': '8', '会阴%': '0', '皮损面积A': '38', '严重度': 'moderate'
    })
    const r = importRecordsFromCsv('\uFEFF' + [HEADER, row].join('\r\n'))[0]
    expect(r.bsa_mode).toBe('lund_browder')
    expect(r.head_neck).toBe(10)
  })
})

describe('CSV 工具 - 数据校验 validateRecords', () => {
  it('数据一致时返回空数组', () => {
    const r = makeRecord()
    expect(validateRecords([r])).toHaveLength(0)
  })

  it('A 值与各部位之和不一致时报告', () => {
    const r = makeRecord({ head_neck: 5, upper_limbs: 10, trunk: 20, lower_limbs: 15, perineum: 0, extent_a: 60 })
    // 实际和 = 50，但记录 extent_a = 60
    const issues = validateRecords([r])
    expect(issues.some((i) => i.field === '皮损面积A')).toBe(true)
  })

  it('B 值与各项之和不一致时报告', () => {
    const r = makeRecord({ erythema: 2, edema_papulation: 1, oozing_crusting: 1, excoriation: 2, lichenification: 1, dryness: 1, intensity_b: 10 })
    // 实际和 = 8，但记录 intensity_b = 10
    const issues = validateRecords([r])
    expect(issues.some((i) => i.field === '强度B')).toBe(true)
  })

  it('SCORAD 与公式不一致时报告', () => {
    const r = makeRecord({ scorad: 999 })
    const issues = validateRecords([r])
    expect(issues.some((i) => i.field === 'SCORAD')).toBe(true)
  })

  it('oSCORAD 与公式不一致时报告', () => {
    const r = makeRecord({ objective_scorad: 999 })
    const issues = validateRecords([r])
    expect(issues.some((i) => i.field === 'oSCORAD')).toBe(true)
  })

  it('C 值（主观症状）与瘙痒+睡眠之和不一致时报告', () => {
    const r = makeRecord({ pruritus: 7, sleep_loss: 6, subjective_c: 20 })
    // 实际和 = 13，但记录 subjective_c = 20
    const issues = validateRecords([r])
    expect(issues.some((i) => i.field === '主观C')).toBe(true)
  })

  it('单条记录存在多处不一致时全部被检出', () => {
    const r = makeRecord({
      extent_a: 999,        // A 不一致
      intensity_b: 999,     // B 不一致
      subjective_c: 999,    // C 不一致
      scorad: 999,          // SCORAD 不一致
      objective_scorad: 999 // oSCORAD 不一致
    })
    const issues = validateRecords([r])
    const fields = issues.map((i) => i.field)
    expect(fields).toContain('皮损面积A')
    expect(fields).toContain('强度B')
    expect(fields).toContain('主观C')
    expect(fields).toContain('SCORAD')
    expect(fields).toContain('oSCORAD')
  })

  it('多条记录各自校验，行号从 2 开始', () => {
    const r1 = makeRecord({ id: 'r1', extent_a: 999 })
    const r2 = makeRecord({ id: 'r2', intensity_b: 999 })
    const issues = validateRecords([r1, r2])
    expect(issues.length).toBeGreaterThan(0)
    // r1 在第 2 行，r2 在第 3 行
    expect(issues.some((i) => i.row === 2)).toBe(true)
    expect(issues.some((i) => i.row === 3)).toBe(true)
  })
})

describe('去标识符导出（deidentified）', () => {
  it('默认导出 35 列含患者姓名', () => {
    const row = recordToCsvRow(makeRecord())
    const fields = row.split(',')
    expect(fields).toHaveLength(35)
    expect(fields[1]).toBe('张三')
  })

  it('去标识导出 34 列且无患者姓名', () => {
    const row = recordToCsvRow(makeRecord(), { deidentified: true })
    const fields = row.split(',')
    expect(fields).toHaveLength(34)
    expect(fields.join(',')).not.toContain('张三')
    // 姓名列被移除，第 2 列变为性别
    expect(fields[1]).toBe('male')
  })

  it('去标识导出其余列与默认导出一致', () => {
    const r = makeRecord()
    const full = recordToCsvRow(r).split(',')
    const deid = recordToCsvRow(r, { deidentified: true }).split(',')
    // 去掉第 2 列（姓名）后应完全相同
    expect([...full.slice(0, 1), ...full.slice(2)]).toEqual(deid)
  })
})

describe('JSON 导出（recordsToJson）', () => {
  it('可解析为记录数组且含审计字段', () => {
    const json = recordsToJson([makeRecord()])
    const parsed = JSON.parse(json) as AssessmentRecord[]
    expect(parsed).toHaveLength(1)
    expect(parsed[0].created_by).toBe('test-user')
    expect(parsed[0].created_at).toBeTruthy()
    expect(parsed[0].updated_at).toBeTruthy()
  })

  it('保留科研字段与全部 35 列对应字段', () => {
    const json = recordsToJson([makeRecord({ research_project_id: 'PROJ-1', center_id: 'C01' })])
    const parsed = JSON.parse(json) as AssessmentRecord[]
    expect(parsed[0].research_project_id).toBe('PROJ-1')
    expect(parsed[0].center_id).toBe('C01')
    expect(parsed[0].patient_name).toBe('张三')
    expect(parsed[0].scorad).toBe(51)
  })
})
