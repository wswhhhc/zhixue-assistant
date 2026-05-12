import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, List, Empty, message, Spin, Skeleton, Typography, Button, Modal, Tooltip } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { API_BASE } from '../config'
import { authFetch } from '../auth'
import '../components/ActionButtons.css'
import './Favorites.css'

interface FavoriteItem {
  favorite_id: number
  question_id: number
  content: string
  knowledge_point: string
  created_at: string
}

export default function Favorites() {
  const navigate = useNavigate()
  const [items, setItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    setLoading(true)
    authFetch(`${API_BASE}/favorites`)
      .then((r) => r.json())
      .then((data) => {
        setItems(data)
        setLoading(false)
      })
      .catch(() => {
        message.error('获取收藏列表失败')
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRemove = (questionId: number) => {
    Modal.confirm({
      title: '确认取消收藏',
      content: '确定要取消收藏这道题吗？',
      onOk: async () => {
        try {
          await authFetch(`${API_BASE}/favorites/${questionId}`, { method: 'DELETE' })
          message.success('已取消收藏')
          fetchData()
        } catch {
          message.error('操作失败')
        }
      },
    })
  }

  return (
    <div className="favorites-page">
      <Card title="我的收藏" className="favorites-card">
        {loading ? (
          <div className="favorites-loading">
            <Skeleton active paragraph={{ rows: 4 }} />
            <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 16 }} />
          </div>
        ) : items.length > 0 ? (
          <List
            dataSource={items}
            renderItem={(item) => (
              <List.Item
                className="favorites-list-item"
                onClick={() => navigate(`/practice?question_id=${item.question_id}`)}
                actions={[
                  <Tooltip key="delete" title="取消收藏">
                    <Button
                      className="list-action-btn"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => { e.stopPropagation(); handleRemove(item.question_id) }}
                    />
                  </Tooltip>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span className="favorites-meta-title">
                      {item.knowledge_point}
                    </span>
                  }
                  description={
                    <Typography.Paragraph ellipsis={{ rows: 2 }} className="favorites-meta-desc">
                      {item.content}
                    </Typography.Paragraph>
                  }
                />
                <div className="favorites-date">
                  {item.created_at}
                </div>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="还没有收藏题目">
            <Button type="primary" onClick={() => navigate('/practice')}>去刷题</Button>
          </Empty>
        )}
      </Card>
    </div>
  )
}
