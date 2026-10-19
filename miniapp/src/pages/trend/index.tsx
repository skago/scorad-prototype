/**
 * 受试者 SCORAD 趋势页
 * 入口：history 页选定受试者筛选号后「查看趋势」
 * 数据：本地全部记录中按 subject_screening_no 过滤，按评估时间升序
 */
import { View, Text, Button } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { getStorage } from '@/storage'
import type { AssessmentRecord } from '@/storage/types'
import { SEVERITY_LABEL } from '@/engine'
import TrendChart, { type TrendPoint } from '@/components/TrendChart'

export default function Trend() {
  const [subject, setSubject] = useState('')
  const [records, setRecords] = useState<AssessmentRecord[]>([])

  useLoad((options) => {
    const s = decodeURIComponent((options?.subject as string) ?? '')
    setSubject(s)
    void loadRecords(s)
  })

  async function loadRecords(s: string) {
    const list = await getStorage().listRecords()
    const filtered = list
      .filter((r) => (s ? r.subject_screening_no === s : true))
      .sort((a, b) => (a.assessed_at < b.assessed_at ? -1 : 1))
    setRecords(filtered)
  }

  const points: TrendPoint[] = records.map((r) => ({
    label: r.visit_week || r.assessed_at.slice(0, 10),
    value: r.scorad,
    title: r.assessed_at.replace('T', ' ')
  }))

  const latest = records[records.length - 1]
  const avg = records.length > 0
    ? Math.round((records.reduce((sum, r) => sum + r.scorad, 0) / records.length) * 10) / 10
    : 0

  return (
    <View className='container'>
      <View className='card'>
        <Text className='page-title'>SCORAD 趋势</Text>
        <Text className='desc'>受试者筛选号：{subject || '全部'} · 共 {records.length} 次评估</Text>

        {records.length === 0 ? (
          <Text className='placeholder'>该受试者暂无评估记录</Text>
        ) : (
          <>
            <TrendChart points={points} />
            <View className='sub-scores'>
              <View className='sub-item'>
                <Text className='sub-label'>最近 SCORAD</Text>
                <Text className='sub-val'>{latest?.scorad ?? '-'}</Text>
              </View>
              <View className='sub-item'>
                <Text className='sub-label'>平均 SCORAD</Text>
                <Text className='sub-val'>{avg}</Text>
              </View>
            </View>
            {records.map((r) => (
              <View className='record-item' key={r.id}>
                <View className='record-main'>
                  <View className='record-top'>
                    <Text className='record-name'>{r.visit_week || '未标周次'}</Text>
                    <Text className={`record-severity ${r.scorad_severity}`}>
                      {SEVERITY_LABEL[r.scorad_severity]}
                    </Text>
                  </View>
                  <Text className='record-meta'>{r.assessed_at.replace('T', ' ')}</Text>
                  <View className='record-scores'>
                    <Text>SCORAD <Text className='score-num'>{r.scorad}</Text></Text>
                    <Text>oSCORAD <Text className='score-num'>{r.objective_scorad}</Text></Text>
                  </View>
                </View>
              </View>
            ))}
          </>
        )}

        <View className='actions'>
          <Button className='btn-default' onClick={() => Taro.navigateBack()}>返回</Button>
        </View>
      </View>
    </View>
  )
}
