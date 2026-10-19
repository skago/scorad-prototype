import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StepIndicator from './StepIndicator.vue'

describe('StepIndicator 组件', () => {
  it('渲染首页入口 + 4 个步骤', () => {
    const wrapper = mount(StepIndicator, { props: { current: 2 } })
    const labels = wrapper.findAll('.step-label').map((el) => el.text())
    expect(labels).toEqual(['首页', '记录信息', 'Extent', 'Intensity', 'Subjective'])
  })

  it('current=2 时，第 2 步为 active，第 1 步为 done，其余为普通', () => {
    const wrapper = mount(StepIndicator, { props: { current: 2 } })
    const items = wrapper.findAll('.step-item')
    // items[0] = 首页, items[1] = 记录信息(step1), items[2] = Extent(step2)
    expect(items[1].classes()).toContain('done')
    expect(items[2].classes()).toContain('active')
    expect(items[3].classes()).not.toContain('active')
    expect(items[3].classes()).not.toContain('done')
    expect(items[4].classes()).not.toContain('active')
  })

  it('current=1 时，无 done 步骤，第 1 步为 active', () => {
    const wrapper = mount(StepIndicator, { props: { current: 1 } })
    const items = wrapper.findAll('.step-item')
    expect(items[1].classes()).toContain('active')
    expect(items[1].classes()).not.toContain('done')
    expect(items[2].classes()).not.toContain('active')
    expect(items[2].classes()).not.toContain('done')
  })

  it('current=5（结果页）时，全部 4 步均为 done', () => {
    const wrapper = mount(StepIndicator, { props: { current: 5 } })
    const items = wrapper.findAll('.step-item')
    // 首页不参与 active/done 判断
    expect(items[1].classes()).toContain('done')
    expect(items[2].classes()).toContain('done')
    expect(items[3].classes()).toContain('done')
    expect(items[4].classes()).toContain('done')
  })

  it('已完成步骤显示 ✓，当前步骤显示数字', () => {
    const wrapper = mount(StepIndicator, { props: { current: 3 } })
    const dots = wrapper.findAll('.step-dot')
    // dots[0]=首页, dots[1]=step1(done=✓), dots[2]=step2(done=✓), dots[3]=step3(active=3), dots[4]=step4(4)
    expect(dots[1].text()).toBe('✓')
    expect(dots[2].text()).toBe('✓')
    expect(dots[3].text()).toBe('3')
    expect(dots[4].text()).toBe('4')
  })

  it('点击第 1 步触发 navigate(1)', async () => {
    const wrapper = mount(StepIndicator, { props: { current: 3 } })
    const items = wrapper.findAll('.step-item')
    await items[1].trigger('click')
    expect(wrapper.emitted('navigate')).toEqual([[1]])
  })

  it('点击第 4 步触发 navigate(4)', async () => {
    const wrapper = mount(StepIndicator, { props: { current: 1 } })
    const items = wrapper.findAll('.step-item')
    await items[4].trigger('click')
    expect(wrapper.emitted('navigate')).toEqual([[4]])
  })

  it('点击首页触发 goHome', async () => {
    const wrapper = mount(StepIndicator, { props: { current: 2 } })
    const homeItem = wrapper.find('.step-item.home')
    await homeItem.trigger('click')
    expect(wrapper.emitted('goHome')).toBeTruthy()
  })

  it('连续点击不同步骤分别触发 navigate', async () => {
    const wrapper = mount(StepIndicator, { props: { current: 4 } })
    const items = wrapper.findAll('.step-item')
    await items[1].trigger('click')
    await items[3].trigger('click')
    const emits = wrapper.emitted('navigate')
    expect(emits).toEqual([[1], [3]])
  })

  it('首页图标使用 home-dot 类', () => {
    const wrapper = mount(StepIndicator, { props: { current: 1 } })
    const homeDot = wrapper.find('.home-dot')
    expect(homeDot.exists()).toBe(true)
    expect(homeDot.text()).toBe('⌂')
  })
})
