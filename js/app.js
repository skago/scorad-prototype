/**
 * SCORAD Assessment Tool - UI 交互逻辑
 * 依赖 engine.js（window.ScoradEngine）
 *
 * 功能：
 * - 单页多屏导航
 * - 四步评估表单 + 实时校验
 * - SCORAD 计算与结果渲染
 * - localStorage 持久化（草稿 + 已保存记录）
 * - 单条 / 全部 CSV 导出
 */

(function () {
  "use strict";

  const STORAGE_KEY = "scorad_records_v1";
  const DRAFT_KEY = "scorad_draft_v1";
  const USER_KEY = "scorad_user_v1";

  // 当前登录用户（null = 未登录）
  let currentUser = null;

  // B 项体征定义
  const B_ITEMS = [
    { key: "erythema", label: "红斑", en: "Erythema" },
    { key: "edema_papulation", label: "水肿/丘疹", en: "Oedema/Papulation" },
    { key: "oozing_crusting", label: "渗出/结痂", en: "Oozing/Crusting" },
    { key: "excoriation", label: "抓痕/表皮剥脱", en: "Excoriation" },
    { key: "lichenification", label: "苔藓化", en: "Lichenification" },
    { key: "dryness", label: "干燥", en: "Dryness", special: "应在非炎症性皮肤区域评价" }
  ];

  // 身体部位分组（Rule of Nines，成人）
  const BODY_PARTS = [
    { key: "head_neck", label: "头颈部（前+后）", max: 9 },
    { key: "upper_limbs", label: "双上肢（前+后）", max: 18 },
    { key: "trunk", label: "躯干（前+后）", max: 36 },
    { key: "lower_limbs", label: "双下肢（前+后）", max: 36 },
    { key: "perineum", label: "会阴", max: 1 }
  ];

  const SCORE_LABELS = ["无", "轻", "中", "重"];

  // 科研扩展字段
  const RESEARCH_FIELDS = [
    "research_project_id", "center_id", "subject_screening_no",
    "evaluator_id", "evaluator_qualification", "blinding", "data_source"
  ];

  // 科研模式开关状态
  let researchMode = false;

  // 当前表单状态（内存中）
  let formState = {
    assessed_at: "",
    patient_name: "",
    patient_gender: "",
    patient_age: "",
    patient_id: "",
    visit_week: "",
    research_project_id: "",
    center_id: "",
    subject_screening_no: "",
    evaluator_id: "",
    evaluator_qualification: "",
    blinding: "",
    data_source: "",
    head_neck: 0,
    upper_limbs: 0,
    trunk: 0,
    lower_limbs: 0,
    perineum: 0,
    extent_a: 0,
    erythema: null,
    edema_papulation: null,
    oozing_crusting: null,
    excoriation: null,
    lichenification: null,
    dryness: null,
    pruritus: 0,
    sleep_loss: 0
  };

  // 生成 UUID（兼容非 HTTPS / file:// 环境下 crypto.randomUUID 不可用）
  function genUUID() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  // 当前计算结果
  let currentResult = null;

  // ============== 导航 ==============
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => (s.style.display = "none"));
    const el = document.getElementById("screen-" + id);
    if (el) el.style.display = "block";
    window.scrollTo(0, 0);
  }

  document.addEventListener("click", (e) => {
    const nav = e.target.getAttribute("data-nav");
    if (nav) {
      // 登录拦截：除 login 外，所有页面均需登录
      if (nav !== "login" && !currentUser) {
        showScreen("login");
        return;
      }
      showScreen(nav);
    }
  });

  // ============== 用户认证（仅微信登录） ==============
  function loadUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      currentUser = u ? JSON.parse(u) : null;
    } catch {
      currentUser = null;
    }
    updateUserBar();
  }

  function updateUserBar() {
    const bar = document.getElementById("user-bar");
    if (currentUser) {
      bar.style.display = "flex";
      document.getElementById("user-name").textContent = currentUser.nickname || "微信用户";
    } else {
      bar.style.display = "none";
    }
  }

  // 模拟微信 OAuth 授权登录（原型阶段用 mock 用户）
  function wechatLogin() {
    // 实际开发：跳转微信 OAuth 授权页，回调带 code，后端用 code 换 openid + access_token
    // 原型：直接生成 mock 微信用户
    const mockUser = {
      openid: "o" + Math.random().toString(36).slice(2, 12),
      nickname: "微信用户" + Math.floor(Math.random() * 9000 + 1000),
      avatar: "",
      login_at: new Date().toISOString()
    };
    currentUser = mockUser;
    localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
    updateUserBar();
    showScreen("home");
  }

  function logout() {
    if (!confirm("确定退出登录？")) return;
    currentUser = null;
    localStorage.removeItem(USER_KEY);
    updateUserBar();
    showScreen("login");
  }

  // ============== 初始化 ==============
  function init() {
    // 1. 恢复登录态；未登录则停留在登录页
    loadUser();
    if (!currentUser) {
      showScreen("login");
    } else {
      showScreen("home");
    }

    // 默认评估时间 = 当前本地时间
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById("f-assessed_at").value = now.toISOString().slice(0, 16);

    renderBItems();
    renderBodyParts();
    bindSlider("f-pruritus", "v-pruritus");
    bindSlider("f-sleep_loss", "v-sleep_loss");

    // 恢复草稿
    loadDraft();

    // 绑定认证按钮
    document.getElementById("btn-wechat-login").addEventListener("click", wechatLogin);
    document.getElementById("btn-logout").addEventListener("click", logout);

    // 科研模式开关
    const rmToggle = document.getElementById("research-mode-toggle");
    researchMode = localStorage.getItem("scorad_research_mode") === "1";
    rmToggle.checked = researchMode;
    document.getElementById("research-fields").style.display = researchMode ? "block" : "none";
    rmToggle.addEventListener("change", () => {
      researchMode = rmToggle.checked;
      localStorage.setItem("scorad_research_mode", researchMode ? "1" : "0");
      document.getElementById("research-fields").style.display = researchMode ? "block" : "none";
    });

    // 绑定按钮
    document.getElementById("btn-step1-next").addEventListener("click", goStep2);
    document.getElementById("btn-step2-back").addEventListener("click", () => showScreen("step1"));
    document.getElementById("btn-step2-next").addEventListener("click", goStep3);
    document.getElementById("btn-step3-back").addEventListener("click", () => showScreen("step2"));
    document.getElementById("btn-step3-next").addEventListener("click", goStep4);
    document.getElementById("btn-step4-back").addEventListener("click", () => showScreen("step3"));
    document.getElementById("btn-calculate").addEventListener("click", calculate);
    document.getElementById("btn-save").addEventListener("click", saveRecord);
    document.getElementById("btn-export-csv").addEventListener("click", () => exportCSV([currentResult]));
    document.getElementById("btn-export-all").addEventListener("click", exportAllCSV);
    document.getElementById("btn-restart").addEventListener("click", resetForm);

    // 进入历史页时渲染列表
    document.querySelectorAll('[data-nav="history"]').forEach((b) =>
      b.addEventListener("click", renderHistory)
    );
  }

  // ============== B 项渲染 ==============
  function renderBItems() {
    const container = document.getElementById("b-items");
    container.innerHTML = B_ITEMS.map((item) => {
      const radios = [0, 1, 2, 3]
        .map(
          (v) => `
          <input type="radio" name="${item.key}" id="${item.key}-${v}" value="${v}" />
          <label for="${item.key}-${v}">
            <span class="score-val">${v}</span>
            <span class="score-label">${SCORE_LABELS[v]}</span>
          </label>`
        )
        .join("");
      const special = item.special
        ? `<div class="alert alert-warn" style="margin-top:8px;font-size:12px;">${item.special}</div>`
        : "";
      return `
        <div class="form-group" style="margin-bottom:20px;">
          <label>${item.label} <span style="color:var(--text-muted);font-weight:400;">(${item.en})</span></label>
          <div class="radio-group">${radios}</div>
          ${special}
        </div>`;
    }).join("");
  }

  // ============== 身体部位渲染 ==============
  function renderBodyParts() {
    const container = document.getElementById("body-parts");
    container.innerHTML = BODY_PARTS.map((part) => {
      return `
        <div class="form-group" style="margin-bottom:16px;">
          <label>${part.label} <span style="color:var(--text-muted);font-weight:400;">（该部位体表面积占比上限 ${part.max}%）</span></label>
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="number" id="f-${part.key}" data-max="${part.max}" min="0" max="${part.max}" step="0.1" value="0" style="flex:1;" />
            <span style="color:var(--text-muted);">%</span>
          </div>
        </div>`;
    }).join("");

    // 绑定 input 事件，实时更新合计
    BODY_PARTS.forEach((part) => {
      const inp = document.getElementById(`f-${part.key}`);
      inp.addEventListener("input", updateExtentTotal);
    });
    updateExtentTotal();
  }

  function updateExtentTotal() {
    let total = 0;
    BODY_PARTS.forEach((part) => {
      const inp = document.getElementById(`f-${part.key}`);
      const v = parseFloat(inp.value);
      total += Number.isFinite(v) ? v : 0;
    });
    document.getElementById("extent-total").textContent = total.toFixed(1);
  }

  // ============== Slider 绑定 ==============
  function bindSlider(inputId, valId) {
    const input = document.getElementById(inputId);
    const val = document.getElementById(valId);
    input.addEventListener("input", () => {
      val.textContent = Number(input.value).toFixed(1);
    });
  }

  // ============== 表单收集与校验 ==============
  function collectForm() {
    formState.assessed_at = document.getElementById("f-assessed_at").value;
    formState.patient_name = document.getElementById("f-patient_name").value.trim();
    formState.patient_gender = document.getElementById("f-patient_gender").value;
    formState.patient_age = document.getElementById("f-patient_age").value;
    formState.patient_id = document.getElementById("f-patient_id").value.trim();
    formState.visit_week = document.getElementById("f-visit_week").value;

    // 收集科研扩展字段
    RESEARCH_FIELDS.forEach((key) => {
      const el = document.getElementById("f-" + key);
      formState[key] = el ? el.value : "";
    });

    // 收集各身体部位百分比并计算 A
    let total = 0;
    BODY_PARTS.forEach((part) => {
      const inp = document.getElementById(`f-${part.key}`);
      const v = parseFloat(inp.value);
      const val = Number.isFinite(v) ? v : 0;
      formState[part.key] = val;
      total += val;
    });
    formState.extent_a = Math.round(total * 10) / 10;

    formState.pruritus = document.getElementById("f-pruritus").value;
    formState.sleep_loss = document.getElementById("f-sleep_loss").value;

    B_ITEMS.forEach((item) => {
      const checked = document.querySelector(`input[name="${item.key}"]:checked`);
      formState[item.key] = checked ? parseInt(checked.value, 10) : null;
    });
  }

  function validateStep1() {
    const t = document.getElementById("f-assessed_at").value;
    if (!t) return "请填写评估时间";
    return null;
  }

  function validateStep2() {
    for (const part of BODY_PARTS) {
      const inp = document.getElementById(`f-${part.key}`);
      const raw = inp.value.trim();
      if (raw === "") return `请填写「${part.label}」百分比`;
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) return `「${part.label}」必须为数字`;
      if (v < 0 || v > part.max) return `「${part.label}」必须在 0–${part.max} 之间`;
      // 校验最多 1 位小数
      if (!/^\d+(\.\d)?$/.test(raw)) return `「${part.label}」最多保留 1 位小数`;
    }
    return null;
  }

  function validateStep3() {
    for (const item of B_ITEMS) {
      const checked = document.querySelector(`input[name="${item.key}"]:checked`);
      if (!checked) return `请完成「${item.label}」评分`;
    }
    return null;
  }

  // ============== 步骤跳转 ==============
  function goStep2() {
    const err = validateStep1();
    if (err) return alert(err);
    saveDraft();
    showScreen("step2");
  }

  function goStep3() {
    const err = validateStep2();
    if (err) return alert(err);
    saveDraft();
    showScreen("step3");
  }

  function goStep4() {
    const err = validateStep3();
    if (err) return alert(err);
    saveDraft();
    showScreen("step4");
  }

  // ============== 计算 ==============
  function calculate() {
    collectForm();
    try {
      currentResult = ScoradEngine.calculate(formState);
    } catch (e) {
      if (e instanceof ScoradEngine.ValidationError) {
        return alert("校验失败：" + e.message);
      }
      throw e;
    }

    // 附带元数据
    currentResult.id = genUUID();
    currentResult.assessed_at = formState.assessed_at;
    currentResult.patient_name = formState.patient_name;
    currentResult.patient_gender = formState.patient_gender;
    currentResult.patient_age = formState.patient_age;
    currentResult.patient_id = formState.patient_id;
    currentResult.visit_week = formState.visit_week;
    RESEARCH_FIELDS.forEach((key) => {
      currentResult[key] = formState[key] || "";
    });
    currentResult.bsa_mode = "rule_of_nines";
    currentResult.head_neck = formState.head_neck;
    currentResult.upper_limbs = formState.upper_limbs;
    currentResult.trunk = formState.trunk;
    currentResult.lower_limbs = formState.lower_limbs;
    currentResult.perineum = formState.perineum;
    currentResult.app_version = "1.0-draft";

    renderResult();
    showScreen("result");
  }

  function renderResult() {
    const r = currentResult;
    document.getElementById("r-scorad").textContent = r.scorad.toFixed(2);
    document.getElementById("r-oscore").textContent = r.objective_scorad.toFixed(2);

    const sev = document.getElementById("r-severity");
    sev.textContent = ScoradEngine.SEVERITY_LABEL[r.scorad_severity];
    sev.className = "severity-badge severity-" + r.scorad_severity;

    // 明细
    const tb = document.getElementById("r-breakdown");
    const bodyPartRows = BODY_PARTS.map((p) =>
      `<tr><td style="padding-left:24px;color:var(--text-muted);">　${p.label}</td><td class="num">${Number(r[p.key] || 0).toFixed(1)}</td><td class="num"></td></tr>`
    ).join("");
    tb.innerHTML = `
      <tr><td>A 皮损面积</td><td class="num">${r.extent_a.toFixed(1)}</td><td class="num">${r.extent_weighted.toFixed(2)}</td></tr>
      ${bodyPartRows}
      <tr><td>B1 红斑</td><td class="num">${r.erythema}</td><td class="num"></td></tr>
      <tr><td>B2 水肿/丘疹</td><td class="num">${r.edema_papulation}</td><td class="num"></td></tr>
      <tr><td>B3 渗出/结痂</td><td class="num">${r.oozing_crusting}</td><td class="num"></td></tr>
      <tr><td>B4 抓痕/表皮剥脱</td><td class="num">${r.excoriation}</td><td class="num"></td></tr>
      <tr><td>B5 苔藓化</td><td class="num">${r.lichenification}</td><td class="num"></td></tr>
      <tr><td>B6 干燥</td><td class="num">${r.dryness}</td><td class="num"></td></tr>
      <tr><td>B 合计（0–18）</td><td class="num">${r.intensity_b}</td><td class="num">${r.intensity_weighted.toFixed(1)}</td></tr>
      <tr><td>C 瘙痒</td><td class="num">${r.pruritus.toFixed(1)}</td><td class="num"></td></tr>
      <tr><td>C 睡眠影响</td><td class="num">${r.sleep_loss.toFixed(1)}</td><td class="num"></td></tr>
      <tr><td>C 合计（0–20）</td><td class="num">${r.subjective_c.toFixed(1)}</td><td class="num">${r.subjective_c.toFixed(1)}</td></tr>
      <tr class="total"><td>SCORAD = A/5 + 7B/2 + C</td><td class="num"></td><td class="num">${r.scorad.toFixed(2)}</td></tr>
    `;

    document.getElementById("r-formula").textContent =
      `${r.extent_a.toFixed(1)}/5 + 7×${r.intensity_b}/2 + ${r.subjective_c.toFixed(1)} = ` +
      `${r.extent_weighted.toFixed(2)} + ${r.intensity_weighted.toFixed(1)} + ${r.subjective_c.toFixed(1)} = ${r.scorad.toFixed(2)}`;

    document.getElementById("r-algo-ver").textContent = r.scoring_algorithm_version;
    document.getElementById("r-sev-ver").textContent = r.severity_classification_version;
  }

  // ============== 保存记录 ==============
  function saveRecord() {
    if (!currentResult) return;
    const records = loadRecords();
    records.push(currentResult);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    // 清除草稿并重置表单，避免新评估残留旧数据
    localStorage.removeItem(DRAFT_KEY);
    currentResult = null;
    resetFormFields();
    alert("记录已保存到本地");
    showScreen("home");
  }

  function resetFormFields() {
    // 重置内存状态
    formState = {
      assessed_at: "", patient_name: "", patient_gender: "", patient_age: "", patient_id: "", visit_week: "",
      research_project_id: "", center_id: "", subject_screening_no: "",
      evaluator_id: "", evaluator_qualification: "", blinding: "", data_source: "",
      head_neck: 0, upper_limbs: 0, trunk: 0, lower_limbs: 0, perineum: 0, extent_a: 0,
      erythema: null, edema_papulation: null, oozing_crusting: null,
      excoriation: null, lichenification: null, dryness: null,
      pruritus: 0, sleep_loss: 0
    };
    // 重置 DOM
    document.getElementById("f-patient_name").value = "";
    document.getElementById("f-patient_gender").value = "";
    document.getElementById("f-patient_age").value = "";
    document.getElementById("f-patient_id").value = "";
    document.getElementById("f-visit_week").value = "";
    RESEARCH_FIELDS.forEach((key) => {
      const el = document.getElementById("f-" + key);
      if (el) el.value = "";
    });
    BODY_PARTS.forEach((part) => {
      document.getElementById(`f-${part.key}`).value = "0";
    });
    updateExtentTotal();
    document.getElementById("f-pruritus").value = 0;
    document.getElementById("f-sleep_loss").value = 0;
    document.getElementById("v-pruritus").textContent = "0.0";
    document.getElementById("v-sleep_loss").textContent = "0.0";
    document.querySelectorAll('input[type="radio"]').forEach((r) => (r.checked = false));
    // 评估时间重置为当前
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById("f-assessed_at").value = now.toISOString().slice(0, 16);
  }

  function loadRecords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  // ============== 历史记录 ==============
  function renderHistory() {
    const records = loadRecords().sort((a, b) => (a.assessed_at < b.assessed_at ? 1 : -1));
    const list = document.getElementById("history-list");
    if (records.length === 0) {
      list.innerHTML = `<div class="empty-state">暂无记录</div>`;
      return;
    }
    // 使用 textContent 构造文本节点，避免患者姓名/编号中的引号破坏 HTML
    list.innerHTML = records
      .map((r) => {
        const name = r.patient_name ? escapeHtml(r.patient_name) : (r.subject_screening_no ? escapeHtml(r.subject_screening_no) : "(未填)");
        const pid = r.patient_id ? ` #${escapeHtml(r.patient_id)}` : "";
        const proj = r.research_project_id ? ` · ${escapeHtml(r.research_project_id)}` : "";
        const gender = r.patient_gender ? ` · ${escapeHtml(r.patient_gender)}` : "";
        const age = r.patient_age ? ` ${escapeHtml(String(r.patient_age))}岁` : "";
        const week = r.visit_week ? ` · 第${escapeHtml(String(r.visit_week))}周` : "";
        const assessed = escapeHtml(String(r.assessed_at).replace("T", " "));
        const sev = escapeHtml(ScoradEngine.SEVERITY_LABEL[r.scorad_severity] || "");
        return `
          <div class="history-item" data-id="${r.id}">
            <div>
              <div><strong>${name}${pid}</strong>${proj}${gender}${age}${week}</div>
              <div class="history-meta">${assessed} · ${sev}</div>
              <div class="history-actions">
                <button data-action="view" data-id="${r.id}">查看</button>
                <button data-action="export" data-id="${r.id}">导出CSV</button>
                <button data-action="delete" data-id="${r.id}" style="color:var(--severe);border-color:#ffcdd2;">删除</button>
              </div>
            </div>
            <div class="history-score">${Number(r.scorad).toFixed(2)}</div>
          </div>`;
      })
      .join("");
  }

  // HTML 转义，防止注入
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // 历史记录事件委托（查看 / 导出 / 删除）
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!id) return;
    if (action === "view") viewRecord(id);
    else if (action === "export") exportOne(id);
    else if (action === "delete") deleteRecord(id);
  });

  function viewRecord(id) {
    const r = loadRecords().find((x) => x.id === id);
    if (!r) return;
    currentResult = r;
    renderResult();
    showScreen("result");
  }

  function deleteRecord(id) {
    if (!confirm("确定删除该记录？")) return;
    const records = loadRecords().filter((x) => x.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    renderHistory();
  }

  function exportOne(id) {
    const r = loadRecords().find((x) => x.id === id);
    if (r) exportCSV([r]);
  }

  // ============== CSV 导出 ==============
  const CSV_HEADERS = [
    "record_id", "assessed_at", "patient_name", "patient_gender", "patient_age", "patient_id", "visit_week",
    "research_project_id", "center_id", "subject_screening_no",
    "evaluator_id", "evaluator_qualification", "blinding", "data_source", "bsa_mode",
    "head_neck", "upper_limbs", "trunk", "lower_limbs", "perineum", "extent_a",
    "erythema", "edema_papulation", "oozing_crusting", "excoriation",
    "lichenification", "dryness", "intensity_b", "pruritus", "sleep_loss", "subjective_c",
    "extent_weighted", "intensity_weighted", "scorad", "objective_scorad", "scorad_severity",
    "scoring_algorithm_version", "severity_classification_version", "objective_scorad_mode",
    "app_version"
  ];

  function recordToRow(r) {
    return CSV_HEADERS.map((h) => {
      let v = r[h];
      if (v === undefined || v === null) v = "";
      if (typeof v === "number") {
        // 皮损面积与主观症状保留 1 位小数；加权值与总分保留 2 位小数
        if (["head_neck", "upper_limbs", "trunk", "lower_limbs", "perineum", "extent_a", "pruritus", "sleep_loss", "subjective_c"].includes(h)) {
          v = v.toFixed(1);
        } else if (["extent_weighted", "intensity_weighted", "scorad", "objective_scorad"].includes(h)) {
          v = v.toFixed(2);
        }
      }
      const s = String(v);
      // 含逗号/引号/换行时加引号
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(",");
  }

  function exportCSV(records) {
    if (!records || records.length === 0) return alert("无数据可导出");
    const rows = [CSV_HEADERS.join(","), ...records.map(recordToRow)];
    // UTF-8 BOM，兼容 Excel 中文
    const csv = "\uFEFF" + rows.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scorad_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportAllCSV() {
    const records = loadRecords();
    if (records.length === 0) return alert("暂无记录");
    exportCSV(records);
  }

  // ============== 草稿持久化（防刷新丢数据） ==============
  function saveDraft() {
    collectForm();
    localStorage.setItem(DRAFT_KEY, JSON.stringify(formState));
  }

  function loadDraft() {
    const d = localStorage.getItem(DRAFT_KEY);
    if (!d) return;
    try {
      const draft = JSON.parse(d);
      Object.assign(formState, draft);
      // 回填表单
      if (draft.assessed_at) document.getElementById("f-assessed_at").value = draft.assessed_at;
      if (draft.patient_name) document.getElementById("f-patient_name").value = draft.patient_name;
      if (draft.patient_gender) document.getElementById("f-patient_gender").value = draft.patient_gender;
      if (draft.patient_age) document.getElementById("f-patient_age").value = draft.patient_age;
      if (draft.patient_id) document.getElementById("f-patient_id").value = draft.patient_id;
      if (draft.visit_week) document.getElementById("f-visit_week").value = draft.visit_week;
      // 回填科研字段
      RESEARCH_FIELDS.forEach((key) => {
        if (draft[key] !== undefined && draft[key] !== null) {
          const el = document.getElementById("f-" + key);
          if (el) el.value = String(draft[key]);
        }
      });
      // 回填身体部位
      BODY_PARTS.forEach((part) => {
        if (draft[part.key] !== undefined && draft[part.key] !== null) {
          const inp = document.getElementById(`f-${part.key}`);
          if (inp) inp.value = String(draft[part.key]);
        }
      });
      updateExtentTotal();
      if (draft.pruritus !== undefined) {
        document.getElementById("f-pruritus").value = draft.pruritus;
        document.getElementById("v-pruritus").textContent = Number(draft.pruritus).toFixed(1);
      }
      if (draft.sleep_loss !== undefined) {
        document.getElementById("f-sleep_loss").value = draft.sleep_loss;
        document.getElementById("v-sleep_loss").textContent = Number(draft.sleep_loss).toFixed(1);
      }
      B_ITEMS.forEach((item) => {
        if (draft[item.key] !== null && draft[item.key] !== undefined) {
          const rb = document.getElementById(`${item.key}-${draft[item.key]}`);
          if (rb) rb.checked = true;
        }
      });
    } catch {
      // ignore
    }
  }

  function resetForm() {
    localStorage.removeItem(DRAFT_KEY);
    currentResult = null;
    resetFormFields();
    showScreen("home");
  }

  // 启动
  init();
})();
