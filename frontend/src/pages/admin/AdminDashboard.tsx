import { useEffect, useState, useMemo } from 'react'
import { Row, Col, Spin, Button } from 'antd'
import {
  UserOutlined,
  DatabaseOutlined,
  EditOutlined,
  TeamOutlined,
  CrownOutlined,
  AuditOutlined,
  WalletOutlined,
  GiftOutlined,
  ArrowRightOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react'
import { useNavigate } from 'react-router-dom'
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

interface BehaviorItem {
  date: string
  answers: number
  active_users: number
  new_users: number
  uploads: number
}

interface TodoCard {
  key: string
  title: string
  value: number
  hint: string
  path: string
  tone: 'purple' | 'orange' | 'blue' | 'green'
}

interface InsightData {
  behavior_trend: BehaviorItem[]
  todo_cards: TodoCard[]
}

const SOURCE_LABEL: Record<string, string> = {
  system: '系统', user: '用户上传', ai_generated: 'AI生成',
}

const QUICK_ACTIONS = [
  {
    key: 'review',
    title: '处理内容审核',
    desc: '快速进入待审核题目列表',
    path: '/admin/review',
    icon: <AuditOutlined />,
    tone: 'purple',
  },
  {
    key: 'payments',
    title: '查看支付订单',
    desc: '跟进待支付与异常订单',
    path: '/admin/payments',
    icon: <WalletOutlined />,
    tone: 'orange',
  },
  {
    key: 'codes',
    title: '管理兑换码',
    desc: '生成、启停会员兑换码',
    path: '/admin/codes',
    icon: <GiftOutlined />,
    tone: 'blue',
  },
  {
    key: 'users',
    title: '查看用户管理',
    desc: '管理会员、筛查高价值用户',
    path: '/admin/users',
    icon: <TeamOutlined />,
    tone: 'green',
  },
  {
    key: 'questions',
    title: '维护题库',
    desc: '整理题目来源与知识点质量',
    path: '/admin/questions',
    icon: <DatabaseOutlined />,
    tone: 'violet',
  },
  {
    key: 'analytics',
    title: '查看错题分析',
    desc: '定位高频错题与薄弱知识点',
    path: '/admin/analytics',
    icon: <BarChartOutlined />,
    tone: 'cyan',
  },
]

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [trend, setTrend] = useState<TrendData | null>(null)
  const [kpMastery, setKpMastery] = useState<KpItem[]>([])
  const [overview, setOverview] = useState<OverviewData | null>(null)
  const [insights, setInsights] = useState<InsightData | null>(null)
  const chartColors = useChartTheme()

  useEffect(() => {
    Promise.all([
      adminFetch('/admin/stats').then((r) => r.json()),
      adminFetch('/admin/stats/trend?days=7').then((r) => r.json()),
      adminFetch('/admin/stats/knowledge-mastery').then((r) => r.json()),
      adminFetch('/admin/stats/overview-charts').then((r) => r.json()),
      adminFetch('/admin/stats/dashboard-insights?days=7').then((r) => r.json()),
    ])
      .then(([s, t, k, o, i]) => {
        setStats(s)
        setTrend(t)
        setKpMastery(k.items || [])
        setOverview(o)
        setInsights(i)
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

  const behaviorOption = useMemo(() => insights && insights.behavior_trend.length > 0 ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      textStyle: { color: chartColors.textColor },
    },
    legend: {
      top: 0,
      textStyle: { color: chartColors.mutedTextColor, fontSize: 11 },
    },
    grid: { left: 42, right: 18, top: 42, bottom: 26 },
    xAxis: {
      type: 'category' as const,
      data: insights.behavior_trend.map((item) => item.date),
      axisLine: { lineStyle: { color: chartColors.axisLineColor } },
      axisLabel: { color: chartColors.mutedTextColor, fontSize: 11 },
    },
    yAxis: {
      type: 'value' as const,
      minInterval: 1,
      splitLine: { lineStyle: { color: chartColors.splitLineColor } },
      axisLabel: { color: chartColors.mutedTextColor, fontSize: 11 },
    },
    series: [
      {
        name: '答题量',
        type: 'line' as const,
        smooth: true,
        data: insights.behavior_trend.map((item) => item.answers),
        lineStyle: { color: chartColors.lineColor, width: 2.4 },
        itemStyle: { color: chartColors.lineColor },
        symbolSize: 6,
      },
      {
        name: '活跃用户',
        type: 'line' as const,
        smooth: true,
        data: insights.behavior_trend.map((item) => item.active_users),
        lineStyle: { color: '#a855f7', width: 2 },
        itemStyle: { color: '#a855f7' },
        symbolSize: 5,
      },
      {
        name: '用户上传',
        type: 'bar' as const,
        barMaxWidth: 18,
        data: insights.behavior_trend.map((item) => item.uploads),
        itemStyle: {
          color: chartColors.backgroundColor.includes('255')
            ? 'rgba(14, 165, 233, 0.5)'
            : 'rgba(34, 197, 94, 0.55)',
          borderRadius: [6, 6, 0, 0],
        },
      },
    ],
  } : null, [insights, chartColors])

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
                <span className="admin-stat-label">{card.title}</span>
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

      <div className="admin-dashboard-section-head" style={{ marginTop: 28 }}>
        <div>
          <h3 className="admin-dashboard-section-title">待处理事项</h3>
          <p className="admin-dashboard-section-subtitle">优先处理这些会直接影响内容流转和后台运营效率的事项。</p>
        </div>
      </div>

      <Row gutter={[18, 18]}>
        {(insights?.todo_cards || []).map((item) => (
          <Col xs={24} sm={12} xl={6} key={item.key}>
            <div className={`admin-insight-card tone-${item.tone}`} onClick={() => navigate(item.path)}>
              <div className="admin-insight-card-top">
                <span className="admin-insight-card-title">{item.title}</span>
                <ArrowRightOutlined className="admin-insight-card-arrow" />
              </div>
              <div className="admin-insight-card-value">{item.value.toLocaleString()}</div>
              <div className="admin-insight-card-hint">{item.hint}</div>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 24 }}>
        <Col xs={24} xl={16}>
          <div className="admin-stat-card admin-feature-card">
            <div className="admin-dashboard-section-head compact">
              <div>
                <h3 className="admin-dashboard-section-title">用户行为趋势</h3>
                <p className="admin-dashboard-section-subtitle">对比近 7 天答题、活跃、上传的变化，快速判断平台活跃度。</p>
              </div>
              <div className="admin-dashboard-chip">
                <ThunderboltOutlined />
                <span>近 7 天</span>
              </div>
            </div>
            {behaviorOption ? (
              <ReactEChartsCore option={behaviorOption} style={{ height: 300 }} />
            ) : (
              <div className="admin-empty-block">暂无行为趋势数据</div>
            )}
          </div>
        </Col>
        <Col xs={24} xl={8}>
          <div className="admin-stat-card admin-feature-card">
            <div className="admin-dashboard-section-head compact">
              <div>
                <h3 className="admin-dashboard-section-title">快捷操作区</h3>
                <p className="admin-dashboard-section-subtitle">把后台高频动作收拢到首页，减少来回跳页。</p>
              </div>
              <div className="admin-dashboard-chip">
                <SafetyOutlined />
                <span>高频</span>
              </div>
            </div>
            <div className="admin-quick-actions">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  className={`admin-quick-action tone-${action.tone}`}
                  onClick={() => navigate(action.path)}
                >
                  <div className="admin-quick-action-icon">{action.icon}</div>
                  <div className="admin-quick-action-copy">
                    <div className="admin-quick-action-title">{action.title}</div>
                    <div className="admin-quick-action-desc">{action.desc}</div>
                  </div>
                  <ArrowRightOutlined className="admin-quick-action-arrow" />
                </button>
              ))}
            </div>
          </div>
        </Col>
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <div className="admin-stat-card admin-feature-card">
            <h3 className="admin-dashboard-section-title">近 7 天做题趋势</h3>
            {trendOption ? (
              <ReactEChartsCore option={trendOption} style={{ height: 220 }} />
            ) : (
              <div className="admin-empty-block">暂无数据</div>
            )}
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="admin-stat-card admin-feature-card">
            <h3 className="admin-dashboard-section-title">各知识点正确率</h3>
            {kpOption ? (
              <ReactEChartsCore option={kpOption} style={{ height: 220 }} />
            ) : (
              <div className="admin-empty-block">暂无数据</div>
            )}
          </div>
        </Col>
      </Row>

      <Row gutter={[20, 20]} style={{ marginTop: 20 }}>
        <Col xs={24} lg={12}>
          <div className="admin-stat-card admin-feature-card">
            <h3 className="admin-dashboard-section-title">题目来源分布</h3>
            {sourceOption ? (
              <ReactEChartsCore option={sourceOption} style={{ height: 220 }} />
            ) : (
              <div className="admin-empty-block">暂无数据</div>
            )}
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="admin-stat-card admin-feature-card">
            <h3 className="admin-dashboard-section-title">用户会员比例</h3>
            {memberOption ? (
              <ReactEChartsCore option={memberOption} style={{ height: 220 }} />
            ) : (
              <div className="admin-empty-block">暂无数据</div>
            )}
          </div>
        </Col>
      </Row>

      <div style={{ marginTop: 20 }}>
        <Button type="default" onClick={() => navigate('/admin/analytics')}>
          查看完整错题分析
        </Button>
      </div>
    </div>
  )
}
