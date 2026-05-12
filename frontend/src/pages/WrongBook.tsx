import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, List, Pagination, Spin, Skeleton, Empty, message, Typography, Modal, Button, Tooltip } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { API_BASE } from '../config'
import { authFetch } from '../auth'
import '../components/ActionButtons.css'
import './WrongBook.css'

interface WrongItem {
  record_id: number
  question_id: number
  content: string
  knowledge_point: string
  error_type: string
  user_answer: string
  correct_answer: string
  created_at: string
}

interface PageData {
  total: number
  page: number
  page_size: number
  total_pages: number
  items: WrongItem[]
}

export default function WrongBook() {
  const navigate = useNavigate()
  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), page_size: '10' })

    authFetch(`${API_BASE}/wrong-book?${params}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data)
        setLoading(false)
      })
      .catch(() => {
        message.error('获取错题本失败')
        setLoading(false)
      })
  }

  const handleDelete = (recordId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条错题记录吗？',
      onOk: async () => {
        try {
          const res = await authFetch(`${API_BASE}/wrong-book/${recordId}`, { method: 'DELETE' })
          if (!res.ok) {
            const err = await res.json()
            message.error(err.detail || '删除失败')
            return
          }
          message.success('已删除')
          fetchData()
        } catch {
          message.error('删除失败')
        }
      },
    })
  }

  useEffect(() => {
    fetchData()
  }, [page])

  return (
    <div className="wrongbook-page">
      <Card title="错题本" className="wrongbook-card" extra={
        <Button type="primary" onClick={() => navigate('/practice?redo_all=1')}>
          重做所有错题
        </Button>
      }>
        {loading ? (
          <div className="wrongbook-loading">
            <Skeleton active paragraph={{ rows: 4 }} />
            <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 16 }} />
          </div>
        ) : data && data.items.length > 0 ? (
          <>
            <List
              dataSource={data.items}
              renderItem={(item) => (
                <List.Item
                  className="wrongbook-list-item"
                  onClick={() => navigate(`/wrong-book/${item.record_id}`)}
                  actions={[
                    <Tooltip key="delete" title="删除记录">
                      <Button
                        className="list-action-btn"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => handleDelete(item.record_id, e)}
                      />
                    </Tooltip>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <span className="wrongbook-meta-title">
                        {item.knowledge_point}
                      </span>
                    }
                    description={
                      <Typography.Paragraph
                        ellipsis={{ rows: 2 }}
                        className="wrongbook-meta-desc"
                      >
                        {item.content}
                      </Typography.Paragraph>
                    }
                  />
                  <div className="wrongbook-date">
                    {item.created_at}
                  </div>
                </List.Item>
              )}
            />
            <div className="wrongbook-pagination">
              <Pagination
                current={data.page}
                total={data.total}
                pageSize={data.page_size}
                onChange={setPage}
                showTotal={(t) => `共 ${t} 条`}
              />
            </div>
          </>
        ) : (
          <Empty description="暂无错题，继续保持！">
            <span className="wrongbook-empty-hint">答错的题目会自动收录到这里</span>
          </Empty>
        )}
      </Card>
    </div>
  )
}
