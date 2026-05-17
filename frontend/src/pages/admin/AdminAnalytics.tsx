import { useEffect, useState, useMemo } from 'react'
import { Table, Tag, Select, Space, Typography, Row, Col, Spin } from 'antd'
import ReactEChartsCore from 'echarts-for-react'
import { useChartTheme } from '../../hooks/useChartTheme'
import { adminFetch } from '../../adminAuth'

interface WrongItem {
  question_id: number
  content: string
  knowledge_point: string
  total_answers: number
  wrong_count: number
  wrong_rate: number
}

interface ErrorTypeItem {
  type: string
  label: string
  count: number
  rate: number
}

interface WeakKpItem {
  knowledge_point: string
  total: number
  correct: number
  rate: number
  total_users: number
}

const KNOWLEDGE_POINTS = [
  '极限与连续', '导数与微分', '不定积分与定积分',
  '微分中值定理', '多元函数', '级数',
]

const ERROR_TYPE_COLORS: Record<string, string> = {
  concept_misunderstanding: '#ef4444',
  calculation_error: '#f97316',
  careless_mistake: '#eab308',
  wrong_direction: '#a855f7',
  knowledge_gap: '#3b82f6',
  unknown: '#94a3b8',
}

export default function AdminAnalytics() {
  const [wrongData, setWrongData] = useState<WrongItem[]>([])
  const [errorTypes, setErrorTypes] = useState<ErrorTypeItem[]>([])
  const [weakKp, setWeakKp] = useState<WeakKpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [wrongPage, setWrongPage] = useState(1)
  const [wrongTotal, setWrongTotal] = useState(0)
  const [kpFilter, setKpFilter] = useState('')
  const chartColors = useChartTheme()

  const fetchAll = () => {
    setLoading(true)
    Promise.all([
      adminFetch(`/admin/analytics/wrong-questions?page=${wrongPage}&page_size=20${kpFilter ? `&knowledge_point=${kpFilter}` : ''}`).then(r => r.json()),
      adminFetch('/admin/analytics/error-types').then(r => r.json()),
      adminFetch('/admin/analytics/weak-knowledge').then(r => r.json()),
    ]).then(([w, e, k]) => {
      setWrongData(w.items || [])
      setWrongTotal(w.total || 0)
      setErrorTypes(e.items || [])
      setWeakKp(k.items || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { fetchAll() }, [wrongPage, kpFilter])

  const errorOption = useMemo(() => errorTypes.length > 0 ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      textStyle: { color: chartColors.textColor },
      formatter: (params: { name: string; value: number; percent: number }) =>
        `${params.name}: ${params.value} 次 (${params.percent}%)`,
    },
    series: [{
      type: 'pie' as const,
      radius: ['30%', '58%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 4, borderColor: chartColors.backgroundColor, borderWidth: 2 },
      label: { color: chartColors.textColor, fontSize: 11, formatter: '{b}\n{d}%' },
      labelLine: { lineStyle: { color: chartColors.axisLineColor } },
      data: errorTypes.map((e) => ({
        name: e.label,
        value: e.count,
        itemStyle: { color: ERROR_TYPE_COLORS[e.type] || '#94a3b8' },
      })),
    }],
  } : null, [errorTypes, chartColors])

  const weakKpOption = useMemo(() => weakKp.length > 0 ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      textStyle: { color: chartColors.textColor },
      formatter: (params: { name: string; value: number }[]) => {
        const item = weakKp.find((k) => k.knowledge_point === params[0]?.name)
        if (!item) return ''
        return `${item.knowledge_point}<br/>正确率: ${item.rate}%<br/>总答题: ${item.total}<br/>参与用户: ${item.total_users}`
      },
    },
    grid: { left: 90, right: 40, top: 16, bottom: 24 },
    xAxis: {
      type: 'value' as const,
      max: 100,
      axisLabel: { color: chartColors.mutedTextColor, fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: chartColors.splitLineColor } },
    },
    yAxis: {
      type: 'category' as const,
      data: weakKp.map((k) => k.knowledge_point).reverse(),
      axisLine: { lineStyle: { color: chartColors.axisLineColor } },
      axisLabel: { color: chartColors.textColor, fontSize: 11 },
    },
    series: [{
      type: 'bar' as const,
      data: weakKp.map((k) => ({ value: k.rate, itemStyle: { color: k.rate < 50 ? '#ef4444' : k.rate < 70 ? '#f59e0b' : '#22c55e' } })).reverse(),
      barWidth: 18,
      label: {
        show: true,
        position: 'right' as const,
        color: chartColors.textColor,
        fontSize: 11,
        formatter: (p: { value: number }) => `${p.value}%`,
      },
    }],
  } : null, [weakKp, chartColors])

  const wrongColumns = [
    { title: '排名', key: 'rank', width: 60, render: (_: unknown, __: unknown, i: number) => (wrongPage - 1) * 20 + i + 1 },
    { title: '题目ID', dataIndex: 'question_id', key: 'question_id', width: 70 },
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '知识点', dataIndex: 'knowledge_point', key: 'knowledge_point', width: 120, render: (v: string) => <Tag>{v}</Tag> },
    { title: '答题次数', dataIndex: 'total_answers', key: 'total_answers', width: 80 },
    {
      title: '错误次数', dataIndex: 'wrong_count', key: 'wrong_count', width: 80,
      render: (v: number) => <span style={{ color: '#ef4444', fontWeight: 700 }}>{v}</span>,
    },
    {
      title: '错误率', dataIndex: 'wrong_rate', key: 'wrong_rate', width: 80,
      render: (v: number) => (
        <Tag color={v >= 70 ? 'red' : v >= 40 ? 'orange' : 'green'}>{v}%</Tag>
      ),
    },
  ]

  return (
    <div>
      <h2 className="admin-page-title">错题分析</h2>

      {loading && wrongData.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* 图表区域 */}
          <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
            <Col xs={24} lg={12}>
              <div className="admin-stat-card" style={{ padding: 20 }}>
                <Typography.Text strong style={{ color: '#e2e8f0', fontSize: 15, display: 'block', marginBottom: 12 }}>
                  薄弱知识点排名
                </Typography.Text>
                {weakKpOption ? (
                  <ReactEChartsCore option={weakKpOption} style={{ height: weakKp.length * 40 + 60 }} />
                ) : (
                  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>暂无数据</div>
                )}
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div className="admin-stat-card" style={{ padding: 20 }}>
                <Typography.Text strong style={{ color: '#e2e8f0', fontSize: 15, display: 'block', marginBottom: 12 }}>
                  全平台错误类型分布
                </Typography.Text>
                {errorOption ? (
                  <ReactEChartsCore option={errorOption} style={{ height: 260 }} />
                ) : (
                  <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>暂无数据</div>
                )}
              </div>
            </Col>
          </Row>

          {/* 高频错题表 */}
          <div className="admin-stat-card" style={{ padding: 20 }}>
            <Typography.Text strong style={{ color: '#e2e8f0', fontSize: 15, display: 'block', marginBottom: 12 }}>
              高频错题排行榜
            </Typography.Text>
            <Space style={{ marginBottom: 16 }}>
              <Select
                value={kpFilter}
                onChange={(v) => { setKpFilter(v); setWrongPage(1) }}
                options={[{ label: '全部知识点', value: '' }, ...KNOWLEDGE_POINTS.map((p) => ({ label: p, value: p }))]}
                style={{ width: 150 }}
              />
            </Space>
            <Table
              dataSource={wrongData}
              columns={wrongColumns}
              rowKey="question_id"
              pagination={{
                current: wrongPage,
                pageSize: 20,
                total: wrongTotal,
                onChange: setWrongPage,
              }}
              size="small"
            />
          </div>
        </>
      )}
    </div>
  )
}
