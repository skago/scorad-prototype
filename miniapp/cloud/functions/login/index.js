/**
 * login 云函数：返回调用者 OPENID
 * 用于 CloudStorageAdapter 登录闸门（云端 _openid 由数据库自动写入做权限隔离）
 * 部署方式：微信开发者工具 → 云开发 → 云函数 → 右键「上传并部署：云端安装依赖」
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async () => {
  const { OPENID } = cloud.getWXContext()
  return { openid: OPENID }
}
