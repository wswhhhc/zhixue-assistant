import { Layout, Menu, Typography, Button, Space, Avatar } from 'antd'
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
} from '@ant-design/icons'
import { useAuth } from '../auth'
import { useTheme } from '../contexts/ThemeContext'
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
          <Space size={16}>
            {/* 会员状态 */}
            {isPremium ? (
              <div
              style={{
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <CrownOutlined style={{ color: '#fbbf24', fontSize: 18, filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.5))' }} />
            </div>
            ) : selectedKey !== '/membership' ? (
              <Button
                className="upgrade-membership-button"
                type="text"
                icon={<CrownOutlined />}
                onClick={() => navigate('/membership')}
                style={{ 
                  color: '#f59e0b',
                  fontSize: 14,
                  fontWeight: 500,
                  padding: '4px 12px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 20,
                  background: 'rgba(245, 158, 11, 0.05)',
                }}
              >
                升级会员
              </Button>
            ) : null}

            {/* 用户头像 - 点击进入设置 */}
            <Avatar 
              style={{ 
                background: 'var(--tech-gradient-primary)',
                cursor: 'pointer',
              }}
              onClick={() => navigate('/settings')}
            >
              {username?.[0]?.toUpperCase() || 'U'}
            </Avatar>

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
