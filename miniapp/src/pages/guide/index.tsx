import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'

export default function Guide() {
  return (
    <View className='container'>
      <View className='card'>
        <Text className='page-title'>评分指南</Text>

        <View className='formula-box'>
          <Text className='formula'>SCORAD = A/5 + 7B/2 + C</Text>
          <Text className='formula'>oSCORAD = A/5 + 7B/2（去除主观症状 C）</Text>
        </View>

        <View className='guide-section'>
          <Text className='guide-h'>A（Extent）皮损面积</Text>
          <Text className='guide-p'>AD 炎症性皮损占体表面积百分比，0–100。按代表区域原则评估：选取代表性区域的皮损程度，估计整体受累面积。</Text>

          <Text className='guide-h'>B（Intensity）客观强度</Text>
          <Text className='guide-p'>6 项客观体征之和，每项 0–3 分：红斑、水肿/丘疹、渗出/结痂、抓痕/表皮剥脱、苔藓化、干燥。</Text>
          <Text className='guide-p'>注意：B6「干燥」应在非炎症性皮肤区域评价。</Text>

          <Text className='guide-h'>C（Subjective）主观症状</Text>
          <Text className='guide-p'>瘙痒 + 睡眠影响，各 0–10 分。回顾期为近 3 天 / 3 夜的平均程度。</Text>

          <Text className='guide-h'>严重度分层</Text>
          <Text className='guide-p'>＜25 轻度；25–50 中度；＞50 重度</Text>
        </View>

        <Text className='guide-disclaimer'>本工具仅用于评分记录与随访管理，不构成医疗诊断或治疗建议。</Text>

        <View className='actions'>
          <Button className='btn-default' onClick={() => Taro.navigateBack()}>返回</Button>
        </View>
      </View>
    </View>
  )
}
