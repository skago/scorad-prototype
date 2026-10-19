import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAssessStore } from './assessStore'
import { generateUUID, getOrCreateUserId } from '@/utils/uuid'

/**
 * 实时合计逻辑测试
 * 验证 extent_a / intensity_b / subjective_c 在 store 值变化时实时更新
 */
describe('assessStore - 实时合计', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  describe('extent_a（皮损面积合计）', () => {
    it('初始值为 0', () => {
      const store = useAssessStore()
      expect(store.extent_a).toBe(0)
    })

    it('五部位之和实时反映到 extent_a', () => {
      const store = useAssessStore()
      store.head_neck = 5
      store.upper_limbs = 10
      store.trunk = 20
      store.lower_limbs = 15
      store.perineum = 0
      expect(store.extent_a).toBe(50)
    })

    it('修改任一部位，extent_a 立即更新', () => {
      const store = useAssessStore()
      store.head_neck = 10
      expect(store.extent_a).toBe(10)
      store.trunk = 30
      expect(store.extent_a).toBe(40)
    })

    it('小数部位精确到 0.1', () => {
      const store = useAssessStore()
      store.head_neck = 5.5
      store.upper_limbs = 10.5
      expect(store.extent_a).toBe(16)
    })
  })

  describe('intensity_b（客观强度合计）', () => {
    it('初始值为 0（全部未评估）', () => {
      const store = useAssessStore()
      expect(store.intensity_b).toBe(0)
    })

    it('已评估项之和实时反映到 intensity_b', () => {
      const store = useAssessStore()
      store.erythema = 2
      store.edema_papulation = 1
      store.excoriation = 2
      expect(store.intensity_b).toBe(5)
    })

    it('未评估项（null）不计入合计', () => {
      const store = useAssessStore()
      store.erythema = 3
      // 其余为 null
      expect(store.intensity_b).toBe(3)
      expect(store.erythema).toBe(3)
      expect(store.dryness).toBeNull()
    })

    it('六项全评为 3 时合计为 18', () => {
      const store = useAssessStore()
      store.erythema = 3
      store.edema_papulation = 3
      store.oozing_crusting = 3
      store.excoriation = 3
      store.lichenification = 3
      store.dryness = 3
      expect(store.intensity_b).toBe(18)
    })

    it('修改任一项，intensity_b 立即更新', () => {
      const store = useAssessStore()
      store.erythema = 1
      expect(store.intensity_b).toBe(1)
      store.erythema = 3
      expect(store.intensity_b).toBe(3)
    })
  })

  describe('subjective_c（主观症状合计）', () => {
    it('初始值为 0', () => {
      const store = useAssessStore()
      expect(store.subjective_c).toBe(0)
    })

    it('瘙痒与睡眠之和实时反映到 subjective_c', () => {
      const store = useAssessStore()
      store.pruritus = 7
      store.sleep_loss = 6
      expect(store.subjective_c).toBe(13)
    })

    it('小数精确到 0.1', () => {
      const store = useAssessStore()
      store.pruritus = 7.5
      store.sleep_loss = 6.5
      expect(store.subjective_c).toBe(14)
    })

    it('修改任一值，subjective_c 立即更新', () => {
      const store = useAssessStore()
      store.pruritus = 5
      expect(store.subjective_c).toBe(5)
      store.sleep_loss = 5
      expect(store.subjective_c).toBe(10)
    })
  })

  describe('doCalculate（基于当前 store 状态计算）', () => {
    it('使用 store 中的 A/B/C 值计算 SCORAD', () => {
      const store = useAssessStore()
      // A = 50
      store.head_neck = 5
      store.upper_limbs = 10
      store.trunk = 20
      store.lower_limbs = 15
      store.perineum = 0
      // B = 8
      store.erythema = 2
      store.edema_papulation = 1
      store.oozing_crusting = 1
      store.excoriation = 2
      store.lichenification = 1
      store.dryness = 1
      // C = 13
      store.pruritus = 7
      store.sleep_loss = 6

      const r = store.doCalculate()
      expect(r.scorad).toBe(51)
      expect(r.objective_scorad).toBe(38)
      expect(r.scorad_severity).toBe('severe')
    })

    it('result 被设置', () => {
      const store = useAssessStore()
      store.pruritus = 0
      store.sleep_loss = 0
      store.erythema = 0
      store.edema_papulation = 0
      store.oozing_crusting = 0
      store.excoriation = 0
      store.lichenification = 0
      store.dryness = 0
      store.doCalculate()
      expect(store.result).not.toBeNull()
      expect(store.result?.scorad).toBe(0)
    })
  })

  describe('校验方法', () => {
    it('validateStep1 缺少评估时间返回错误', () => {
      const store = useAssessStore()
      store.assessed_at = ''
      expect(store.validateStep1()).toBe('请填写评估时间')
    })

    it('validateStep1 有评估时间返回 null', () => {
      const store = useAssessStore()
      store.assessed_at = '2026-10-17T10:00'
      expect(store.validateStep1()).toBeNull()
    })

    it('validateStep3 有未评估项返回错误', () => {
      const store = useAssessStore()
      expect(store.validateStep3()).toContain('红斑')
    })

    it('validateStep3 全部评估返回 null', () => {
      const store = useAssessStore()
      store.erythema = 0
      store.edema_papulation = 0
      store.oozing_crusting = 0
      store.excoriation = 0
      store.lichenification = 0
      store.dryness = 0
      expect(store.validateStep3()).toBeNull()
    })
  })

  describe('reset', () => {
    it('重置后所有字段归零/空，合计为 0', () => {
      const store = useAssessStore()
      store.head_neck = 50
      store.erythema = 3
      store.pruritus = 10
      store.extent_a
      expect(store.extent_a).toBe(50)
      expect(store.intensity_b).toBe(3)
      expect(store.subjective_c).toBe(10)

      store.reset()
      expect(store.extent_a).toBe(0)
      expect(store.intensity_b).toBe(0)
      expect(store.subjective_c).toBe(0)
      expect(store.result).toBeNull()
    })
  })

  describe('loadRecord（从历史记录加载）', () => {
    const record = {
      id: 'r1',
      assessed_at: '2026-10-17T10:00',
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
      objective_scorad_mode: 'standard'
    } as never

    it('加载后表单字段与结果均被还原', () => {
      const store = useAssessStore()
      store.loadRecord(record)
      expect(store.patient_name).toBe('张三')
      expect(store.patient_id).toBe('P001')
      expect(store.head_neck).toBe(5)
      expect(store.trunk).toBe(20)
      expect(store.erythema).toBe(2)
      expect(store.pruritus).toBe(7)
      expect(store.extent_a).toBe(50)
      expect(store.intensity_b).toBe(8)
      expect(store.subjective_c).toBe(13)
      expect(store.result?.scorad).toBe(51)
      expect(store.result?.objective_scorad).toBe(38)
      expect(store.result?.scorad_severity).toBe('severe')
    })

    it('加载后可重新编辑并重新计算', () => {
      const store = useAssessStore()
      store.loadRecord(record)
      store.head_neck = 10
      expect(store.extent_a).toBe(55) // 10+10+20+15+0
    })
  })

  describe('setBsaMode（体表面积表切换）', () => {
    it('默认 auto 模式，成人用 Rule of Nines', () => {
      const store = useAssessStore()
      expect(store.bsaModeOverride).toBe('auto')
      expect(store.bsa_mode).toBe('rule_of_nines')
    })

    it('强制 rule_of_nines 时各部位上限为成人值', () => {
      const store = useAssessStore()
      store.setBsaMode('rule_of_nines')
      expect(store.bsa_mode).toBe('rule_of_nines')
      const head = store.bodyParts.find((p) => p.key === 'head_neck')
      expect(head?.max).toBe(9)
      const leg = store.bodyParts.find((p) => p.key === 'lower_limbs')
      expect(leg?.max).toBe(36)
    })

    it('强制 lund_browder 时头颈部上限变大（儿童）', () => {
      const store = useAssessStore()
      store.patient_age = '5'
      store.setBsaMode('lund_browder')
      expect(store.bsa_mode).toBe('lund_browder')
      const head = store.bodyParts.find((p) => p.key === 'head_neck')
      expect(head?.max).toBeGreaterThan(9) // 儿童头颈占比更大
    })

    it('切回 auto 后按年龄自动判断', () => {
      const store = useAssessStore()
      store.patient_age = '5'
      store.setBsaMode('lund_browder')
      store.setBsaMode('auto')
      expect(store.bsa_mode).toBe('lund_browder') // 5岁自动用儿童表
    })
  })

  describe('saveRecord - 审计字段', () => {
    /** 填充最小可计算状态 */
    function fillMinimal(store: ReturnType<typeof useAssessStore>) {
      store.assessed_at = '2026-10-18T10:00'
      store.patient_name = '审计测试'
      store.head_neck = 5
      store.erythema = 1
      store.edema_papulation = 0
      store.oozing_crusting = 0
      store.excoriation = 0
      store.lichenification = 0
      store.dryness = 0
      store.doCalculate()
    }

    it('保存时写入 created_at / updated_at / created_by', async () => {
      const store = useAssessStore()
      fillMinimal(store)
      await store.saveRecord()

      const list = JSON.parse(localStorage.getItem('scorad_records_v1')!)
      expect(list).toHaveLength(1)
      const rec = list[0]
      expect(rec.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(rec.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(rec.created_by).toBeTruthy()
      // created_by 与本地持久化的用户 UUID 一致
      const user = JSON.parse(localStorage.getItem('scorad_user_v1')!)
      expect(rec.created_by).toBe(user.uuid)
    })

    it('保存成功后清除草稿', async () => {
      const store = useAssessStore()
      fillMinimal(store)
      await store.saveDraft()
      expect(localStorage.getItem('scorad_draft_v1')).not.toBeNull()

      await store.saveRecord()
      expect(localStorage.getItem('scorad_draft_v1')).toBeNull()
    })
  })

  describe('loadDraft - 白名单过滤', () => {
    it('草稿中的未知字段与 result 被忽略，不污染 state', async () => {
      localStorage.setItem(
        'scorad_draft_v1',
        JSON.stringify({
          patient_name: '白名单测试',
          head_neck: 9,
          evil_field: 'hack',
          result: { scorad: 99 }
        })
      )
      const store = useAssessStore()
      const restored = await store.loadDraft()

      expect(restored).toBe(true)
      expect(store.patient_name).toBe('白名单测试')
      expect(store.head_neck).toBe(9)
      // result 不从草稿恢复，未知字段不进入 store
      expect(store.result).toBeNull()
      expect((store as unknown as Record<string, unknown>).evil_field).toBeUndefined()
    })

    it('无草稿时返回 false', async () => {
      const store = useAssessStore()
      expect(await store.loadDraft()).toBe(false)
    })
  })

  describe('UUID - 本地用户标识', () => {
    it('首次生成并持久化到 scorad_user_v1，二次调用返回同一值', async () => {
      const id1 = await getOrCreateUserId()
      expect(id1).toMatch(/^[0-9a-f-]{36}$/)

      const user = JSON.parse(localStorage.getItem('scorad_user_v1')!)
      expect(user.uuid).toBe(id1)

      const id2 = await getOrCreateUserId()
      expect(id2).toBe(id1)
    })

    it('generateUUID 生成合法 v4 格式且每次不同', () => {
      const a = generateUUID()
      const b = generateUUID()
      expect(a).not.toBe(b)
      expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })
  })
})
