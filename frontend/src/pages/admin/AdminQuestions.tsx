import { useEffect, useState } from 'react'
import {
  Table, Select, Input, Button, Tag, Modal, Form, Space, message, Popconfirm, Radio, Tooltip,
} from 'antd'
import AntUpload from 'antd/es/upload'
import { SearchOutlined, EditOutlined, DeleteOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons'
import { adminFetch } from '../../adminAuth'

const KNOWLEDGE_POINTS = [
  '极限与连续', '导数与微分', '不定积分与定积分',
  '微分中值定理', '多元函数', '级数',
]

const SOURCES = [
  { label: '系统', value: 'system' },
]

interface QuestionItem {
  id: number
  content: string
  question_type: string
  knowledge_point: string
  source: string
  user_id: number | null
  created_at: string
}

interface PageRes {
  items: QuestionItem[]
  total: number
  page: number
  page_size: number
}

const latexToText = (s: string) =>
  s
    .replace(/\$\$([^$]+)\$\$/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\lim/g, 'lim')
    .replace(/\\int/g, '∫')
    .replace(/\\sum/g, '∑')
    .replace(/\\to\b/g, '→')
    .replace(/\\rightarrow\b/g, '→')
    .replace(/\\infty\b/g, '∞')
    .replace(/\\cdot\b/g, '·')
    .replace(/\\times\b/g, '×')
    .replace(/\\left\b/g, '')
    .replace(/\\right\b/g, '')
    .replace(/\\([a-zA-Z]+)/g, '')
    .replace(/[{}]/g, '')
    .trim()

export default function AdminQuestions() {
  const [data, setData] = useState<PageRes | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [source, setSource] = useState('system')
  const [kp, setKp] = useState('')
  const [search, setSearch] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<QuestionItem | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [editKp, setEditKp] = useState('')
  const [editExplanation, setEditExplanation] = useState('')

  // 上传题目弹窗
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadStreamText, setUploadStreamText] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uType, setUType] = useState('choice')
  const [uContent, setUContent] = useState('')
  const [uOptions, setUOptions] = useState(['', '', '', ''])
  const [uAnswer, setUAnswer] = useState('')
  const [uKnowledgePoint, setUKnowledgePoint] = useState('')
  const [uExplanation, setUExplanation] = useState('')
  const [uConfirming, setUConfirming] = useState(false)

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), page_size: '20' })
    if (source) params.set('source', source)
    if (kp) params.set('knowledge_point', kp)
    if (search) params.set('search', search)
    adminFetch('/admin/questions?' + params.toString())
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [page, source, kp])

  const sourceColor: Record<string, string> = {
    system: 'blue', user: 'green', ai_generated: 'orange',
  }
  const sourceLabel: Record<string, string> = {
    system: '系统', user: '用户', ai_generated: 'AI',
  }

  const openEdit = (item: QuestionItem) => {
    setEditItem(item)
    setEditContent(item.content)
    setEditAnswer('')
    setEditKp(item.knowledge_point)
    setEditExplanation('')
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editItem) return
    const body: Record<string, unknown> = { content: editContent, knowledge_point: editKp }
    if (editAnswer) body.answer = editAnswer
    if (editExplanation) body.explanation = editExplanation

    const res = await adminFetch(`/admin/questions/${editItem.id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = await res.json()
      message.error(d.detail || '保存失败')
      return
    }
    message.success('题目已更新')
    setEditOpen(false)
    fetchData()
  }

  const handleDelete = async (id: number) => {
    const res = await adminFetch(`/admin/questions/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      message.error(d.detail || '删除失败')
      return
    }
    message.success('题目已删除')
    fetchData()
  }

  const resetUpload = () => {
    setUploadStreamText('')
    setUploadError('')
    setUType('choice')
    setUContent('')
    setUOptions(['', '', '', ''])
    setUAnswer('')
    setUKnowledgePoint('')
    setUExplanation('')
  }

  const handleUploadImage = async (file: File) => {
    setUploadLoading(true)
    setUploadError('')
    setUploadStreamText('')
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await adminFetch('/upload/image-stream', { method: 'POST', body: formData })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        message.error(errData.detail || errData.error || '上传失败')
        setUploadLoading(false)
        return false
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'token') {
              setUploadStreamText((prev) => prev + data.content)
            } else if (data.type === 'done') {
              const d = data.data
              setUType(d.question_type || 'choice')
              setUContent(d.content || '')
              setUOptions(d.options?.length === 4 ? d.options : ['', '', '', ''])
              setUAnswer(d.answer || '')
              setUKnowledgePoint(d.knowledge_point || '')
              setUExplanation(d.explanation || '')
              setUploadStreamText('')
              setUploadLoading(false)
            } else if (data.type === 'error') {
              setUploadError(data.message || '识别失败')
              setUploadStreamText('')
              setUploadLoading(false)
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setUploadError('上传失败，请稍后重试')
      setUploadStreamText('')
    }
    setUploadLoading(false)
    return false
  }

  const handleUploadConfirm = async () => {
    if (!uContent.trim()) { message.error('请输入题目内容'); return }
    if (uType === 'choice' && uOptions.some((o) => !o.trim())) { message.error('请填写所有选项'); return }
    if (!uAnswer.trim() && uType !== 'choice') { message.error('请填写答案'); return }
    if (uType === 'choice' && !uAnswer) { message.error('请选择正确答案'); return }
    setUConfirming(true)
    try {
      const res = await adminFetch('/upload/confirm', {
        method: 'POST',
        body: JSON.stringify({
          content: uContent,
          options: uOptions,
          answer: uAnswer,
          knowledge_point: uKnowledgePoint,
          question_type: uType,
          explanation: uExplanation,
        }),
      })
      const d = await res.json()
      if (d.question_id) {
        message.success('题目已入库')
        setUploadOpen(false)
        fetchData()
      } else {
        message.error(d.message || '入库失败')
      }
    } catch {
      message.error('入库失败')
    }
    setUConfirming(false)
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: '内容', dataIndex: 'content', key: 'content', ellipsis: true,
      render: (t: string) => latexToText(t),
    },
    {
      title: '题型', dataIndex: 'question_type', key: 'question_type', width: 80,
      render: (t: string) => ({ choice: '选择题', fill: '填空题', judge: '判断题', subjective: '主观题' })[t] || t,
    },
    { title: '知识点', dataIndex: 'knowledge_point', key: 'knowledge_point', width: 120 },
    {
      title: '来源', dataIndex: 'source', key: 'source', width: 80,
      render: (s: string) => <Tag color={sourceColor[s] || 'default'}>{sourceLabel[s] || s}</Tag>,
    },
    {
      title: '操作', key: 'action', width: 120,
      render: (_: unknown, record: QuestionItem) => (
        <div className="table-actions">
          <Tooltip title="编辑题目" placement="top" overlayClassName="admin-tooltip">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此题？"
            description="删除后关联的答题记录也会一并清除"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除题目" placement="top" overlayClassName="admin-tooltip">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{
        marginBottom: 24,
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--tech-text-primary)',
        fontFamily: "'Space Grotesk', 'Noto Sans SC', sans-serif",
        letterSpacing: '0.5px',
      }}>
        题库管理
      </h2>

      <div style={{ marginBottom: 24 }}>
        <Space wrap style={{ marginBottom: 12 }}>
          <Select
            value={source}
            onChange={(v) => { setSource(v); setPage(1) }}
            options={SOURCES}
            style={{ width: 130 }}
          />
          <Select
            value={kp}
            onChange={(v) => { setKp(v); setPage(1) }}
            options={[{ label: '全部知识点', value: '' }, ...KNOWLEDGE_POINTS.map((p) => ({ label: p, value: p }))]}
            style={{ width: 150 }}
          />
          <Input
            placeholder="搜索题目内容"
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={() => { setPage(1); fetchData() }}
            style={{ width: 280 }}
          />
          <Button type="primary" onClick={() => { setPage(1); fetchData() }}>
            搜索
          </Button>
        </Space>

        <Button
          type="primary"
          icon={<UploadOutlined />}
          onClick={() => { resetUpload(); setUploadOpen(true) }}
          style={{ marginLeft: 16 }}
        >
          上传题目
        </Button>
      </div>

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
        title="编辑题目"
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item label="题目内容">
            <Input.TextArea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
            />
          </Form.Item>
          <Form.Item label="答案">
            <Input
              value={editAnswer}
              onChange={(e) => setEditAnswer(e.target.value)}
              placeholder="留空则不修改"
            />
          </Form.Item>
          <Form.Item label="知识点">
            <Select
              value={editKp}
              onChange={setEditKp}
              options={KNOWLEDGE_POINTS.map((p) => ({ label: p, value: p }))}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label="解析">
            <Input.TextArea
              value={editExplanation}
              onChange={(e) => setEditExplanation(e.target.value)}
              rows={3}
              placeholder="留空则不修改"
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 上传题目弹窗 */}
      <Modal
        title="上传题目"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        footer={null}
        width={640}
        destroyOnClose
      >
        {!uContent && !uploadLoading ? (
          <div>
            <AntUpload.Dragger
              accept="image/jpeg,image/png,image/webp,image/bmp"
              showUploadList={false}
              beforeUpload={handleUploadImage}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p>点击或拖拽图片到此区域上传</p>
              <p style={{ fontSize: 13 }}>支持 JPEG/PNG/WebP/BMP，单张不超过 10MB</p>
            </AntUpload.Dragger>
            {uploadError && (
              <p style={{ color: '#ff4d4f', marginTop: 12, textAlign: 'center' }}>{uploadError}</p>
            )}
          </div>
        ) : uploadLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ marginBottom: 16 }}>AI 识别中...</p>
            {uploadStreamText && (
              <div style={{
                background: 'rgba(3,7,18,0.8)', border: '1px solid rgba(0,212,255,0.15)',
                borderRadius: 8, padding: 16, maxHeight: 300, overflow: 'auto',
                textAlign: 'left', color: '#00d4ff', fontSize: 13, whiteSpace: 'pre-wrap',
              }}>
                {uploadStreamText}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ display: 'block', marginBottom: 8 }}>题型</span>
              <Radio.Group value={uType} onChange={(e) => setUType(e.target.value)}>
                <Radio value="choice">选择题</Radio>
                <Radio value="fill">填空题</Radio>
                <Radio value="judge">判断题</Radio>
                <Radio value="subjective">主观题</Radio>
              </Radio.Group>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ display: 'block', marginBottom: 8 }}>题目内容</span>
              <Input.TextArea
                value={uContent}
                onChange={(e) => setUContent(e.target.value)}
                rows={4}
              />
            </div>
            {uType === 'choice' && (
              <div style={{ marginBottom: 16 }}>
                <span style={{ display: 'block', marginBottom: 8 }}>选项</span>
                {uOptions.map((o, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                    <span style={{ color: '#00d4ff', width: 20 }}>{['A','B','C','D'][i]}</span>
                    <Input
                      value={o}
                      onChange={(e) => {
                        const next = [...uOptions]
                        next[i] = e.target.value
                        setUOptions(next)
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div style={{ marginBottom: 16 }}>
              <span style={{ display: 'block', marginBottom: 8 }}>答案</span>
              {uType === 'choice' ? (
                <Radio.Group value={uAnswer} onChange={(e) => setUAnswer(e.target.value)}>
                  {uOptions.map((_, i) => (
                    <Radio key={i} value={['A','B','C','D'][i]}>
                      {['A','B','C','D'][i]}
                    </Radio>
                  ))}
                </Radio.Group>
              ) : (
                <Input
                  value={uAnswer}
                  onChange={(e) => setUAnswer(e.target.value)}
                />
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ display: 'block', marginBottom: 8 }}>知识点</span>
              <Select
                value={uKnowledgePoint}
                onChange={setUKnowledgePoint}
                options={KNOWLEDGE_POINTS.map((p) => ({ label: p, value: p }))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ display: 'block', marginBottom: 8 }}>解析</span>
              <Input.TextArea
                value={uExplanation}
                onChange={(e) => setUExplanation(e.target.value)}
                rows={3}
              />
            </div>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={resetUpload}>重新上传</Button>
              <Button type="primary" loading={uConfirming} onClick={handleUploadConfirm}>
                确认入库
              </Button>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  )
}
