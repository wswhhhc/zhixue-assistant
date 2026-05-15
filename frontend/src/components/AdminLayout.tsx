import { Layout, Menu, Typography, Button, Space } from 'antd'
import {
  DashboardOutlined,
  UserOutlined,
  DatabaseOutlined,
  GiftOutlined,
  WalletOutlined,
  LogoutOutlined,
  RocketOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { getAdminAuth, clearAdminAuth } from '../adminAuth'
import { useTheme } from '../contexts/ThemeContext'
import './AppLayout.css'
import './AdminLayout.css'

const { Header, Sider, Content } = Layout

const menuItems = [
  { key: '/admin/dashboard', label: '仪表盘', icon: <DashboardOutlined /> },
  { key: '/admin/users', label: '用户管理', icon: <UserOutlined /> },
  { key: '/admin/questions', label: '题库管理', icon: <DatabaseOutlined /> },
  { key: '/admin/codes', label: '兑换码', icon: <GiftOutlined /> },
  { key: '/admin/payments', label: '支付订单', icon: <WalletOutlined /> },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = getAdminAuth()
  const [collapsed, setCollapsed] = useState(false)
  const { isDark, toggleTheme } = useTheme()

  const selectedKey = '/' + location.pathname.split('/').slice(1, 3).join('/')

  const handleLogout = () => {
    clearAdminAuth()
    navigate('/admin/login', { replace: true })
  }

  const toggleCollapsed = () => {
    setCollapsed(!collapsed)
  }

  return (
    <Layout style={{ minHeight: '100vh', background: 'var(--tech-bg-primary)' }}>
      <Sider
        className={`admin-sider ${collapsed ? 'admin-sider-collapsed' : ''}`}
        width={collapsed ? 80 : 240}
        style={{
          background: 'var(--tech-gradient-dark)',
          borderRight: '1px solid var(--tech-border)',
          boxShadow: 'var(--tech-shadow-md)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* 折叠切换按钮 - 和谐设计 */}
        <div
          className="sider-toggle-btn"
          onClick={toggleCollapsed}
          style={{
            position: 'absolute',
            bottom: 24,
            left: collapsed ? '50%' : 20,
            right: collapsed ? undefined : 20,
            width: collapsed ? 36 : 'auto',
            height: 36,
            background: 'var(--tech-bg-tertiary)',
            border: '1px solid var(--tech-border)',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 100,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(8px)',
            padding: collapsed ? 0 : '0 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8 }}>
            {collapsed ? (
              <MenuUnfoldOutlined style={{ fontSize: 14, color: 'var(--tech-accent-purple)' }} />
            ) : (
              <>
                <MenuFoldOutlined style={{ fontSize: 14, color: 'var(--tech-accent-purple)' }} />
                <span style={{ 
                  fontSize: 12, 
                  color: 'var(--tech-accent-purple)',
                  fontFamily: "'Noto Sans SC', sans-serif",
                  whiteSpace: 'nowrap',
                  opacity: 0.7,
                }}>
                  收起菜单
                </span>
              </>
            )}
          </div>
        </div>

        <div
          className="admin-logo"
          style={{
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? 0 : 12,
            borderBottom: '1px solid var(--tech-border)',
            cursor: 'pointer',
            padding: collapsed ? '0' : '0 20px',
            transition: 'all 0.3s ease',
          }}
          onClick={() => navigate('/admin/dashboard')}
        >
          <div
            className="admin-logo-icon"
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              flexShrink: 0,
            }}
          >
            <RocketOutlined style={{ fontSize: 20 }} />
          </div>
          {!collapsed && (
            <Typography.Text
              style={{
                color: 'var(--tech-text-primary)',
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: 1,
                fontFamily: "'Space Grotesk', 'Noto Sans SC', sans-serif",
                transition: 'all 0.3s ease',
              }}
            >
              管理后台
            </Typography.Text>
          )}
        </div>

        <Menu
          theme={isDark ? 'dark' : 'light'}
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            borderRight: 'none',
            marginTop: 16,
            padding: collapsed ? '0' : '0 4px',
            transition: 'all 0.3s ease',
          }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            height: 56,
            padding: '0 24px',
            background: 'var(--tech-bg-primary)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--tech-border)',
            boxShadow: 'var(--tech-shadow-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Text style={{ 
            color: 'var(--tech-text-secondary)', 
            fontSize: 14,
            fontFamily: "'Noto Sans SC', sans-serif",
          }}>
            智学助手 · 管理后台
          </Typography.Text>
          <Space size={16}>
            <Typography.Text style={{ 
              color: 'var(--tech-accent-purple)', 
              fontSize: 14,
              fontWeight: 600,
              textShadow: isDark 
                ? '0 0 12px rgba(168, 85, 247, 0.3)' 
                : '0 0 8px rgba(124, 58, 237, 0.2)',
            }}>
              {auth?.username || '管理员'}
            </Typography.Text>

            {/* 主题切换按钮 */}
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleTheme}
              style={{
                color: isDark ? '#f59e0b' : 'var(--tech-accent-purple)',
                fontSize: 18,
                transition: 'all 0.3s ease',
              }}
              title={isDark ? '切换到亮色模式' : '切换到深色模式'}
            />

            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ 
                color: 'var(--tech-text-secondary)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = isDark ? '#a855f7' : '#7c3aed';
                e.currentTarget.style.textShadow = isDark 
                  ? '0 0 8px rgba(168, 85, 247, 0.4)' 
                  : '0 0 6px rgba(124, 58, 237, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--tech-text-secondary)';
                e.currentTarget.style.textShadow = 'none';
              }}
            >
              退出
            </Button>
          </Space>
        </Header>

        <Content className="admin-content-area" style={{ minHeight: 'calc(100vh - 56px)' }}>
          <div key={location.pathname} className="page-transition" style={{ padding: 24 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
