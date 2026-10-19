import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAssessStore } from '@/stores/assessStore'

export default function Step3() {
  const { state, set, B_ITEMS, SCORE_LABELS, intensity_b, validateStep3, saveDraft } = useAssessStore()

  function onSelect(key: string, value: number) {
    set({ [key]: value } as never)
  }

  async function onNext() {
    const err = validateStep3()
    if (err) {
      Taro.showToast({ title: err, icon: 'none' })
      return
    }
    await saveDraft()
    Taro.navigateTo({ url: '/pages/step4/index' })
  }

  return (
    <View className='container'>
      <View className='card'>
        <Text className='page-title'>第三步：客观皮损强度 B（Intensity）</Text>
        <Text className='desc'>对每个体征在 0–3 之间选择严重程度。合计为强度 B（0–18）。</Text>

        {B_ITEMS.map((item) => (
          <View className='b-row' key={item.key}>
            <View className='b-label'>
              <Text>{item.label}</Text>
              <Text className='en'>{item.en}</Text>
              {item.special && <Text className='special'>{item.special}</Text>}
            </View>
            <View className='b-radios'>
              {SCORE_LABELS.map((_, idx) => (
                <View
                  key={idx}
                  className={`b-radio ${(state[item.key] as number | null) === idx ? 'active' : ''}`}
                  onClick={() => onSelect(item.key, idx)}
                >
                  {idx}
                </View>
              ))}
            </View>
          </View>
        ))}

        <View className='legend'>
          {SCORE_LABELS.map((label, idx) => (
            <Text className='legend-item' key={idx}>
              <Text className='legend-num'>{idx}</Text> = {label}
            </Text>
          ))}
        </View>

        <View className='total-box'>
          <Text>强度 B 合计</Text>
          <Text className='total-val'>{intensity_b} / 18</Text>
        </View>

        <View className='actions'>
          <Button className='btn-default' onClick={() => Taro.navigateBack()}>上一步</Button>
          <Button className='btn-primary' onClick={onNext}>下一步</Button>
        </View>
      </View>
    </View>
  )
}
