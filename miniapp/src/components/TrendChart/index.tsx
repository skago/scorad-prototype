/**
 * 极简 SCORAD 趋势折线图组件（自实现，零依赖，控主包体积）
 * - canvas type="2d" 新接口，按 devicePixelRatio 缩放防模糊
 * - 背景绘制严重度色带：<25 轻度 / 25-50 中度 / >50 重度
 * - 已知限制：模拟器 canvas 2d 渲染与真机有差异，需真机预览验证
 */
import { Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useId, useRef } from 'react'

export interface TrendPoint {
  /** X 轴标签（就诊周次或日期） */
  label: string
  /** SCORAD 值 */
  value: number
  /** 数据点备注（评估时间，列表展示用） */
  title?: string
}

interface Props {
  points: TrendPoint[]
  height?: number
}

const PAD = { left: 36, right: 14, top: 14, bottom: 28 }
/** 严重度分层色带（与 PRD 严重度阈值一致：<25 / 25-50 / >50） */
const BANDS: Array<{ from: number; to: number; color: string }> = [
  { from: 0, to: 25, color: 'rgba(76, 175, 80, 0.10)' },
  { from: 25, to: 50, color: 'rgba(255, 193, 7, 0.12)' },
  { from: 50, to: 103, color: 'rgba(244, 67, 54, 0.10)' }
]
const GRID_TICKS = [0, 25, 50, 75, 100]

function severityColor(v: number): string {
  if (v < 25) return '#4caf50'
  if (v <= 50) return '#ff9800'
  return '#f44336'
}

export default function TrendChart({ points, height = 220 }: Props) {
  const canvasId = useRef(`trend_${Math.random().toString(36).slice(2, 10)}`).current
  const reactId = useId() // 触发严格模式下 effect 重放防护无必要，仅保持引用稳定
  void reactId

  useEffect(() => {
    if (points.length === 0) return
    // 等一帧确保 Canvas 节点已挂载
    const timer = setTimeout(() => draw(), 50)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  function draw() {
    Taro.createSelectorQuery()
      .select(`#${canvasId}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        const info = res?.[0]
        if (!info?.node) return
        const canvas = info.node as { width: number; height: number; getContext(t: '2d'): CanvasRenderingContext2D | null }
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const dpr = Taro.getWindowInfo?.().pixelRatio ?? Taro.getSystemInfoSync().pixelRatio ?? 2
        const W = info.width
        const H = info.height
        canvas.width = W * dpr
        canvas.height = H * dpr
        ctx.scale(dpr, dpr)

        const yMax = Math.max(100, ...points.map((p) => p.value))
        const plotW = W - PAD.left - PAD.right
        const plotH = H - PAD.top - PAD.bottom
        const xOf = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW)
        const yOf = (v: number) => PAD.top + plotH - (v / yMax) * plotH

        // 严重度色带
        for (const b of BANDS) {
          if (b.from > yMax) continue
          ctx.fillStyle = b.color
          ctx.fillRect(PAD.left, yOf(Math.min(b.to, yMax)), plotW, yOf(b.from) - yOf(Math.min(b.to, yMax)))
        }
        // 网格线 + Y 轴刻度
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        for (const t of GRID_TICKS) {
          if (t > yMax) continue
          ctx.strokeStyle = 'rgba(0,0,0,0.08)'
          ctx.beginPath()
          ctx.moveTo(PAD.left, yOf(t))
          ctx.lineTo(W - PAD.right, yOf(t))
          ctx.stroke()
          ctx.fillStyle = '#909399'
          ctx.fillText(String(t), PAD.left - 6, yOf(t))
        }
        // 折线
        ctx.strokeStyle = '#1565c0'
        ctx.lineWidth = 2
        ctx.beginPath()
        points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(xOf(i), yOf(p.value))
          else ctx.lineTo(xOf(i), yOf(p.value))
        })
        ctx.stroke()
        // 数据点（按严重度着色）
        points.forEach((p, i) => {
          ctx.fillStyle = severityColor(p.value)
          ctx.beginPath()
          ctx.arc(xOf(i), yOf(p.value), 3.5, 0, Math.PI * 2)
          ctx.fill()
        })
        // X 轴标签（≤6 全显，否则均分取 6 个）
        ctx.fillStyle = '#909399'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const step = Math.max(1, Math.ceil(points.length / 6))
        points.forEach((p, i) => {
          if (i % step !== 0 && i !== points.length - 1) return
          const label = p.label.length > 8 ? p.label.slice(0, 8) : p.label
          ctx.fillText(label, xOf(i), H - PAD.bottom + 8)
        })
      })
  }

  return (
    <Canvas
      type='2d'
      id={canvasId}
      style={{ width: '100%', height: `${height}px` }}
    />
  )
}
