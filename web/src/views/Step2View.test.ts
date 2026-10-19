import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import Step2View from './Step2View.vue'
import { useAssessStore } from '@/stores/assessStore'

// mock vue-router
const push = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({ push })
}))

vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn() }
}))

describe('Step2View 导航处理', () => {
  beforeEach(() => {
    push.mockReset()
    localStorage.clear()
  })

  function mountStep2() {
    return mount(Step2View, {
      global: {
        plugins: [createTestingPinia({ createSpy: vi.fn, stubActions: false })],
        stubs: {
          'el-input-number': {
            props: ['modelValue', 'min', 'max', 'step', 'precision'],
            template: '<input class="el-input-number-stub" :value="modelValue" />'
          },
          'el-button': {
            props: ['type'],
            template: '<button class="el-button-stub"><slot /></button>'
          },
          'el-radio-group': {
            props: ['modelValue', 'size'],
            template: '<div class="el-radio-group-stub"><slot /></div>'
          },
          'el-radio-button': {
            props: ['value'],
            template: '<span class="el-radio-button-stub"><slot /></span>'
          }
        }
      }
    })
  }

  it('点击步骤条第 1 步时，saveDraft 后跳转 /assess/step1', async () => {
    const wrapper = mountStep2()
    const store = useAssessStore()
    const saveDraftSpy = vi.spyOn(store, 'saveDraft').mockResolvedValue(undefined)

    // StepIndicator 渲染了 .step-item，index 1 对应第 1 步（记录信息）
    const items = wrapper.findAll('.step-item')
    await items[1].trigger('click')
    await flushPromises()

    expect(saveDraftSpy).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith('/assess/step1')
  })

  it('点击步骤条第 4 步时，跳转 /assess/step4', async () => {
    const wrapper = mountStep2()
    const store = useAssessStore()
    vi.spyOn(store, 'saveDraft').mockResolvedValue(undefined)

    const items = wrapper.findAll('.step-item')
    await items[4].trigger('click') // index 4 = 第 4 步
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/assess/step4')
  })

  it('点击首页入口时，跳转 /', async () => {
    const wrapper = mountStep2()

    const homeItem = wrapper.find('.step-item.home')
    await homeItem.trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith('/')
  })

  it('跳转前会保存草稿（saveDraft 被调用）', async () => {
    const wrapper = mountStep2()
    const store = useAssessStore()
    const saveDraftSpy = vi.spyOn(store, 'saveDraft').mockResolvedValue(undefined)

    const items = wrapper.findAll('.step-item')
    await items[3].trigger('click') // 第 3 步
    await flushPromises()

    expect(saveDraftSpy).toHaveBeenCalled()
  })
})
