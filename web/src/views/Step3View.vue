<template>
  <div class="card">
    <StepIndicator :current="3" @navigate="onNavigate" @go-home="onGoHome" />
    <h2>第三步：客观皮损强度 B（Intensity）</h2>
    <p class="desc">对每个体征在 0–3 之间选择严重程度。合计为强度 B（0–18）。</p>

    <div class="b-rows">
      <div v-for="item in assess.B_ITEMS" :key="item.key" class="b-row">
        <div class="b-label">
          {{ item.label }}
          <span class="en">{{ item.en }}</span>
          <span v-if="item.special" class="special">{{ item.special }}</span>
        </div>
        <el-radio-group v-model="(assess as any)[item.key]" class="b-radios">
          <el-radio-button
            v-for="(_, idx) in assess.SCORE_LABELS"
            :key="idx"
            :value="idx"
          >
            {{ idx }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="legend">
      <span v-for="(label, idx) in assess.SCORE_LABELS" :key="idx" class="legend-item">
        <em>{{ idx }}</em> = {{ label }}
      </span>
    </div>

    <div class="total">
      <span>强度 B 合计</span>
      <strong>{{ assess.intensity_b }}</strong>
      <span class="range">/ 18</span>
    </div>

    <div class="actions">
      <el-button @click="$router.push('/assess/step2')">上一步</el-button>
      <el-button type="primary" @click="onNext">下一步</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import StepIndicator from '@/components/StepIndicator.vue'
import { useAssessStore } from '@/stores/assessStore'

const router = useRouter()
const assess = useAssessStore()

function onGoHome() {
  router.push('/')
}

async function onNavigate(step: number) {
  await assess.saveDraft()
  router.push(`/assess/step${step}`)
}

async function onNext() {
  const err = assess.validateStep3()
  if (err) {
    ElMessage.warning(err)
    return
  }
  await assess.saveDraft()
  router.push('/assess/step4')
}
</script>

<style scoped>
.card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
}
h2 { font-size: 18px; margin-bottom: 8px; }
.desc { color: var(--text-muted); font-size: 13px; margin-bottom: 16px; }
.b-rows { display: grid; gap: 10px; }
.b-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f7f9fc;
  border-radius: 6px;
}
.b-label { font-size: 14px; min-width: 180px; }
.b-label .en { color: var(--text-muted); font-size: 12px; margin-left: 6px; }
.b-label .special { display: block; color: #e65100; font-size: 11px; margin-top: 2px; }
.legend {
  margin-top: 16px;
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-muted);
  flex-wrap: wrap;
}
.legend-item em { font-style: normal; font-weight: 600; color: var(--text); }
.total {
  margin-top: 16px;
  padding: 14px;
  background: var(--primary-light);
  border-radius: 8px;
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 15px;
}
.total strong { font-size: 22px; color: var(--primary-dark); }
.total .range { color: var(--text-muted); font-size: 13px; }
.actions { display: flex; gap: 12px; margin-top: 24px; justify-content: space-between; }
</style>
