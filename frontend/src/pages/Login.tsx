import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Typography, message, Tabs, Checkbox, Image } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, RobotOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { API_BASE } from '../config'
import { useAuth } from '../auth'
import './Login.css'

const { Title, Text } = Typography

const MATH_SYMBOLS = [
  '∫', '∑', '√', 'π', '∞',
  '∂', '∇', 'Δ', 'Σ', 'θ',
  'λ', 'μ', 'α', 'β', 'γ',
]

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [loginLoading, setLoginLoading] = useState(false)
  const [registerLoading, setRegisterLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('login')
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailCountdown, setEmailCountdown] = useState(0)
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('remembered_username'))
  const [success, setSuccess] = useState(false)
  const [successUsername, setSuccessUsername] = useState('')
  const countdownRef = useRef<ReturnType<typeof setInterval>>()
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()

  const particles = useMemo(() =>
    MATH_SYMBOLS.flatMap(s => [s, s, s]).map((sym, i) => {
      const angle = (i / (MATH_SYMBOLS.length * 3)) * 360
      const dist = 180 + Math.random() * 220
      return {
        symbol: sym,
        x: Math.cos((angle * Math.PI) / 180) * dist,
        y: Math.sin((angle * Math.PI) / 180) * dist,
        rot: (Math.random() - 0.5) * 1080,
        delay: i * 0.02,
        size: 20 + Math.random() * 28,
      }
    }),
  [])

  // Pre-fill remembered username
  useEffect(() => {
    const saved = localStorage.getItem('remembered_username')
    if (saved) {
      loginForm.setFieldsValue({ username: saved })
    }
  }, [loginForm])

  const sendEmailCode = async (email: string) => {
    if (!email) {
      message.error('请先输入邮箱')
      return
    }
    setEmailSending(true)
    try {
      const res = await fetch(`${API_BASE}/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.status !== 200) {
        message.error(data.detail || '发送失败')
        return
      }
      message.success('验证码已发送')
      setEmailCountdown(60)
      countdownRef.current = setInterval(() => {
        setEmailCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current)
            return 0
          }
          return c - 1
        })
      }, 1000)
    } catch {
      message.error('发送失败，请检查后端是否运行')
    } finally {
      setEmailSending(false)
    }
  }

  useEffect(() => {
    return () => clearInterval(countdownRef.current)
  }, [])

  const fetchCaptcha = useCallback(async (showMessage = false) => {
    setCaptchaLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/captcha`)
      const data = await res.json()
      setCaptchaId(data.captcha_id)
      setCaptchaImage(`data:image/png;base64,${data.image_base64}`)
      if (showMessage) message.success('验证码已刷新')
    } catch {
      message.error('验证码加载失败')
    } finally {
      setCaptchaLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'login') fetchCaptcha()
  }, [activeTab, fetchCaptcha])

  useEffect(() => {
    if (activeTab === 'login') fetchCaptcha()
  }, [activeTab, fetchCaptcha])

  const handleLogin = async (values: {
    username: string
    password: string
    captcha_code: string
  }) => {
    if (!captchaId || !values.captcha_code) {
      message.error('请完成验证码')
      return
    }
    setLoginLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, captcha_id: captchaId }),
      })
      const data = await res.json()
      if (res.status !== 200) {
        message.error(data.detail || '登录失败')
        fetchCaptcha()
        return
      }
      if (rememberMe) {
        localStorage.setItem('remembered_username', values.username)
      } else {
        localStorage.removeItem('remembered_username')
      }

      login(data.token, data.user_id, data.username)
      setSuccessUsername(data.username)
      setSuccess(true)
      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 2500)
    } catch {
      message.error('登录失败，请检查后端是否运行')
    } finally {
      setLoginLoading(false)
    }
  }

  const handleRegister = async (values: {
    username: string
    email: string
    password: string
    email_code: string
  }) => {
    if (!values.email_code) {
      message.error('请先获取邮箱验证码')
      return
    }
    setRegisterLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (res.status !== 200) {
        message.error(data.detail || '注册失败')
        return
      }
      login(data.token, data.user_id, data.username)
      setSuccessUsername(data.username)
      setSuccess(true)
      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 2500)
    } catch {
      message.error('注册失败，请检查后端是否运行')
    } finally {
      setRegisterLoading(false)
    }
  }

  const loginFormEl = (
    <Form
      key="login"
      form={loginForm}
      layout="vertical"
      onFinish={handleLogin}
      autoComplete="off"
      requiredMark={false}
    >
      <Form.Item
        name="username"
        rules={[{ required: true, message: '请输入用户名或邮箱' }]}
      >
        <Input prefix={<UserOutlined />} placeholder="用户名或邮箱" size="large" />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
      </Form.Item>
      <Form.Item style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div
            onClick={captchaLoading || !captchaImage ? undefined : () => fetchCaptcha(true)}
            style={{ position: 'relative', flexShrink: 0, cursor: (captchaLoading || !captchaImage) ? 'not-allowed' : 'pointer', minWidth: 130, height: 48, background: 'rgba(255,255,255,0.05)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            {captchaImage ? (
              <>
                <Image
                  src={captchaImage}
                  alt="验证码"
                  preview={false}
                  style={{
                    height: 48,
                    borderRadius: 8,
                    display: 'block',
                    border: '1px solid rgba(255,255,255,0.1)',
                    opacity: captchaLoading ? 0.5 : 1,
                  }}
                />
                <ReloadOutlined
                  spin={captchaLoading}
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    color: '#fff',
                    fontSize: 12,
                    background: 'rgba(0,0,0,0.45)',
                    borderRadius: 10,
                    padding: 3,
                    cursor: 'pointer',
                  }}
                />
              </>
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                {captchaLoading ? '加载中...' : '点击刷新'}
              </span>
            )}
          </div>
          <Form.Item name="captcha_code" rules={[{ required: true, message: '请输入验证码' }]} noStyle>
            <Input
              prefix={<SafetyCertificateOutlined />}
              placeholder="验证码"
              size="large"
              maxLength={4}
              style={{ flex: 1 }}
            />
          </Form.Item>
        </div>
      </Form.Item>
      <Form.Item>
        <Checkbox checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={{ color: 'rgba(255,255,255,0.55)' }}>
          记住我
        </Checkbox>
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loginLoading}
          block
          size="large"
          className="login-btn"
        >
          登录
        </Button>
      </Form.Item>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: -8 }}>
        测试账号：wsw / 123456
      </div>
    </Form>
  )

  const registerFormEl = (
    <Form
      key="register"
      form={registerForm}
      layout="vertical"
      onFinish={handleRegister}
      autoComplete="off"
      requiredMark={false}
    >
      <Form.Item
        name="username"
        rules={[{ required: true, message: '请输入用户名' }]}
      >
        <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
      </Form.Item>
      <Form.Item
        name="email"
        rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <Form.Item name="email" noStyle>
            <Input prefix={<MailOutlined />} placeholder="邮箱" size="large" style={{ flex: 1 }} />
          </Form.Item>
          <Button
            size="large"
            loading={emailSending}
            disabled={emailCountdown > 0}
            onClick={() => {
              const email = registerForm.getFieldValue('email')
              sendEmailCode(email || '')
            }}
            style={{
              borderRadius: 10,
              flexShrink: 0,
              background: emailCountdown > 0 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none',
              color: emailCountdown > 0 ? 'rgba(255,255,255,0.3)' : '#fff',
              height: 48,
              minWidth: 120,
            }}
          >
            {emailCountdown > 0 ? `${emailCountdown}s` : '发送验证码'}
          </Button>
        </div>
      </Form.Item>
      <Form.Item
        name="email_code"
        rules={[{ required: true, message: '请输入邮箱验证码' }]}
      >
        <Input
          prefix={<SafetyCertificateOutlined />}
          placeholder="邮箱验证码"
          size="large"
          maxLength={6}
          style={{ letterSpacing: 8, fontWeight: 600 }}
        />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[
          { required: true, message: '请输入密码' },
          { min: 6, message: '密码至少 6 位' },
        ]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={registerLoading}
          block
          size="large"
          className="login-btn"
        >
          注册
        </Button>
      </Form.Item>
    </Form>
  )

  return (
    <div className="login-page">
      {/* Floating math symbols background */}
      {MATH_SYMBOLS.map((sym, i) => (
        <span
          key={i}
          className="math-symbol"
          style={{
            top: `${5 + (i * 6.5) % 90}%`,
            left: `${2 + (i * 9) % 92}%`,
            fontSize: `${42 + (i * 7) % 52}px`,
            animationDelay: `-${i * 2.2}s`,
            animationDuration: `${16 + (i % 7) * 2}s`,
          }}
        >
          {sym}
        </span>
      ))}

      {/* Decorative blobs */}
      <div className="deco-blob deco-blob-1" />
      <div className="deco-blob deco-blob-2" />
      <div className="deco-blob deco-blob-3" />

      {/* Success overlay with particles */}
      {success && (
        <div className="success-overlay">
          <div className="success-particles">
            {particles.map((p, i) => (
              <span
                key={i}
                className="success-particle"
                style={{
                  '--x': `${p.x}px`,
                  '--y': `${p.y}px`,
                  '--rot': `${p.rot}deg`,
                  fontSize: p.size,
                  animationDelay: `${p.delay}s`,
                } as React.CSSProperties}
              >
                {p.symbol}
              </span>
            ))}
          </div>
          <div className="success-welcome">
            <div className="success-welcome-icon">✓</div>
            <div className="success-welcome-text">欢迎回来</div>
            <div className="success-welcome-name">{successUsername}</div>
          </div>
        </div>
      )}

      {/* Glass card */}
      <div className={`glass-card ${success ? 'glass-card-exit' : ''}`}>
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <RobotOutlined />
          </div>
          <Title level={2} className="brand-title">
            智学助手
          </Title>
          <Text className="brand-slogan">AI 驱动的高数学习伴侣</Text>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key)
            setLoginLoading(false)
            setRegisterLoading(false)
          }}
          centered
          items={[
            { key: 'login', label: '登录', children: loginFormEl },
            { key: 'register', label: '注册', children: registerFormEl },
          ]}
        />
      </div>
    </div>
  )
}
