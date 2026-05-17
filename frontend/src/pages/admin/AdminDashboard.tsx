import { useEffect, useState, useMemo } from 'react'
import { Card, Row, Col, Statistic, Spin } from 'antd'
import {
  UserOutlined,
  DatabaseOutlined,
  EditOutlined,
  TeamOutlined,
  CrownOutlined,
} from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react'
import { useChartTheme } from '../../hooks/useChartTheme'
import { adminFetch } from '../../adminAuth'

interface Stats {
  total_users: number
  total_questions: number
  total_answers: number
  today_answers: number
  premium_users: number
  active_users_today: number
}

interface TrendData {
  dates: string[]
  counts: number[]
}

interface KpItem {
  knowledge_point: string
  total: number
  correct: number
  rate: number
}

interface SourceItem {
  source: string
  count: number
}

interface OverviewData {
  source_distribution: SourceItem[]
  membership_ratio: { free: number; premium: number }
}

const SOURCE_LABEL: Record<string, string> = {
  system: '系统', user: '用户上传', ai_generated: 'AI生成',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [trend, setTrend] = useState<TrendData | null>(null)
  const [kpMastery, setKpMastery] = useState<KpItem[]>([])
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const chartColors = useChartTheme()

  useEffect(() => {
    Promise.all([
      adminFetch('/admin/stats').then((r) => r.json()),
      adminFetch('/admin/stats/trend?days=7').then((r) => r.json()),
      adminFetch('/admin/stats/knowledge-mastery').then((r) => r.json()),
      adminFetch('/admin/stats/overview-charts').then((r) => r.json()),
    ])
      .then(([s, t, k, o]) => {
        setStats(s)
        setTrend(t)
        setKpMastery(k.items || [])
        setOverview(o)
      })
      .finally(() => setLoading(false))
  }, [])

  const trendOption = useMemo(() => trend ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      textStyle: { color: chartColors.textColor },
    },
    grid: { left: 40, right: 16, top: 20, bottom: 24 },
    xAxis: {
      type: 'category' as const,
      data: trend.dates,
      axisLine: { lineStyle: { color: chartColors.axisLineColor } },
      axisLabel: { color: chartColors.mutedTextColor, fontSize: 11 },
    },
    yAxis: {
      type: 'value' as const,
      minInterval: 1,
      splitLine: { lineStyle: { color: chartColors.splitLineColor } },
      axisLabel: { color: chartColors.mutedTextColor, fontSize: 11 },
    },
    series: [{
      type: 'line' as const,
      data: trend.counts,
      smooth: true,
      symbol: 'circle' as const,
      symbolSize: 6,
      lineStyle: { color: chartColors.lineColor, width: 2 },
      areaStyle: {
        color: {
          type: 'linear' as const,
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: chartColors.areaStartColor },
            { offset: 1, color: chartColors.areaEndColor },
          ],
        },
      },
      itemStyle: { color: chartColors.lineColor },
    }],
  } : null, [trend, chartColors])

  const kpOption = useMemo(() => kpMastery.length > 0 ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      textStyle: { color: chartColors.textColor },
      formatter: (params: { name: string; value: number }[]) => {
        const item = kpMastery.find((k) => k.knowledge_point === params[0]?.name)
        if (!item) return ''
        return `${item.knowledge_point}<br/>正确率: ${item.rate}%<br/>答题: ${item.total} 题 (正确: ${item.correct})`
      },
    },
    grid: { left: 80, right: 40, top: 16, bottom: 20 },
    xAxis: {
      type: 'value' as const,
      max: 100,
      axisLabel: { color: chartColors.mutedTextColor, fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: chartColors.splitLineColor } },
    },
    yAxis: {
      type: 'category' as const,
      data: kpMastery.map((k) => k.knowledge_point).reverse(),
      axisLine: { lineStyle: { color: chartColors.axisLineColor } },
      axisLabel: { color: chartColors.textColor, fontSize: 11 },
    },
    series: [{
      type: 'bar' as const,
      data: kpMastery.map((k) => k.rate).reverse(),
      barWidth: 14,
      itemStyle: {
        borderRadius: [0, 6, 6, 0],
        color: {
          type: 'linear' as const,
          x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [
            { offset: 0, color: chartColors.areaStartColor },
            { offset: 1, color: chartColors.lineColor },
          ],
        },
      },
      label: {
        show: true,
        position: 'right' as const,
        color: chartColors.textColor,
        fontSize: 11,
        formatter: '{c}%',
      },
    }],
  } : null, [kpMastery, chartColors])

  const sourceOption = useMemo(() => overview && overview.source_distribution.length > 0 ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      textStyle: { color: chartColors.textColor },
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}: ${params.value} 题 (${params.percent}%)`,
    },
    series: [{
      type: 'pie' as const,
      radius: ['36%', '62%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: chartColors.backgroundColor, borderWidth: 2 },
      label: {
        color: chartColors.textColor,
        fontSize: 12,
        formatter: '{b}',
      },
      labelLine: { lineStyle: { color: chartColors.axisLineColor } },
      data: overview.source_distribution
        .filter((s) => s.count > 0)
        .map((s, i) => ({
          name: SOURCE_LABEL[s.source] || s.source,
          value: s.count,
          itemStyle: {
            color: [chartColors.lineColor, '#a855f7', '#f59e0b'][i % 3],
          },
        })),
    }],
  } : null, [overview, chartColors])

  const memberOption = useMemo(() => overview ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      textStyle: { color: chartColors.textColor },
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}: ${params.value} 人 (${params.percent}%)`,
    },
    series: [{
      type: 'pie' as const,
      radius: ['36%', '62%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: chartColors.backgroundColor, borderWidth: 2 },
      label: {
        color: chartColors.textColor,
        fontSize: 12,
        formatter: '{b}',
      },
      labelLine: { lineStyle: { color: chartColors.axisLineColor } },
      data: [
        {
          name: '免费用户', value: overview.membership_ratio.free,
          itemStyle: { color: chartColors.mutedTextColor },
        },
        {
          name: '会员用户', value: overview.membership_ratio.premium,
          itemStyle: { color: '#f59e0b' },
        },
      ].filter((d) => d.value > 0),
    }],
  } : null, [overview, chartColors])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    )
  }

  const cards = [
    { title: '总用户数', value: stats?.total_users ?? 0, icon: <UserOutlined />, gradient: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' },
    { title: '总题目数', value: stats?.total_questions ?? 0, icon: <DatabaseOutlined />, gradient: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)' },
    { title: '会员用户', value: stats?.premium_users ?? 0, icon: <CrownOutlined />, gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' },
    { title: '今日做题', value: stats?.today_answers ?? 0, icon: <EditOutlined />, gradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)' },
    { title: '今日活跃', value: stats?.active_users_today ?? 0, icon: <TeamOutlined />, gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' },
  ]

  return (
    <div>
      <h2 className="admin-page-title">
        仪表盘
      </h2>

      <Row gutter={[20, 20]}>
        {cards.map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.title}>
            <div className="admin-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  fontSize: 24,
                  background: card.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {card.icon}
                </div>
                <span style={{ color: '#94a3b8', fontSize: 14 }}>{card.title}</span>
              </div>
              <div
                className="admin-stat-value"
                style={{
                  background: card.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {card.value.toLocaleString()}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* 趋势图 + 知识点掌握 */}
      <Row gutter={[20, 20]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <div className="admin-stat-card" style={{ padding: 20 }}>
            <h3 style={{ color: '#e2e8f0', fontSize: 15, marginBottom: 16, fontWeight: 600 }}>
              近 7 天做题趋势
            </h3>
            {trendOption ? (
              <ReactEChartsCore option={trendOption} style={{ height: 220 }} />
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>暂无数据</div>
            )}
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="admin-stat-card" style={{ padding: 20 }}>
            <h3 style={{ color: '#e2e8f0', fontSize: 15, marginBottom: 16, fontWeight: 600 }}>
              各知识点正确率
            </h3>
            {kpOption ? (
              <ReactEChartsCore option={kpOption} style={{ height: 220 }} />
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>暂无数据</div>
            )}
          </div>
        </Col>
      </Row>

      {/* 来源分布 + 会员比例 */}
      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={12}>
          <div className="admin-stat-card" style={{ padding: 20 }}>
            <h3 style={{ color: '#e2e8f0', fontSize: 15, marginBottom: 16, fontWeight: 600 }}>
              题目来源分布
            </h3>
            {sourceOption ? (
              <ReactEChartsCore option={sourceOption} style={{ height: 220 }} />
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>暂无数据</div>
            )}
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="admin-stat-card" style={{ padding: 20 }}>
            <h3 style={{ color: '#e2e8f0', fontSize: 15, marginBottom: 16, fontWeight: 600 }}>
              用户会员比例
            </h3>
            {memberOption ? (
              <ReactEChartsCore option={memberOption} style={{ height: 220 }} />
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>暂无数据</div>
            )}
          </div>
        </Col>
      </Row>
    </div>
  )
}
