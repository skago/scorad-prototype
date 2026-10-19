/**
 * 统一测试所有评估页面（Step1/3/4 + Result）的导航处理器
 * 验证：点击步骤条 → saveDraft → router.push(正确路径)
 *       点击首页 → router.push('/')
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import Step1View from './Step1View.vue'
import Step3View from './Step3View.vue'
import Step4View from './Step4View.vue'
import ResultView from './ResultView.vue'
import { useAssessStore } from '@/stores/assessStore'

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push })
}))

vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn(), success: vi.fn(), error: vi.fn() }
}))

// 通用 Element Plus 表单组件 stub
const formStubs = {
  'el-form': { template: '<form><slot /></form>' },
  'el-form-item': { template: '<div><slot /></div>' },
  'el-date-picker': {
    props: ['modelValue', 'type', 'placeholder'],
    template: '<input class="el-date-picker-stub" :value="modelValue" />'
  },
  'el-input': {
    props: ['modelValue', 'placeholder'],
    template: '<input class="el-input-stub" :value="modelValue" />'
  },
  'el-input-number': {
    props: ['modelValue', 'min', 'max', 'step', 'precision'],
    template: '<input class="el-input-number-stub" :value="modelValue" />'
  },
  'el-radio-group': {
    props: ['modelValue'],
    template: '<div class="el-radio-group-stub"><slot /></div>'
  },
  'el-radio': {
    props: ['value'],
    template: '<label class="el-radio-stub"><slot /></label>'
  },
  'el-radio-button': {
    props: ['value'],
    template: '<span class="el-radio-button-stub"><slot /></span>'
  },
  'el-slider': {
    props: ['modelValue', 'min', 'max', 'step'],
    template: '<input class="el-slider-stub" type="range" :value="modelValue" />'
  },
  'el-select': {
    props: ['modelValue', 'placeholder'],
    template: '<select class="el-select-stub"><slot /></select>'
  },
  'el-option': {
    props: ['label', 'value'],
    template: '<option :value="value">{{ label }}</option>'
  },
  'el-switch': {
    props: ['modelValue'],
    template: '<input type="checkbox" class="el-switch-stub" :checked="modelValue" />'
  },
  'el-button': {
    props: ['type', 'disabled'],
    template: '<button class="el-button-stub" :disabled="disabled"><slot /></button>'
  },
  'el-tag': { template: '<span><slot /></span>' },
  'el-empty': { template: '<div class="el-empty-stub"></div>' },
  'el-table': { template: '<table><slot /></table>' },
  'el-table-column': { template: '<col />' },
  'el-descriptions': { template: '<dl><slot /></dl>' },
  'el-descriptions-item': { template: '<dd><slot /></dd>' }
}

interface ViewConfig {
  name: string
  component: any
}

const views: ViewConfig[] = [
  { name: 'Step1View', component: Step1View },
  { name: 'Step3View', component: Step3View },
  { name: 'Step4View', component: Step4View },
  { name: 'ResultView', component: ResultView }
]

describe('评估页面导航处理器', () => {
  beforeEach(() => {
    push.mockReset()
    localStorage.clear()
  })

  function mountView(component: any) {
    return mount(component, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
        stubs: formStubs
      }
    })
  }

  for (const view of views) {
    describe(`${view.name}`, () => {
      it('点击步骤条触发 navigate 时，saveDraft 后跳转到对应步骤', async () => {
        const wrapper = mountView(view.component)
        const store = useAssessStore()
        const saveDraftSpy = vi.spyOn(store, 'saveDraft').mockResolvedValue(undefined)

        const stepIndicator = wrapper.find('.step-indicator')
        // 触发第 1 步的点击（.step-item 索引 1）
        const items = stepIndicator.findAll('.step-item')
        await items[1].trigger('click')
        await flushPromises()

        expect(saveDraftSpy).toHaveBeenCalledTimes(1)
        expect(push).toHaveBeenCalledWith('/assess/step1')
      })

      it('点击首页入口触发 goHome 时，跳转到 /', async () => {
        const wrapper = mountView(view.component)

        const homeItem = wrapper.find('.step-item.home')
        await homeItem.trigger('click')
        await flushPromises()

        expect(push).toHaveBeenCalledWith('/')
      })

      it('点击第 4 步时跳转到 /assess/step4', async () => {
        const wrapper = mountView(view.component)
        const store = useAssessStore()
        vi.spyOn(store, 'saveDraft').mockResolvedValue(undefined)

        const stepIndicator = wrapper.find('.step-indicator')
        const items = stepIndicator.findAll('.step-item')
        await items[4].trigger('click') // 索引 4 = 第 4 步
        await flushPromises()

        expect(push).toHaveBeenCalledWith('/assess/step4')
      })
    })
  }
})
