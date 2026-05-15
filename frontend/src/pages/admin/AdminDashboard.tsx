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
    { title: '总用户数', value: stats?.total_users ?? 0, icon: <UserOutlined />, color: '#00d4ff' },
    { title: '总题目数', value: stats?.total_questions ?? 0, icon: <DatabaseOutlined />, color: '#6366f1' },
    { title: '会员用户', value: stats?.premium_users ?? 0, icon: <CrownOutlined />, color: '#fbbf24' },
    { title: '今日做题', value: stats?.today_answers ?? 0, icon: <EditOutlined />, color: '#22c55e' },
    { title: '今日活跃', value: stats?.active_users_today ?? 0, icon: <TeamOutlined />, color: '#f97316' },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 22, fontWeight: 700 }}>
        仪表盘
      </h2>
      <Row gutter={[16, 16]}>
        {cards.map((card) => (
          <Col xs={24} sm={12} lg={6} key={card.title}>
            <Card>
              <Statistic
                title={card.title}
                value={card.value}
                valueStyle={{ color: card.color, fontSize: 28, fontWeight: 700 }}
                prefix={card.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  )
}
