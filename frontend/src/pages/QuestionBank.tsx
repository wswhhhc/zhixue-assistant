import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Table, Tag, Select, message, Typography,
  Button, Modal, Form, Input, Tooltip, Empty, Radio, Divider,
} from 'antd'
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { API_BASE } from '../config'
import { authFetch } from '../auth'
import '../components/ActionButtons.css'
import './QuestionBank.css'
import { renderLatex } from '../utils/renderLatex'

const { Title, Paragraph } = Typography
const { TextArea } = Input

interface QuestionItem {
  id: number
  question_type: string
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

  // answer detail modal
  const [answerModalOpen, setAnswerModalOpen] = useState(false)
  const [answerDetail, setAnswerDetail] = useState<QuestionItem & { explanation?: string } | null>(null)
  const [answerLoading, setAnswerLoading] = useState(false)

  const showAnswer = async (record: QuestionItem) => {
    setAnswerLoading(true)
    setAnswerModalOpen(true)
    try {
      const res = await authFetch(`${API_BASE}/questions/${record.id}`)
      const data = await res.json()
      setAnswerDetail({ ...record, explanation: data.explanation || '' })
    } catch {
      setAnswerDetail({ ...record, explanation: '' })
    }
    setAnswerLoading(false)
  }

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

  const [editQuestionType, setEditQuestionType] = useState('choice')

  const handleEdit = async (record: QuestionItem) => {
    setEditingId(record.id)
    const qtype = record.question_type || 'choice'
    setEditQuestionType(qtype)
    // 获取题目详情（含解析）
    let explanation = ''
    try {
      const res = await authFetch(`${API_BASE}/questions/${record.id}`)
      const data = await res.json()
      explanation = data.explanation || ''
    } catch { /* ignore */ }
    editForm.setFieldsValue({
      question_type: qtype,
      content: record.content,
      optionA: record.options?.[0] || '',
      optionB: record.options?.[1] || '',
      optionC: record.options?.[2] || '',
      optionD: record.options?.[3] || '',
      answer: record.answer,
      knowledge_point: record.knowledge_point,
      explanation,
    })
    setEditOpen(true)
  }

  const handleEditSave = async () => {
    try {
      const values = await editForm.validateFields()
      setConfirmLoading(true)

      const qtype = values.question_type || 'choice'
      const body = {
        question_type: qtype,
        content: values.content,
        options: qtype === 'fill' || qtype === 'judge' || qtype === 'subjective' ? [] : [values.optionA, values.optionB, values.optionC, values.optionD],
        answer: values.answer,
        knowledge_point: values.knowledge_point,
        explanation: values.explanation || '',
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
      title: '题型',
      dataIndex: 'question_type',
      key: 'question_type',
      width: 70,
      render: (val: string) => (
        <Tag color={val === 'fill' ? 'orange' : val === 'judge' ? 'purple' : val === 'subjective' ? 'cyan' : 'blue'}>
          {val === 'fill' ? '填空' : val === 'judge' ? '判断' : val === 'subjective' ? '主观' : '选择'}
        </Tag>
      ),
    },
    {
      title: '题目',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (val: string) => renderLatex(val),
    },
    {
      title: '答案',
      dataIndex: 'answer',
      key: 'answer',
      width: 100,
      render: (val: string, record: QuestionItem) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => { e.stopPropagation(); showAnswer(record) }}
        >
          查看答案
        </Button>
      ),
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
          locale={{ emptyText: <Empty description="暂无题目"><Button type="link" onClick={() => navigate('/upload')}>去上传题目</Button></Empty> }}
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
          <Form.Item name="question_type" label="题型">
            <Radio.Group onChange={(e) => {
              setEditQuestionType(e.target.value)
              editForm.setFieldValue('answer', '')
              editForm.setFieldValue('explanation', '')
            }}>
              <Radio value="choice">选择题</Radio>
              <Radio value="fill">填空题</Radio>
              <Radio value="judge">判断题</Radio>
              <Radio value="subjective">主观题</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="content" label="题目内容" rules={[{ required: true, message: '请输入题目' }]}>
            <TextArea rows={3} placeholder="支持 LaTeX 公式，用 $...$ 包裹；填空题用 ___ 表示填空位置" />
          </Form.Item>
          {editQuestionType === 'choice' && (
            <>
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
            </>
          )}
          {editQuestionType === 'judge' && (
            <Form.Item name="answer" label="答案" rules={[{ required: true, message: '请选择答案' }]}>
              <Radio.Group>
                <Radio value="对">对</Radio>
                <Radio value="错">错</Radio>
              </Radio.Group>
            </Form.Item>
          )}
          {editQuestionType === 'fill' && (
            <Form.Item name="answer" label="答案" rules={[{ required: true, message: '请输入答案' }]}>
              <Input placeholder="输入正确答案" />
            </Form.Item>
          )}
          {editQuestionType === 'subjective' && (
            <>
              <Form.Item name="answer" label="最终答案" rules={[{ required: true, message: '请输入最终答案' }]}>
                <Input placeholder="输入最终答案" />
              </Form.Item>
              <Form.Item name="explanation" label="解题步骤">
                <TextArea rows={10} placeholder="输入完整的解题步骤，支持 LaTeX 公式" />
              </Form.Item>
            </>
          )}
          <Form.Item name="knowledge_point" label="知识点">
            <Input placeholder="如：极限与连续" />
          </Form.Item>
          <Form.Item name="explanation" label="题目解析">
            <TextArea rows={3} placeholder="输入解析内容，支持 LaTeX 公式" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 答案详情弹窗 */}
      <Modal
        title="查看答案"
        open={answerModalOpen}
        onCancel={() => setAnswerModalOpen(false)}
        footer={<Button onClick={() => setAnswerModalOpen(false)}>关闭</Button>}
        width={720}
      >
        {answerLoading ? (
          <div style={{ textAlign: 'center', padding: 24 }}>加载中...</div>
        ) : answerDetail ? (
          <>
            <Paragraph><strong>题目：</strong></Paragraph>
            <Paragraph>{renderLatex(answerDetail.content)}</Paragraph>
            <Divider />

            {answerDetail.question_type === 'fill' || answerDetail.question_type === 'judge' || answerDetail.question_type === 'subjective' ? (
              <>
                <Paragraph>
                  <strong>正确答案：</strong>
                  <span style={{ color: '#52c41a', fontSize: 16 }}>{renderLatex(answerDetail.answer)}</span>
                </Paragraph>
                {answerDetail.question_type === 'subjective' && answerDetail.explanation && (
                  <>
                    <Divider />
                    <Paragraph><strong>解题步骤：</strong></Paragraph>
                    <div style={{ background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(0, 212, 255, 0.2)', padding: 12, borderRadius: 8, maxHeight: 360, overflow: 'auto', color: '#e2e8f0' }}>
                      {renderLatex(answerDetail.explanation)}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <Paragraph><strong>选项：</strong></Paragraph>
                {answerDetail.options.map((opt, i) => {
                  const label = OPTION_LABELS[i]
                  const isCorrect = answerDetail.answer === label
                  return (
                    <Paragraph
                      key={label}
                      style={{
                        color: isCorrect ? '#52c41a' : undefined,
                        fontWeight: isCorrect ? 'bold' : undefined,
                      }}
                    >
                      {label}. {renderLatex(opt)}
                      {isCorrect && <Tag color="green" style={{ marginLeft: 8 }}>正确答案</Tag>}
                    </Paragraph>
                  )
                })}
              </>
            )}
            <Divider />

            {answerDetail.explanation ? (
              <>
                <Paragraph><strong>题目解析：</strong></Paragraph>
                <div style={{ background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: 12, borderRadius: 8, maxHeight: 360, overflow: 'auto', color: '#e2e8f0' }}>
                  {renderLatex(answerDetail.explanation)}
                </div>
              </>
            ) : (
              <Paragraph type="secondary">暂无解析</Paragraph>
            )}
          </>
        ) : null}
      </Modal>
    </div>
  )
}
