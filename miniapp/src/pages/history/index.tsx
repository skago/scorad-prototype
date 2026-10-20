import { View, Text, Button, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useMemo } from 'react'
import { getStorage } from '@/storage'
import type { AssessmentRecord } from '@/storage/types'
import { SEVERITY_LABEL } from '@/engine'
import { useAssessStore } from '@/stores/assessStore'
import { exportRecordsAsCsv, exportRecordsAsJson } from '@/utils/fileExport'

export default function History() {
  const [records, setRecords] = useState<AssessmentRecord[]>([])
  const [filterSubject, setFilterSubject] = useState('')
  const { loadRecord, reset } = useAssessStore()

  /** 全部记录中出现过的受试者筛选号（去重，供 Picker 选择） */
  const subjects = useMemo(() => {
    const set = new Set<string>()
    records.forEach((r) => { if (r.subject_screening_no) set.add(r.subject_screening_no) })
    return Array.from(set)
  }, [records])

  /** 按受试者筛选号过滤后的记录 */
  const filteredRecords = useMemo(
    () => (filterSubject ? records.filter((r) => r.subject_screening_no === filterSubject) : records),
    [records, filterSubject]
  )

  async function loadRecords() {
    const storage = getStorage()
    const list = await storage.listRecords()
    list.sort((a, b) => (a.assessed_at < b.assessed_at ? 1 : -1))
    setRecords(list)
  }

  useEffect(() => {
    loadRecords()
  }, [])

  async function onDelete(id: string) {
    const res = await Taro.showModal({ title: '确认删除', content: '删除后无法恢复' })
    if (!res.confirm) return
    const storage = getStorage()
    await storage.deleteRecord(id)
    Taro.showToast({ title: '已删除', icon: 'success' })
    loadRecords()
  }

  function onView(record: AssessmentRecord) {
    loadRecord(record)
    Taro.navigateTo({ url: '/pages/result/index' })
  }

  /** 导出全部：先选格式（CSV / 去标识 CSV / JSON） */
  async function onExportAll() {
    let res
    try {
      res = await Taro.showActionSheet({ itemList: ['导出 CSV', '导出 CSV（去标识）', '导出 JSON'] })
    } catch {
      return // 用户取消
    }
    if (res.tapIndex === 0) await exportRecordsAsCsv(records)
    else if (res.tapIndex === 1) await exportRecordsAsCsv(records, 'scorad_export_deidentified', { deidentified: true })
    else await exportRecordsAsJson(records)
  }

  /** 跳转趋势页（当前选中的受试者） */
  function onViewTrend() {
    Taro.navigateTo({ url: `/pages/trend/index?subject=${encodeURIComponent(filterSubject)}` })
  }

  /** 开始新评估：清空可能残留的评估状态，重开第一步（清页面栈） */
  function onNewAssessment() {
    reset()
    Taro.reLaunch({ url: '/pages/step1/index' })
  }

  return (
    <View className='container'>
      <View className='card'>
        <Text className='page-title'>历史记录</Text>
        <Text className='desc'>共 {filteredRecords.length} 条记录{filterSubject ? `（筛选：${filterSubject}）` : ''}</Text>

        <View className='actions'>
          <Button className='btn-primary' onClick={onNewAssessment}>新评估</Button>
        </View>

        {subjects.length > 0 && (
          <View className='actions' style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
            <Picker
              mode='selector'
              range={['全部受试者', ...subjects]}
              value={filterSubject ? subjects.indexOf(filterSubject) + 1 : 0}
              onChange={(e) => {
                const idx = Number(e.detail.value)
                setFilterSubject(idx === 0 ? '' : subjects[idx - 1])
              }}
            >
              <View className='btn-default' style={{ padding: '8rpx 24rpx' }}>
                受试者：{filterSubject || '全部'}
              </View>
            </Picker>
            {filterSubject && (
              <Button className='btn-default' size='mini' onClick={onViewTrend}>查看趋势</Button>
            )}
          </View>
        )}

        {records.length > 0 && (
          <View className='actions'>
            <Button className='btn-default' onClick={onExportAll}>导出全部</Button>
          </View>
        )}

        {filteredRecords.length === 0 ? (
          <Text className='placeholder'>{records.length === 0 ? '暂无评估记录' : '该受试者暂无记录'}</Text>
        ) : (
          filteredRecords.map((rec) => (
            <View className='record-item' key={rec.id}>
              <View className='record-main' onClick={() => onView(rec)}>
                <View className='record-top'>
                  <Text className='record-name'>{rec.patient_name || '未命名'}</Text>
                  <Text className={`record-severity ${rec.scorad_severity}`}>
                    {SEVERITY_LABEL[rec.scorad_severity]}
                  </Text>
                </View>
                <Text className='record-meta'>
                  {rec.patient_id || '无编号'} · {rec.assessed_at.replace('T', ' ')}
                </Text>
                <View className='record-scores'>
                  <Text>SCORAD <Text className='score-num'>{rec.scorad}</Text></Text>
                  <Text>oSCORAD <Text className='score-num'>{rec.objective_scorad}</Text></Text>
                  <Text>A={rec.extent_a} B={rec.intensity_b} C={rec.subjective_c}</Text>
                </View>
              </View>
              <View className='record-actions'>
                <Button className='btn-sm' onClick={() => onView(rec)}>查看</Button>
                <Button className='btn-sm danger' onClick={() => onDelete(rec.id)}>删除</Button>
              </View>
            </View>
          ))
        )}

        <View className='actions'>
          <Button className='btn-default' onClick={() => Taro.reLaunch({ url: '/pages/home/index' })}>返回首页</Button>
        </View>
      </View>
    </View>
  )
}
