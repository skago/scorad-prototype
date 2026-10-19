<template>
  <div class="card">
    <h2>特应性皮炎严重度标准化评分</h2>
    <p class="desc">
      支持标准 SCORAD（0–103）与客观 SCORAD oSCORAD（0–83）。
      适用于临床评估、随访、教学与科研数据采集。
    </p>
    <div class="alert">
      本工具用于标准化评分计算、记录及科研辅助，<strong>不用于单独诊断</strong>，不能替代专业医疗判断。
    </div>

    <div class="research-switch">
      <el-switch
        v-model="assess.researchMode"
        active-text="科研模式"
        inactive-text="临床模式"
        @change="onModeChange"
      />
    </div>

    <div class="actions">
      <el-button type="primary" size="large" @click="$router.push('/assess/step1')">开始评估</el-button>
      <el-button size="large" @click="$router.push('/history')">历史记录</el-button>
      <el-button size="large" @click="$router.push('/guide')">评分指南</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAssessStore } from '@/stores/assessStore'
import { getStorage } from '@/storage'

const assess = useAssessStore()

onMounted(async () => {
  const v = await getStorage().getConfig<string>('scorad_research_mode')
  assess.researchMode = v === '1'
})

async function onModeChange(val: boolean) {
  await getStorage().setConfig('scorad_research_mode', val ? '1' : '0')
}
</script>

<style scoped>
.card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
}
h2 {
  font-size: 18px;
  margin-bottom: 8px;
}
.desc {
  color: var(--text-muted);
  font-size: 14px;
}
.alert {
  margin-top: 16px;
  padding: 12px 16px;
  background: var(--primary-light);
  border-left: 4px solid var(--primary);
  border-radius: 6px;
  font-size: 13px;
  color: var(--primary-dark);
}
.research-switch {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
.actions {
  display: grid;
  gap: 12px;
  margin-top: 24px;
}
.actions .el-button {
  justify-content: flex-start;
  padding: 16px 20px;
}
</style>
