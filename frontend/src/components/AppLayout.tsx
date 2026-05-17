import { useState, useEffect } from 'react'
import { Layout, Menu, Typography, Button, Space, Avatar, Badge, Popover, List, Empty } from 'antd'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  EditOutlined,
  UploadOutlined,
  BookOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  StarOutlined,
  LogoutOutlined,
  CrownOutlined,
  RocketOutlined,
  SunOutlined,
  MoonOutlined,
  BellOutlined,
  BellFilled,
  CheckOutlined,
} from '@ant-design/icons'
import { useAuth, authFetch } from '../auth'
import { useTheme } from '../contexts/ThemeContext'
import { API_BASE } from '../config'
import './AppLayout.css'

const { Header, Content } = Layout

const menuItems = [
  { key: '/dashboard', label: '仪表盘', icon: <DashboardOutlined /> },
  { key: '/practice', label: '刷题', icon: <EditOutlined /> },
  { key: '/question-bank', label: '题库', icon: <DatabaseOutlined /> },
  { key: '/upload', label: '上传题目', icon: <UploadOutlined /> },
  { key: '/wrong-book', label: '错题本', icon: <BookOutlined /> },
  { key: '/report', label: '学习报告', icon: <BarChartOutlined /> },
  { key: '/favorites', label: '收藏', icon: <StarOutlined /> },
  { key: '/membership', label: '会员中心', icon: <CrownOutlined /> },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, username, isPremium, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()

  const selectedKey = '/' + location.pathname.split('/')[1]

  // 通知系统
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)

  const fetchUnreadCount = () => {
    if (!isAuthenticated) return
    authFetch(`${API_BASE}/notifications/unread-count`)
      .then((r) => r.json())
      .then((d) => setUnreadCount(d.count || 0))
      .catch(() => {})
  }

  const fetchNotifications = async () => {
    try {
      const res = await authFetch(`${API_BASE}/notifications?page_size=10`)
      const d = await res.json()
      setNotifications(d.items || [])
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchUnreadCount()
    const timer = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(timer)
  }, [isAuthenticated])

  const handleNotifOpen = (open: boolean) => {
    setNotifOpen(open)
    if (open) fetchNotifications()
  }

  const handleNotifClick = async (notif: any) => {
    if (!notif.is_read) {
      await authFetch(`${API_BASE}/notifications/${notif.id}/read`, { method: 'PUT' })
      setUnreadCount((prev) => Math.max(0, prev - 1))
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
      )
    }
  }

  const handleMarkAllRead = async () => {
    await authFetch(`${API_BASE}/notifications/read-all`, { method: 'PUT' })
    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const notifContent = (
    <div style={{ width: 340, maxHeight: 400 }}>
      {notifications.length === 0 ? (
        <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '24px 0' }} />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--tech-border)' }}>
            <Typography.Text strong style={{ fontSize: 13 }}>通知</Typography.Text>
            {unreadCount > 0 && (
              <Button type="link" size="small" onClick={handleMarkAllRead} style={{ fontSize: 12 }}>
                全部标为已读
              </Button>
            )}
          </div>
          <List
            dataSource={notifications}
            renderItem={(item: any) => (
              <List.Item
                onClick={() => handleNotifClick(item)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  background: item.is_read ? 'transparent' : 'rgba(0, 212, 255, 0.04)',
                  borderLeft: item.is_read ? 'none' : '3px solid #00d4ff',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0, 212, 255, 0.06)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = item.is_read ? 'transparent' : 'rgba(0, 212, 255, 0.04)' }}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Typography.Text strong style={{ fontSize: 13, color: item.is_read ? 'var(--tech-text-secondary)' : 'var(--tech-text-primary)' }}>
                        {item.title}
                      </Typography.Text>
                      {!item.is_read && <Badge status="processing" color="#00d4ff" />}
                    </Space>
                  }
                  description={
                    <>
                      <Typography.Paragraph
                        ellipsis={{ rows: 2 }}
                        style={{ fontSize: 12, color: 'var(--tech-text-secondary)', margin: 0 }}
                      >
                        {item.content}
                      </Typography.Paragraph>
                      <Typography.Text style={{ fontSize: 11, color: 'var(--tech-text-tertiary)' }}>
                        {item.created_at}
                      </Typography.Text>
                    </>
                  }
                />
              </List.Item>
            )}
          />
        </>
      )}
    </div>
  )

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--tech-bg-primary)' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          height: 64,
          padding: '0 24px',
          background: 'var(--tech-bg-primary)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--tech-border)',
          boxShadow: 'var(--tech-shadow-md)',
        }}
      >
        {/* Logo */}
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            marginRight: 32,
            cursor: 'pointer',
          }}
          onClick={() => navigate('/dashboard')}
        >
          <div
            style={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0, 212, 255, 0.15)',
            }}
          >
            <RocketOutlined style={{ 
              fontSize: 20, 
              background: 'var(--tech-gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }} />
          </div>
          <Typography.Title
            level={4}
            style={{ 
              color: 'var(--tech-text-primary)', 
              margin: 0, 
              fontFamily: "'Space Grotesk', 'Noto Sans SC', sans-serif",
              fontWeight: 700,
              letterSpacing: 1,
              fontSize: 20,
            }}
          >
            智学助手
          </Typography.Title>
        </div>

        {/* 导航菜单 */}
        <Menu
          theme={isDark ? 'dark' : 'light'}
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="header-menu"
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            borderBottom: 'none',
            fontFamily: "'Noto Sans SC', sans-serif",
          }}
        />

        {/* 右侧用户区 */}
        {isAuthenticated && (
          <Space size={16} className="header-actions">
            {/* 通知铃铛 */}
            <Popover
              content={notifContent}
              trigger="click"
              open={notifOpen}
              onOpenChange={handleNotifOpen}
              placement="bottomRight"
              overlayStyle={{ paddingTop: 8 }}
            >
              <Badge count={unreadCount} size="small" offset={[-4, 4]} className="notif-badge">
                <Button
                  type="text"
                  className={`header-icon-action header-icon-action--notification${notifOpen ? ' is-active' : ''}`}
                  icon={unreadCount > 0 ? <BellFilled /> : <BellOutlined />}
                  title="查看通知"
                />
              </Badge>
            </Popover>

            {/* 用户头像 - 点击进入设置 */}
            <div
              className={`header-avatar-wrap${isPremium ? ' is-premium' : ''}`}
              onClick={() => navigate('/settings')}
              title={isPremium ? '会员用户' : '个人设置'}
            >
              <Avatar
                className="header-avatar"
                style={{
                  background: 'var(--tech-gradient-primary)',
                  cursor: 'pointer',
                }}
              >
                {username?.[0]?.toUpperCase() || 'U'}
              </Avatar>
              {isPremium ? (
                <span className="header-avatar-premium-badge" aria-hidden="true">
                  <CrownOutlined />
                </span>
              ) : null}
            </div>

            {/* 主题切换按钮 */}
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
              style={{
                color: isDark ? '#f59e0b' : '#4f46e5',
                fontSize: 18,
                transition: 'all 0.3s ease',
              }}
              title={isDark ? '切换到亮色模式' : '切换到深色模式'}
            />

            {/* 退出按钮 */}
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={() => { logout(); navigate('/login') }}
              style={{ 
                color: 'var(--tech-text-secondary)',
                fontSize: 18,
              }}
            />
          </Space>
        )}
      </Header>
      
      <Content className="content-area">
        <div key={location.pathname} className="page-transition">
          {children}
        </div>
      </Content>
    </Layout>
  )
}
