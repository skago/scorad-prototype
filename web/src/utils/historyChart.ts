import { LineChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  TooltipComponent
} from 'echarts/components'
import { init, use, type ECharts } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

use([LineChart, GridComponent, LegendComponent, MarkAreaComponent, TooltipComponent, CanvasRenderer])

export function createHistoryChart(element: HTMLDivElement): ECharts {
  return init(element)
}

export type { ECharts }
