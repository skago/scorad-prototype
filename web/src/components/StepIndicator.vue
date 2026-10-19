<template>
  <div class="step-indicator">
    <!-- 返回首页 -->
    <div class="step-item home" @click="$emit('goHome')" title="返回首页">
      <div class="step-dot home-dot">⌂</div>
      <div class="step-label">首页</div>
    </div>

    <div class="connector"></div>

    <div
      v-for="(step, idx) in steps"
      :key="step"
      class="step-item"
      :class="{ active: current === idx + 1, done: current > idx + 1, clickable: true }"
      @click="$emit('navigate', idx + 1)"
    >
      <div class="step-dot">{{ current > idx + 1 ? '✓' : idx + 1 }}</div>
      <div class="step-label">{{ step }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  current: number
}>()

defineEmits<{
  (e: 'navigate', step: number): void
  (e: 'goHome'): void
}>()

const steps = ['记录信息', 'Extent', 'Intensity', 'Subjective']
</script>

<style scoped>
.step-indicator {
  display: flex;
  align-items: flex-start;
  margin-bottom: 24px;
  position: relative;
}
.step-item {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  cursor: pointer;
}
.step-item:hover .step-dot {
  transform: scale(1.1);
}
.connector {
  position: absolute;
  top: 16px;
  left: 10%;
  right: 2%;
  height: 2px;
  background: var(--border);
  z-index: 0;
}
.step-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
  transition: transform 0.15s ease, background 0.15s ease;
}
.home-dot {
  background: #fff;
  border-color: var(--border);
  font-size: 16px;
}
.step-item.home:hover .home-dot {
  border-color: var(--primary);
  color: var(--primary);
}
.step-item.active .step-dot {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.step-item.done .step-dot {
  background: #2e7d32;
  border-color: #2e7d32;
  color: #fff;
}
.step-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 6px;
  text-align: center;
}
.step-item.active .step-label {
  color: var(--primary-dark);
  font-weight: 600;
}
</style>
