import { useState, useEffect, useRef } from 'react'
import { Card, Row, Col, Statistic, Button, Spin, Skeleton, Empty, message, Typography } from 'antd'
import { PrinterOutlined, DownloadOutlined, EditOutlined, CheckCircleOutlined, CloseCircleOutlined, TrophyOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react'
import { renderLatex } from '../utils/renderLatex'
import './Report.css'
import { API_BASE } from '../config'
import { authFetch } from '../auth'

const { Title, Paragraph } = Typography


interface ReportData {
  generated_at: string
  username: string
  stats: {
    today_count: number
    today_accuracy: number
    total_count: number
    total_accuracy: number
    total_errors: number
  }
  mastery: { knowledge_point: string; total: number; correct: number; mastery_rate: number }[]
  trend: { date: string; total: number; correct: number; accuracy: number }[]
  error_distribution: { type: string; label: string; count: number }[]
  weakest: { knowledge_point: string; total: number; correct: number; mastery_rate: number }[]
  ai_advice: string
}

const ERROR_COLORS: Record<string, string> = {
  concept_misunderstanding: '#f5222d',
  calculation_error: '#fa8c16',
  careless_mistake: '#fadb14',
  wrong_direction: '#722ed1',
  knowledge_gap: '#13c2c2',
  unknown: '#999',
}

export default function Report() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const reportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    authFetch(`${API_BASE}/report/generate`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { message.error('生成报告失败'); setLoading(false) })
  }, [])

  const handlePrint = () => window.print()

  const handleSaveText = async () => {
    if (!data) return
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `学习报告_${data.generated_at.slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="report-page">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card className="report-card" style={{ animationDelay: '0s' }}>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
          <Row gutter={[16, 16]}>
            {[1,2,3,4].map(i => (
              <Col xs={12} sm={6} key={i}>
                <Card className="report-card" style={{ animationDelay: `${i * 0.08}s` }}>
                  <Skeleton active paragraph={{ rows: 1 }} title={{ width: '60%' }} />
                </Card>
              </Col>
            ))}
          </Row>
          <Card className="report-card" style={{ animationDelay: '0.32s' }}>
            <Skeleton active paragraph={{ rows: 4 }} />
          </Card>
          <Card className="report-card" style={{ animationDelay: '0.40s' }}>
            <Skeleton active paragraph={{ rows: 3 }} />
          </Card>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Empty description="暂无数据，先去刷几道题吧" />
      </div>
    )
  }

  const radarOption = {
    radar: {
      indicator: data.mastery.map((m) => ({ name: m.knowledge_point, max: 100 })),
      shape: 'polygon',
      splitNumber: 5,
    },
    series: [{
      type: 'radar',
      data: [{ value: data.mastery.map((m) => m.mastery_rate), name: '掌握度', areaStyle: { color: 'rgba(22, 119, 255, 0.2)' } }],
    }],
  }

  const trendOption = data.trend.some((d) => d.total > 0)
    ? {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: data.trend.map((d) => d.date), axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value', min: 0, max: 100, axisLabel: { fontSize: 11, formatter: '{value}%' } },
        grid: { left: 45, right: 16, top: 8, bottom: 24 },
        series: [{
          type: 'line',
          data: data.trend.map((d) => d.accuracy),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#1677ff', width: 2 },
          areaStyle: { color: 'rgba(22, 119, 255, 0.08)' },
        }],
      }
    : null

  const knownErrors = data.error_distribution.filter((e) => e.type !== 'unknown')

  const pieOption = knownErrors.length > 0
    ? {
        tooltip: { trigger: 'item', formatter: '{b}: {c}次 ({d}%)' },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          data: knownErrors.map((e) => ({
            name: e.label,
            value: e.count,
            itemStyle: { color: ERROR_COLORS[e.type] || '#999' },
          })),
          label: { fontSize: 12 },
        }],
      }
    : null

  return (
    <div className="report-page" ref={reportRef}>
      {/* 操作栏 */}
      <div className="report-toolbar">
        <Button icon={<PrinterOutlined />} onClick={handlePrint} style={{ marginRight: 8 }}>
          打印 / 导出 PDF
        </Button>
        <Button icon={<DownloadOutlined />} onClick={handleSaveText}>
          导出数据
        </Button>
      </div>

      {/* 报告标题 */}
      <Card className="report-card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <Title level={3}>学习报告</Title>
        <Paragraph style={{ color: '#888' }}>
          {data.username} · 生成时间：{data.generated_at}
        </Paragraph>
      </Card>

      {/* 统计数据 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card className="report-stat-card report-card" style={{ animationDelay: '0s' }}>
            <div className="report-stat-card-inner">
              <div className="report-stat-card-icon report-stat-card-icon-brand1"><EditOutlined /></div>
              <Statistic title="总做题数" value={data.stats.total_count} suffix="题" />
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="report-stat-card report-card" style={{ animationDelay: '0.08s' }}>
            <div className="report-stat-card-inner">
              <div className="report-stat-card-icon report-stat-card-icon-brand2"><CheckCircleOutlined /></div>
              <Statistic
                title="总正确率"
                value={data.stats.total_accuracy}
                suffix="%"
                valueStyle={{ color: data.stats.total_accuracy >= 60 ? '#52c41a' : '#ff4d4f' }}
              />
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="report-stat-card report-card" style={{ animationDelay: '0.16s' }}>
            <div className="report-stat-card-inner">
              <div className="report-stat-card-icon report-stat-card-icon-brand3"><CloseCircleOutlined /></div>
              <Statistic
                title="总错误数"
                value={data.stats.total_errors}
                suffix="题"
                valueStyle={{ color: data.stats.total_errors > 0 ? '#ff4d4f' : '#52c41a' }}
              />
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card className="report-stat-card report-card" style={{ animationDelay: '0.24s' }}>
            <div className="report-stat-card-inner">
              <div className="report-stat-card-icon report-stat-card-icon-brand4"><TrophyOutlined /></div>
              <Statistic
                title="今日正确率"
                value={data.stats.today_accuracy}
                suffix="%"
                valueStyle={{ color: data.stats.today_accuracy >= 60 ? '#52c41a' : '#ff4d4f' }}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 雷达图 */}
      {data.mastery.length > 0 && (
        <Card title="知识点掌握度" className="report-chart-card report-card" style={{ animationDelay: '0.32s' }}>
          <ReactEChartsCore option={radarOption} style={{ height: 300 }} />
        </Card>
      )}

      {/* 趋势图 + 错因饼图 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {trendOption && (
          <Col xs={24} lg={14}>
            <Card title="近 14 天正确率趋势" className="report-chart-card report-card" style={{ animationDelay: '0.40s' }}>
              <ReactEChartsCore option={trendOption} style={{ height: 220 }} />
            </Card>
          </Col>
        )}
        {pieOption && (
          <Col xs={24} lg={10}>
            <Card title="错误类型分布" className="report-chart-card report-card" style={{ animationDelay: '0.48s' }}>
              <ReactEChartsCore option={pieOption} style={{ height: 220 }} />
            </Card>
          </Col>
        )}
      </Row>

      {/* 薄弱知识点 */}
      {data.weakest.length > 0 && (
        <Card title="薄弱知识点" className="report-chart-card report-card" style={{ animationDelay: '0.56s' }}>
          {data.weakest.map((w) => (
            <div key={w.knowledge_point} className="report-weak-item">
              <span className="report-weak-dot">●</span>{' '}
              {w.knowledge_point} —— 掌握度 {w.mastery_rate}%（做题 {w.total} 道，正确 {w.correct} 道）
            </div>
          ))}
        </Card>
      )}

      {/* AI 学习建议 */}
      <Card title="AI 学习建议" className="report-chart-card report-card" style={{ animationDelay: '0.64s' }}>
        <Paragraph className="result-paragraph">
          {renderLatex(data.ai_advice)}
        </Paragraph>
      </Card>

      {/* print styles */}
      <style>{`
        @media print {
          @page { margin: 1cm; }
          body { background: #fff; }
          .ant-btn { display: none !important; }
        }
      `}</style>
    </div>
  )
}
