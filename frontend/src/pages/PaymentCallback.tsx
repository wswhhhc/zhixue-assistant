import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Result, Spin, Button, Typography } from 'antd'
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'
import { API_BASE } from '../config'
import './PaymentCallback.css'

export default function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending')
  const [message, setMessage] = useState('正在确认支付...')

  useEffect(() => {
    const orderNo = searchParams.get('order_no')
    const key = searchParams.get('key')

    if (!orderNo || !key) {
      setStatus('error')
      setMessage('支付链接无效')
      return
    }

    const confirm = async () => {
      try {
        const res = await fetch(`${API_BASE}/payment/confirm?order_no=${orderNo}&key=${key}`, { method: 'POST' })
        const data = await res.json()
        if (res.ok) {
          setStatus('success')
          setMessage(data.message || '支付成功！')
        } else {
          setStatus('error')
          setMessage(data.detail || '支付确认失败')
        }
      } catch {
        setStatus('error')
        setMessage('网络错误，请重试')
      }
    }
    confirm()
  }, [searchParams])

  return (
    <div className="payment-callback-page">
      {status === 'pending' && (
        <div className="payment-callback-box">
          <Spin size="large" />
          <Typography.Title level={4} style={{ marginTop: 24 }}>
            正在确认支付...
          </Typography.Title>
        </div>
      )}
      {status === 'success' && (
        <Result
          icon={<CheckCircleFilled style={{ color: '#52c41a', fontSize: 72 }} />}
          title="支付成功！"
          subTitle={message}
          extra={
            <Button type="primary" onClick={() => window.close()}>
              关闭页面
            </Button>
          }
        />
      )}
      {status === 'error' && (
        <Result
          icon={<CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 72 }} />}
          title="支付失败"
          subTitle={message}
          extra={
            <Button type="primary" onClick={() => window.close()}>
              关闭页面
            </Button>
          }
        />
      )}
    </div>
  )
}
