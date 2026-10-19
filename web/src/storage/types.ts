/**
 * 存储抽象层
 * 业务代码只依赖此接口，不直接操作 localStorage / wx.storage
 * 升级到方案 B（微信云开发）时，仅需新增 CloudStorageAdapter 实现
 */
import type { ScoradResult } from '@/engine'

/** 评估记录（含患者信息与科研字段） */
export interface AssessmentRecord extends ScoradResult {
  id: string
  assessed_at: string
  // 审计字段（PRD 5.1）
  created_at: string
  updated_at: string
  created_by: string
  patient_name: string
  patient_gender: string
  patient_age: string
  patient_id: string
  visit_week: string
  // 科研扩展字段（选填）
  research_project_id?: string
  center_id?: string
  subject_screening_no?: string
  evaluator_id?: string
  evaluator_qualification?: string
  blinding?: string
  data_source?: string
  bsa_mode: string
  head_neck: number
  upper_limbs: number
  trunk: number
  lower_limbs: number
  perineum: number
}

/** 草稿（未提交的表单状态） */
export type AssessmentDraft = Partial<AssessmentRecord>

/** 用户信息 */
export interface UserInfo {
  openid: string
  nickname: string
  avatar?: string
  login_at: string
}

export interface StorageAdapter {
  // 评估记录
  listRecords(): Promise<AssessmentRecord[]>
  getRecord(id: string): Promise<AssessmentRecord | null>
  saveRecord(record: AssessmentRecord): Promise<void>
  deleteRecord(id: string): Promise<void>

  // 草稿
  getDraft(): Promise<AssessmentDraft | null>
  saveDraft(draft: AssessmentDraft): Promise<void>
  clearDraft(): Promise<void>

  // 用户态
  getUser<T = UserInfo>(): Promise<T | null>
  setUser<T = UserInfo>(user: T): Promise<void>
  clearUser(): Promise<void>

  // 通用配置
  getConfig<T = unknown>(key: string): Promise<T | null>
  setConfig<T = unknown>(key: string, value: T): Promise<void>
}
