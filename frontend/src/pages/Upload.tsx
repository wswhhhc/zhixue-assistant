import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Tabs, Button, Input, Select, message, Spin, Skeleton,
  Alert, Form, Space, Typography, Divider, Radio, Modal, Tag,
} from 'antd'
import AntUpload from 'antd/es/upload'
import { renderLatex } from '../utils/renderLatex'
import './Upload.css'
import {
  UploadOutlined, InboxOutlined, CheckCircleOutlined, BulbOutlined,
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
  const [streamText, setStreamText] = useState('')

  // form fields
  const [questionType, setQuestionType] = useState('choice')
  const [content, setContent] = useState('')
  const [options, setOptions] = useState(['', '', '', ''])
  const [answer, setAnswer] = useState('')
  const [knowledgePoint, setKnowledgePoint] = useState('')
  const [explanation, setExplanation] = useState('')

  // confirm state
  const [confirming, setConfirming] = useState(false)
  const [confirmResult, setConfirmResult] = useState<any>(null)
  const [fixing, setFixing] = useState(false)
  const [answerVerified, setAnswerVerified] = useState(false)
  const [aiFinding, setAiFinding] = useState(false)
  const [aiVerifying, setAiVerifying] = useState(false)

  const resetForm = () => {
    setExtracted(null)
    setQuestionType('choice')
    setContent('')
    setOptions(['', '', '', ''])
    setAnswer('')
    setKnowledgePoint('')
    setExplanation('')
    setStreamText('')
    setError('')
    setConfirmResult(null)
    setAnswerVerified(false)
  }

  const handleImageUpload = async (file: File) => {
    setLoading(true)
    setError('')
    setStreamText('')
    setConfirmResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await authFetch(`${API_BASE}/upload/image-stream`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        message.error(errData.detail || errData.error || '上传失败')
        setLoading(false)
        return
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
              setStreamText((prev) => prev + data.content)
            } else if (data.type === 'done') {
              const d = data.data
              setExtracted(d)
              setQuestionType(d.question_type || 'choice')
              setContent(d.content || '')
              setOptions(d.options?.length === 4 ? d.options : ['', '', '', ''])
              setAnswer(d.answer || '')
              setKnowledgePoint(d.knowledge_point || '')
              setExplanation(d.explanation || '')
              setStreamText('')
              setLoading(false)
            } else if (data.type === 'error') {
              setError(data.message || '识别失败')
              setStreamText('')
              setLoading(false)
              break
            }
          } catch { /* skip parse errors */ }
        }
      }
    } catch {
      setError('上传失败，请稍后重试或联系客服')
      setStreamText('')
    }

    setLoading(false)
    return false
  }

  const handleManualSubmit = async () => {
    if (!content.trim()) {
      message.error('请输入题目内容')
      return
    }
    if (questionType === 'choice') {
      if (options.some((o) => !o.trim())) {
        message.error('请填写所有选项')
        return
      }
      if (!answer) {
        message.error('请选择正确答案')
        return
      }
    } else {
      if (!answer.trim()) {
        message.error('请填写正确答案')
        return
      }
    }

    if (!answerVerified) {
      message.error('请先使用「AI 寻找答案」或「AI 验证答案」确认答案正确性')
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
          options: questionType === 'fill' || questionType === 'judge' || questionType === 'subjective' ? [] : options,
          answer,
          knowledge_point: knowledgePoint,
          question_type: questionType,
          explanation,
        }),
      })
      const data = await res.json()

      if (data.error) {
        setError(data.error)
        setLoading(false)
        return
      }

      setExtracted(data)
      setExplanation(data.explanation || '')
    } catch {
      setError('提交失败，请稍后重试或联系客服')
    }

    setLoading(false)
  }

  const handleAiFindAnswer = async () => {
    if (!content.trim()) {
      message.error('请输入题目内容')
      return
    }
    if (questionType === 'choice' && options.some((o) => !o.trim())) {
      message.error('请填写所有选项')
      return
    }

    setAiFinding(true)

    // 大题使用流式输出，让用户实时看到生成过程
    if (questionType === 'subjective') {
      let streamContent = ''
      const modal = Modal.info({
        title: 'AI 正在解答...',
        content: <div style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap' }}>正在连接...</div>,
        width: 600,
        okText: '关闭',
      })

      try {
        const res = await authFetch(`${API_BASE}/upload/ai-find-answer-stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            options: [],
            question_type: 'subjective',
          }),
        })

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
                streamContent += data.content
                modal.update({
                  content: (
                    <div style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                      {renderLatex(streamContent)}
                    </div>
                  ),
                })
              } else if (data.type === 'done') {
                setAnswer(data.answer || '')
                if (data.explanation) setExplanation(data.explanation)
                setAnswerVerified(true)
                modal.update({
                  title: 'AI 解答结果',
                  content: (
                    <div>
                      <p><strong>答案：</strong>{data.answer}</p>
                      {data.explanation && (
                        <>
                          <Divider />
                          <p><strong>解题过程：</strong></p>
                          <Paragraph style={{ background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(0, 212, 255, 0.2)', padding: 12, borderRadius: 8, color: '#e2e8f0' }}>
                            {renderLatex(data.explanation)}
                          </Paragraph>
                        </>
                      )}
                    </div>
                  ),
                })
              } else if (data.type === 'error') {
                modal.destroy()
                message.error(data.message || 'AI 寻找答案失败')
              }
            } catch { /* skip parse errors */ }
          }
        }
      } catch {
        modal.destroy()
        message.error('AI 寻找答案失败')
      }

      setAiFinding(false)
      return
    }

    // 选择题/填空题/判断题使用原有的非流式接口（响应较快）
    try {
      const res = await authFetch(`${API_BASE}/upload/ai-find-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          options: questionType === 'fill' || questionType === 'judge' ? [] : options,
          question_type: questionType,
        }),
      })
      const data = await res.json()
      if (data.error) {
        message.error(data.error)
        return
      }
      setAnswer(data.answer || '')
      setAnswerVerified(true)
      Modal.info({
        title: 'AI 解答结果',
        content: (
          <div>
            <p><strong>答案：</strong>{data.answer}</p>
            {data.explanation && (
              <>
                <Divider />
                <p><strong>解题过程：</strong></p>
                <Paragraph style={{ background: 'rgba(17, 24, 39, 0.6)', border: '1px solid rgba(0, 212, 255, 0.2)', padding: 12, borderRadius: 8, color: '#e2e8f0' }}>
                  {renderLatex(data.explanation)}
                </Paragraph>
              </>
            )}
          </div>
        ),
      })
    } catch {
      message.error('AI 寻找答案失败')
    }
    setAiFinding(false)
  }

  const handleAiVerifyAnswer = async () => {
    if (!content.trim()) {
      message.error('请输入题目内容')
      return
    }
    if (!answer.trim()) {
      message.error('请先填写你的答案')
      return
    }
    if (questionType === 'choice' && options.some((o) => !o.trim())) {
      message.error('请填写所有选项')
      return
    }

    setAiVerifying(true)
    try {
      const res = await authFetch(`${API_BASE}/upload/ai-verify-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          options: questionType === 'fill' || questionType === 'judge' || questionType === 'subjective' ? [] : options,
          question_type: questionType,
          user_answer: answer,
        }),
      })
      const data = await res.json()
      if (data.error) {
        message.error(data.error)
        return
      }
      if (data.is_correct) {
        setAnswer(data.correct_answer || answer)
        setAnswerVerified(true)
        message.success('答案正确！')
      } else {
        setAnswerVerified(false)
        Modal.warning({
          title: '答案不正确',
          content: (
            <div>
              <p><strong>正确答案：</strong>{data.correct_answer}</p>
              {data.explanation && (
                <>
                  <Divider />
                  <p><strong>说明：</strong></p>
                  <p>{data.explanation}</p>
                </>
              )}
            </div>
          ),
        })
      }
    } catch {
      message.error('AI 验证失败')
    }
    setAiVerifying(false)
  }

  const handleConfirm = async () => {
    setConfirming(true)

    try {
      const res = await authFetch(`${API_BASE}/upload/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          options: questionType === 'fill' || questionType === 'judge' || questionType === 'subjective' ? [] : options,
          answer,
          knowledge_point: knowledgePoint,
          question_type: questionType,
          explanation,
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
          options: questionType === 'fill' || questionType === 'judge' || questionType === 'subjective' ? [] : options,
          answer,
          knowledge_point: knowledgePoint,
          question_type: questionType,
          suggestion: confirmResult?.review?.suggestion || '',
          explanation,
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
      setExplanation(data.explanation || '')
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
        <Form.Item label="题型">
          <Radio.Group
            value={questionType}
            onChange={(e) => setQuestionType(e.target.value)}
          >
            <Radio value="choice">选择题</Radio>
            <Radio value="fill">填空题</Radio>
            <Radio value="judge">判断题</Radio>
            <Radio value="subjective">主观题</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="题目内容（支持 LaTeX）">
          <TextArea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="输入题目内容，LaTeX 公式用 $...$ 包裹；填空题用 ___ 表示填空位置"
          />
        </Form.Item>

        {questionType === 'choice' ? (
          <>
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
          </>
        ) : questionType === 'judge' ? (
          <Form.Item label="正确答案">
            <Radio.Group value={answer} onChange={(e) => setAnswer(e.target.value)}>
              <Radio value="对">对</Radio>
              <Radio value="错">错</Radio>
            </Radio.Group>
          </Form.Item>
        ) : questionType === 'subjective' ? (
          <>
            <Form.Item label="最终答案">
              <Input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="输入最终答案（如：$\\frac{1}{2}$）"
              />
            </Form.Item>
            <Form.Item label="解题步骤">
              <TextArea
                rows={10}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="输入完整的解题步骤，LaTeX 公式用 $...$ 包裹"
              />
            </Form.Item>
          </>
        ) : (
          <Form.Item label="正确答案">
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="输入正确答案（如：$\\frac{1}{2}$）"
            />
          </Form.Item>
        )}

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
                : `审查建议：${confirmResult.review?.suggestion || ''}`
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
                        支持 PNG、JPG 格式，AI 将自动识别题目内容（支持选择题、填空题和判断题）
                      </p>
                    </Dragger>
                  )}

                  {loading && (
                    <div className="upload-loading">
                      <Spin size="large" />
                      <p className="upload-loading-text">
                        {streamText ? 'AI 正在识别题目...' : 'AI 正在识别题目...'}
                      </p>
                      {streamText && (
                        <div className="upload-stream-box">
                          {renderLatex(streamText)}
                        </div>
                      )}
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
                      <Form.Item label="题型">
                        <Radio.Group
                          value={questionType}
                          onChange={(e) => {
                            setQuestionType(e.target.value)
                            setAnswer('')
                            setExplanation('')
                            setAnswerVerified(false)
                          }}
                        >
                          <Radio value="choice">选择题</Radio>
                          <Radio value="fill">填空题</Radio>
                          <Radio value="judge">判断题</Radio>
                          <Radio value="subjective">主观题</Radio>
                        </Radio.Group>
                      </Form.Item>

                      <Form.Item label="题目内容（支持 LaTeX）" required>
                        <TextArea
                          rows={3}
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          placeholder="输入题目内容，LaTeX 公式用 $...$ 包裹；填空题用 ___ 表示填空位置"
                        />
                      </Form.Item>

                      {questionType === 'choice' ? (
                        <>
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
                              onChange={(val) => { setAnswer(val); setAnswerVerified(false) }}
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
                        </>
                      ) : questionType === 'judge' ? (
                        <Form.Item label="正确答案" required>
                          <Radio.Group value={answer} onChange={(e) => { setAnswer(e.target.value); setAnswerVerified(false) }}>
                            <Radio value="对">对</Radio>
                            <Radio value="错">错</Radio>
                          </Radio.Group>
                        </Form.Item>
                      ) : questionType === 'subjective' ? (
                        <>
                          <Form.Item label="最终答案" required>
                            <Input
                              value={answer}
                              onChange={(e) => { setAnswer(e.target.value); setAnswerVerified(false) }}
                              placeholder="输入最终答案（如：$\\frac{1}{2}$）"
                            />
                          </Form.Item>
                          <Form.Item label="解题步骤">
                            <TextArea
                              rows={10}
                              value={explanation}
                              onChange={(e) => setExplanation(e.target.value)}
                              placeholder="输入完整的解题步骤，LaTeX 公式用 $...$ 包裹"
                            />
                          </Form.Item>
                        </>
                      ) : (
                        <Form.Item label="正确答案" required>
                          <Input
                            value={answer}
                            onChange={(e) => { setAnswer(e.target.value); setAnswerVerified(false) }}
                            placeholder="输入正确答案（如：$\\frac{1}{2}$）"
                          />
                        </Form.Item>
                      )}

                      <div style={{ marginBottom: 16 }}>
                        <Space>
                          <Button onClick={handleAiFindAnswer} loading={aiFinding} icon={<BulbOutlined />}>
                            AI 寻找答案
                          </Button>
                          <Button onClick={handleAiVerifyAnswer} loading={aiVerifying} icon={<CheckCircleOutlined />}>
                            AI 验证答案
                          </Button>
                          {answerVerified && (
                            <Tag color="success" icon={<CheckCircleOutlined />}>答案已验证</Tag>
                          )}
                        </Space>
                      </div>

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
          {questionType === 'choice' && (
            <div className="upload-preview-options">
              {options.map((opt, i) => opt && (
                <div key={OPTION_LABELS[i]} className="upload-preview-option">
                  <strong>{OPTION_LABELS[i]}.</strong> {renderLatex(opt)}
                </div>
              ))}
            </div>
          )}
          {answer && (
            <div className="upload-preview-answer">
              答案：<strong>{answer}</strong>
            </div>
          )}
          {questionType === 'subjective' && explanation && (
            <div className="upload-preview-kp">
              解题步骤：{renderLatex(explanation)}
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
