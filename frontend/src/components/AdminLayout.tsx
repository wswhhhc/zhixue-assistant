import { Layout, Menu, Typography, Button, Space } from 'antd'
import {
  DashboardOutlined,
  UserOutlined,
  DatabaseOutlined,
  GiftOutlined,
  WalletOutlined,
  LogoutOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
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

  const selectedKey = '/' + location.pathname.split('/').slice(1, 3).join('/')

  const handleLogout = () => {
    clearAdminAuth()
    navigate('/admin/login', { replace: true })
  }

  return (
    <Layout style={{ minHeight: '100vh', background: '#030712' }}>
      <Sider
        className="admin-sider"
        width={220}
        style={{
          background: 'rgba(15, 23, 42, 0.95)',
          borderRight: '1px solid rgba(0, 212, 255, 0.08)',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            borderBottom: '1px solid rgba(0, 212, 255, 0.08)',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/admin/dashboard')}
        >
          <div
            style={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RocketOutlined style={{ fontSize: 16, color: '#00d4ff' }} />
          </div>
          <Typography.Text
            style={{
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            管理后台
          </Typography.Text>
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            borderRight: 'none',
            marginTop: 8,
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
            borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography.Text style={{ color: 'rgba(148, 163, 184, 0.8)', fontSize: 14 }}>
            智学助手 · 管理后台
          </Typography.Text>
          <Space size={12}>
            <Typography.Text style={{ color: '#00d4ff', fontSize: 14 }}>
              {auth?.username || '管理员'}
            </Typography.Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              style={{ color: 'rgba(148, 163, 184, 0.8)' }}
            >
              退出
            </Button>
          </Space>
        </Header>

        <Content className="content-area" style={{ minHeight: 'calc(100vh - 56px)' }}>
          <div key={location.pathname} className="page-transition" style={{ padding: 24 }}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
