import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Tag, Spin, Skeleton, Button, Typography, Empty, message, Modal } from 'antd'
import { renderLatex } from '../utils/renderLatex'
import './WrongBookDetail.css'
import { API_BASE } from '../config'
import { authFetch } from '../auth'

const { Title, Paragraph } = Typography

const ERROR_TYPE_MAP: Record<string, string> = {
  concept_misunderstanding: '概念理解偏差',
  calculation_error: '计算错误',
  careless_mistake: '审题/粗心失误',
  wrong_direction: '思路方向错误',
  knowledge_gap: '知识点未掌握',
  unknown: '未识别',
  correct: '回答正确',
}


const OPTION_LABELS = ['A', 'B', 'C', 'D']

interface DetailData {
  record: {
    id: number
    user_answer: string
    is_correct: boolean
    error_type: string
    error_analysis: string
    solution_steps: string
    learning_suggestion: string
    similar_question: string
    created_at: string
  }
  question: {
    content: string
    options: string[]
    answer: string
    knowledge_point: string
  } | null
}

export default function WrongBookDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<DetailData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    authFetch(`${API_BASE}/wrong-book/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          message.error(data.error)
        } else {
          setData(data)
        }
        setLoading(false)
      })
      .catch(() => {
        message.error('获取错题详情失败')
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return (
      <div className="wbd-loading">
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    )
  }

  if (!data || !data.question) {
    return (
      <div className="wbd-error">
        <Empty description="错题记录不存在" />
        <Button type="primary" className="wbd-error-btn" onClick={() => navigate('/wrong-book')}>
          返回错题本
        </Button>
      </div>
    )
  }

  const { record, question } = data

  return (
    <div className="wbd-page">
      {/* 原题展示 */}
      <Card title="原题" className="wbd-detail-card">
        <Paragraph className="wbd-content">
          {renderLatex(question.content)}
        </Paragraph>
        <div className="wbd-options">
          {question.options.map((opt, i) => {
            const label = OPTION_LABELS[i]
            const isUserAnswer = record.user_answer === label
            const isCorrectAnswer = question.answer === label
            let color = ''
            if (isUserAnswer && isCorrectAnswer) color = '#52c41a'
            else if (isUserAnswer && !isCorrectAnswer) color = '#ff4d4f'
            else if (isCorrectAnswer) color = '#52c41a'
            return (
              <div key={label} className="wbd-option-item" style={{ color }}>
                <strong>{label}.</strong> {renderLatex(opt)}
                {isUserAnswer && <Tag className="wbd-option-tag" color="red">你的答案</Tag>}
                {isCorrectAnswer && <Tag className="wbd-option-tag" color="green">正确答案</Tag>}
              </div>
            )
          })}
        </div>
      </Card>

      {/* 错因分析 */}
      <Card title="AI 错因分析" className="wbd-detail-card">
        <div className="wbd-analysis-header">
          <Tag color="red">{ERROR_TYPE_MAP[record.error_type] || record.error_type}</Tag>
          <span className="wbd-timestamp">{record.created_at}</span>
        </div>
        <Paragraph className="wbd-paragraph">
          {renderLatex(record.error_analysis)}
        </Paragraph>
      </Card>

      {/* 解题步骤 */}
      {record.solution_steps && (
        <Card title="解题步骤" className="wbd-detail-card">
          <Paragraph className="wbd-paragraph">
            {renderLatex(record.solution_steps)}
          </Paragraph>
        </Card>
      )}

      {/* 学习建议 */}
      {record.learning_suggestion && (
        <Card title="学习建议" className="wbd-detail-card">
          <Paragraph className="wbd-paragraph">
            {renderLatex(record.learning_suggestion)}
          </Paragraph>
        </Card>
      )}

      {/* 相似题 */}
      {record.similar_question && (
        <Card title="巩固练习" className="wbd-detail-card">
          <Paragraph className="wbd-paragraph">
            {renderLatex(record.similar_question)}
          </Paragraph>
        </Card>
      )}

      <div className="wbd-actions">
        <Button onClick={() => navigate('/wrong-book')}>返回错题本</Button>
        <Button
          type="primary"
          onClick={() => navigate(`/practice?question_id=${record.question_id}`)}
        >
          重做此题
        </Button>
        <Button
          danger
          onClick={() => {
            Modal.confirm({
              title: '确认删除',
              content: '确定要删除这条错题记录吗？',
              onOk: async () => {
                try {
                  const res = await authFetch(`${API_BASE}/wrong-book/${id}`, { method: 'DELETE' })
                  if (!res.ok) {
                    const err = await res.json()
                    message.error(err.detail || '删除失败')
                    return
                  }
                  message.success('已删除')
                  navigate('/wrong-book')
                } catch {
                  message.error('删除失败')
                }
              },
            })
          }}
        >
          删除记录
        </Button>
      </div>
    </div>
  )
}
