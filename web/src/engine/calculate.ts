/**
 * SCORAD 计算
 * 采用整数运算消除浮点误差（A 与 C 均最多 1 位小数）：
 *   a10 = round(A×10)，c10 = round(C×10)，B 为整数
 *   SCORAD   = (a10 + 175×B + 5×c10) / 50
 *   oSCORAD  = (a10 + 175×B) / 50
 */
import type { ScoradInput, ScoradResult } from './types'
import { normalizeInput } from './normalize'
import { classifySeverity, SCORAD_ENGINE_VERSION, SEVERITY_VERSION, OSCORAD_MODE } from './severity'

export function calculate(input: ScoradInput): ScoradResult {
  const norm = normalizeInput(input)

  const A = norm.extent_a
  const B =
    norm.erythema +
    norm.edema_papulation +
    norm.oozing_crusting +
    norm.excoriation +
    norm.lichenification +
    norm.dryness
  const C = norm.pruritus + norm.sleep_loss

  // 整数运算（×50，消除 A/C 小数带来的浮点误差）
  const a10 = Math.round(A * 10)
  const c10 = Math.round(C * 10)
  const scoradX50 = a10 + 175 * B + 5 * c10
  const objectiveScoradX50 = a10 + 175 * B

  const scorad = scoradX50 / 50
  const objectiveScorad = objectiveScoradX50 / 50

  const severity = classifySeverity(scorad)

  return {
    // 原始输入
    extent_a: A,
    erythema: norm.erythema,
    edema_papulation: norm.edema_papulation,
    oozing_crusting: norm.oozing_crusting,
    excoriation: norm.excoriation,
    lichenification: norm.lichenification,
    dryness: norm.dryness,
    pruritus: norm.pruritus,
    sleep_loss: norm.sleep_loss,
    // 派生
    intensity_b: B,
    subjective_c: C,
    extent_weighted: A / 5,
    intensity_weighted: (B * 7) / 2,
    scorad,
    objective_scorad: objectiveScorad,
    scorad_severity: severity,
    // 版本
    scoring_algorithm_version: SCORAD_ENGINE_VERSION,
    severity_classification_version: SEVERITY_VERSION,
    objective_scorad_mode: OSCORAD_MODE
  }
}
