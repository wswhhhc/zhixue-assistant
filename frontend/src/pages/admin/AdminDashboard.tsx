import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Spin } from 'antd'
import {
  UserOutlined,
  DatabaseOutlined,
  EditOutlined,
  TeamOutlined,
  CrownOutlined,
} from '@ant-design/icons'
import { adminFetch } from '../../adminAuth'

interface Stats {
  total_users: number
  total_questions: number
  total_answers: number
  today_answers: number
  premium_users: number
  active_users_today: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminFetch('/admin/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Spin size="large" />
      </div>
    )
  }

  const cards = [
    { title: '总用户数', value: stats?.total_users ?? 0, icon: <UserOutlined />, gradient: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)' },
    { title: '总题目数', value: stats?.total_questions ?? 0, icon: <DatabaseOutlined />, gradient: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)' },
    { title: '会员用户', value: stats?.premium_users ?? 0, icon: <CrownOutlined />, gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' },
    { title: '今日做题', value: stats?.today_answers ?? 0, icon: <EditOutlined />, gradient: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)' },
    { title: '今日活跃', value: stats?.active_users_today ?? 0, icon: <TeamOutlined />, gradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' },
  ]

  return (
    <div>
      <h2 style={{ 
        marginBottom: 24, 
        fontSize: 24, 
        fontWeight: 700,
        color: '#e2e8f0',
        fontFamily: "'Space Grotesk', 'Noto Sans SC', sans-serif",
        letterSpacing: '0.5px',
      }}>
        仪表盘
      </h2>
      <Row gutter={[20, 20]}>
        {cards.map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.title}>
            <div className="admin-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ 
                  fontSize: 24, 
                  background: card.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {card.icon}
                </div>
                <span style={{ color: '#94a3b8', fontSize: 14 }}>{card.title}</span>
              </div>
              <div 
                className="admin-stat-value"
                style={{ 
                  background: card.gradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {card.value.toLocaleString()}
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  )
}
