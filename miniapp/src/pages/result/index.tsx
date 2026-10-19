import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useAssessStore } from '@/stores/assessStore'
import { SEVERITY_LABEL } from '@/engine'
import { exportRecordsAsCsv, exportRecordsAsJson } from '@/utils/fileExport'
import type { AssessmentRecord } from '@/storage/types'

export default function Result() {
  const { state, saveRecord, reset } = useAssessStore()
  const r = state.result

  function onSave() {
    saveRecord()
      .then(() => {
        Taro.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => Taro.redirectTo({ url: '/pages/history/index' }), 800)
      })
      .catch((e) => Taro.showToast({ title: e.message, icon: 'none' }))
  }

  /** 构造临时导出记录（未保存也可导出，不落库） */
  function buildTempRecord(): AssessmentRecord | null {
    if (!state.result) return null
    return {
      ...state.result,
      id: 'temp',
      assessed_at: state.assessed_at,
      // 临时导出记录（不落库），审计字段占位
      created_at: '',
      updated_at: '',
      created_by: '',
      patient_name: state.patient_name,
      patient_gender: state.patient_gender,
      patient_age: state.patient_age,
      patient_id: state.patient_id,
      visit_week: state.visit_week,
      bsa_mode: state.bsa_mode,
      head_neck: state.head_neck,
      upper_limbs: state.upper_limbs,
      trunk: state.trunk,
      lower_limbs: state.lower_limbs,
      perineum: state.perineum,
      research_project_id: state.research_mode ? state.research_project_id || undefined : undefined,
      center_id: state.research_mode ? state.center_id || undefined : undefined,
      subject_screening_no: state.research_mode ? state.subject_screening_no || undefined : undefined,
      evaluator_id: state.research_mode ? state.evaluator_id || undefined : undefined,
      evaluator_qualification: state.research_mode ? state.evaluator_qualification || undefined : undefined,
      blinding: state.research_mode ? state.blinding || undefined : undefined,
      data_source: state.research_mode ? state.data_source || undefined : undefined
    }
  }

  /** 导出本条：先选格式（CSV / 去标识 CSV / JSON） */
  async function onExport() {
    const record = buildTempRecord()
    if (!record) return
    let res
    try {
      res = await Taro.showActionSheet({ itemList: ['导出 CSV', '导出 CSV（去标识）', '导出 JSON'] })
    } catch {
      return // 用户取消
    }
    if (res.tapIndex === 0) await exportRecordsAsCsv([record], 'scorad_record')
    else if (res.tapIndex === 1) await exportRecordsAsCsv([record], 'scorad_record_deidentified', { deidentified: true })
    else await exportRecordsAsJson([record], 'scorad_record')
  }

  function onReset() {
    reset()
    Taro.redirectTo({ url: '/pages/step1/index' })
  }

  if (!r) {
    return (
      <View className='container'>
        <View className='card'>
          <Text className='placeholder'>暂无计算结果，请先完成评估。</Text>
          <Button className='btn-primary' onClick={() => Taro.redirectTo({ url: '/pages/step1/index' })}>
            开始评估
          </Button>
        </View>
      </View>
    )
  }

  const severityClass = r.scorad_severity

  return (
    <View className='container'>
      <View className='card'>
        <Text className='page-title'>评估结果</Text>

        <View className={`score-box ${severityClass}`}>
          <Text className='score-label'>SCORAD 总分</Text>
          <Text className='score-val'>{r.scorad}</Text>
          <Text className={`severity-tag ${severityClass}`}>{SEVERITY_LABEL[r.scorad_severity]}</Text>
        </View>

        <View className='sub-scores'>
          <View className='sub-item'>
            <Text className='sub-label'>客观 SCORAD（oSCORAD）</Text>
            <Text className='sub-val'>{r.objective_scorad}</Text>
          </View>
          <View className='sub-item'>
            <Text className='sub-label'>皮损面积 A</Text>
            <Text className='sub-val'>{r.extent_a}</Text>
          </View>
          <View className='sub-item'>
            <Text className='sub-label'>强度 B</Text>
            <Text className='sub-val'>{r.intensity_b}</Text>
          </View>
          <View className='sub-item'>
            <Text className='sub-label'>主观症状 C</Text>
            <Text className='sub-val'>{r.subjective_c}</Text>
          </View>
        </View>

        <View className='formula-box'>
          <Text className='formula-title'>计算公式</Text>
          <Text className='formula'>SCORAD = A/5 + 7×B/2 + C</Text>
          <Text className='formula'>
            = {r.extent_weighted} + {r.intensity_weighted} + {r.subjective_c} = {r.scorad}
          </Text>
          <Text className='formula'>oSCORAD = A/5 + 7×B/2 = {r.objective_scorad}</Text>
        </View>

        <View className='actions'>
          <Button className='btn-primary' onClick={onSave}>保存记录</Button>
        </View>
        <View className='actions'>
          <Button className='btn-default' onClick={onExport}>导出本条</Button>
          <Button className='btn-default' onClick={onReset}>重新评估</Button>
          <Button className='btn-default' onClick={() => Taro.navigateBack()}>返回</Button>
        </View>
      </View>
    </View>
  )
}
