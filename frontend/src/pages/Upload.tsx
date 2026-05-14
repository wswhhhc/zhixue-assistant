import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Tabs, Button, Input, Select, message, Spin, Skeleton,
  Alert, Form, Space, Typography, Divider,
} from 'antd'
import AntUpload from 'antd/es/upload'
import { renderLatex } from '../utils/renderLatex'
import './Upload.css'
import {
  UploadOutlined, InboxOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { API_BASE } from '../config'
import { authFetch } from '../auth'

const { TextArea } = Input
const { Title, Text, Paragraph } = Typography
const { Dragger } = AntUpload

const OPTION_LABELS = ['A', 'B', 'C', 'D']

export default function UploadPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('image')

  // extracted data state
  const [extracted, setExtracted] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // form fields
  const [content, setContent] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [answer, setAnswer] = useState('')
  const [knowledgePoint, setKnowledgePoint] = useState('')

  // confirm state
  const [confirming, setConfirming] = useState(false)
  const [confirmResult, setConfirmResult] = useState<any>(null)
  const [fixing, setFixing] = useState(false)

  const resetForm = () => {
    setExtracted(null)
    setContent('')
    setOptions(['', '', '', ''])
    setAnswer('')
    setKnowledgePoint('')
    setError('')
    setConfirmResult(null)
  }

  const handleImageUpload = async (file: File) => {
    setLoading(true)
    setError('')
    setConfirmResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await authFetch(`${API_BASE}/upload/image`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return false
      }

      setExtracted(data)
      setContent(data.content || '')
      setOptions(data.options?.length === 4 ? data.options : ['', '', '', ''])
      setAnswer(data.answer || '')
      setKnowledgePoint(data.knowledge_point || '')
    } catch {
      setError('上传失败，请检查后端是否运行')
    }

    setLoading(false)
    return false
  }

  const handleManualSubmit = async () => {
    if (!content.trim()) {
      message.error('请输入题目内容')
      return
    }
    if (options.some((o) => !o.trim())) {
      message.error('请填写所有选项')
      return
    }
    if (!answer) {
      message.error('请选择正确答案')
      return
    }

    setLoading(true)
    setError('')
    setConfirmResult(null)

    try {
      const res = await authFetch(`${API_BASE}/upload/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          options,
          answer,
          knowledge_point: knowledgePoint,
        }),
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      setExtracted(data)
    } catch {
      setError('提交失败，请检查后端是否运行')
    }

    setLoading(false)
  }

  const handleConfirm = async () => {
    setConfirming(true)

    try {
      const res = await authFetch(`${API_BASE}/upload/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          options,
          answer,
          knowledge_point: knowledgePoint,
        }),
      })
      const data = await res.json()
      setConfirmResult(data)
      if (data.question_id) {
        message.success('题目入库成功！')
      }
    } catch {
      message.error('入库失败')
    }

    setConfirming(false)
  }

  const handleFix = async () => {
    setFixing(true)
    try {
      const res = await authFetch(`${API_BASE}/upload/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          options,
          answer,
          knowledge_point: knowledgePoint,
          suggestion: confirmResult?.review?.suggestion || '',
        }),
      })
      const data = await res.json()
      if (data.error) {
        message.error(data.error)
        return
      }
      setContent(data.content || '')
      setOptions(data.options?.length === 4 ? data.options : ['', '', '', ''])
      setAnswer(data.answer || '')
      setKnowledgePoint(data.knowledge_point || '')
      setConfirmResult(null)
      message.success('AI 已根据建议自动修改，请确认后重新入库')
    } catch {
      message.error('自动修改失败')
    }
    setFixing(false)
  }

  // Shared form for editing extracted data
  const editForm = (
    <div className="upload-edit-form">
      <Form layout="vertical">
        <Form.Item label="题目内容（支持 LaTeX）">
          <TextArea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入题目内容，LaTeX 公式用 $...$ 包裹"
          />
        </Form.Item>

        {OPTION_LABELS.map((label, i) => (
          <Form.Item key={label} label={`选项 ${label}`}>
            <Input
              value={options[i]}
              onChange={(e) => {
                const next = [...options]
                next[i] = e.target.value
                setOptions(next)
              }}
              placeholder={`选项 ${label} 的内容`}
            />
          </Form.Item>
        ))}

        <Form.Item label="正确答案">
          <Select
            value={answer}
            onChange={setAnswer}
            options={[
              { value: 'A', label: 'A' },
              { value: 'B', label: 'B' },
              { value: 'C', label: 'C' },
              { value: 'D', label: 'D' },
            ]}
            placeholder="选择正确答案"
            style={{ width: 120 }}
          />
        </Form.Item>

        <Form.Item label="知识点">
          <Input
            value={knowledgePoint}
            onChange={(e) => setKnowledgePoint(e.target.value)}
            placeholder="如：极限与连续、导数与微分"
          />
        </Form.Item>
      </Form>

      {confirmResult ? (
        <div>
          <Alert
            type={confirmResult.review?.passed !== false ? 'success' : 'warning'}
            message={
              confirmResult.review?.passed !== false
                ? 'AI 审查通过，题目已入库！'
                : `AI 审查建议：${confirmResult.review?.suggestion || ''}`
            }
            description={confirmResult.review?.review || ''}
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Space>
            <Button onClick={resetForm}>继续上传</Button>
            {confirmResult.review?.passed !== false && confirmResult.question_id ? (
              <Button type="primary" onClick={() => navigate(`/practice?question_id=${confirmResult.question_id}`)}>
                去刷题
              </Button>
            ) : (
              <Button loading={fixing} onClick={handleFix} icon={<CheckCircleOutlined />}>
                AI 自动修改
              </Button>
            )}
          </Space>
        </div>
      ) : (
        <Button
          type="primary"
          size="large"
          block
          loading={confirming}
          onClick={handleConfirm}
          icon={<CheckCircleOutlined />}
        >
          确认入库（AI 将审查完整性）
        </Button>
      )}
    </div>
  )

  return (
    <div className="upload-page">
      <Card className="upload-card">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key)
            resetForm()
          }}
          items={[
            {
              key: 'image',
              label: '拍照上传',
              children: (
                <div>
                  {!extracted && !loading && (
                    <Dragger
                      accept="image/*"
                      showUploadList={false}
                      beforeUpload={handleImageUpload}
                      style={{ padding: 40 }}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined />
                      </p>
                      <p className="ant-upload-text">点击或拖拽图片到此区域</p>
                      <p className="ant-upload-hint">
                        支持 PNG、JPG 格式，AI 将自动识别题目内容
                      </p>
                    </Dragger>
                  )}

                  {loading && (
                    <div className="upload-loading">
                      <Spin size="large" />
                      <p className="upload-loading-text">AI 正在识别题目...</p>
                    </div>
                  )}

                  {error && (
                    <Alert
                      type="error"
                      message={error}
                      showIcon
                      style={{ marginBottom: 16 }}
                      closable
                      onClose={() => setError('')}
                    />
                  )}

                  {extracted && editForm}
                </div>
              ),
            },
            {
              key: 'manual',
              label: '手动输入',
              children: (
                <div>
                  {!extracted && (
                    <Form layout="vertical">
                      <Form.Item label="题目内容（支持 LaTeX）" required>
                        <TextArea
                          rows={3}
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="输入题目内容，LaTeX 公式用 $...$ 包裹"
                        />
                      </Form.Item>

                      {OPTION_LABELS.map((label, i) => (
                        <Form.Item key={label} label={`选项 ${label}`} required>
                          <Input
                            value={options[i]}
                            onChange={(e) => {
                              const next = [...options]
                              next[i] = e.target.value
                              setOptions(next)
                            }}
                            placeholder={`选项 ${label} 的内容`}
                          />
                        </Form.Item>
                      ))}

                      <Form.Item label="正确答案" required>
                        <Select
                          value={answer}
                          onChange={setAnswer}
                          options={[
                            { value: 'A', label: 'A' },
                            { value: 'B', label: 'B' },
                            { value: 'C', label: 'C' },
                            { value: 'D', label: 'D' },
                          ]}
                          placeholder="选择正确答案"
                          style={{ width: 120 }}
                        />
                      </Form.Item>

                      <Form.Item label="知识点">
                        <Input
                          value={knowledgePoint}
                          onChange={(e) => setKnowledgePoint(e.target.value)}
                          placeholder="如：极限与连续、导数与微分"
                        />
                      </Form.Item>

                      <Button
                        type="primary"
                        size="large"
                        block
                        loading={loading}
                        onClick={handleManualSubmit}
                      >
                        提交
                      </Button>
                    </Form>
                  )}

                  {error && (
                    <Alert
                      type="error"
                      message={error}
                      showIcon
                      className="upload-alert-bottom"
                      closable
                      onClose={() => setError('')}
                    />
                  )}

                  {extracted && editForm}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* 预览区 */}
      {content && !confirmResult && (
        <Card title="预览" className="upload-preview-card">
          <Paragraph className="upload-preview-content">
            {renderLatex(content)}
          </Paragraph>
          <div className="upload-preview-options">
            {options.map((opt, i) => opt && (
              <div key={OPTION_LABELS[i]} className="upload-preview-option">
                <strong>{OPTION_LABELS[i]}.</strong> {renderLatex(opt)}
              </div>
            ))}
          </div>
          {answer && (
            <div className="upload-preview-answer">
              答案：<strong>{answer}</strong>
            </div>
          )}
          {knowledgePoint && (
            <div className="upload-preview-kp">
              知识点：{knowledgePoint}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
