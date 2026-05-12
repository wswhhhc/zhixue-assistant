import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Tag, Select, message, Typography,
  Button, Modal, Form, Input, Tooltip,
} from 'antd'
import { EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { API_BASE } from '../config'
import { authFetch } from '../auth'
import '../components/ActionButtons.css'
import './QuestionBank.css'

const { Title } = Typography
const { TextArea } = Input

interface QuestionItem {
  id: number
  content: string
  options: string[]
  answer: string
  knowledge_point: string
  source: string
  created_at: string
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']

export default function QuestionBank() {
  const navigate = useNavigate()
  const [data, setData] = useState<QuestionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>([])
  const [kpFilter, setKpFilter] = useState<string | undefined>(undefined)

  // edit state
  const [editOpen, setEditOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [editForm] = Form.useForm()

  const fetchList = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), page_size: '20' })
    if (kpFilter) params.set('knowledge_point', kpFilter)

    authFetch(`${API_BASE}/questions?${params}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json.items || [])
        setTotal(json.total || 0)
        setLoading(false)
      })
      .catch(() => {
        message.error('获取题库失败')
        setLoading(false)
      })
  }

  useEffect(() => {
    authFetch(`${API_BASE}/questions/knowledge-points`)
      .then((res) => res.json())
      .then(setKnowledgePoints)
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchList()
  }, [page, kpFilter])

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这道题吗？删除后无法恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await authFetch(`${API_BASE}/questions/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error()
          message.success('已删除')
          fetchList()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  const handleEdit = async (record: QuestionItem) => {
    setEditingId(record.id)
    editForm.setFieldsValue({
      content: record.content,
      optionA: record.options?.[0] || '',
      optionB: record.options?.[1] || '',
      optionC: record.options?.[2] || '',
      optionD: record.options?.[3] || '',
      answer: record.answer,
      knowledge_point: record.knowledge_point,
    })
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    try {
      const values = await editForm.validateFields()
      setConfirmLoading(true)

      const body = {
        content: values.content,
        options: [values.optionA, values.optionB, values.optionC, values.optionD],
        answer: values.answer,
        knowledge_point: values.knowledge_point,
      }

      const res = await authFetch(`${API_BASE}/questions/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error()
      message.success('修改成功')
      setEditOpen(false)
      fetchList()
    } catch {
      message.error('修改失败')
    } finally {
      setConfirmLoading(false)
    }
  }

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '题目',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '答案',
      dataIndex: 'answer',
      key: 'answer',
      width: 70,
      render: (val: string) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: '知识点',
      dataIndex: 'knowledge_point',
      key: 'knowledge_point',
      width: 140,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 80,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: QuestionItem) => (
        <div className="action-buttons" onClick={(e) => e.stopPropagation()}>
          <Tooltip title="编辑">
            <Button
              className="action-btn action-btn-edit"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              className="action-btn action-btn-delete"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
        </div>
      ),
    },
  ]

  return (
    <div className="qb-page">
      <Card className="qb-card">
        <div className="qb-title-bar">
          <Title level={4} className="qb-title">题库</Title>
          <Select
            allowClear
            placeholder="按知识点筛选"
            className="qb-filter"
            value={kpFilter}
            onChange={(val) => { setKpFilter(val); setPage(1) }}
            options={knowledgePoints.map((kp) => ({ value: kp, label: kp }))}
          />
        </div>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 题`,
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/practice?question_id=${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      <Modal
        title="编辑题目"
        open={editOpen}
        onOk={handleEditSave}
        onCancel={() => setEditOpen(false)}
        confirmLoading={confirmLoading}
        okText="保存"
        cancelText="取消"
        width={640}
      >
        <Form form={editForm} layout="vertical" className="qb-edit-form">
          <Form.Item name="content" label="题目内容" rules={[{ required: true, message: '请输入题目' }]}>
            <TextArea rows={3} placeholder="支持 LaTeX 公式，用 $...$ 包裹" />
          </Form.Item>
          {OPTION_LABELS.map((label) => (
            <Form.Item
              key={label}
              name={`option${label}`}
              label={`选项 ${label}`}
              rules={[{ required: true, message: `请输入选项 ${label}` }]}
            >
              <Input placeholder={`选项 ${label} 的内容`} />
            </Form.Item>
          ))}
          <Form.Item name="answer" label="答案" rules={[{ required: true, message: '请选择答案' }]}>
            <Select
              options={OPTION_LABELS.map((l) => ({ value: l, label: l }))}
              placeholder="选择正确答案"
              className="qb-answer-select"
            />
          </Form.Item>
          <Form.Item name="knowledge_point" label="知识点">
            <Input placeholder="如：极限与连续" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
