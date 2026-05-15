import { useTheme } from '../contexts/ThemeContext'

export interface ChartColors {
  backgroundColor: string
  tooltipBg: string
  tooltipBorder: string
  textColor: string
  mutedTextColor: string
  splitLineColor: string
  axisLineColor: string
  areaStartColor: string
  areaEndColor: string
  lineColor: string
  radarFillStart: string
  radarFillEnd: string
}

export function useChartTheme(): ChartColors {
  const { isDark } = useTheme()

  return isDark ? {
    backgroundColor: 'rgba(17, 24, 39, 0.9)',
    tooltipBg: 'rgba(17, 24, 39, 0.95)',
    tooltipBorder: 'rgba(0, 212, 255, 0.3)',
    textColor: '#e2e8f0',
    mutedTextColor: '#94a3b8',
    splitLineColor: 'rgba(0, 212, 255, 0.1)',
    axisLineColor: 'rgba(0, 212, 255, 0.2)',
    areaStartColor: 'rgba(0, 212, 255, 0.2)',
    areaEndColor: 'rgba(0, 212, 255, 0.02)',
    lineColor: '#00d4ff',
    radarFillStart: 'rgba(0, 212, 255, 0.3)',
    radarFillEnd: 'rgba(168, 85, 247, 0.15)',
  } : {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    tooltipBg: 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: 'rgba(2, 132, 199, 0.3)',
    textColor: '#0f172a',
    mutedTextColor: '#64748b',
    splitLineColor: 'rgba(100, 116, 139, 0.15)',
    axisLineColor: 'rgba(100, 116, 139, 0.3)',
    areaStartColor: 'rgba(2, 132, 199, 0.15)',
    areaEndColor: 'rgba(2, 132, 199, 0.02)',
    lineColor: '#0284c7',
    radarFillStart: 'rgba(2, 132, 199, 0.25)',
    radarFillEnd: 'rgba(124, 58, 237, 0.1)',
  }
}
