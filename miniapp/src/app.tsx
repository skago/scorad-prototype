import { PropsWithChildren } from 'react'
import Taro, { useLaunch } from '@tarojs/taro'
import { getOrCreateUserId } from '@/utils/uuid'
import { ENV_ID, isCloudConfigured } from '@/config/cloud'
import './app.scss'

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('SCORAD 小程序启动')
    // 首次启动生成本地用户 UUID（created_by 审计字段用）
    getOrCreateUserId().catch(() => {})
    // 云开发初始化（方案 B；未配置 envId 时跳过，纯本地运行）
    if (isCloudConfigured && Taro.cloud) {
      Taro.cloud.init({ env: ENV_ID, traceUser: true })
    }
  })
  return children
}

export default App
