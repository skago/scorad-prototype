import { View, Text, Button, Input, Radio, RadioGroup } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useAssessStore } from '@/stores/assessStore'

export default function Step2() {
  const { state, set, bodyParts, bsa_mode, extent_a, validateStep2, saveDraft, setBsaMode } = useAssessStore()
  // 输入中间态：保留原始输入串，避免受控回显吞掉小数点（如 "10." 被 parseFloat 成 10）
  const [inputs, setInputs] = useState<Record<string, string>>({})

  function onPartChange(key: string, max: number, value: string) {
    // 仅允许整数部分最多 3 位、小数点后最多 1 位（对齐 web 端 precision: 1）
    if (value !== '' && !/^\d{0,3}(\.\d?)?$/.test(value)) return
    const num = parseFloat(value)
    if (!isNaN(num) && num > max) {
      // 超上限立即钳制
      set({ [key]: max } as never)
      setInputs((prev) => ({ ...prev, [key]: String(max) }))
      return
    }
    setInputs((prev) => ({ ...prev, [key]: value }))
    if (!isNaN(num)) set({ [key]: num } as never)
  }

  function onPartBlur(key: string, max: number) {
    const raw = inputs[key]
    if (raw === undefined) return
    const num = Math.min(Math.max(parseFloat(raw) || 0, 0), max)
    set({ [key]: Math.round(num * 10) / 10 } as never)
    setInputs((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function onNext() {
    const err = validateStep2()
    if (err) {
      Taro.showToast({ title: err, icon: 'none' })
      return
    }
    await saveDraft()
    Taro.navigateTo({ url: '/pages/step3/index' })
  }

  const bsaLabel = bsa_mode === 'lund_browder' ? '儿童 Lund-Browder' : '成人 Rule of Nines'

  return (
    <View className='container'>
      <View className='card'>
        <Text className='page-title'>第二步：皮损面积 A（Extent）</Text>
        <Text className='desc'>填写受累面积占该部位百分比，合计为皮损面积 A（0–100）。</Text>

        <View className='bsa-mode-box'>
          <Text className='bsa-mode'>体表面积表：{bsaLabel}</Text>
          <RadioGroup
            className='bsa-switch'
            onChange={(e) => setBsaMode(e.detail.value)}
          >
            <Radio value='auto' checked={state.bsa_mode_override === 'auto'} color='#1565c0'>自动</Radio>
            <Radio value='rule_of_nines' checked={state.bsa_mode_override === 'rule_of_nines'} color='#1565c0'>成人</Radio>
            <Radio value='lund_browder' checked={state.bsa_mode_override === 'lund_browder'} color='#1565c0'>儿童</Radio>
          </RadioGroup>
        </View>

        {bodyParts.map((part) => (
          <View className='part-row' key={part.key}>
            <Text className='part-label'>
              {part.label}
              <Text className='part-max'>（上限 {part.max}%）</Text>
            </Text>
            <View className='part-input-wrap'>
              <Input
                className='part-input'
                type='digit'
                value={inputs[part.key] ?? String((state as unknown as Record<string, number>)[part.key])}
                onInput={(e) => onPartChange(part.key, part.max, e.detail.value)}
                onBlur={() => onPartBlur(part.key, part.max)}
              />
              <Text className='unit'>%</Text>
            </View>
          </View>
        ))}

        <View className='total-box'>
          <Text>皮损面积 A 合计</Text>
          <Text className='total-val'>{extent_a}%</Text>
        </View>

        <View className='actions'>
          <Button className='btn-default' onClick={() => Taro.navigateBack()}>上一步</Button>
          <Button className='btn-primary' onClick={onNext}>下一步</Button>
        </View>
      </View>
    </View>
  )
}
