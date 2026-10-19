<template>
  <div class="card">
    <StepIndicator :current="2" @navigate="onNavigate" @go-home="onGoHome" />
    <h2>第二步：皮损面积 A（Extent）</h2>
    <p class="desc">填写受累面积占该部位百分比，合计为皮损面积 A（0–100）。</p>

    <div class="bsa-info">
      <span class="tag">体表面积表：{{ assess.bsa_mode === 'lund_browder' ? '儿童 Lund-Browder' : '成人 Rule of Nines' }}</span>
      <el-radio-group v-model="bsaModeLocal" size="small" @change="onBsaModeChange" class="bsa-switch">
        <el-radio-button value="auto">自动（按年龄）</el-radio-button>
        <el-radio-button value="rule_of_nines">成人</el-radio-button>
        <el-radio-button value="lund_browder">儿童</el-radio-button>
      </el-radio-group>
    </div>

    <div class="body-rows">
      <div v-for="part in assess.bodyParts" :key="part.key" class="body-row">
        <div class="body-label">
          {{ part.label }}
          <span class="max">（上限 {{ part.max }}%）</span>
        </div>
        <div class="body-input">
          <el-input-number
            v-model="(assess as any)[part.key]"
            :min="0"
            :max="part.max"
            :step="0.1"
            :precision="1"
            controls-position="right"
            style="width: 140px"
          />
          <span class="pct">%</span>
        </div>
      </div>
    </div>

    <div class="total">
      <span>皮损面积 A 合计</span>
      <strong :class="{ warn: assess.extent_a > 100 }">{{ assess.extent_a }}%</strong>
    </div>

    <div class="actions">
      <el-button @click="$router.push('/assess/step1')">上一步</el-button>
      <el-button type="primary" @click="onNext">下一步</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import StepIndicator from '@/components/StepIndicator.vue'
import { useAssessStore } from '@/stores/assessStore'

const router = useRouter()
const assess = useAssessStore()

const bsaModeLocal = ref<'auto' | 'rule_of_nines' | 'lund_browder'>(assess.bsaModeOverride)
// 外部变化（如从历史记录加载）时同步本地
watch(() => assess.bsaModeOverride, (v) => { bsaModeLocal.value = v })

function onBsaModeChange(val: 'auto' | 'rule_of_nines' | 'lund_browder') {
  assess.setBsaMode(val)
}

function onGoHome() {
  router.push('/')
}

async function onNavigate(step: number) {
  await assess.saveDraft()
  router.push(`/assess/step${step}`)
}

async function onNext() {
  const err = assess.validateStep2()
  if (err) {
    ElMessage.warning(err)
    return
  }
  await assess.saveDraft()
  router.push('/assess/step3')
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
.desc { color: var(--text-muted); font-size: 13px; margin-bottom: 12px; }
.bsa-info { margin-bottom: 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.bsa-switch { margin-left: auto; }
.tag {
  display: inline-block;
  padding: 3px 10px;
  background: var(--primary-light);
  color: var(--primary-dark);
  font-size: 12px;
  border-radius: 12px;
}
.body-rows { display: grid; gap: 12px; }
.body-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f7f9fc;
  border-radius: 6px;
}
.body-label { font-size: 14px; }
.body-label .max { color: var(--text-muted); font-size: 12px; }
.body-input { display: flex; align-items: center; gap: 6px; }
.pct { font-size: 14px; color: var(--text-muted); }
.total {
  margin-top: 16px;
  padding: 14px;
  background: var(--primary-light);
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 15px;
}
.total strong { font-size: 20px; color: var(--primary-dark); }
.total .warn { color: #d32f2f; }
.actions { display: flex; gap: 12px; margin-top: 24px; justify-content: space-between; }
</style>
