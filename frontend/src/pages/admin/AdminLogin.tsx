import { useState, useEffect, useRef, useMemo } from 'react'
import { Card, Form, Input, Button, Typography, message } from 'antd'
import { UserOutlined, LockOutlined, RocketOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { setAdminAuth } from '../../adminAuth'
import { API_BASE } from '../../config'
import '../Login.css'
import './AdminLogin.css'

const { Title, Text } = Typography

const MATH_SYMBOLS = [
  '∫', '∑', '√', 'π', '∞', '∂', '∇', 'Δ', 'Σ', 'θ',
  'λ', 'μ', 'α', 'β', 'γ', 'φ', 'ψ', 'ω', 'Ω', '∈',
]

const PARTICLE_CONFIG = {
  particleCount: 80,
  connectionDistance: 120,
  mouseDistance: 200,
  particleSize: 2,
  particleSpeed: 0.5,
}

export default function AdminLogin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  // 鼠标位置追踪
  const mouseRef = useRef({ x: 0, y: 0 })
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // Canvas 引用
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number; size: number; opacity: number
  }>>([])
  const animationRef = useRef<number | null>(null)
  const animationActiveRef = useRef(true)

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

  const resizeCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    initParticles(window.innerWidth, window.innerHeight)
  }

  const handleMouseMove = (e: MouseEvent) => {
    const x = e.clientX
    const y = e.clientY
    mouseRef.current = { x, y }
    const centerX = window.innerWidth / 2
    const centerY = window.innerHeight / 2
    setMousePosition({
      x: (x - centerX) / centerX,
      y: (y - centerY) / centerY,
    })
  }

  useEffect(() => {
    resizeCanvas()
    animationActiveRef.current = true

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const animate = () => {
      if (!animationActiveRef.current) return
      const width = canvas.width
      const height = canvas.height
      const particles = particlesRef.current
      const mouse = mouseRef.current

      ctx.clearRect(0, 0, width, height)

      particles.forEach((particle, i) => {
        const dx = mouse.x - particle.x
        const dy = mouse.y - particle.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < PARTICLE_CONFIG.mouseDistance) {
          const force = (PARTICLE_CONFIG.mouseDistance - distance) / PARTICLE_CONFIG.mouseDistance
          const angle = Math.atan2(dy, dx)
          particle.vx -= Math.cos(angle) * force * 0.5
          particle.vy -= Math.sin(angle) * force * 0.5
        }

        particle.x += particle.vx
        particle.y += particle.vy

        if (particle.x < 0 || particle.x > width) {
          particle.vx *= -1
          particle.x = Math.max(0, Math.min(width, particle.x))
        }
        if (particle.y < 0 || particle.y > height) {
          particle.vy *= -1
          particle.y = Math.max(0, Math.min(height, particle.y))
        }

        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(168, 85, 247, ${particle.opacity})`
        ctx.fill()

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
            ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

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

  const parallaxStyle = (depth: number) => ({
    transform: `translate(${mousePosition.x * depth}px, ${mousePosition.y * depth}px)`,
  })

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const res = await fetch(API_BASE + '/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        message.error(data.detail || '登录失败')
        return
      }
      setAdminAuth(data.token, data.username)
      message.success('登录成功')
      navigate('/admin/dashboard', { replace: true })
    } catch {
      message.error('网络错误，请检查服务器连接')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page admin-login-page">
      {/* Canvas 粒子网格背景 */}
      <canvas ref={canvasRef} className="particle-canvas" />

      {/* 网格叠加层 */}
      <div className="grid-overlay" />

      {/* 扫描线效果 */}
      <div className="scanline" />

      {/* 装饰性光球 - 视差效果 */}
      <div className="glow-orb glow-orb-1" style={parallaxStyle(-30)} />
      <div className="glow-orb glow-orb-2" style={parallaxStyle(-20)} />
      <div className="glow-orb glow-orb-3" style={parallaxStyle(-40)} />

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

      {/* 登录卡片 */}
      <Card
        className="glass-card admin-login-card"
        style={{
          width: 420,
        }}
      >
        <div className="brand-section">
          <div className="brand-icon-wrapper">
            <div className="brand-icon-inner">
              <RocketOutlined />
            </div>
          </div>
          <Title level={2} className="brand-title">
            智学助手
          </Title>
          <Text className="brand-slogan">管理后台</Text>
        </div>

        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入管理员用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="管理员用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
              className="login-btn admin-login-btn"
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12 }}>测试账号：admin / 123456</span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <a
            href="/login"
            onClick={(e) => { e.preventDefault(); navigate('/login') }}
            style={{ color: 'rgba(168, 85, 247, 0.7)', fontSize: 13, transition: 'color 0.3s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#a855f7' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(168, 85, 247, 0.7)' }}
          >
            ← 返回用户登录
          </a>
        </div>
      </Card>
    </div>
  )
}
