import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Card, Radio, Spin, Skeleton, Typography, message, Segmented, Select } from 'antd'
import { renderLatex } from '../utils/renderLatex'
import { StarOutlined, StarFilled } from '@ant-design/icons'
import './Practice.css'

import { API_BASE } from '../config'
import { authFetch } from '../auth'

const { Title, Paragraph } = Typography

interface Question {
  id: number
  subject: string
  chapter: string
  content: string
  options: string[]
  knowledge_point: string
}

const OPTION_LABELS = ['A', 'B', 'C', 'D']
type Mode = 'sequential' | 'random' | 'recommend' | 'kp_practice'


export default function Practice() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [question, setQuestion] = useState<Question | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [streamDone, setStreamDone] = useState(false)
  const [recommendInfo, setRecommendInfo] = useState<{ knowledge_point: string; mastery_rate: number } | null>(null)
  const [mode, setMode] = useState<Mode>('recommend')
  const [loading, setLoading] = useState(false)
  const navigateCalledRef = useRef(false)
  const [redoQuestions, setRedoQuestions] = useState<Question[] | null>(null)
  const [redoIndex, setRedoIndex] = useState(0)

  // 知识点练习
  const [kpList, setKpList] = useState<string[]>([])
  const [selectedKp, setSelectedKp] = useState<string | null>(null)
  const [kpQuestions, setKpQuestions] = useState<Question[]>([])
  const [kpIndex, setKpIndex] = useState(0)

  // 收藏
  const [favorited, setFavorited] = useState(false)
  const [favLoading, setFavLoading] = useState(false)

  // 换题过渡动画
  const [transitioning, setTransitioning] = useState(false)

  const fetchKpList = async () => {
    try {
      const res = await authFetch(`${API_BASE}/questions/knowledge-points`)
      setKpList(await res.json())
    } catch { /* ignore */ }
  }

  const fetchKpQuestions = async (kp: string) => {
    setLoading(true)
    setTransitioning(true)
    setSelectedKp(kp)
    try {
      const res = await authFetch(`${API_BASE}/questions/by-kp/${encodeURIComponent(kp)}`)
      const data = await res.json()
      setKpQuestions(data)
      setKpIndex(0)
      if (data.length > 0) setQuestion(data[0])
      else message.warning('该知识点暂无题目')
    } catch {
      message.error('获取题目失败')
    }
    setLoading(false)
    setTimeout(() => setTransitioning(false), 50)
  }

  const checkFavorite = async (qid: number) => {
    try {
      const res = await authFetch(`${API_BASE}/favorites/check?question_id=${qid}`)
      const data = await res.json()
      setFavorited(data.favorited)
    } catch { setFavorited(false) }
  }

  const toggleFavorite = async () => {
    if (!question) return
    setFavLoading(true)
    try {
      if (favorited) {
        await authFetch(`${API_BASE}/favorites/${question.id}`, { method: 'DELETE' })
        setFavorited(false)
        message.success('已取消收藏')
      } else {
        await authFetch(`${API_BASE}/favorites/${question.id}`, { method: 'POST' })
        setFavorited(true)
        message.success('已收藏')
      }
    } catch {
      message.error('操作失败')
    }
    setFavLoading(false)
  }

  const fetchRedoQuestions = async () => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_BASE}/wrong-book/questions`)
      const data = await res.json()
      setRedoQuestions(data)
      if (data.length > 0) {
        setQuestion(data[0])
      }
    } catch {
      message.error('获取错题失败')
    }
    setLoading(false)
  }

  const fetchQuestion = useCallback(async (m: Mode, currentId?: number) => {
    setLoading(true)
    setTransitioning(true)
    setSelected(null)
    setRecommendInfo(null)
    try {
      const qid = searchParams.get('question_id')
      let url: string
      if (qid) {
        url = `${API_BASE}/questions/${qid}`
      } else if (m === 'sequential') {
        const savedId = localStorage.getItem('practice_sequential_id')
        const startId = currentId || (savedId ? Number(savedId) : null)
        if (startId) {
          url = `${API_BASE}/questions/${startId}`
        } else {
          url = `${API_BASE}/questions/sequential?current_id=0&direction=next`
        }
      } else if (m === 'recommend') {
        url = `${API_BASE}/practice/recommend`
      } else {
        url = `${API_BASE}/questions/random`
      }

      const res = await authFetch(url)
      const data = await res.json()
      if (data.question) {
        setQuestion(data.question)
        setRecommendInfo(data.recommendation || null)
      } else {
        setQuestion(data)
        setRecommendInfo(null)
      }
    } catch {
      message.error('获取题目失败')
    }
    setLoading(false)
    setTimeout(() => setTransitioning(false), 50)
  }, [searchParams])

  useEffect(() => {
    fetchKpList()
    if (searchParams.get('redo_all')) {
      fetchRedoQuestions()
    } else {
      fetchQuestion(mode)
    }
  }, []) // only on mount

  // 当问题切换时检查收藏状态，并保存顺序刷题进度
  useEffect(() => {
    if (question?.id) {
      checkFavorite(question.id)
      if (mode === 'sequential') {
        localStorage.setItem('practice_sequential_id', String(question.id))
      }
    }
  }, [question?.id])

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode)
    if (newMode === 'kp_practice') {
      if (selectedKp) {
        fetchKpQuestions(selectedKp)
      } else {
        setQuestion(null)
      }
    } else {
      setKpQuestions([])
      fetchQuestion(newMode)
    }
  }

  const handlePrevKp = () => {
    if (kpIndex <= 0) return
    setTransitioning(true)
    const newIndex = kpIndex - 1
    setKpIndex(newIndex)
    setQuestion(kpQuestions[newIndex])
    setSelected(null)
    setTimeout(() => setTransitioning(false), 50)
  }

  const handleNextKp = () => {
    if (kpIndex >= kpQuestions.length - 1) return
    setTransitioning(true)
    const newIndex = kpIndex + 1
    setKpIndex(newIndex)
    setQuestion(kpQuestions[newIndex])
    setSelected(null)
    setTimeout(() => setTransitioning(false), 50)
  }

  const handleNextSequential = async () => {
    if (!question) return
    setTransitioning(true)
    try {
      const res = await authFetch(`${API_BASE}/questions/sequential?current_id=${question.id}&direction=next`)
      if (!res.ok) { setTransitioning(false); message.warning('已经是最后一题了'); return }
      const data = await res.json()
      setQuestion(data)
      setSelected(null)
      setTimeout(() => setTransitioning(false), 50)
    } catch {
      message.error('获取下一题失败')
      setTransitioning(false)
    }
  }

  const handlePrevSequential = async () => {
    if (!question) return
    setTransitioning(true)
    try {
      const res = await authFetch(`${API_BASE}/questions/sequential?current_id=${question.id}&direction=prev`)
      if (!res.ok) { setTransitioning(false); message.warning('已经是第一题了'); return }
      const data = await res.json()
      setQuestion(data)
      setSelected(null)
      setTimeout(() => setTransitioning(false), 50)
    } catch {
      message.error('获取上一题失败')
      setTransitioning(false)
    }
  }

  const handleSkip = () => {
    fetchQuestion(mode)
  }

  const handlePrevRedo = () => {
    if (!redoQuestions || redoIndex <= 0) return
    setTransitioning(true)
    const newIndex = redoIndex - 1
    setRedoIndex(newIndex)
    setQuestion(redoQuestions[newIndex])
    setSelected(null)
    setTimeout(() => setTransitioning(false), 50)
  }

  const handleNextRedo = () => {
    if (!redoQuestions || redoIndex >= redoQuestions.length - 1) return
    setTransitioning(true)
    const newIndex = redoIndex + 1
    setRedoIndex(newIndex)
    setQuestion(redoQuestions[newIndex])
    setSelected(null)
    setTimeout(() => setTransitioning(false), 50)
  }

  const handleSubmit = async () => {
    if (!selected || !question) return
    setSubmitting(true)
    setStreamText('')
    setStreamDone(false)
    navigateCalledRef.current = false

    try {
      const res = await authFetch(`${API_BASE}/practice/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question_id: question.id, answer: selected }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let isCorrect = false
      let recordId: number | null = null

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
            if (data.type === 'meta') {
              isCorrect = data.is_correct
            } else if (data.type === 'token') {
              fullText += data.content
              setStreamText(fullText)
            } else if (data.type === 'done') {
              recordId = data.record_id
            } else if (data.type === 'error') {
              message.error(data.message)
            }
          } catch { /* skip parse errors */ }
        }
      }

      setStreamDone(true)

      if (recordId && !navigateCalledRef.current) {
        navigateCalledRef.current = true
        navigate(`/result/${recordId}`, {
          state: {
            question,
            userAnswer: selected,
            isCorrect,
            analysisText: fullText,
          },
        })
      }
    } catch {
      message.error('提交失败，请检查后端是否运行')
      setSubmitting(false)
    }
  }

  if (!question && mode !== 'kp_practice') {
    return (
      <div className="practice-page">
        <Card className="practice-card">
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      </div>
    )
  }

  if (submitting) {
    return (
      <div className="practice-page">
        <Card>
          <Title level={4}>AI 正在批改...</Title>
          <Paragraph>{renderLatex(question.content)}</Paragraph>
          <div className="practice-submitting-text">
            {streamText || '正在生成分析...'}
          </div>
          {streamDone && <Spin className="practice-stream-spin" />}
        </Card>
      </div>
    )
  }

  return (
    <div className="practice-page">
      {/* 模式切换 */}
      {!searchParams.get('question_id') && !searchParams.get('redo_all') && (
        <Segmented
          value={mode}
          onChange={(v) => handleModeChange(v as Mode)}
          options={[
            { label: '顺序答题', value: 'sequential' },
            { label: '随机答题', value: 'random' },
            { label: '智能推荐', value: 'recommend' },
            { label: '知识点练习', value: 'kp_practice' },
          ]}
          block
          className="practice-mode-selector"
        />
      )}

      <Card className="practice-card">
        {redoQuestions && (
          <div className="practice-info-banner practice-info-banner-redo">
            重做错题（{redoIndex + 1}/{redoQuestions.length}）
          </div>
        )}
        {mode === 'kp_practice' && (
          <div className="practice-info-banner">
            <Select
              value={selectedKp}
              placeholder="选择知识点"
              style={{ width: 280 }}
              onChange={(kp) => fetchKpQuestions(kp)}
              options={kpList.map((kp) => ({ label: kp, value: kp }))}
            />
            {kpQuestions.length > 0 && (
              <span className="practice-info-banner-kp">
                知识点练习（{kpIndex + 1}/{kpQuestions.length}）
              </span>
            )}
          </div>
        )}
        {recommendInfo && (
          <div className="practice-info-recommend">
            推荐攻克 · {recommendInfo.knowledge_point}（掌握度 {recommendInfo.mastery_rate}%）
          </div>
        )}
        <div className={`practice-content-fade${transitioning ? ' fade-out' : ''}`}>
        {question && (
          <>
            <div className="practice-question-header">
              <span className="practice-question-meta">
                {question.subject} · {question.knowledge_point}
                {mode === 'sequential' && <span className="practice-question-seq">· 第 #{question.id} 题</span>}
                {mode === 'sequential' && (
                  <Button
                    size="small"
                    type="link"
                    style={{ padding: 0, marginLeft: 8, fontSize: 12 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      localStorage.removeItem('practice_sequential_id')
                      fetchQuestion('sequential')
                    }}
                  >
                    从头开始
                  </Button>
                )}
              </span>
              <span
                onClick={toggleFavorite}
                className={`practice-favorite-btn${favorited ? ' favorited' : ''}`}
              >
                {favLoading ? <Spin size="small" /> : (favorited ? <StarFilled /> : <StarOutlined />)}
              </span>
            </div>
            <Title level={4} className="practice-question-content">{renderLatex(question.content)}</Title>
          </>
        )}

        {question && (
          <>
            <div className="practice-options">
              <Radio.Group
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                style={{ width: '100%' }}
              >
                {question.options.map((opt, i) => (
                  <div
                    key={OPTION_LABELS[i]}
                    className={`practice-option-item${selected === OPTION_LABELS[i] ? ' selected' : ''}`}
                    onClick={() => setSelected(OPTION_LABELS[i])}
                  >
                    <Radio value={OPTION_LABELS[i]}>
                      <strong>{OPTION_LABELS[i]}.</strong> {renderLatex(opt)}
                    </Radio>
                  </div>
                ))}
              </Radio.Group>
            </div>

            <Button
              type="primary"
              size="large"
              block
              disabled={!selected}
              onClick={handleSubmit}
              className="practice-submit-btn"
            >
              提交答案
            </Button>
          </>
        )}

        {!searchParams.get('question_id') && !redoQuestions && mode !== 'kp_practice' && (
          <div className="practice-nav">
            {mode === 'sequential' ? (
              <>
                <Button className="practice-nav-btn" onClick={handlePrevSequential} disabled={loading}>
                  上一题
                </Button>
                <Button className="practice-nav-btn" onClick={handleNextSequential} disabled={loading}>
                  下一题
                </Button>
              </>
            ) : (
              <Button block className="practice-nav-btn" onClick={handleSkip} loading={loading}>
                {mode === 'recommend' ? '换一道推荐' : '换一题'}
              </Button>
            )}
          </div>
        )}

        {mode === 'kp_practice' && kpQuestions.length > 0 && (
          <div className="practice-nav">
            <Button className="practice-nav-btn" onClick={handlePrevKp} disabled={kpIndex <= 0 || loading}>
              上一题
            </Button>
            <Button className="practice-nav-btn" onClick={handleNextKp} disabled={kpIndex >= kpQuestions.length - 1 || loading}>
              下一题
            </Button>
          </div>
        )}

        {redoQuestions && (
          <div className="practice-nav">
            <Button
              className="practice-nav-btn"
              onClick={handlePrevRedo}
              disabled={redoIndex <= 0 || loading}
            >
              上一题
            </Button>
            <Button
              className="practice-nav-btn"
              onClick={handleNextRedo}
              disabled={redoIndex >= redoQuestions.length - 1 || loading}
            >
              下一题
            </Button>
          </div>
        )}
        </div>
      </Card>
    </div>
  )
}
