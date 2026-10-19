/**
 * SCORAD Scoring Engine
 * 与 UI 完全解耦的纯评分模块。
 *
 * 设计原则：
 * 1. 所有输入先做值域校验，非法输入抛出 ValidationError，不自动修正。
 * 2. 整数运算消除浮点误差：pruritus/sleep_loss 以 ×10 整数参与运算。
 * 3. 0 与 null 严格区分：0 = 已评估无体征，null = 未评估。
 * 4. 严重度分类使用精确值比较，不先取整。
 *
 * 算法版本：SCORAD_CLASSIC_BASE_1.0
 * 分层版本：SCORAD_LT25_25TO50_GT50_1.0
 * oSCORAD 模式：BASE_0_83_NO_BONUS
 */

const SCORAD_ENGINE_VERSION = "SCORAD_CLASSIC_BASE_1.0";
const SEVERITY_VERSION = "SCORAD_LT25_25TO50_GT50_1.0";
const OSCORAD_MODE = "BASE_0_83_NO_BONUS";

/** 严重度分层阈值（可配置，默认采用临床研究常用分层） */
const SEVERITY_THRESHOLDS = {
  mildUpper: 25,    // < 25  → 轻度
  moderateUpper: 50 // 25–50 → 中度；> 50 → 重度
};

class ValidationError extends Error {
  constructor(field, message) {
    super(`${field}: ${message}`);
    this.name = "ValidationError";
    this.field = field;
  }
}

/**
 * 校验并标准化输入。
 * @param {Object} raw
 * @returns {Object} 标准化后的输入（数值型）
 */
function normalizeInput(raw) {
  const out = {};

  // 必填核心字段（整数）
  const requiredInt = {
    erythema: { min: 0, max: 3, label: "红斑 B1" },
    edema_papulation: { min: 0, max: 3, label: "水肿/丘疹 B2" },
    oozing_crusting: { min: 0, max: 3, label: "渗出/结痂 B3" },
    excoriation: { min: 0, max: 3, label: "抓痕/表皮剥脱 B4" },
    lichenification: { min: 0, max: 3, label: "苔藓化 B5" },
    dryness: { min: 0, max: 3, label: "干燥 B6" }
  };

  for (const [key, rule] of Object.entries(requiredInt)) {
    const v = raw[key];
    if (v === null || v === undefined || v === "") {
      throw new ValidationError(key, `${rule.label} 未评估（null）`);
    }
    const n = Number(v);
    if (!Number.isInteger(n)) {
      throw new ValidationError(key, `${rule.label} 必须为整数`);
    }
    if (n < rule.min || n > rule.max) {
      throw new ValidationError(key, `${rule.label} 必须在 ${rule.min}–${rule.max} 之间`);
    }
    out[key] = n;
  }

  // 皮损面积 A：0–100，步长 0.1
  const ea = raw.extent_a;
  if (ea === null || ea === undefined || ea === "") {
    throw new ValidationError("extent_a", "皮损面积 A 未评估（null）");
  }
  const eaNum = Number(ea);
  if (Number.isNaN(eaNum)) {
    throw new ValidationError("extent_a", "皮损面积 A 必须为数字");
  }
  if (eaNum < 0 || eaNum > 100) {
    throw new ValidationError("extent_a", "皮损面积 A 必须在 0–100 之间");
  }
  out.extent_a = Math.round(eaNum * 10) / 10;

  // 主观症状：0–10，步长 0.1
  const decimalFields = {
    pruritus: { label: "瘙痒" },
    sleep_loss: { label: "睡眠影响" }
  };
  for (const [key, rule] of Object.entries(decimalFields)) {
    const v = raw[key];
    if (v === null || v === undefined || v === "") {
      throw new ValidationError(key, `${rule.label} 未评估（null）`);
    }
    const n = Number(v);
    if (Number.isNaN(n)) {
      throw new ValidationError(key, `${rule.label} 必须为数字`);
    }
    if (n < 0 || n > 10) {
      throw new ValidationError(key, `${rule.label} 必须在 0–10 之间`);
    }
    // 步长 0.1：四舍五入到 1 位小数
    const rounded = Math.round(n * 10) / 10;
    out[key] = rounded;
  }

  return out;
}

/**
 * 计算 SCORAD 与 oSCORAD。
 * 采用整数运算避免浮点误差（A 与 C 均最多 1 位小数）：
 *   令 a10 = round(A×10)，c10 = round(C×10)，B 为整数
 *   SCORAD = (a10 + 175×B + 5×c10) / 50
 *   oSCORAD = (a10 + 175×B) / 50
 * @param {Object} input 已 normalize 的输入
 * @returns {Object} 完整评分结果
 */
function calculate(input) {
  const norm = normalizeInput(input);

  const A = norm.extent_a;
  const B =
    norm.erythema +
    norm.edema_papulation +
    norm.oozing_crusting +
    norm.excoriation +
    norm.lichenification +
    norm.dryness;
  const C = norm.pruritus + norm.sleep_loss;

  // 整数运算（×50，消除 A/C 小数带来的浮点误差）
  const a10 = Math.round(A * 10);
  const c10 = Math.round(C * 10);
  const scoradX50 = a10 + 175 * B + 5 * c10;
  const objectiveScoradX50 = a10 + 175 * B;

  const scorad = scoradX50 / 50;
  const objectiveScorad = objectiveScoradX50 / 50;

  const severity = classifySeverity(scorad);

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
  };
}

/**
 * 严重度分层。使用精确值比较，禁止先取整。
 * @param {number} scorad
 * @returns {'mild'|'moderate'|'severe'}
 */
function classifySeverity(scorad) {
  if (scorad < SEVERITY_THRESHOLDS.mildUpper) return "mild";
  if (scorad <= SEVERITY_THRESHOLDS.moderateUpper) return "moderate";
  return "severe";
}

const SEVERITY_LABEL = {
  mild: "轻度 Mild",
  moderate: "中度 Moderate",
  severe: "重度 Severe"
};

// 暴露到全局（原型用 <script> 加载，无模块系统）
window.ScoradEngine = {
  calculate,
  normalizeInput,
  classifySeverity,
  ValidationError,
  SEVERITY_LABEL,
  SCORAD_ENGINE_VERSION,
  SEVERITY_VERSION,
  OSCORAD_MODE
};
