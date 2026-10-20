import { View, Text, Button, Slider } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAssessStore } from '@/stores/assessStore'

export default function Step4() {
  const { state, set, subjective_c, doCalculate } = useAssessStore()

  // slider 拖动返回值存在浮点误差（如 2.8000000000000003），统一钳制到 1 位小数
  const round1 = (v: number) => Math.round(v * 10) / 10

  function onCalculate() {
    try {
      doCalculate()
      Taro.redirectTo({ url: '/pages/result/index' })
    } catch (e) {
      Taro.showToast({ title: e instanceof Error ? e.message : '计算失败', icon: 'none' })
    }
  }

  return (
    <View className='container'>
      <View className='card'>
        <Text className='page-title'>第四步：主观症状 C（Subjective）</Text>
        <Text className='desc'>回顾最近 3 天 / 3 夜，在 0–10 之间滑动。两项之和为主观症状 C（0–20）。</Text>

        <View className='slider-row'>
          <View className='slider-head'>
            <Text className='slider-label'>瘙痒 Pruritus</Text>
            <Text className='slider-val'>{state.pruritus}</Text>
          </View>
          <Slider
            min={0}
            max={10}
            step={0.1}
            value={state.pruritus}
            onChange={(e) => set({ pruritus: round1(e.detail.value) })}
            activeColor='#1565c0'
            blockColor='#1565c0'
          />
        </View>

        <View className='slider-row'>
          <View className='slider-head'>
            <Text className='slider-label'>睡眠影响 Sleep Loss</Text>
            <Text className='slider-val'>{state.sleep_loss}</Text>
          </View>
          <Slider
            min={0}
            max={10}
            step={0.1}
            value={state.sleep_loss}
            onChange={(e) => set({ sleep_loss: round1(e.detail.value) })}
            activeColor='#1565c0'
            blockColor='#1565c0'
          />
        </View>

        <View className='total-box'>
          <Text>主观症状 C 合计</Text>
          <Text className='total-val'>{subjective_c} / 20</Text>
        </View>

        <View className='actions'>
          <Button className='btn-default' onClick={() => Taro.navigateBack()}>上一步</Button>
          <Button className='btn-primary' onClick={onCalculate}>计算 SCORAD</Button>
        </View>
      </View>
    </View>
  )
}
