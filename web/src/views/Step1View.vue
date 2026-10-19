<template>
  <div class="card">
    <StepIndicator :current="1" @navigate="onNavigate" @go-home="onGoHome" />
    <h2>第一步：记录信息</h2>

    <el-form :model="form" label-width="120px" size="default">
      <el-form-item label="评估时间" required>
        <el-date-picker
          v-model="form.assessed_at"
          type="datetime"
          placeholder="选择评估时间"
          format="YYYY-MM-DD HH:mm"
          value-format="YYYY-MM-DDTHH:mm"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="患者姓名">
        <el-input v-model="form.patient_name" placeholder="选填" />
      </el-form-item>
      <el-form-item label="性别">
        <el-radio-group v-model="form.patient_gender">
          <el-radio value="male">男</el-radio>
          <el-radio value="female">女</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="年龄">
        <el-input-number v-model="form.patient_age" :min="0" :max="120" controls-position="right" />
        <span class="hint">影响体表面积表选择（＜14 岁用 Lund-Browder）</span>
      </el-form-item>
      <el-form-item label="患者编号">
        <el-input v-model="form.patient_id" placeholder="选填" />
      </el-form-item>
      <el-form-item label="就诊周次">
        <el-input v-model="form.visit_week" placeholder="如：第 4 周" />
      </el-form-item>

      <div v-if="assess.researchMode" class="research-panel">
        <div class="research-title">科研信息（选填）</div>
        <el-form-item label="研究项目编号">
          <el-input v-model="form.research_project_id" />
        </el-form-item>
        <el-form-item label="中心编号">
          <el-input v-model="form.center_id" />
        </el-form-item>
        <el-form-item label="受试者筛选号">
          <el-input v-model="form.subject_screening_no" />
        </el-form-item>
        <el-form-item label="评估者 ID">
          <el-input v-model="form.evaluator_id" />
        </el-form-item>
        <el-form-item label="评估者资质">
          <el-input v-model="form.evaluator_qualification" />
        </el-form-item>
        <el-form-item label="盲法标记">
          <el-select v-model="form.blinding" placeholder="请选择" style="width: 100%">
            <el-option label="无盲法" value="none" />
            <el-option label="单盲" value="single" />
            <el-option label="双盲" value="double" />
          </el-select>
        </el-form-item>
        <el-form-item label="数据来源">
          <el-select v-model="form.data_source" placeholder="请选择" style="width: 100%">
            <el-option label="现场评估" value="onsite" />
            <el-option label="照片评估" value="photo" />
            <el-option label="远程评估" value="remote" />
          </el-select>
        </el-form-item>
      </div>
    </el-form>

    <div class="actions">
      <el-button @click="onCancel">取消</el-button>
      <el-button type="primary" @click="onNext">下一步</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import StepIndicator from '@/components/StepIndicator.vue'
import { useAssessStore } from '@/stores/assessStore'

const router = useRouter()
const assess = useAssessStore()

const form = reactive({
  assessed_at: assess.assessed_at,
  patient_name: assess.patient_name,
  patient_gender: assess.patient_gender,
  patient_age: assess.patient_age === '' ? null : Number(assess.patient_age),
  patient_id: assess.patient_id,
  visit_week: assess.visit_week,
  research_project_id: assess.research_project_id,
  center_id: assess.center_id,
  subject_screening_no: assess.subject_screening_no,
  evaluator_id: assess.evaluator_id,
  evaluator_qualification: assess.evaluator_qualification,
  blinding: assess.blinding,
  data_source: assess.data_source
})

onMounted(async () => {
  // 恢复未完成的草稿（已有计算结果时跳过，防覆盖已完成的评估）
  if (!assess.result) {
    const restored = await assess.loadDraft()
    if (restored) {
      syncFromStore()
      ElMessage.info('已恢复未完成的草稿')
    }
  }
  assess.setDefaultAssessedAt()
  form.assessed_at = assess.assessed_at
})

/** 把 store 值同步回表单（草稿恢复后调用） */
function syncFromStore() {
  form.assessed_at = assess.assessed_at
  form.patient_name = assess.patient_name
  form.patient_gender = assess.patient_gender
  form.patient_age = assess.patient_age === '' ? null : Number(assess.patient_age)
  form.patient_id = assess.patient_id
  form.visit_week = assess.visit_week
  form.research_project_id = assess.research_project_id
  form.center_id = assess.center_id
  form.subject_screening_no = assess.subject_screening_no
  form.evaluator_id = assess.evaluator_id
  form.evaluator_qualification = assess.evaluator_qualification
  form.blinding = assess.blinding
  form.data_source = assess.data_source
}

function syncToStore() {
  assess.assessed_at = form.assessed_at
  assess.patient_name = form.patient_name
  assess.patient_gender = form.patient_gender
  assess.patient_age = form.patient_age === null ? '' : String(form.patient_age)
  assess.patient_id = form.patient_id
  assess.visit_week = form.visit_week
  assess.research_project_id = form.research_project_id
  assess.center_id = form.center_id
  assess.subject_screening_no = form.subject_screening_no
  assess.evaluator_id = form.evaluator_id
  assess.evaluator_qualification = form.evaluator_qualification
  assess.blinding = form.blinding
  assess.data_source = form.data_source
}

function onCancel() {
  router.push('/')
}

function onGoHome() {
  syncToStore()
  router.push('/')
}

async function onNavigate(step: number) {
  syncToStore()
  await assess.saveDraft()
  router.push(`/assess/step${step}`)
}

async function onNext() {
  syncToStore()
  const err = assess.validateStep1()
  if (err) {
    ElMessage.warning(err)
    return
  }
  await assess.saveDraft()
  router.push('/assess/step2')
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
.hint { font-size: 12px; color: var(--text-muted); margin-left: 8px; }
.research-panel {
  margin-top: 16px;
  padding: 16px;
  background: #f7f9fc;
  border-radius: 8px;
  border: 1px dashed var(--border);
}
.research-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--primary-dark);
  margin-bottom: 12px;
}
.actions { display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end; }
</style>
