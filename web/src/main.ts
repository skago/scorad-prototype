import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { getOrCreateUserId } from '@/utils/uuid'

// 首次启动生成本地用户 UUID（created_by 审计字段用），不阻塞渲染
getOrCreateUserId().catch(() => {})

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Element Plus 通过 unplugin-vue-components 按需自动注册，无需全局引入

app.mount('#app')
