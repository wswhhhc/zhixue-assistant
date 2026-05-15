import { useEffect, useState } from 'react'
import {
  Table, Input, Tag, Button, Modal, Radio, InputNumber, Space, message, Typography, Tooltip,
} from 'antd'
import { SearchOutlined, EditOutlined, FileTextOutlined } from '@ant-design/icons'
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
      title: '操作', key: 'action', width: 100,
      render: (_: unknown, record: UserItem) => (
        <div className="table-actions">
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

  return (
    <div>
      <h2 style={{
        marginBottom: 24,
        fontSize: 24,
        fontWeight: 700,
        color: '#e2e8f0',
        fontFamily: "'Space Grotesk', 'Noto Sans SC', sans-serif",
        letterSpacing: '0.5px',
      }}>
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
    </div>
  )
}
