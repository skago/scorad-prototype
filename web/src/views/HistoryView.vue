<template>
  <div class="card">
    <div class="head">
      <h2>历史记录</h2>
      <div class="head-actions">
        <el-button :disabled="!records.length" @click="onValidateAll">数据校验</el-button>
        <el-button @click="onImportCsv">导入 CSV</el-button>
        <input ref="fileInput" type="file" accept=".csv" style="display: none" @change="onFileChange" />
        <el-dropdown :disabled="!records.length" @command="onExportCommand">
          <el-button type="primary" :disabled="!records.length">导出全部</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="csv">导出全部 CSV</el-dropdown-item>
              <el-dropdown-item command="csv_deidentified">导出全部 CSV（去标识）</el-dropdown-item>
              <el-dropdown-item command="json">导出全部 JSON</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- SCORAD 趋势图 -->
    <div v-if="records.length > 1" class="chart-box">
      <h3>SCORAD 趋势图</h3>
      <div ref="chartRef" class="chart"></div>
    </div>

    <!-- 校验结果 -->
    <el-alert
      v-if="validationIssues.length"
      :title="`发现 ${validationIssues.length} 项数据不一致`"
      type="warning"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    >
      <div class="issues">
        <div v-for="(issue, i) in validationIssues" :key="i" class="issue">
          第 {{ issue.row }} 行 · {{ issue.field }}：{{ issue.message }}（期望 {{ issue.expected }}，实际 {{ issue.actual }}）
        </div>
      </div>
    </el-alert>
    <el-alert
      v-else-if="validated"
      title="所有记录数据校验通过"
      type="success"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-table v-if="records.length" :data="records" border size="small">
      <el-table-column prop="assessed_at" label="评估时间" width="160" />
      <el-table-column label="患者" width="120">
        <template #default="{ row }">
          {{ row.subject_screening_no || row.patient_id || row.patient_name || '—' }}
        </template>
      </el-table-column>
      <el-table-column prop="scorad" label="SCORAD" width="90" align="right" />
      <el-table-column prop="objective_scorad" label="oSCORAD" width="90" align="right" />
      <el-table-column label="严重度" width="90">
        <template #default="{ row }">
          <el-tag :type="sevType(row.scorad_severity)" size="small">{{ sevLabel(row.scorad_severity) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="onView(row)">查看</el-button>
          <el-button link type="primary" size="small" @click="onExportOne(row)">导出</el-button>
          <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else description="暂无评估记录" />

    <el-button @click="$router.push('/')" style="margin-top: 16px">返回首页</el-button>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import { useRecordStore } from '@/stores/recordStore'
import { useAssessStore } from '@/stores/assessStore'
import { SEVERITY_LABEL, type Severity } from '@/engine'
import { exportRecordsCsv, downloadJson, importRecordsFromCsv, validateRecords, type ValidationIssue } from '@/utils/csv'
import { getOrCreateUserId } from '@/utils/uuid'
import type { AssessmentRecord } from '@/storage'

const router = useRouter()
const recordStore = useRecordStore()
const assessStore = useAssessStore()
const records = ref<AssessmentRecord[]>([])
const validationIssues = ref<ValidationIssue[]>([])
const validated = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const chartRef = ref<HTMLDivElement | null>(null)
let chartInstance: echarts.ECharts | null = null

onMounted(async () => {
  await recordStore.loadRecords()
  refreshRecords()
})

onUnmounted(() => {
  chartInstance?.dispose()
})

function refreshRecords() {
  records.value = [...recordStore.records].sort((a, b) => b.assessed_at.localeCompare(a.assessed_at))
  validated.value = false
  validationIssues.value = []
  nextTick(renderChart)
}

watch(records, () => nextTick(renderChart), { deep: true })

function renderChart() {
  if (!chartRef.value || records.value.length < 2) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }
  // 按时间升序排列
  const sorted = [...records.value].sort((a, b) => a.assessed_at.localeCompare(b.assessed_at))
  const dates = sorted.map((r) => r.assessed_at.replace('T', ' ').slice(0, 16))
  const scoradData = sorted.map((r) => r.scorad)
  const objData = sorted.map((r) => r.objective_scorad)

  chartInstance.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['SCORAD', 'oSCORAD'], bottom: 0 },
    grid: { left: 40, right: 20, top: 30, bottom: 50 },
    xAxis: { type: 'category', data: dates, axisLabel: { rotate: 30, fontSize: 10 } },
    yAxis: { type: 'value', name: '分数' },
    series: [
      {
        name: 'SCORAD',
        type: 'line',
        data: scoradData,
        smooth: true,
        symbol: 'circle',
        itemStyle: { color: '#1565c0' },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(76, 175, 80, 0.08)' },
          data: [[{ yAxis: 0 }, { yAxis: 25 }]]
        }
      },
      {
        name: 'oSCORAD',
        type: 'line',
        data: objData,
        smooth: true,
        symbol: 'circle',
        itemStyle: { color: '#ff9800' }
      }
    ]
  })
  chartInstance.resize()
}

function sevLabel(s: Severity) {
  return SEVERITY_LABEL[s]
}
function sevType(s: Severity) {
  return s === 'mild' ? 'success' : s === 'moderate' ? 'warning' : 'danger'
}

function onView(row: AssessmentRecord) {
  assessStore.loadRecord(row)
  router.push('/result')
}

function onExportOne(row: AssessmentRecord) {
  const name = `scorad_${row.patient_id || row.patient_name || 'record'}_${row.id.slice(0, 8)}.csv`
  exportRecordsCsv([row], name)
  ElMessage.success('已导出 CSV')
}

function onExportCommand(command: string) {
  const ts = Date.now()
  if (command === 'json') {
    downloadJson(records.value, `scorad_all_${ts}.json`)
    ElMessage.success(`已导出 ${records.value.length} 条记录（JSON）`)
  } else if (command === 'csv_deidentified') {
    exportRecordsCsv(records.value, `scorad_all_deidentified_${ts}.csv`, { deidentified: true })
    ElMessage.success(`已导出 ${records.value.length} 条记录（去标识 CSV）`)
  } else {
    exportRecordsCsv(records.value, `scorad_all_${ts}.csv`)
    ElMessage.success(`已导出 ${records.value.length} 条记录`)
  }
}

function onValidateAll() {
  validationIssues.value = validateRecords(records.value)
  validated.value = true
  if (validationIssues.value.length === 0) {
    ElMessage.success('数据校验通过，所有记录公式一致')
  } else {
    ElMessage.warning(`发现 ${validationIssues.value.length} 项不一致`)
  }
}

function onImportCsv() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const text = await file.text()
  const imported = importRecordsFromCsv(text, await getOrCreateUserId())
  if (imported.length === 0) {
    ElMessage.error('未解析到有效记录，请检查 CSV 格式')
    input.value = ''
    return
  }
  // 逐条保存
  let ok = 0
  for (const rec of imported) {
    try {
      await recordStore.saveRecord(rec)
      ok++
    } catch {
      /* skip */
    }
  }
  refreshRecords()
  ElMessage.success(`成功导入 ${ok}/${imported.length} 条记录`)
  input.value = ''
}

async function onDelete(row: AssessmentRecord) {
  try {
    await ElMessageBox.confirm('确定删除该记录？此操作不可撤销。', '删除确认', { type: 'warning' })
    await recordStore.deleteRecord(row.id)
    refreshRecords()
    ElMessage.success('已删除')
  } catch {
    /* cancelled */
  }
}
</script>

<style scoped>
.card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
}
.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;
}
.head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
h2 { font-size: 18px; }
h3 { font-size: 15px; margin: 0 0 8px; }
.chart-box {
  margin-bottom: 16px;
  padding: 16px;
  background: #f7f9fc;
  border-radius: 8px;
}
.chart { width: 100%; height: 320px; }
.issues { margin-top: 8px; }
.issue { font-size: 13px; line-height: 1.8; }
</style>
