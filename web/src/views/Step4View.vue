<template>
  <div class="card">
    <StepIndicator :current="4" @navigate="onNavigate" @go-home="onGoHome" />
    <h2>第四步：主观症状 C（Subjective）</h2>
    <p class="desc">回顾最近 3 天 / 3 夜，在 0–10 之间滑动。两项之和为主观症状 C（0–20）。</p>

    <div class="slider-row">
      <div class="slider-head">
        <label>瘙痒 Pruritus</label>
        <span class="val">{{ assess.pruritus }}</span>
      </div>
      <el-slider
        v-model="assess.pruritus"
        :min="0"
        :max="10"
        :step="0.1"
        :precision="1"
        show-input
        input-size="small"
      />
    </div>

    <div class="slider-row">
      <div class="slider-head">
        <label>睡眠影响 Sleep Loss</label>
        <span class="val">{{ assess.sleep_loss }}</span>
      </div>
      <el-slider
        v-model="assess.sleep_loss"
        :min="0"
        :max="10"
        :step="0.1"
        :precision="1"
        show-input
        input-size="small"
      />
    </div>

    <div class="total">
      <span>主观症状 C 合计</span>
      <strong>{{ assess.subjective_c }}</strong>
      <span class="range">/ 20</span>
    </div>

    <div class="actions">
      <el-button @click="$router.push('/assess/step3')">上一步</el-button>
      <el-button type="primary" @click="onCalculate">计算 SCORAD</el-button>
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

function onCalculate() {
  try {
    assess.doCalculate()
    router.push('/result')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '计算失败，请检查输入')
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
h2 { font-size: 18px; margin-bottom: 8px; }
.desc { color: var(--text-muted); font-size: 13px; margin-bottom: 24px; }
.slider-row { margin-bottom: 24px; }
.slider-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
.slider-head label { font-size: 14px; font-weight: 500; }
.slider-head .val {
  font-size: 22px;
  font-weight: 700;
  color: var(--primary-dark);
}
.total {
  margin-top: 8px;
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
