import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

export default function Home() {
  return (
    <View className='container'>
      <View className='card'>
        <Text className='title'>特应性皮炎严重度标准化评分</Text>
        <Text className='desc'>
          支持标准 SCORAD（0–103）与客观 SCORAD oSCORAD（0–83）。
          本地计算，数据不上传。
        </Text>
        <View className='alert'>
          本工具用于标准化评分计算、记录及科研辅助，不用于单独诊断。
        </View>
        <Button className='btn-primary' onClick={() => Taro.navigateTo({ url: '/pages/step1/index' })}>
          开始评估
        </Button>
        <Button className='btn-default' onClick={() => Taro.navigateTo({ url: '/pages/history/index' })}>
          历史记录
        </Button>
        <Button className='btn-default' onClick={() => Taro.navigateTo({ url: '/pages/guide/index' })}>
          评分指南
        </Button>
      </View>
    </View>
  )
}
