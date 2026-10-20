/**
 * 云开发配置
 * 用户操作：微信公众平台 → 云开发 → 开通环境，将下方占位符替换为真实环境 ID
 * （如 'cloud1-2gabc123def45678'）
 */
// 显式标注 string，避免字面量类型收窄导致下方 isCloudConfigured 比较恒真
export const ENV_ID: string = 'cloud1-d1gvx0dpzae6aede6'

/** 是否已配置云环境（未配置时 CloudStorageAdapter 不启用云端同步） */
export const isCloudConfigured = ENV_ID !== 'YOUR_CLOUD_ENV_ID'
