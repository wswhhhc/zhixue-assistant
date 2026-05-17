import { useEffect, useState, useMemo } from 'react'
import {
  Table, Input, Tag, Button, Modal, Radio, InputNumber, Space, message, Typography, Tooltip,
  Drawer, Descriptions, Empty, Row, Col,
} from 'antd'
import { SearchOutlined, EditOutlined, FileTextOutlined, BarChartOutlined } from '@ant-design/icons'
import ReactEChartsCore from 'echarts-for-react'
import { useChartTheme } from '../../hooks/useChartTheme'
import { adminFetch } from '../../adminAuth'

interface UserItem {
  id: number
  username: string
  email: string
  role: string
  membership: string
  member_expires: string | null
}

interface PageRes {
  items: UserItem[]
  total: number
  page: number
  page_size: number
}

interface UserQuestion {
  id: number
  content: string
  question_type: string
  knowledge_point: string
  source: string
  created_at: string
}

interface UserStats {
  username: string
  email: string
  membership: string
  total_answers: number
  correct_count: number
  correct_rate: number
  kp_mastery: { knowledge_point: string; total: number; correct: number; rate: number }[]
  most_wrong: { question_id: number; content: string; knowledge_point: string; wrong_count: number }[]
  error_distribution: { type: string; label: string; count: number }[]
  recent_records: { id: number; question_id: number; user_answer: string; is_correct: boolean; error_type: string; created_at: string }[]
}

const ERROR_TYPE_COLORS: Record<string, string> = {
  concept_misunderstanding: '#ef4444',
  calculation_error: '#f97316',
  careless_mistake: '#eab308',
  wrong_direction: '#a855f7',
  knowledge_gap: '#3b82f6',
  unknown: '#94a3b8',
}

export default function AdminUsers() {
  const [data, setData] = useState<PageRes | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserItem | null>(null)
  const [editMembership, setEditMembership] = useState('free')
  const [editDays, setEditDays] = useState(30)

  // 用户上传题弹窗
  const [questionsOpen, setQuestionsOpen] = useState(false)
  const [questionsUser, setQuestionsUser] = useState<UserItem | null>(null)
  const [userQuestions, setUserQuestions] = useState<UserQuestion[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)

  // 学习详情抽屉
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailUser, setDetailUser] = useState<UserItem | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const chartColors = useChartTheme()

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), page_size: '20' })
    if (search) params.set('search', search)
    adminFetch('/admin/users?' + params.toString())
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [page])

  const handleSearch = () => {
    setPage(1)
    fetchData()
  }

  const openEdit = (user: UserItem) => {
    setEditUser(user)
    setEditMembership(user.membership)
    setEditDays(30)
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editUser) return
    const res = await adminFetch(`/admin/users/${editUser.id}`, {
      method: 'PUT',
      body: JSON.stringify({ membership: editMembership, duration_days: editDays }),
    })
    if (!res.ok) {
      const d = await res.json()
      message.error(d.detail || '保存失败')
      return
    }
    message.success('用户已更新')
    setEditOpen(false)
    fetchData()
  }

  const openUserQuestions = async (user: UserItem) => {
    setQuestionsUser(user)
    setQuestionsOpen(true)
    setQuestionsLoading(true)
    try {
      const res = await adminFetch(`/admin/questions?source=user&user_id=${user.id}&page_size=100`)
      const d = await res.json()
      setUserQuestions(d.items || [])
    } catch {
      message.error('加载失败')
      setUserQuestions([])
    } finally {
      setQuestionsLoading(false)
    }
  }

  const openUserDetail = async (user: UserItem) => {
    setDetailUser(user)
    setDetailOpen(true)
    setDetailLoading(true)
    setUserStats(null)
    try {
      const res = await adminFetch(`/admin/users/${user.id}/stats`)
      const d = await res.json()
      setUserStats(d)
    } catch {
      message.error('加载失败')
    } finally {
      setDetailLoading(false)
    }
  }

  const radarOption = useMemo(() => {
    if (!userStats || userStats.kp_mastery.length === 0) return null
    const items = userStats.kp_mastery
    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: chartColors.tooltipBg,
        borderColor: chartColors.tooltipBorder,
        textStyle: { color: chartColors.textColor },
      },
      radar: {
        indicator: items.map((k) => ({ name: k.knowledge_point, max: 100 })),
        splitArea: {
          areaStyle: { color: [chartColors.splitLineColor, 'transparent'] },
        },
        axisLine: { lineStyle: { color: chartColors.axisLineColor } },
        axisName: { color: chartColors.textColor, fontSize: 11 },
        splitLine: { lineStyle: { color: chartColors.splitLineColor } },
      },
      series: [{
        type: 'radar',
        data: [{
          value: items.map((k) => k.rate),
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 1,
              colorStops: [
                { offset: 0, color: chartColors.radarFillStart },
                { offset: 1, color: chartColors.radarFillEnd },
              ],
            },
          },
          lineStyle: { color: chartColors.lineColor, width: 2 },
          itemStyle: { color: chartColors.lineColor },
        }],
      }],
    }
  }, [userStats, chartColors])

  const errorOption = useMemo(() => {
    if (!userStats || userStats.error_distribution.length === 0) return null
    const items = userStats.error_distribution
    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        backgroundColor: chartColors.tooltipBg,
        borderColor: chartColors.tooltipBorder,
        textStyle: { color: chartColors.textColor },
        formatter: (params: { name: string; value: number; percent: number }) =>
          `${params.name}: ${params.value} 次 (${params.percent}%)`,
      },
      series: [{
        type: 'pie',
        radius: ['36%', '62%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: chartColors.backgroundColor, borderWidth: 2 },
        label: { color: chartColors.textColor, fontSize: 11, formatter: '{b}' },
        labelLine: { lineStyle: { color: chartColors.axisLineColor } },
        data: items.map((e) => ({
          name: e.label,
          value: e.count,
          itemStyle: { color: ERROR_TYPE_COLORS[e.type] || '#94a3b8' },
        })),
      }],
    }
  }, [userStats, chartColors])

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色', dataIndex: 'role', key: 'role', width: 80,
      render: (r: string) => <Tag color={r === 'admin' ? 'red' : 'blue'}>{r}</Tag>,
    },
    {
      title: '会员', dataIndex: 'membership', key: 'membership', width: 90,
      render: (m: string) => (
        <Tag color={m === 'premium' ? 'gold' : 'default'}>{m === 'premium' ? '会员' : '免费'}</Tag>
      ),
    },
    {
      title: '到期时间', dataIndex: 'member_expires', key: 'member_expires',
      render: (t: string | null) => t ? new Date(t).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '操作', key: 'action', width: 140,
      render: (_: unknown, record: UserItem) => (
        <div className="table-actions">
          <Tooltip title="学习详情" placement="top" overlayClassName="admin-tooltip">
            <Button
              size="small"
              icon={<BarChartOutlined />}
              onClick={() => openUserDetail(record)}
            />
          </Tooltip>
          <Tooltip title="查看上传题目" placement="top" overlayClassName="admin-tooltip">
            <Button
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => openUserQuestions(record)}
            />
          </Tooltip>
          <Tooltip title="编辑用户" placement="top" overlayClassName="admin-tooltip">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
        </div>
      ),
    },
  ]

  const questionColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '题型', dataIndex: 'question_type', key: 'question_type', width: 80 },
    { title: '知识点', dataIndex: 'knowledge_point', key: 'knowledge_point', width: 120 },
  ]

  const recentColumns = [
    { title: '题目ID', dataIndex: 'question_id', key: 'question_id', width: 70 },
    {
      title: '结果', dataIndex: 'is_correct', key: 'is_correct', width: 60,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'red'}>{v ? '正确' : '错误'}</Tag>
      ),
    },
    { title: '用户答案', dataIndex: 'user_answer', key: 'user_answer', width: 100, ellipsis: true },
    {
      title: '错因', dataIndex: 'error_type', key: 'error_type', width: 100,
      render: (t: string) => t && t !== 'correct' ? <Tag>{t}</Tag> : '-',
    },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 100 },
  ]

  return (
    <div>
      <h2 className="admin-page-title">
        用户管理
      </h2>

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索用户名或邮箱"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={handleSearch}
          style={{ width: 300 }}
        />
        <Button type="primary" onClick={handleSearch}>
          搜索
        </Button>
      </Space>

      <Table
        dataSource={data?.items}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total || 0,
          onChange: setPage,
        }}
      />

      <Modal
        title="编辑用户"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        {editUser && (
          <div>
            <p>用户名：{editUser.username}</p>
            <p style={{ marginBottom: 16 }}>邮箱：{editUser.email}</p>
            <div style={{ marginBottom: 16 }}>
              <span style={{ display: 'block', marginBottom: 8 }}>会员类型</span>
              <Radio.Group
                value={editMembership}
                onChange={(e) => setEditMembership(e.target.value)}
              >
                <Radio value="free">免费</Radio>
                <Radio value="premium">会员</Radio>
              </Radio.Group>
            </div>
            {editMembership === 'premium' && (
              <div>
                <span style={{ display: 'block', marginBottom: 8 }}>到期天数</span>
                <InputNumber
                  value={editDays}
                  onChange={(v) => setEditDays(v || 30)}
                  min={1}
                  max={3650}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 用户上传题弹窗 */}
      <Modal
        title={`${questionsUser?.username || ''} 上传的题目`}
        open={questionsOpen}
        onCancel={() => setQuestionsOpen(false)}
        footer={null}
        width={720}
        destroyOnClose
      >
        {questionsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>加载中...</div>
        ) : userQuestions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(148,163,184,0.6)' }}>
            该用户暂无上传题目
          </div>
        ) : (
          <div>
            <Typography.Text style={{ display: 'block', marginBottom: 12 }}>
              共 {userQuestions.length} 题
            </Typography.Text>
            <Table
              dataSource={userQuestions}
              columns={questionColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </div>
        )}
      </Modal>

      {/* 学习详情抽屉 */}
      <Drawer
        title={detailUser ? `${detailUser.username} 的学习详情` : '学习详情'}
        placement="right"
        width={640}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        styles={{ body: { padding: 24 } }}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>加载中...</div>
        ) : userStats ? (
          <>
            {/* 基本信息 */}
            <Descriptions column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="用户名">{userStats.username}</Descriptions.Item>
              <Descriptions.Item label="会员">
                <Tag color={userStats.membership === 'premium' ? 'gold' : 'default'}>
                  {userStats.membership === 'premium' ? '会员' : '免费'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="总答题数">{userStats.total_answers}</Descriptions.Item>
              <Descriptions.Item label="正确数">{userStats.correct_count}</Descriptions.Item>
              <Descriptions.Item label="正确率">
                <Typography.Text style={{ color: userStats.correct_rate >= 60 ? '#22c55e' : '#ef4444', fontSize: 18, fontWeight: 700 }}>
                  {userStats.correct_rate}%
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>

            {/* 知识点雷达图 */}
            {radarOption && (
              <div style={{ marginBottom: 24 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>知识点掌握度</Typography.Text>
                <div style={{ background: 'var(--tech-bg-secondary)', borderRadius: 8, padding: 8 }}>
                  <ReactEChartsCore option={radarOption} style={{ height: 260 }} />
                </div>
              </div>
            )}

            {/* 错误类型分布 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>错误类型分布</Typography.Text>
                {errorOption ? (
                  <div style={{ background: 'var(--tech-bg-secondary)', borderRadius: 8, padding: 8 }}>
                    <ReactEChartsCore option={errorOption} style={{ height: 200 }} />
                  </div>
                ) : (
                  <Typography.Text type="secondary">暂无错误记录</Typography.Text>
                )}
              </Col>
            </Row>

            {/* 高频错题 */}
            {userStats.most_wrong.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>高频错题 TOP 10</Typography.Text>
                {userStats.most_wrong.map((item) => (
                  <div
                    key={item.question_id}
                    style={{
                      padding: '8px 12px', marginBottom: 6,
                      background: 'var(--tech-bg-secondary)', borderRadius: 6,
                      borderLeft: '3px solid #ef4444',
                    }}
                  >
                    <Typography.Text style={{ fontSize: 13 }}>{item.content}</Typography.Text>
                    <div style={{ marginTop: 4, display: 'flex', gap: 12 }}>
                      <Tag>{item.knowledge_point}</Tag>
                      <Typography.Text type="danger" style={{ fontSize: 12 }}>
                        错了 {item.wrong_count} 次
                      </Typography.Text>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 最近做题记录 */}
            <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>最近做题记录</Typography.Text>
            {userStats.recent_records.length > 0 ? (
              <Table
                dataSource={userStats.recent_records}
                columns={recentColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Typography.Text type="secondary">暂无记录</Typography.Text>
            )}
          </>
        ) : (
          <Empty description="加载失败" />
        )}
      </Drawer>
    </div>
  )
}
