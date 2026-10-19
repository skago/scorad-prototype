/**
 * 体表面积估算表
 * - 成人 Rule of Nines
 * - 儿童 Lund-Browder（按年龄段）
 */

export type BsaMode = 'rule_of_nines' | 'lund_browder'

/** 身体部位定义 */
export interface BodyPart {
  key: string
  label: string
  max: number // 该部位体表面积占比上限（%）
}

/** 成人 Rule of Nines */
export const ADULT_BODY_PARTS: BodyPart[] = [
  { key: 'head_neck', label: '头颈部（前+后）', max: 9 },
  { key: 'upper_limbs', label: '双上肢（前+后）', max: 18 },
  { key: 'trunk', label: '躯干（前+后）', max: 36 },
  { key: 'lower_limbs', label: '双下肢（前+后）', max: 36 },
  { key: 'perineum', label: '会阴', max: 1 }
]

/**
 * 儿童 Lund-Browder 各年龄段各部位占比（%）
 * 年龄段：0、1、5、10、15 岁
 * 数据来源：Lund & Browder (1944) 烧伤面积估算表（公开医学文献）
 */
export const LUND_BROWDER_TABLE: Record<string, Record<string, number>> = {
  '0': { head_neck: 19, upper_limbs: 17, trunk: 36, lower_limbs: 27, perineum: 1 },
  '1': { head_neck: 17, upper_limbs: 17, trunk: 36, lower_limbs: 29, perineum: 1 },
  '5': { head_neck: 13, upper_limbs: 18, trunk: 36, lower_limbs: 32, perineum: 1 },
  '10': { head_neck: 11, upper_limbs: 18, trunk: 36, lower_limbs: 34, perineum: 1 },
  '15': { head_neck: 9, upper_limbs: 18, trunk: 36, lower_limbs: 36, perineum: 1 }
}

/**
 * 根据年龄获取体表面积表
 * @param age 年龄（岁）
 * @returns 各部位占比上限
 */
export function getBsaByAge(age: number): BodyPart[] {
  if (age < 1) return buildFromTable(LUND_BROWDER_TABLE['0'])
  if (age < 5) return buildFromTable(LUND_BROWDER_TABLE['1'])
  if (age < 10) return buildFromTable(LUND_BROWDER_TABLE['5'])
  if (age < 15) return buildFromTable(LUND_BROWDER_TABLE['10'])
  return ADULT_BODY_PARTS
}

function buildFromTable(row: Record<string, number>): BodyPart[] {
  return ADULT_BODY_PARTS.map((p) => ({ ...p, max: row[p.key] ?? p.max }))
}
