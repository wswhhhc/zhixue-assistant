import { Layout, Menu, Typography, Button, Space } from 'antd'
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
  SettingOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth'
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
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, username, logout } = useAuth()

  const selectedKey = '/' + location.pathname.split('/')[1]

  return (
    <Layout>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'linear-gradient(135deg, #0a0a2e 0%, #1a1a4e 50%, #2d1b69 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Typography.Title
          level={4}
          style={{ color: '#fff', margin: '0 24px 0 0', whiteSpace: 'nowrap', letterSpacing: 1 }}
        >
          智学助手
        </Typography.Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, minWidth: 0, background: 'transparent', borderBottom: 'none' }}
        />
        {isAuthenticated && (
          <Space>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>{username}</span>
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => navigate('/settings')}
              style={{ color: 'rgba(255,255,255,0.6)' }}
            />
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={() => { logout(); navigate('/login') }}
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              退出
            </Button>
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
