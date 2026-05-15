import { useEffect, useState } from 'react'
import { Table, Tag, Select, Space } from 'antd'
import { adminFetch } from '../../adminAuth'

interface PaymentItem {
  id: number
  order_no: string
  user_id: number
  amount: number
  duration_days: number
  status: string
  created_at: string
  paid_at: string | null
}

interface PageRes {
  items: PaymentItem[]
  total: number
  page: number
  page_size: number
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待支付', color: 'orange' },
  paid: { label: '已支付', color: 'green' },
  expired: { label: '已过期', color: 'default' },
}

export default function AdminPayments() {
  const [data, setData] = useState<PageRes | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const fetchData = () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), page_size: '20' })
    if (status) params.set('status', status)
    adminFetch('/admin/payments?' + params.toString())
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [page, status])

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '订单号', dataIndex: 'order_no', key: 'order_no', width: 200 },
    { title: '用户ID', dataIndex: 'user_id', key: 'user_id', width: 80 },
    { title: '金额', dataIndex: 'amount', key: 'amount', width: 80, render: (v: number) => `¥${v}` },
    { title: '时长(天)', dataIndex: 'duration_days', key: 'duration_days', width: 80 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => {
        const m = STATUS_MAP[s] || { label: s, color: 'default' }
        return <Tag color={m.color}>{m.label}</Tag>
      },
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
    {
      title: '支付时间', dataIndex: 'paid_at', key: 'paid_at',
      render: (t: string | null) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 22, fontWeight: 700 }}>
        支付订单
      </h2>

      <Space style={{ marginBottom: 16 }}>
        <span>状态：</span>
        <Select
          value={status}
          onChange={(v) => { setStatus(v); setPage(1) }}
          options={[
            { label: '全部', value: '' },
            { label: '待支付', value: 'pending' },
            { label: '已支付', value: 'paid' },
            { label: '已过期', value: 'expired' },
          ]}
          style={{ width: 120 }}
        />
      </Space>

      <Table
        dataSource={data?.items}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total || 0,
          onChange: setPage,
        }}
      />
    </div>
  )
}
