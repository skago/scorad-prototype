import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '首页' }
  },
  {
    path: '/guide',
    name: 'guide',
    component: () => import('@/views/GuideView.vue'),
    meta: { title: '评分指南' }
  },
  {
    path: '/assess/step1',
    name: 'step1',
    component: () => import('@/views/Step1View.vue'),
    meta: { title: '记录信息' }
  },
  {
    path: '/assess/step2',
    name: 'step2',
    component: () => import('@/views/Step2View.vue'),
    meta: { title: '皮损面积' }
  },
  {
    path: '/assess/step3',
    name: 'step3',
    component: () => import('@/views/Step3View.vue'),
    meta: { title: '客观强度' }
  },
  {
    path: '/assess/step4',
    name: 'step4',
    component: () => import('@/views/Step4View.vue'),
    meta: { title: '主观症状' }
  },
  {
    path: '/result',
    name: 'result',
    component: () => import('@/views/ResultView.vue'),
    meta: { title: '评估结果' }
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryView.vue'),
    meta: { title: '历史记录' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.afterEach((to) => {
  const title = to.meta?.title as string | undefined
  document.title = title ? `${title} · SCORAD 评估工具` : 'SCORAD 评估工具'
})

export default router
