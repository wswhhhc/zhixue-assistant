import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, Tag, Typography, Divider, Spin, Skeleton, message } from 'antd'
import { renderLatex, extractJsonFromText } from '../utils/renderLatex'
import './Result.css'
import { API_BASE } from '../config'
import { authFetch } from '../auth'

const { Title, Paragraph } = Typography

/** 将分析文本按段落分割，每段独立渲染，增强可读性 */
function FormattedContent({ text }: { text: string }) {
  if (!text) return null
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean)
  return (
    <>
      {paragraphs.map((p, i) => (
        <Paragraph key={i} className="result-paragraph">
          {renderLatex(p)}
        </Paragraph>
      ))}
    </>
  )
}

const ERROR_TYPE_MAP: Record<string, string> = {
  concept_misunderstanding: '概念理解偏差',
  calculation_error: '计算错误',
  careless_mistake: '审题/粗心失误',
  wrong_direction: '思路方向错误',
  knowledge_gap: '知识点完全未掌握',
  unknown: '未识别',
  correct: '回答正确',
}

interface ResultState {
  question: {
    id: number
    question_type?: string
    content: string
    options: string[]
    answer: string
    knowledge_point: string
    explanation?: string
  }
  userAnswer: string
  isCorrect: boolean
  analysisText: string
}


export default function Result() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id } = useParams()
  const state = location.state as ResultState | null
  const [loading, setLoading] = useState(false)
  const [fetchedState, setFetchedState] = useState<ResultState | null>(null)
  const [generating, setGenerating] = useState(false)

  const handleGenerateSimilar = async () => {
    if (!displayState) return
    setGenerating(true)
    try {
      const res = await authFetch(`${API_BASE}/practice/generate-similar?question_id=${displayState.question.id}`, { method: 'POST' })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        message.error(errData.detail || '生成失败，升级会员可无限使用')
        setGenerating(false)
        return
      }
      const data = await res.json()
      message.success('相似题已生成')
      navigate(`/practice?question_id=${data.id}`)
    } catch {
      message.error('生成失败')
      setGenerating(false)
    }
  }

  useEffect(() => {
    if (state) return
    if (!id) return
    setLoading(true)
    authFetch(`${API_BASE}/wrong-book/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error || !data.question) {
          setLoading(false)
          return
        }
        setFetchedState({
          question: data.question,
          userAnswer: data.record.user_answer,
          isCorrect: data.record.is_correct,
          analysisText: data.record.error_analysis,
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, state])

  // 合并 state，优先使用 location state，否则用 fetchedState
  const displayState = state || fetchedState

  // 确保 question 数据存在
  const hasValidQuestion = displayState?.question && displayState.question.content

  if (loading) {
    return (
      <div className="result-page">
        <Card className="result-card" style={{ animationDelay: '0s' }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    )
  }

  if (!displayState || !hasValidQuestion) {
    return (
      <div className="result-error" style={{ textAlign: 'center', padding: '40px 20px' }}>
        <Title level={4}>结果数据未找到</Title>
        <Paragraph style={{ color: '#888' }}>页面跳转数据已过期，请重新刷题</Paragraph>
        <Button type="primary" onClick={() => navigate('/practice')}>返回刷题</Button>
      </div>
    )
  }

  try {
    const { question, userAnswer, isCorrect, analysisText } = displayState
    
    // 防御性检查
    if (!question || typeof question !== 'object') {
      throw new Error('题目数据无效')
    }
    if (!Array.isArray(question.options)) {
      throw new Error('选项数据无效')
    }
    
    const parsed = extractJsonFromText(analysisText || '')
    const analysis = parsed?.analysis || analysisText || ''
    const solutionSteps = parsed?.solution_steps || ''
    const suggestion = parsed?.suggestion || ''
    const similarQuestion = parsed?.similar_question || ''
    const errorType = parsed?.error_type || (isCorrect ? 'correct' : '')

    return (
      <div className="result-page">
        <Card className={`result-header-card${isCorrect ? ' correct' : ' wrong'}`}>
          <div className="result-header-inner">
            <Title level={3} className={`result-header-title${isCorrect ? ' correct' : ' wrong'}`}>
              {isCorrect ? '✓ 回答正确！' : '✗ 回答错误'}
            </Title>
            {errorType && errorType !== 'correct' && (
              <Tag color="red">{ERROR_TYPE_MAP[errorType] || errorType}</Tag>
            )}
          </div>
        </Card>

        <Card title="题目回顾" className="result-detail-card">
          <Paragraph className="result-review-content">
            {renderLatex(question.content)}
          </Paragraph>
          <div className="result-options">
            {question.question_type === 'fill' || question.question_type === 'judge' || question.question_type === 'subjective' ? (
              <>
                <div className="result-option-item" style={{ color: isCorrect ? '#52c41a' : '#ff4d4f' }}>
                  你的答案：<strong>{renderLatex(userAnswer)}</strong>
                  <Tag className="result-option-tag" color={isCorrect ? 'green' : 'red'}>
                    {isCorrect ? '正确' : '错误'}
                  </Tag>
                </div>
                {!isCorrect && (
                  <div className="result-option-item" style={{ color: '#52c41a' }}>
                    正确答案：<strong>{renderLatex(question.answer)}</strong>
                    <Tag className="result-option-tag" color="green">正确答案</Tag>
                  </div>
                )}
              </>
            ) : (
              question.options.map((opt: string, i: number) => {
                const label = String.fromCharCode(65 + i)
                const isUA = userAnswer === label
                const isCA = question.answer === label
                let color = ''
                if (isUA && isCA) color = '#52c41a'
                else if (isUA && !isCA) color = '#ff4d4f'
                else if (isCA) color = '#52c41a'
                return (
                  <div key={label} className="result-option-item" style={{ color }}>
                    <strong>{label}.</strong> {renderLatex(opt)}
                    {isUA && <Tag className="result-option-tag" color={isCorrect ? 'green' : 'red'}>你的答案</Tag>}
                    {isCA && <Tag className="result-option-tag" color="green">正确答案</Tag>}
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {question.question_type === 'subjective' && question.explanation && (
          <Card title="参考解题步骤" className="result-detail-card">
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              <Paragraph className="result-paragraph">
                {renderLatex(question.explanation)}
              </Paragraph>
            </div>
          </Card>
        )}

        <Card title="AI 错因分析" className="result-detail-card">
          <FormattedContent text={analysis} />
        </Card>

        {solutionSteps && (
          <Card title="解题步骤" className="result-detail-card">
            <FormattedContent text={solutionSteps} />
          </Card>
        )}

        {suggestion && (
          <Card title="学习建议" className="result-detail-card">
            <FormattedContent text={suggestion} />
          </Card>
        )}

        {similarQuestion && (
          <Card title="巩固练习" className="result-detail-card">
            <Paragraph className="result-paragraph">
              {renderLatex(similarQuestion)}
            </Paragraph>
          </Card>
        )}

        <Divider />
        <Button
          type="primary"
          size="large"
          block
          loading={generating}
          onClick={handleGenerateSimilar}
          className="result-action-btn"
        >
          AI 生成相似题
        </Button>
        <Button size="large" block onClick={() => navigate('/practice')}>
          继续刷题
        </Button>
      </div>
    )
  } catch (e) {
    return (
      <div className="result-error">
        <Title level={4}>页面渲染出错</Title>
        <Paragraph>{(e as Error).message}</Paragraph>
        <Button type="primary" onClick={() => navigate('/practice')}>返回刷题</Button>
      </div>
    )
  }
}
