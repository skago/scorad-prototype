/**
 * 文件导出工具（小程序端）
 * 写入本地临时文件后，通过 ActionSheet 提供「发送给好友 / 打开预览」
 */
import Taro from '@tarojs/taro'
import { buildCsv, recordsToJson } from './csv'
import type { CsvExportOptions } from './csv'
import type { AssessmentRecord } from '@/storage/types'

/** 把内容写入用户数据目录，返回文件路径；失败返回 null */
function writeTempFile(content: string, ext: string, baseName: string): string | null {
  const fs = Taro.getFileSystemManager()
  const filePath = `${Taro.env.USER_DATA_PATH}/${baseName}_${Date.now()}.${ext}`
  try {
    fs.writeFileSync(filePath, content, 'utf8')
    return filePath
  } catch {
    return null
  }
}

/** 写文件后弹出 ActionSheet；preview=false 时仅提供「发送给好友」 */
async function exportFile(content: string, ext: string, baseName: string, preview: boolean): Promise<void> {
  const filePath = writeTempFile(content, ext, baseName)
  if (!filePath) {
    Taro.showToast({ title: '文件写入失败', icon: 'none' })
    return
  }
  const items = preview ? ['发送给好友', '打开预览'] : ['发送给好友']
  try {
    const res = await Taro.showActionSheet({ itemList: items })
    if (items[res.tapIndex] === '发送给好友') {
      await Taro.shareFileMessage({ filePath })
    } else if (items[res.tapIndex] === '打开预览') {
      await Taro.openDocument({ filePath, fileType: ext as never, showMenu: true })
    }
  } catch {
    // 用户取消或当前环境不支持（如模拟器不支持 shareFileMessage）
  }
}

/** 导出记录为 CSV（支持预览，openDocument fileType: csv；deidentified 时 34 列无姓名） */
export async function exportRecordsAsCsv(
  records: AssessmentRecord[],
  baseName = 'scorad_export',
  opts: CsvExportOptions = {}
): Promise<void> {
  if (records.length === 0) {
    Taro.showToast({ title: '无记录可导出', icon: 'none' })
    return
  }
  await exportFile(buildCsv(records, opts), 'csv', baseName, true)
}

/** 导出记录为 JSON（含全部审计字段；openDocument 不支持 json，仅「发送给好友」） */
export async function exportRecordsAsJson(records: AssessmentRecord[], baseName = 'scorad_export'): Promise<void> {
  if (records.length === 0) {
    Taro.showToast({ title: '无记录可导出', icon: 'none' })
    return
  }
  await exportFile(recordsToJson(records), 'json', baseName, false)
}
