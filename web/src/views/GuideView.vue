<template>
  <div class="card">
    <h2>评分指南</h2>
    <div class="content">
      <p><strong>SCORAD = A/5 + 7B/2 + C</strong></p>
      <p><strong>oSCORAD = A/5 + 7B/2</strong>（去除主观症状 C）</p>
      <ul>
        <li><strong>A（Extent）皮损面积</strong>：AD 炎症性皮损占体表面积百分比，0–100。按代表区域原则评估：选取代表性区域的皮损程度，估计整体受累面积</li>
        <li><strong>B（Intensity）客观强度</strong>：6 项客观体征之和，每项 0–3（红斑、水肿/丘疹、渗出/结痂、抓痕/表皮剥脱、苔藓化、干燥）。注意：B6「干燥」应在非炎症性皮肤区域评价</li>
        <li><strong>C（Subjective）主观症状</strong>：瘙痒 + 睡眠影响，各 0–10。回顾期为近 3 天 / 3 夜的平均程度</li>
      </ul>
      <p><strong>严重度分层</strong>：＜25 轻度；25–50 中度；＞50 重度</p>
      <p class="disclaimer">本工具仅用于评分记录与随访管理，不构成医疗诊断或治疗建议。</p>
    </div>
    <el-button @click="$router.push('/')">返回首页</el-button>
  </div>
</template>

<script setup lang="ts">
// 评分指南：静态说明页（与小程序 guide 页文案对齐）
</script>

<style scoped>
.card {
  background: var(--card);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 24px;
}
h2 { font-size: 18px; margin-bottom: 12px; }
.content { font-size: 14px; line-height: 1.8; }
ul { margin-left: 20px; margin-top: 8px; }
.disclaimer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 13px;
}
</style>
