<template>
  <div class="app">
    <header class="app-header">
      <h1>SCORAD 评估工具</h1>
      <div class="subtitle">SCORAD Assessment Tool · v1.0</div>
      <span class="local-note">本地计算 · 数据不上传</span>
    </header>
    <main class="container">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
// 根组件：仅提供布局骨架，页面内容由路由视图渲染
</script>

<style>
:root {
  --primary: #1565c0;
  --primary-dark: #0d47a1;
  --primary-light: #e3f2fd;
  --bg: #f5f7fa;
  --card: #ffffff;
  --border: #e0e6ed;
  --text: #1a2332;
  --text-muted: #6b7a8f;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}

.app-header {
  text-align: center;
  padding: 24px 16px 16px;
}
.app-header h1 {
  font-size: 24px;
  font-weight: 700;
  color: var(--primary-dark);
}
.app-header .subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin-top: 4px;
}
.local-note {
  display: inline-block;
  margin-top: 10px;
  padding: 4px 12px;
  font-size: 12px;
  background: var(--primary-light);
  color: var(--primary-dark);
  border-radius: 20px;
}

.container {
  max-width: 860px;
  margin: 0 auto;
  padding: 16px;
}
</style>
