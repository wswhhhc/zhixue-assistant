import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, Typography, message } from 'antd'
import { UserOutlined, MailOutlined, LockOutlined } from '@ant-design/icons'
import './Settings.css'
import { API_BASE } from '../config'
import { authFetch, useAuth } from '../auth'

const { Title } = Typography

export default function Settings() {
  const { updateProfile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [pwdLoading, setPwdLoading] = useState(false)
  const [passwordForm] = Form.useForm()
  const [profileForm] = Form.useForm()

  useEffect(() => {
    authFetch(`${API_BASE}/auth/me`)
      .then((res) => res.json())
      .then((data) => {
        profileForm.setFieldsValue({ username: data.username, email: data.email })
      })
      .catch(() => message.error('获取用户信息失败'))
  }, [profileForm])

  const handleUpdateProfile = async (values: { username: string; email: string }) => {
    setLoading(true)
    try {
      const res = await authFetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        message.error(data.detail || '更新失败')
        return
      }
      message.success('个人信息已更新')
      updateProfile({ username: data.username })
      profileForm.setFieldsValue({ username: data.username, email: data.email })
    } catch {
      message.error('更新失败')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (values: {
    old_password: string
    new_password: string
    confirm: string
  }) => {
    if (values.new_password !== values.confirm) {
      message.error('两次密码输入不一致')
      return
    }
    setPwdLoading(true)
    try {
      const res = await authFetch(`${API_BASE}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          old_password: values.old_password,
          new_password: values.new_password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        message.error(data.detail || '修改失败')
        return
      }
      message.success('密码已修改')
      passwordForm.resetFields()
    } catch {
      message.error('修改失败')
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <div className="settings-page">
      <Title level={4} className="settings-title">账号设置</Title>

      <Card title="个人信息" className="settings-card settings-card-gap">
        <Form
          form={profileForm}
          layout="vertical"
          onFinish={handleUpdateProfile}
          initialValues={{ username: '', email: '' }}
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
          >
            <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              保存修改
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="修改密码">
        <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
          <Form.Item
            name="old_password"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="原密码" size="large" />
          </Form.Item>
          <Form.Item
            name="new_password"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="新密码" size="large" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="确认新密码"
            rules={[{ required: true, message: '请再次输入新密码' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" size="large" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={pwdLoading} size="large">
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
