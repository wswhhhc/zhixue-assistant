import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Card, Tag, Button, Input, message, Typography, Modal, Spin,
} from 'antd'
import { CrownOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'
import { QRCodeSVG } from 'qrcode.react'
import { API_BASE } from '../config'
import { authFetch, useAuth } from '../auth'
import './Membership.css'

const { Text } = Typography

const QUOTA_LABELS: Record<string, string> = {
  qa_ask: 'AI 问答',
  report_gen: '学习报告',
  upload_image: '图片上传',
  gen_similar: '相似题生成',
}

const BENEFITS = [
  { label: 'AI 数学问答', free: '10 次/天', premium: '无限制' },
  { label: 'AI 学习报告', free: '1 次/天', premium: '无限制' },
  { label: '拍照上传题目', free: '3 次/天', premium: '无限制' },
  { label: 'AI 生成相似题', free: '3 次/天', premium: '无限制' },
  { label: '刷题练习', free: '无限制', premium: '无限制' },
  { label: '错题本 / 题库', free: '无限制', premium: '无限制' },
]

const PLANS = [
  { days: 30, label: '30天', price: 29.90, tag: '推荐' },
  { days: 365, label: '365天', price: 299.00, tag: '最值' },
]

export default function Membership() {
  const { membership, member_expires, isPremium, updateMembership } = useAuth()
  const navigate = useNavigate()
  const [quotas, setQuotas] = useState<Record<string, { used: number; limit: number }> | null>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)

  // 支付状态
  const [orderData, setOrderData] = useState<{ order_no: string; amount: number; confirm_key: string } | null>(null)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrStatus, setQrStatus] = useState<'waiting' | 'paid' | 'error'>('waiting')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    authFetch(`${API_BASE}/membership/status`)
      .then((r) => r.json())
      .then((data) => setQuotas(data.quotas || {}))
      .catch(() => {})
  }, [])

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleRedeem = async () => {
    if (!redeemCode.trim()) {
      message.warning('请输入兑换码')
      return
    }
    setRedeeming(true)
    try {
      const res = await authFetch(`${API_BASE}/membership/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: redeemCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        message.error(data.detail || '兑换失败')
        return
      }
      message.success(data.message || '兑换成功！')
      updateMembership(data.membership, data.member_expires)
      setRedeemCode('')
      const statusRes = await authFetch(`${API_BASE}/membership/status`)
      const statusData = await statusRes.json()
      setQuotas(statusData.quotas || {})
    } catch {
      message.error('兑换失败，请重试')
    } finally {
      setRedeeming(false)
    }
  }

  const handleBuy = async (durationDays: number) => {
    try {
      const res = await authFetch(`${API_BASE}/payment/create-order?duration_days=${durationDays}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        message.error(data.detail || '创建订单失败')
        return
      }
      setOrderData(data)
      setQrStatus('waiting')
      setQrModalOpen(true)

      // 开始轮询支付状态
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          const sr = await authFetch(`${API_BASE}/payment/status/${data.order_no}`)
          const sd = await sr.json()
          if (sd.status === 'paid') {
            setQrStatus('paid')
            if (pollRef.current) {
              clearInterval(pollRef.current)
            }
            pollRef.current = null
            // 从后端获取真实会员状态（含正确 member_expires）
            const statusRes = await authFetch(`${API_BASE}/membership/status`)
            const statusData = await statusRes.json()
            updateMembership(statusData.membership, statusData.member_expires)
            setQuotas(statusData.quotas || {})
          }
        } catch { /* ignore */ }
      }, 2000)
    } catch {
      message.error('创建订单失败')
    }
  }

  const handleQrClose = () => {
    setQrModalOpen(false)
    setOrderData(null)
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const handleSimulateScan = () => {
    if (!orderData) return
    const url = `${window.location.origin}/payment/callback?order_no=${orderData.order_no}&key=${orderData.confirm_key}`
    window.open(url, '_blank')
  }

  return (
    <div className="membership-page">
      {/* 会员状态卡片 */}
      <Card className="membership-card membership-status-card">
        <div className={`membership-badge ${isPremium ? 'premium' : 'free'}`}>
          <CrownOutlined />
        </div>
        <div className="membership-status-title">
          {isPremium ? '尊贵会员' : '免费用户'}
        </div>
        {isPremium && member_expires && (
          <div className="membership-expires">
            有效期至：{new Date(member_expires).toLocaleDateString('zh-CN')}
          </div>
        )}
        {isPremium && !member_expires && (
          <div className="membership-expires">永久会员</div>
        )}
        {!isPremium && (
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            开通会员解锁全部功能
          </Text>
        )}
      </Card>

      {/* 使用配额卡片 */}
      <Card title="今日使用配额" className="membership-card">
        <div className="quota-grid">
          {Object.entries(QUOTA_LABELS).map(([key, label]) => {
            const q = quotas?.[key]
            const used = q?.used ?? 0
            const limit = q?.limit ?? -1
            const isUnlimited = limit === -1
            return (
<div key={key} className="quota-item" style={{background: 'rgba(17, 24, 39, 0.8)', border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: 12, padding: 16}}>                <div className="quota-label">{label}</div>
                <div className={`quota-value ${isUnlimited ? 'unlimited' : used >= limit ? 'low' : 'ok'}`}>
                  {isUnlimited ? '∞ 无限制' : `${used} / ${limit}`}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* 权益对比 */}
      <Card title="会员权益对比" className="membership-card">
        <div className="benefit-table">
          <div className="benefit-row" style={{ fontWeight: 600 }}>
            <span className="benefit-label">功能</span>
            <span>
              <Tag color="default">免费</Tag>
              <Tag color="gold" style={{ marginLeft: 8 }}>会员</Tag>
            </span>
          </div>
          {BENEFITS.map((b) => (
            <div key={b.label} className="benefit-row">
              <span className="benefit-label">{b.label}</span>
              <span>
                <span className="benefit-free">{b.free}</span>
                <span className="benefit-premium" style={{ marginLeft: 12 }}>
                  {b.premium}
                </span>
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* 购买会员 */}
      {!isPremium && (
        <Card title="购买会员" className="membership-card">
          <Text type="secondary">选择套餐后点击「模拟扫码支付」完成支付</Text>
          <div className="plan-grid">
            {PLANS.map((plan) => (
              <div
                key={plan.days}
                className="plan-card"
                onClick={() => handleBuy(plan.days)}
              >
                {plan.tag && <Tag color="gold" className="plan-tag">{plan.tag}</Tag>}
                <div className="plan-name">{plan.label}</div>
                <div className="plan-price">¥{plan.price}</div>
                <div className="plan-unit">日均约 ¥{(plan.price / plan.days).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 兑换会员码 */}
      {!isPremium && (
        <Card title="兑换会员" className="membership-card">
          <Text type="secondary">输入会员兑换码激活会员（请联系管理员获取）</Text>
          <div className="redeem-section">
            <div className="redeem-input-row">
              <Input
                placeholder="请输入兑换码"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value)}
                onPressEnter={handleRedeem}
              />
              <Button type="primary" loading={redeeming} onClick={handleRedeem}>
                兑换
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 支付弹窗 */}
      <Modal
        title="扫码支付"
        open={qrModalOpen}
        onCancel={handleQrClose}
        footer={[
          qrStatus === 'paid'
            ? <Button type="primary" key="done" onClick={handleQrClose}>完成</Button>
            : <Button key="close" onClick={handleQrClose}>关闭</Button>,
        ]}
        width={380}
        destroyOnClose
      >
        <div className="qr-modal-body">
          {qrStatus === 'paid' ? (
            <>
              <CheckCircleFilled style={{ fontSize: 64, color: '#52c41a' }} />
              <div className="qr-amount" style={{ color: '#52c41a', fontSize: 20, marginTop: 16 }}>
                支付成功！
              </div>
              <div className="qr-hint">会员已激活，尽情享受全部功能</div>
            </>
          ) : qrStatus === 'error' ? (
            <>
              <CloseCircleFilled style={{ fontSize: 64, color: '#ff4d4f' }} />
              <div className="qr-amount" style={{ color: '#ff4d4f', fontSize: 20, marginTop: 16 }}>
                支付失败
              </div>
              <div className="qr-hint">请重试或联系客服</div>
            </>
          ) : (
            <>
              <div style={{ background: '#fff', display: 'inline-block', padding: 12, borderRadius: 8 }}>
                <QRCodeSVG value={orderData ? `${window.location.origin}/payment/callback?order_no=${orderData.order_no}&key=${orderData.confirm_key}` : ''} size={200} />
              </div>
              <div className="qr-amount">¥{orderData?.amount.toFixed(2)}</div>
              <Button
                type="primary"
                size="large"
                style={{ marginTop: 16 }}
                onClick={handleSimulateScan}
              >
                模拟扫码支付
              </Button>
              <div className="qr-hint">点击按钮在新标签页完成支付，本页自动更新</div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
