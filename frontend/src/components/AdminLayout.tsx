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
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { getAdminAuth, clearAdminAuth } from '../adminAuth'
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

  const selectedKey = '/' + location.pathname.split('/').slice(1, 3).join('/')

  const handleLogout = () => {
    clearAdminAuth()
    navigate('/admin/login', { replace: true })
  }

  const toggleCollapsed = () => {
    setCollapsed(!collapsed)
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#030712' }}>
      <Sider
        className={`admin-sider ${collapsed ? 'admin-sider-collapsed' : ''}`}
        width={collapsed ? 80 : 240}
        style={{
          background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(17, 24, 39, 0.98) 100%)',
          borderRight: '1px solid rgba(168, 85, 247, 0.1)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.4)',
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
            background: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.15)',
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
              <MenuUnfoldOutlined style={{ fontSize: 14, color: 'rgba(168, 85, 247, 0.8)' }} />
            ) : (
              <>
                <MenuFoldOutlined style={{ fontSize: 14, color: 'rgba(168, 85, 247, 0.8)' }} />
                <span style={{ 
                  fontSize: 12, 
                  color: 'rgba(168, 85, 247, 0.6)',
                  fontFamily: "'Noto Sans SC', sans-serif",
                  whiteSpace: 'nowrap',
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
            borderBottom: '1px solid rgba(168, 85, 247, 0.15)',
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
                color: '#fff',
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
          theme="dark"
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
            background: 'rgba(3, 7, 18, 0.95)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(168, 85, 247, 0.1)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Text style={{ 
            color: 'rgba(148, 163, 184, 0.8)', 
            fontSize: 14,
            fontFamily: "'Noto Sans SC', sans-serif",
          }}>
            智学助手 · 管理后台
          </Typography.Text>
          <Space size={16}>
            <Typography.Text style={{ 
              color: '#a855f7', 
              fontSize: 14,
              fontWeight: 600,
              textShadow: '0 0 12px rgba(168, 85, 247, 0.3)',
            }}>
              {auth?.username || '管理员'}
            </Typography.Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ 
                color: 'rgba(148, 163, 184, 0.8)',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#a855f7';
                e.currentTarget.style.textShadow = '0 0 8px rgba(168, 85, 247, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(148, 163, 184, 0.8)';
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
