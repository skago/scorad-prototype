import { View, Text, Button, Input, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useAssessStore } from '@/stores/assessStore'

export default function Step1() {
  const { state, set, validateStep1, saveDraft, loadDraft } = useAssessStore()

  // 恢复未完成的草稿（已有计算结果时跳过）
  useDidShow(() => {
    if (!state.result) {
      loadDraft().then((restored) => {
        if (restored) Taro.showToast({ title: '已恢复未完成的草稿', icon: 'none' })
      })
    }
  })

  async function onNext() {
    const err = validateStep1()
    if (err) {
      Taro.showToast({ title: err, icon: 'none' })
      return
    }
    await saveDraft()
    Taro.navigateTo({ url: '/pages/step2/index' })
  }

  return (
    <View className='container'>
      <View className='card'>
        <Text className='page-title'>第一步：记录信息</Text>

        <View className='form-item'>
          <Text className='label'>评估时间 *</Text>
          <Input
            className='input'
            type='text'
            value={state.assessed_at}
            onInput={(e) => set({ assessed_at: e.detail.value })}
            placeholder='YYYY-MM-DDTHH:mm'
          />
        </View>

        <View className='form-item'>
          <Text className='label'>患者姓名</Text>
          <Input
            className='input'
            type='text'
            value={state.patient_name}
            onInput={(e) => set({ patient_name: e.detail.value })}
            placeholder='请输入姓名'
          />
        </View>

        <View className='form-item'>
          <Text className='label'>性别</Text>
          <View className='radio-group'>
            <View
              className={`radio-item ${state.patient_gender === 'male' ? 'active' : ''}`}
              onClick={() => set({ patient_gender: 'male' })}
            >
              男
            </View>
            <View
              className={`radio-item ${state.patient_gender === 'female' ? 'active' : ''}`}
              onClick={() => set({ patient_gender: 'female' })}
            >
              女
            </View>
          </View>
        </View>

        <View className='form-row'>
          <View className='form-item half'>
            <Text className='label'>年龄</Text>
            <Input
              className='input'
              type='number'
              value={state.patient_age}
              onInput={(e) => set({ patient_age: e.detail.value })}
              placeholder='岁'
            />
          </View>
          <View className='form-item half'>
            <Text className='label'>就诊周次</Text>
            <Input
              className='input'
              type='text'
              value={state.visit_week}
              onInput={(e) => set({ visit_week: e.detail.value })}
              placeholder='第 N 周'
            />
          </View>
        </View>

        <View className='form-item'>
          <Text className='label'>患者编号</Text>
          <Input
            className='input'
            type='text'
            value={state.patient_id}
            onInput={(e) => set({ patient_id: e.detail.value })}
            placeholder='病历号 / 研究编号'
          />
        </View>

        <View className='form-item switch-row'>
          <Text className='label'>科研模式</Text>
          <Switch checked={state.research_mode} onChange={(e) => set({ research_mode: e.detail.value })} />
        </View>

        {state.research_mode && (
          <View className='research-fields'>
            <View className='form-item'>
              <Text className='label'>研究项目编号</Text>
              <Input className='input' value={state.research_project_id} onInput={(e) => set({ research_project_id: e.detail.value })} />
            </View>
            <View className='form-row'>
              <View className='form-item half'>
                <Text className='label'>中心编号</Text>
                <Input className='input' value={state.center_id} onInput={(e) => set({ center_id: e.detail.value })} />
              </View>
              <View className='form-item half'>
                <Text className='label'>受试者筛选号</Text>
                <Input className='input' value={state.subject_screening_no} onInput={(e) => set({ subject_screening_no: e.detail.value })} />
              </View>
            </View>
            <View className='form-row'>
              <View className='form-item half'>
                <Text className='label'>评估者编号</Text>
                <Input className='input' value={state.evaluator_id} onInput={(e) => set({ evaluator_id: e.detail.value })} />
              </View>
              <View className='form-item half'>
                <Text className='label'>评估者资质</Text>
                <Input className='input' value={state.evaluator_qualification} onInput={(e) => set({ evaluator_qualification: e.detail.value })} />
              </View>
            </View>
            <View className='form-row'>
              <View className='form-item half'>
                <Text className='label'>设盲</Text>
                <Input className='input' value={state.blinding} onInput={(e) => set({ blinding: e.detail.value })} />
              </View>
              <View className='form-item half'>
                <Text className='label'>数据来源</Text>
                <Input className='input' value={state.data_source} onInput={(e) => set({ data_source: e.detail.value })} />
              </View>
            </View>
          </View>
        )}

        <View className='actions'>
          <Button className='btn-default' onClick={() => Taro.navigateBack()}>取消</Button>
          <Button className='btn-primary' onClick={onNext}>下一步</Button>
        </View>
      </View>
    </View>
  )
}
