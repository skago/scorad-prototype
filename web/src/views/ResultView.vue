<template>
  <div class="card result-card">
    <StepIndicator :current="5" @navigate="onNavigate" @go-home="onGoHome" />
    <h2>评估结果</h2>

    <template v-if="assess.result">
      <div class="score-hero">
        <div class="score-main">
          <span class="label">SCORAD</span>
          <span class="num">{{ assess.result.scorad }}</span>
          <el-tag :type="severityType" size="large" effect="dark">{{ severityLabel }}</el-tag>
        </div>
        <div class="score-obj">
          <span>oSCORAD</span>
          <strong>{{ assess.result.objective_scorad }}</strong>
          <span class="hint">（去除主观症状）</span>
        </div>
      </div>

      <div class="formula">
        <code>SCORAD = A/5 + 7B/2 + C = {{ assess.result.extent_a }}/5 + 7×{{ assess.result.intensity_b }}/2 + {{ assess.result.subjective_c }} = {{ assess.result.scorad }}</code>
      </div>

      <h3>评分明细</h3>
      <el-table :data="detailRows" border size="small" class="detail-table">
        <el-table-column prop="name" label="项目" min-width="130" />
        <el-table-column prop="raw" label="原始值" align="right" width="90" />
        <el-table-column prop="weighted" label="加权值" align="right" width="90" />
        <el-table-column prop="note" label="说明" />
      </el-table>

      <h3>患者信息</h3>
      <el-descriptions :column="2" border size="small" class="info">
        <el-descriptions-item label="评估时间">{{ assess.assessed_at }}</el-descriptions-item>
        <el-descriptions-item label="患者姓名">{{ assess.patient_name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ assess.patient_gender === 'male' ? '男' : assess.patient_gender === 'female' ? '女' : '—' }}</el-descriptions-item>
        <el-descriptions-item label="年龄">{{ assess.patient_age || '—' }}</el-descriptions-item>
        <el-descriptions-item label="患者编号">{{ assess.patient_id || '—' }}</el-descriptions-item>
        <el-descriptions-item label="就诊周次">{{ assess.visit_week || '—' }}</el-descriptions-item>
      </el-descriptions>

      <div class="version-note">
        算法版本：{{ assess.result.scoring_algorithm_version }} ·
        分层版本：{{ assess.result.severity_classification_version }}
      </div>
    </template>

    <div v-else class="empty">
      <el-empty description="暂无评估结果，请先完成评估" />
    </div>

    <div class="actions">
      <el-button type="primary" :disabled="!assess.result" @click="onSave">保存记录</el-button>
      <el-dropdown :disabled="!assess.result" @command="onExport">
        <el-button :disabled="!assess.result">导出</el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="csv">导出 CSV</el-dropdown-item>
            <el-dropdown-item command="csv_deidentified">导出 CSV（去标识）</el-dropdown-item>
            <el-dropdown-item command="json">导出 JSON</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button @click="onRestart">重新评估</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import StepIndicator from '@/components/StepIndicator.vue'
import { useAssessStore } from '@/stores/assessStore'
import { SEVERITY_LABEL } from '@/engine'
import { exportRecordsCsv, downloadJson } from '@/utils/csv'
import type { AssessmentRecord } from '@/storage'

const router = useRouter()
const assess = useAssessStore()

const severityLabel = computed(() =>
  assess.result ? SEVERITY_LABEL[assess.result.scorad_severity] : ''
)
const severityType = computed(() => {
  if (!assess.result) return 'info'
  return assess.result.scorad_severity === 'mild' ? 'success'
    : assess.result.scorad_severity === 'moderate' ? 'warning' : 'danger'
})

const detailRows = computed(() => {
  if (!assess.result) return []
  const r = assess.result
  return [
    { name: '皮损面积 A', raw: `${r.extent_a}`, weighted: `${r.extent_weighted}`, note: 'A/5' },
    { name: '红斑 B1', raw: `${r.erythema}`, weighted: '', note: '客观体征 0–3' },
    { name: '水肿/丘疹 B2', raw: `${r.edema_papulation}`, weighted: '', note: '' },
    { name: '渗出/结痂 B3', raw: `${r.oozing_crusting}`, weighted: '', note: '' },
    { name: '抓痕 B4', raw: `${r.excoriation}`, weighted: '', note: '' },
    { name: '苔藓化 B5', raw: `${r.lichenification}`, weighted: '', note: '' },
    { name: '干燥 B6', raw: `${r.dryness}`, weighted: '', note: '' },
    { name: '强度 B 合计', raw: `${r.intensity_b}`, weighted: `${r.intensity_weighted}`, note: '7B/2' },
    { name: '瘙痒 C1', raw: `${r.pruritus}`, weighted: '', note: '主观症状 0–10' },
    { name: '睡眠影响 C2', raw: `${r.sleep_loss}`, weighted: '', note: '' },
    { name: '主观 C 合计', raw: `${r.subjective_c}`, weighted: `${r.subjective_c}`, note: '直接计入' }
  ]
})

async function onSave() {
  if (!assess.result) return
  await assess.saveRecord()
  ElMessage.success('已保存到本地')
  router.push('/history')
}

function onExport(command: string) {
  if (!assess.result) return
  const record: AssessmentRecord = {
    ...assess.result,
    id: 'temp',
    assessed_at: assess.assessed_at,
    // 临时导出记录（不落库），审计字段占位
    created_at: '',
    updated_at: '',
    created_by: '',
    patient_name: assess.patient_name,
    patient_gender: assess.patient_gender,
    patient_age: assess.patient_age,
    patient_id: assess.patient_id,
    visit_week: assess.visit_week,
    research_project_id: assess.research_project_id || undefined,
    center_id: assess.center_id || undefined,
    subject_screening_no: assess.subject_screening_no || undefined,
    evaluator_id: assess.evaluator_id || undefined,
    evaluator_qualification: assess.evaluator_qualification || undefined,
    blinding: assess.blinding || undefined,
    data_source: assess.data_source || undefined,
    bsa_mode: assess.bsa_mode,
    head_neck: assess.head_neck,
    upper_limbs: assess.upper_limbs,
    trunk: assess.trunk,
    lower_limbs: assess.lower_limbs,
    perineum: assess.perineum
  }
  const base = `scorad_${assess.patient_id || assess.patient_name || 'export'}_${Date.now()}`
  if (command === 'json') {
    downloadJson([record], `${base}.json`)
    ElMessage.success('已导出 JSON')
  } else if (command === 'csv_deidentified') {
    exportRecordsCsv([record], `${base}_deidentified.csv`, { deidentified: true })
    ElMessage.success('已导出去标识 CSV')
  } else {
    exportRecordsCsv([record], `${base}.csv`)
    ElMessage.success('已导出 CSV')
  }
}

function onRestart() {
  assess.reset()
  router.push('/assess/step1')
}

function onGoHome() {
  router.push('/')
}

async function onNavigate(step: number) {
  await assess.saveDraft()
  router.push(`/assess/step${step}`)
}
</script>

<style scoped>
.card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
}
h2 { font-size: 18px; margin-bottom: 16px; }
h3 { font-size: 15px; margin: 20px 0 10px; color: var(--primary-dark); }
.score-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  border-radius: 10px;
  margin-bottom: 16px;
}
.score-main { display: flex; flex-direction: column; gap: 4px; }
.score-main .label { font-size: 13px; color: var(--primary-dark); }
.score-main .num { font-size: 44px; font-weight: 800; color: var(--primary-dark); line-height: 1; }
.score-obj { text-align: right; }
.score-obj strong { display: block; font-size: 26px; color: var(--primary); }
.score-obj .hint { font-size: 11px; color: var(--text-muted); }
.formula {
  background: #f5f5f5;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  overflow-x: auto;
}
.formula code { font-family: 'SF Mono', Menlo, monospace; }
.detail-table { margin-bottom: 8px; }
.info { margin-bottom: 8px; }
.version-note {
  margin-top: 16px;
  font-size: 11px;
  color: var(--text-muted);
}
.empty { padding: 40px 0; }
.actions { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
</style>
