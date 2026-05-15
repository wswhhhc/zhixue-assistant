import { useEffect, useState } from 'react'
import {
  Table, Tag, Button, InputNumber, Space, message, Typography, Card,
} from 'antd'
import { GiftOutlined } from '@ant-design/icons'
import { adminFetch } from '../../adminAuth'

interface CodeItem {
  id: number
  code: string
  duration_days: number
  max_uses: number
  used_count: number
  is_active: boolean
  created_at: string
}

interface PageRes {
  items: CodeItem[]
  total: number
  page: number
  page_size: number
}

export default function AdminCodes() {
  const [data, setData] = useState<PageRes | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const [genCount, setGenCount] = useState(10)
  const [genDays, setGenDays] = useState(30)
  const [genUses, setGenUses] = useState(1)
  const [genLoading, setGenLoading] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([])

  const fetchData = () => {
    setLoading(true)
    adminFetch(`/admin/codes?page=${page}&page_size=20`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [page])

  const handleGenerate = async () => {
    setGenLoading(true)
    const res = await adminFetch('/admin/codes/generate', {
      method: 'POST',
      body: JSON.stringify({ count: genCount, duration_days: genDays, max_uses: genUses }),
    })
    const d = await res.json()
    if (!res.ok) {
      message.error(d.detail || '生成失败')
    } else {
      message.success(`已生成 ${d.codes.length} 个兑换码`)
      setGeneratedCodes(d.codes)
      fetchData()
    }
    setGenLoading(false)
  }

  const handleToggle = async (id: number, isActive: boolean) => {
    const res = await adminFetch(`/admin/codes/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    })
    if (!res.ok) {
      const d = await res.json()
      message.error(d.detail || '操作失败')
      return
    }
    message.success(isActive ? '已启用' : '已禁用')
    fetchData()
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '兑换码', dataIndex: 'code', key: 'code', width: 200 },
    { title: '天数', dataIndex: 'duration_days', key: 'duration_days', width: 60 },
    {
      title: '使用次数', key: 'uses', width: 100,
      render: (_: unknown, r: CodeItem) => `${r.used_count} / ${r.max_uses}`,
    },
    {
      title: '状态', dataIndex: 'is_active', key: 'is_active', width: 80,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at',
      render: (t: string) => t ? new Date(t).toLocaleDateString('zh-CN') : '-',
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: unknown, r: CodeItem) => (
        <Button type="link" onClick={() => handleToggle(r.id, !r.is_active)}>
          {r.is_active ? '禁用' : '启用'}
        </Button>
      ),
    },
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 22, fontWeight: 700 }}>
        兑换码管理
      </h2>

      <Card style={{ marginBottom: 24 }}>
        <Typography.Text strong style={{ fontSize: 15, display: 'block', marginBottom: 16 }}>
          批量生成兑换码
        </Typography.Text>
        <Space wrap>
          <span>数量 <InputNumber value={genCount} onChange={(v) => setGenCount(v || 1)} min={1} max={100} /></span>
          <span>会员天数 <InputNumber value={genDays} onChange={(v) => setGenDays(v || 30)} min={1} max={3650} /></span>
          <span>最大使用 <InputNumber value={genUses} onChange={(v) => setGenUses(v || 1)} min={1} max={100} /></span>
          <Button type="primary" icon={<GiftOutlined />} loading={genLoading} onClick={handleGenerate}>
            生成
          </Button>
        </Space>

        {generatedCodes.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text type="success" style={{ display: 'block', marginBottom: 8 }}>
              生成的兑换码（点击复制）：
            </Typography.Text>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              {generatedCodes.map((code) => (
                <div
                  key={code}
                  style={{
                    padding: '4px 8px',
                    marginBottom: 4,
                    background: 'rgba(3, 7, 18, 0.8)',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    color: '#00d4ff',
                    fontSize: 13,
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(code)
                    message.success('已复制')
                  }}
                >
                  {code}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

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
