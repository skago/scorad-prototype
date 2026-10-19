import { describe, it, expect } from 'vitest'
import { calculate, ValidationError, classifySeverity, SEVERITY_LABEL } from './index'
import type { ScoradInput } from './types'

/** 构造标准输入的辅助函数 */
function makeInput(overrides: Partial<ScoradInput> = {}): ScoradInput {
  return {
    extent_a: 0,
    erythema: 0,
    edema_papulation: 0,
    oozing_crusting: 0,
    excoriation: 0,
    lichenification: 0,
    dryness: 0,
    pruritus: 0,
    sleep_loss: 0,
    ...overrides
  }
}

describe('SCORAD 引擎 - calculate', () => {
  it('全 0 输入时 SCORAD 为 0', () => {
    const r = calculate(makeInput())
    expect(r.scorad).toBe(0)
    expect(r.objective_scorad).toBe(0)
    expect(r.scorad_severity).toBe('mild')
    expect(r.intensity_b).toBe(0)
    expect(r.subjective_c).toBe(0)
  })

  it('典型值：A=50, B=8, C=13 → SCORAD=51', () => {
    const r = calculate(
      makeInput({
        extent_a: 50,
        erythema: 2,
        edema_papulation: 1,
        oozing_crusting: 1,
        excoriation: 2,
        lichenification: 1,
        dryness: 1,
        pruritus: 7,
        sleep_loss: 6
      })
    )
    // A/5 = 10, 7B/2 = 28, C = 13 → 51
    expect(r.scorad).toBe(51)
    expect(r.extent_weighted).toBe(10)
    expect(r.intensity_weighted).toBe(28)
    expect(r.objective_scorad).toBe(38) // A/5 + 7B/2 = 10 + 28
    expect(r.subjective_c).toBe(13)
    expect(r.scorad_severity).toBe('severe')
  })

  it('严重度边界：SCORAD=25 应为中度', () => {
    // A=25 → A/5=5, B=0, C=20 → 25
    const r = calculate(makeInput({ extent_a: 25, pruritus: 10, sleep_loss: 10 }))
    expect(r.scorad).toBe(25)
    expect(r.scorad_severity).toBe('moderate')
  })

  it('严重度边界：SCORAD=24.98 应为轻度', () => {
    // A=24.9 → A/5=4.98, B=0, C=20 → 24.98
    const r = calculate(makeInput({ extent_a: 24.9, pruritus: 10, sleep_loss: 10 }))
    expect(r.scorad).toBeCloseTo(24.98, 2)
    expect(r.scorad_severity).toBe('mild')
  })

  it('严重度边界：SCORAD=50 应为中度', () => {
    // A=100, B=4, C=16 → (1000 + 700 + 800)/50 = 50
    const r = calculate(
      makeInput({
        extent_a: 100,
        erythema: 1,
        edema_papulation: 1,
        oozing_crusting: 1,
        excoriation: 1,
        pruritus: 8,
        sleep_loss: 8
      })
    )
    expect(r.scorad).toBe(50)
    expect(r.scorad_severity).toBe('moderate')
  })

  it('严重度边界：SCORAD=50.1 应为重度', () => {
    // A=100, B=4, C=16.1 → (1000 + 700 + 805)/50 = 50.1
    const r = calculate(
      makeInput({
        extent_a: 100,
        erythema: 1,
        edema_papulation: 1,
        oozing_crusting: 1,
        excoriation: 1,
        pruritus: 8,
        sleep_loss: 8.1
      })
    )
    expect(r.scorad).toBeCloseTo(50.1, 1)
    expect(r.scorad_severity).toBe('severe')
  })

  it('最大可能值：A=100, B=18, C=20 → SCORAD=103', () => {
    const r = calculate(
      makeInput({
        extent_a: 100,
        erythema: 3,
        edema_papulation: 3,
        oozing_crusting: 3,
        excoriation: 3,
        lichenification: 3,
        dryness: 3,
        pruritus: 10,
        sleep_loss: 10
      })
    )
    // A/5=20, 7*18/2=63, C=20 → 103
    expect(r.scorad).toBe(103)
    expect(r.objective_scorad).toBe(83)
    expect(r.scorad_severity).toBe('severe')
  })

  it('整数运算消除浮点误差：A=0.1, C=0.1 不应产生浮点累积', () => {
    const r = calculate(makeInput({ extent_a: 0.1, pruritus: 0.1, sleep_loss: 0 }))
    // A/5 = 0.02, C = 0.1 → 0.12
    expect(r.scorad).toBe(0.12)
  })

  it('A 和 C 各保留 1 位小数，结果为 0.02 的整数倍', () => {
    const r = calculate(makeInput({ extent_a: 33.3, pruritus: 5.5, sleep_loss: 4.4 }))
    // a10=333, c10=99 → (333 + 0 + 5*99)/50 = (333+495)/50 = 828/50 = 16.56
    expect(r.scorad).toBe(16.56)
  })
})

describe('SCORAD 引擎 - 输入校验', () => {
  it('A 超过 100 抛出 ValidationError', () => {
    expect(() => calculate(makeInput({ extent_a: 101 }))).toThrow(ValidationError)
  })

  it('B 项超过 3 抛出 ValidationError', () => {
    expect(() => calculate(makeInput({ erythema: 4 }))).toThrow(ValidationError)
  })

  it('B 项为 null 抛出 ValidationError', () => {
    expect(() => calculate(makeInput({ erythema: null }))).toThrow(ValidationError)
  })

  it('C 项超过 10 抛出 ValidationError', () => {
    expect(() => calculate(makeInput({ pruritus: 11 }))).toThrow(ValidationError)
  })

  it('B 项非整数抛出 ValidationError', () => {
    expect(() => calculate(makeInput({ erythema: 1.5 }))).toThrow(ValidationError)
  })

  it('负数抛出 ValidationError', () => {
    expect(() => calculate(makeInput({ extent_a: -1 }))).toThrow(ValidationError)
  })
})

describe('SCORAD 引擎 - classifySeverity', () => {
  it('0 → mild', () => expect(classifySeverity(0)).toBe('mild'))
  it('24 → mild', () => expect(classifySeverity(24)).toBe('mild'))
  it('25 → moderate', () => expect(classifySeverity(25)).toBe('moderate'))
  it('50 → moderate', () => expect(classifySeverity(50)).toBe('moderate'))
  it('51 → severe', () => expect(classifySeverity(51)).toBe('severe'))
  it('103 → severe', () => expect(classifySeverity(103)).toBe('severe'))

  it('SEVERITY_LABEL 包含三级', () => {
    expect(SEVERITY_LABEL.mild).toContain('轻度')
    expect(SEVERITY_LABEL.moderate).toContain('中度')
    expect(SEVERITY_LABEL.severe).toContain('重度')
  })
})
