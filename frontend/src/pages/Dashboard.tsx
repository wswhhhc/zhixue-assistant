import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Col, Row, Statistic, List, message, Empty, Skeleton,
  Input, Button, Space, Progress, InputNumber,
} from 'antd'
import { SendOutlined, ClockCircleOutlined, FlagOutlined, EditOutlined, CheckCircleOutlined, BookOutlined, TrophyOutlined, FireOutlined } from '@ant-design/icons'
import { renderLatex } from '../utils/renderLatex'
import { useChartTheme } from '../hooks/useChartTheme'
import './Dashboard.css'
import ReactEChartsCore from 'echarts-for-react'
import { API_BASE } from '../config'
import { authFetch } from '../auth'

const { TextArea } = Input

// 错误类型映射（用于显示）
const _ERROR_TYPE_MAP: Record<string, string> = {
  concept_misunderstanding: '概念理解偏差',
  calculation_error: '计算错误',
  careless_mistake: '审题/粗心失误',
  wrong_direction: '思路方向错误',
  knowledge_gap: '知识点未掌握',
  unknown: '未识别',
  correct: '正确',
}


interface MasteryItem {
  knowledge_point: string
  total: number
  correct: number
  mastery_rate: number
}

interface WrongItem {
  record_id: number
  question_id: number
  content: string
  knowledge_point: string
  error_type: string
  created_at: string
}

interface StatsData {
  today_count: number
  today_accuracy: number
  total_count: number
  total_accuracy: number
  mastery: MasteryItem[]
  recent_wrong: WrongItem[]
}

export default function Dashboard() {
  const navigate = useNavigate()
  const chartColors = useChartTheme()
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [trendData, setTrendData] = useState<{ date: string; total: number; correct: number; accuracy: number }[] | null>(null)

  // AI 问答状态
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [answering, setAnswering] = useState(false)
  const answerRef = useRef<HTMLDivElement>(null)

  // 打卡状态
  const [checkedIn, setCheckedIn] = useState(false)
  const [streak, setStreak] = useState(0)
  const [weekDays, setWeekDays] = useState<{ date: string; checked: boolean }[]>([])
  const [checking, setChecking] = useState(false)

  // 今日目标
  const [dailyGoal, setDailyGoal] = useState(10)
  const [goalInput, setGoalInput] = useState(10)
  const [editingGoal, setEditingGoal] = useState(false)

  // 使用配额
  const [quotas, setQuotas] = useState<Record<string, { used: number; limit: number }> | null>(null)

  // 学习动态
  const [timeline, setTimeline] = useState<{ type: string; label: string; detail: string; time: string }[]>([])

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      try {
        const results = await Promise.allSettled([
          authFetch(`${API_BASE}/dashboard/stats`),
          authFetch(`${API_BASE}/dashboard/trend?days=14`),
          authFetch(`${API_BASE}/checkin/status`),
          authFetch(`${API_BASE}/user/goal`),
          authFetch(`${API_BASE}/dashboard/timeline?days=7`),
          authFetch(`${API_BASE}/membership/status`),
        ])

        if (cancelled) return

        const [sRes, tRes, cRes, gRes, tlRes, mRes] = results.map(
          (r) => (r.status === 'fulfilled' ? r.value : null),
        )

        if (sRes?.ok) {
          const sData = await sRes.json()
          setStats(sData)
        }
        if (tRes?.ok) {
          const tData = await tRes.json()
          setTrendData(tData)
        }
        if (cRes?.ok) {
          const cData = await cRes.json()
          setCheckedIn(cData.checked_in)
          setStreak(cData.streak)
          setWeekDays(cData.week)
        }
        if (gRes?.ok) {
          const gData = await gRes.json()
          setDailyGoal(gData.daily_goal)
          setGoalInput(gData.daily_goal)
        }
        if (tlRes?.ok) {
          const tlData = await tlRes.json()
          setTimeline(tlData)
        }
        if (mRes?.ok) {
          const mData = await mRes.json()
          setQuotas(mData.quotas || null)
        }

        setLoading(false)
      } catch {
        if (!cancelled) {
          message.error('获取数据失败')
          setLoading(false)
        }
      }
    }

    fetchData()
    return () => { cancelled = true }
  }, [])

  const handleAsk = async () => {
    if (!question.trim()) return
    setAnswer('')
    setAnswering(true)

    try {
      const res = await authFetch(`${API_BASE}/qa/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        message.error(errData.detail || 'AI 问答暂时不可用')
        setAnswering(false)
        return
      }
      const reader = res.body?.getReader()
      if (!reader) { setAnswering(false); return }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === 'token') {
                setAnswer((prev) => prev + data.content)
              } else if (data.type === 'error') {
                message.error(data.content || '回答失败')
              }
            } catch {
              // skip invalid JSON
            }
          }
        }
      }

      if (buffer.startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.slice(6))
          if (data.type === 'token') {
            setAnswer((prev) => prev + data.content)
          }
        } catch {
          // skip
        }
      }
    } catch {
      message.error('请求失败，请稍后重试或联系客服')
    }

    setAnswering(false)
    // AI 问答完成后刷新配额
    refreshQuotas()
  }
  const refreshQuotas = async () => {
    try {
      const res = await authFetch(`${API_BASE}/membership/status`)
      if (res.ok) {
        const data = await res.json()
        setQuotas(data.quotas || null)
      }
    } catch { /* ignore */ }
  }

  const handleCheckin = async () => {
    setChecking(true)
    try {
      const res = await authFetch(`${API_BASE}/checkin`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setCheckedIn(true)
        setStreak(data.streak)
        // refresh week
        const sRes = await authFetch(`${API_BASE}/checkin/status`)
        const sData = await sRes.json()
        setWeekDays(sData.week)
        message.success('打卡成功')
      } else {
        const err = await res.json()
        message.error(err.detail || '打卡失败')
      }
    } catch {
      message.error('打卡失败')
    }
    setChecking(false)
  }

  const handleGoalUpdate = async () => {
    if (goalInput < 1 || goalInput > 200) { message.warning('目标范围 1-200'); return }
    try {
      const res = await authFetch(`${API_BASE}/user/goal?daily_goal=${goalInput}`, { method: 'PUT' })
      if (res.ok) {
        setDailyGoal(goalInput)
        setEditingGoal(false)
        message.success('目标已更新')
      }
    } catch { message.error('更新失败') }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk()
    }
  }

  // 雷达图配置 - 动态主题色
  const radarOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      textStyle: { color: chartColors.textColor },
    },
    radar: {
      indicator: stats?.mastery.length
        ? stats.mastery.map((m) => ({ name: m.knowledge_point, max: 100 }))
        : [{ name: '暂无数据', max: 100 }],
      shape: 'polygon',
      splitNumber: 5,
      axisName: {
        color: chartColors.mutedTextColor,
        fontSize: 12,
      },
      splitLine: {
        lineStyle: {
          color: chartColors.splitLineColor,
        },
      },
      splitArea: {
        areaStyle: {
          color: [chartColors.splitLineColor, 'transparent'],
        },
      },
      axisLine: {
        lineStyle: {
          color: chartColors.axisLineColor,
        },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: stats?.mastery.length
              ? stats.mastery.map((m) => m.mastery_rate)
              : [0],
            name: '掌握度',
            areaStyle: {
              color: {
                type: 'radial',
                x: 0.5,
                y: 0.5,
                r: 0.5,
                colorStops: [
                  { offset: 0, color: chartColors.radarFillStart },
                  { offset: 1, color: chartColors.radarFillEnd },
              ],
              },
            },
            lineStyle: {
              color: chartColors.lineColor,
              width: 2,
            },
            itemStyle: {
              color: chartColors.lineColor,
              borderColor: '#fff',
              borderWidth: 1,
            },
          },
        ],
      },
    ],
  }), [stats, chartColors])

  // 趋势图配置 - 动态主题色
  const trendOption = useMemo(() => trendData ? {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: chartColors.tooltipBg,
      borderColor: chartColors.tooltipBorder,
      textStyle: { color: chartColors.textColor },
    },
    xAxis: {
      type: 'category',
      data: trendData.map(d => d.date),
      axisLabel: { fontSize: 11, color: chartColors.mutedTextColor },
      axisLine: { lineStyle: { color: chartColors.axisLineColor } },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { fontSize: 11, formatter: '{value}%', color: chartColors.mutedTextColor },
      axisLine: { lineStyle: { color: chartColors.axisLineColor } },
      splitLine: { lineStyle: { color: chartColors.splitLineColor } },
    },
    grid: { left: 45, right: 16, top: 8, bottom: 24 },
    series: [
      {
        type: 'line',
        data: trendData.map(d => d.accuracy),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: chartColors.lineColor, width: 2 },
        itemStyle: { color: chartColors.lineColor },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: chartColors.areaStartColor },
              { offset: 1, color: chartColors.areaEndColor },
            ],
          },
        },
      },
    ],
  } : null, [trendData, chartColors])

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-card-wrap">
          <Card className="dashboard-card" style={{ animationDelay: '0s' }}>
            <Skeleton active paragraph={{ rows: 8 }} />
          </Card>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-card-wrap">
          <Card className="dashboard-card" style={{ animationDelay: '0s' }}>
            <Empty description="暂无数据" />
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-page">
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="dashboard-card-wrap stat-card-wrap">
            <Card className="stat-card dashboard-card" style={{ animationDelay: '0s' }}>
              <div className="stat-card-inner">
                <div className="stat-card-icon stat-card-icon-brand1"><EditOutlined /></div>
                <Statistic title="今日做题" value={stats.today_count} suffix="题" />
              </div>
            </Card>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="dashboard-card-wrap stat-card-wrap">
            <Card className="stat-card dashboard-card" style={{ animationDelay: '0.08s' }}>
              <div className="stat-card-inner">
                <div className="stat-card-icon stat-card-icon-brand2"><CheckCircleOutlined /></div>
                <Statistic
                  title="今日正确率"
                  value={stats.today_accuracy}
                  suffix="%"
                  valueStyle={{ color: stats.today_accuracy >= 60 ? 'var(--tech-accent-green)' : 'var(--tech-accent-pink)' }}
                />
              </div>
            </Card>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="dashboard-card-wrap stat-card-wrap">
            <Card className="stat-card dashboard-card" style={{ animationDelay: '0.16s' }}>
              <div className="stat-card-inner">
                <div className="stat-card-icon stat-card-icon-brand3"><BookOutlined /></div>
                <Statistic title="总做题数" value={stats.total_count} suffix="题" />
              </div>
            </Card>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="dashboard-card-wrap stat-card-wrap">
            <Card className="stat-card dashboard-card" style={{ animationDelay: '0.24s' }}>
              <div className="stat-card-inner">
                <div className="stat-card-icon stat-card-icon-brand4"><TrophyOutlined /></div>
                <Statistic
                  title="总正确率"
                  value={stats.total_accuracy}
                  suffix="%"
                  valueStyle={{ color: stats.total_accuracy >= 60 ? 'var(--tech-accent-green)' : 'var(--tech-accent-pink)' }}
                />
              </div>
            </Card>
          </div>
        </Col>
      </Row>

      {/* 使用配额 */}
      {quotas && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {Object.entries({ qa_ask: 'AI 问答', report_gen: '学习报告', upload_image: '图片上传', gen_similar: '相似题' }).map(([key, label], i) => {
            const q = quotas[key]
            if (!q) return null
            const pct = q.limit <= 0 ? 100 : Math.round((q.used / q.limit) * 100)
            return (
              <Col xs={12} sm={6} key={key}>
                <div className="dashboard-card-wrap stat-card-wrap">
                  <Card className="stat-card dashboard-card" style={{ animationDelay: `${0.32 + i * 0.08}s` }}>
                  <Statistic
  title={label}
  value={q.limit <= 0 ? '∞' : `${q.used}/${q.limit}`}
  suffix={q.limit <= 0 ? '无限制' : '次'}
  valueStyle={{ 
    fontSize: 20, 
    color: q.limit > 0 && pct >= 100 ? '#ec4899' : (q.limit <= 0 ? '#f59e0b' : 'var(--tech-primary)'),
    fontWeight: q.limit <= 0 ? 700 : 600,
    textShadow: q.limit <= 0 ? '0 0 10px rgba(245, 158, 11, 0.4)' : 'none',
  }}
/>
                    {q.limit > 0 && (
                      <Progress
                        percent={Math.min(pct, 100)}
                        size="small"
                        status={pct >= 100 ? 'exception' : 'active'}
                        style={{ marginTop: 4 }}
                      />
                    )}
                  </Card>
                </div>
              </Col>
            )
          })}
        </Row>
      )}

      {/* 打卡 + 今日目标 + 学习时长 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={14}>
          <div className="dashboard-card-wrap">
            <Card className="dashboard-card checkin-card" style={{ animationDelay: '0.32s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FireOutlined style={{ color: '#f59e0b' }} /> 打卡
                  </div>
                  <div className="checkin-streak">
                    连续 <span className="checkin-streak-num">{streak}</span> 天
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'end' }}>
                  {weekDays.map((d) => {
                    const dayOfWeek = new Date(d.date).getDay()
                    const weekLabel = ['日', '一', '二', '三', '四', '五', '六'][dayOfWeek]
                    return (
                      <div key={d.date} className="checkin-week-label">
                        <div className={`checkin-dot ${d.checked ? 'checkin-dot-checked' : 'checkin-dot-unchecked'}`}>
                          {d.checked ? '✓' : ''}
                        </div>
                        <div>{weekLabel}</div>
                      </div>
                    )
                  })}
                </div>
                <Button
                  type={checkedIn ? 'default' : 'primary'}
                  onClick={handleCheckin}
                  loading={checking}
                  disabled={checkedIn}
                  style={{ minWidth: 90 }}
                >
                  {checkedIn ? '已打卡' : '打卡'}
                </Button>
              </div>
            </Card>
          </div>
        </Col>
        <Col xs={12} lg={5}>
          <div className="dashboard-card-wrap">
            <Card className="dashboard-card" style={{ animationDelay: '0.38s' }}>
              <Statistic
                title={<span><ClockCircleOutlined style={{ marginRight: 4, color: 'var(--tech-secondary)' }} />今日学习时长</span>}
                value={Math.round((stats.today_count || 0) * 2)}
                suffix="分钟"
                valueStyle={{ color: 'var(--tech-secondary)' }}
              />
            </Card>
          </div>
        </Col>
        <Col xs={12} lg={5}>
          <div className="dashboard-card-wrap">
            <Card className="dashboard-card" style={{ animationDelay: '0.44s' }}>
              <div style={{ fontSize: 13, color: 'var(--tech-text-muted)', marginBottom: 4 }}>
                <FlagOutlined style={{ marginRight: 4 }} />今日目标
                <a style={{ marginLeft: 6, fontSize: 12 }} onClick={() => setEditingGoal(!editingGoal)}>
                  {editingGoal ? '取消' : '修改'}
                </a>
              </div>
              {editingGoal ? (
                <Space>
                  <InputNumber min={1} max={200} value={goalInput} onChange={(v) => setGoalInput(v || 10)} size="small" />
                  <Button size="small" type="primary" onClick={handleGoalUpdate}>确定</Button>
                </Space>
              ) : (
                <>
                  <div className="goal-progress-value">
                    {stats.today_count}/{dailyGoal}
                  </div>
                  <Progress
                    percent={Math.min(100, Math.round((stats.today_count || 0) / dailyGoal * 100))}
                    size="small"
                    showInfo={false}
                    strokeColor={stats.today_count >= dailyGoal ? 'var(--tech-accent-green)' : 'var(--tech-primary)'}
                  />
                </>
              )}
            </Card>
          </div>
        </Col>
      </Row>

      {/* AI 问答 */}
      <div className="dashboard-card-wrap">
        <Card title={<span style={{ color: 'var(--tech-text-primary)' }}>AI 问答 {quotas?.qa_ask && quotas.qa_ask.limit > 0 ? <span style={{ fontSize: 12, color: 'var(--tech-text-muted)', fontWeight: 400 }}>（剩余 {Math.max(0, quotas.qa_ask.limit - quotas.qa_ask.used)} 次）</span> : <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 400 }}>（无限制）</span>}</span>} className="ai-card dashboard-card" style={{ marginBottom: 16, animationDelay: '0.50s' }}>
          {answer && (
            <div ref={answerRef} className="ai-answer-box">
              {renderLatex(answer)}
            </div>
          )}
          <Space.Compact style={{ width: '100%' }}>
            <TextArea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入数学问题，按 Enter 发送，Shift+Enter 换行"
              rows={2}
              disabled={answering}
              style={{ resize: 'none' }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              loading={answering}
              onClick={handleAsk}
              style={{ height: 52 }}
            >
              发送
            </Button>
          </Space.Compact>
        </Card>
      </div>

      {/* 学习动态 */}
      <div className="dashboard-card-wrap">
        <Card title="学习动态" className="dashboard-card" style={{ marginBottom: 16, animationDelay: '0.56s' }}>
          {timeline.length > 0 ? (
            <div className="timeline-container">
              {timeline.map((evt, i) => {
                let dotClass = 'timeline-dot-wrong'
                if (evt.type === 'checkin') dotClass = 'timeline-dot-checkin'
                else if (evt.label.includes('✓')) dotClass = 'timeline-dot-correct'
                return (
                  <div key={i} className="timeline-item">
                    <div className={`timeline-dot ${dotClass}`}>
                      {evt.type === 'checkin' ? '✓' : (evt.label.includes('✓') ? '✓' : '✗')}
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-detail">{evt.detail}</div>
                      <div className="timeline-time">{evt.time}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <Empty description="暂无学习动态" />
          )}
        </Card>
      </div>

      {/* 学习趋势图 */}
      {trendData && trendData.some(d => d.total > 0) && trendOption && (
        <div className="dashboard-card-wrap">
          <Card title="近 14 天正确率趋势" className="dashboard-card" style={{ marginBottom: 16, animationDelay: '0.62s' }}>
            <ReactEChartsCore
              option={trendOption}
              style={{ height: 200 }}
            />
          </Card>
        </div>
      )}

      {/* 雷达图 + 最近错题 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <div className="dashboard-card-wrap">
            <Card title="知识点掌握度" className="dashboard-card" style={{ animationDelay: '0.68s' }}>
              {stats.mastery.length > 0 ? (
                <ReactEChartsCore option={radarOption} style={{ height: 350 }} />
              ) : (
                <div className="empty-state-cta" style={{ height: 350 }}>
                  <Empty description="暂无做题记录" />
                  <Button type="primary" shape="round" onClick={() => navigate('/practice')}>去刷题</Button>
                </div>
              )}
            </Card>
          </div>
        </Col>
        <Col xs={24} lg={10}>
          <div className="dashboard-card-wrap">
            <Card title="最近错题" className="dashboard-card" style={{ animationDelay: '0.74s' }}>
              {stats.recent_wrong.length > 0 ? (
                <List
                  dataSource={stats.recent_wrong}
                  renderItem={(item) => (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/result/${item.record_id}`)}
                    >
                      <List.Item.Meta
                        title={<span>{item.knowledge_point}</span>}
                        description={
                          <span style={{ fontSize: 13 }}>{renderLatex(item.content)}</span>
                        }
                      />
                      <div style={{ fontSize: 12, color: 'var(--tech-text-muted)' }}>{item.created_at}</div>
                    </List.Item>
                  )}
                />
              ) : (
                <div className="empty-state-cta">
                  <Empty description="暂无错题，继续保持！" />
                  <Button type="primary" shape="round" onClick={() => navigate('/practice')}>去刷题</Button>
                </div>
              )}
            </Card>
          </div>
        </Col>
      </Row>

    </div>
  )
}
