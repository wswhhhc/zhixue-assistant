import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Typography, message, Tabs, Checkbox, Image } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined, RocketOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons'
import { API_BASE } from '../config'
import { useAuth } from '../auth'
import { useTheme } from '../contexts/ThemeContext'
import './Login.css'

const { Title, Text } = Typography

// 数学符号用于背景装饰
const MATH_SYMBOLS = [
  '∫', '∑', '√', 'π', '∞', '∂', '∇', 'Δ', 'Σ', 'θ',
  'λ', 'μ', 'α', 'β', 'γ', 'φ', 'ψ', 'ω', 'Ω', '∈',
]

// 粒子网格配置
const PARTICLE_CONFIG = {
  particleCount: 80,
  connectionDistance: 120,
  mouseDistance: 200,
  particleSize: 2,
  particleSpeed: 0.5,
}

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { isDark, toggleTheme } = useTheme()
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
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [loginForm] = Form.useForm()
  const [registerForm] = Form.useForm()

  // 鼠标位置追踪
  const mouseRef = useRef({ x: 0, y: 0 })
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // Canvas 引用
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Array<{
    x: number
    y: number
    vx: number
    vy: number
    size: number
    opacity: number
  }>>([])
  const animationRef = useRef<number | null>(null)
  const animationActiveRef = useRef(true)

  // 粒子初始化
  const initParticles = (width: number, height: number) => {
    const particles = []
    for (let i = 0; i < PARTICLE_CONFIG.particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * PARTICLE_CONFIG.particleSpeed,
        vy: (Math.random() - 0.5) * PARTICLE_CONFIG.particleSpeed,
        size: Math.random() * PARTICLE_CONFIG.particleSize + 1,
        opacity: Math.random() * 0.5 + 0.2,
      })
    }
    particlesRef.current = particles
  }

  // 设置Canvas尺寸
  const resizeCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    initParticles(window.innerWidth, window.innerHeight)
  }

  // 鼠标移动处理
  const handleMouseMove = (e: MouseEvent) => {
    const x = e.clientX
    const y = e.clientY
    mouseRef.current = { x, y }
    
    // 计算相对于屏幕中心的偏移量（用于视差效果）
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    setMousePosition({
      x: (x - centerX) / centerX,
      y: (y - centerY) / centerY,
    })
  }

  // 初始化动画循环
  useEffect(() => {
    resizeCanvas()
    animationActiveRef.current = true
    
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 动画循环函数
    const animate = () => {
      if (!animationActiveRef.current) return
      
      const width = canvas.width
      const height = canvas.height
      const particles = particlesRef.current
      const mouse = mouseRef.current

      ctx.clearRect(0, 0, width, height)

      // 更新和绘制粒子
      particles.forEach((particle, i) => {
        // 鼠标排斥效果
        const dx = mouse.x - particle.x
        const dy = mouse.y - particle.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        
        if (distance < PARTICLE_CONFIG.mouseDistance) {
          const force = (PARTICLE_CONFIG.mouseDistance - distance) / PARTICLE_CONFIG.mouseDistance
          const angle = Math.atan2(dy, dx)
          particle.vx -= Math.cos(angle) * force * 0.5
          particle.vy -= Math.sin(angle) * force * 0.5
        }

        // 更新位置
        particle.x += particle.vx
        particle.y += particle.vy

        // 边界反弹
        if (particle.x < 0 || particle.x > width) {
          particle.vx *= -1
          particle.x = Math.max(0, Math.min(width, particle.x))
        }
        if (particle.y < 0 || particle.y > height) {
          particle.vy *= -1
          particle.y = Math.max(0, Math.min(height, particle.y))
        }

        // 绘制粒子
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(0, 212, 255, ${particle.opacity})`
        ctx.fill()

        // 绘制连接线
        for (let j = i + 1; j < particles.length; j++) {
          const other = particles[j]
          const lineDx = particle.x - other.x
          const lineDy = particle.y - other.y
          const lineDistance = Math.sqrt(lineDx * lineDx + lineDy * lineDy)

          if (lineDistance < PARTICLE_CONFIG.connectionDistance) {
            const opacity = (1 - lineDistance / PARTICLE_CONFIG.connectionDistance) * 0.3
            ctx.beginPath()
            ctx.moveTo(particle.x, particle.y)
            ctx.lineTo(other.x, other.y)
            ctx.strokeStyle = `rgba(0, 212, 255, ${opacity})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }
    
    // 启动动画
    animationRef.current = requestAnimationFrame(animate)
    
    window.addEventListener('resize', resizeCanvas)
    window.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      animationActiveRef.current = false
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])

  // 预填充记住的用户名
  useEffect(() => {
    const saved = localStorage.getItem('remembered_username')
    if (saved) {
      loginForm.setFieldsValue({ username: saved })
    }
  }, [loginForm])

  // 发送邮箱验证码
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
      const intervalId = setInterval(() => {
        setEmailCountdown((c) => {
          if (c <= 1) {
            clearInterval(intervalId)
            return 0
          }
          return c - 1
        })
      }, 1000)
      countdownRef.current = intervalId
    } catch {
      message.error('发送失败，请稍后重试')
    } finally {
      setEmailSending(false)
    }
  }

  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
    }
  }, [])

  // 验证码刷新
  const fetchCaptcha = async (showMessage = false) => {
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
  }

  useEffect(() => {
    if (activeTab === 'login') fetchCaptcha()
  }, [activeTab])

  // 登录处理
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
        if (data.detail === "管理员请使用管理后台登录入口") {
          message.error('管理员请前往 /admin/login 登录管理后台')
        } else {
          message.error(data.detail || '登录失败')
        }
        fetchCaptcha()
        return
      }
      if (rememberMe) {
        localStorage.setItem('remembered_username', values.username)
      } else {
        localStorage.removeItem('remembered_username')
      }

      login(data.token, data.user_id, data.username, data.membership, data.member_expires)
      setSuccessUsername(data.username)
      setSuccess(true)
      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 2500)
    } catch {
      message.error('登录失败，请稍后重试')
    } finally {
      setLoginLoading(false)
    }
  }

  // 注册处理
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
      login(data.token, data.user_id, data.username, data.membership, data.member_expires)
      setSuccessUsername(data.username)
      setSuccess(true)
      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 2500)
    } catch {
      message.error('注册失败，请稍后重试')
    } finally {
      setRegisterLoading(false)
    }
  }

  // 成功登录的粒子效果
  const successParticles = useMemo(() =>
    MATH_SYMBOLS.flatMap(s => [s, s]).map((sym, i) => ({
      symbol: sym,
      x: Math.cos((i / 40) * Math.PI * 2) * (200 + Math.random() * 150),
      y: Math.sin((i / 40) * Math.PI * 2) * (200 + Math.random() * 150),
      rot: (Math.random() - 0.5) * 720,
      delay: i * 0.02,
      size: 16 + Math.random() * 24,
    })),
  [])

  // 计算视差偏移
  const parallaxStyle = (depth: number) => ({
    transform: `translate(${mousePosition.x * depth}px, ${mousePosition.y * depth}px)`,
  })

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
        <Input 
          prefix={<UserOutlined />} 
          placeholder="用户名或邮箱" 
          size="large" 
        />
      </Form.Item>
      <Form.Item
        name="password"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password 
          prefix={<LockOutlined />} 
          placeholder="密码" 
          size="large" 
        />
      </Form.Item>
      <Form.Item style={{ marginBottom: 16 }}>
        <div className="captcha-container">
          <div
            onClick={captchaLoading || !captchaImage ? undefined : () => fetchCaptcha(true)}
            className="captcha-image-wrapper"
          >
            {captchaImage ? (
              <>
                <Image
                  src={captchaImage}
                  alt="验证码"
                  preview={false}
                  style={{
                    height: 48,
                    display: 'block',
                    opacity: captchaLoading ? 0.5 : 1,
                  }}
                />
                <div className="captcha-refresh-icon">
                  <SafetyCertificateOutlined />
                </div>
              </>
            ) : (
              <span style={{ color: 'rgba(148, 163, 184, 0.5)', fontSize: 13 }}>
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
      <Form.Item style={{ marginBottom: 16 }}>
        <Checkbox 
          checked={rememberMe} 
          onChange={e => setRememberMe(e.target.checked)}
        >
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
          登 录
        </Button>
      </Form.Item>
      <div className="test-account-hint">
        测试账号：<span>wsw / 123456</span>
      </div>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <a
          href="/admin/login"
          onClick={(e) => { e.preventDefault(); navigate('/admin/login') }}
          style={{
            color: 'rgba(0, 212, 255, 0.6)',
            fontSize: 13,
            transition: 'color 0.3s',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#00d4ff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(0, 212, 255, 0.6)'}
        >
          管理员登录 →
        </a>
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
        <div style={{ display: 'flex', gap: 10 }}>
          <Form.Item name="email" noStyle>
            <Input 
              prefix={<MailOutlined />} 
              placeholder="邮箱" 
              size="large" 
              style={{ flex: 1 }} 
            />
          </Form.Item>
          <Button
            size="large"
            loading={emailSending}
            disabled={emailCountdown > 0}
            onClick={() => {
              const email = registerForm.getFieldValue('email')
              sendEmailCode(email || '')
            }}
            className="send-code-btn"
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
          style={{ letterSpacing: 8, fontWeight: 500 }}
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
          注 册
        </Button>
      </Form.Item>
    </Form>
  )

  return (
    <div className="login-page">
      {/* Canvas 粒子网格背景 */}
      <canvas 
        ref={canvasRef} 
        className="particle-canvas"
      />

      {/* 网格叠加层 */}
      <div className="grid-overlay" />

      {/* 扫描线效果 */}
      <div className="scanline" />

      {/* 装饰性光球 - 视差效果 */}
      <div 
        className="glow-orb glow-orb-1" 
        style={parallaxStyle(-30)}
      />
      <div 
        className="glow-orb glow-orb-2" 
        style={parallaxStyle(-20)}
      />
      <div 
        className="glow-orb glow-orb-3" 
        style={parallaxStyle(-40)}
      />

      {/* 数学符号浮动 - 视差效果 */}
      {MATH_SYMBOLS.map((sym, i) => (
        <span
          key={i}
          className="math-symbol-float"
          style={{
            top: `${5 + (i * 5) % 90}%`,
            left: `${3 + (i * 7) % 92}%`,
            fontSize: `${36 + (i * 4) % 48}px`,
            animationDelay: `-${i * 0.5}s`,
            animationDuration: `${12 + (i % 5) * 3}s`,
            ...parallaxStyle(-10 - (i % 3) * 10),
          }}
        >
          {sym}
        </span>
      ))}

      {/* 成功登录覆盖层 */}
      {success && (
        <div className="success-overlay">
          <div className="success-particles">
            {successParticles.map((p, i) => (
              <span
                key={i}
                className="success-particle"
                style={{
                  '--x': `${p.x}px`,
                  '--y': `${p.y}px`,
                  '--rot': `${p.rot}deg`,
                  fontSize: p.size,
                  animationDelay: `${p.delay}s`,
                  top: '50%',
                  left: '50%',
                } as React.CSSProperties}
              >
                {p.symbol}
              </span>
            ))}
          </div>
          <div className="success-content">
            <div className="success-icon">
              <span>✓</span>
            </div>
            <div className="success-title">欢迎回来</div>
            <div className="success-username">{successUsername}</div>
          </div>
        </div>
      )}

      {/* 登录卡片 */}
      <div
        className={`glass-card ${success ? 'glass-card-exit' : ''}`}
      >
        {/* 主题切换按钮 */}
        <Button
          type="text"
          icon={isDark ? <SunOutlined /> : <MoonOutlined />}
          onClick={toggleTheme}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            color: isDark ? '#f59e0b' : '#4f46e5',
            fontSize: 18,
            transition: 'all 0.3s ease',
            zIndex: 100,
          }}
          title={isDark ? '切换到亮色模式' : '切换到深色模式'}
        />
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <div className="brand-icon-inner">
              <RocketOutlined />
            </div>
          </div>
          <Title level={2} className="brand-title">
            智学助手
          </Title>
          <Text className="brand-slogan">智能学习 · 自适应提升</Text>
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
