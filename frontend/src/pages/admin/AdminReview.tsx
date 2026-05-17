import { useEffect, useState } from 'react'
import { Table, Tag, Button, Space, message, Modal, Typography, Empty, Popconfirm } from 'antd'
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons'
import { renderLatex } from '../../utils/renderLatex'
import { adminFetch } from '../../adminAuth'

interface QuestionItem {
  id: number
  content: string
  question_type: string
  knowledge_point: string
  source: string
  user_id: number | null
  created_at: string
  answer: string
  options: string[]
  explanation: string
}

interface PageRes {
  items: QuestionItem[]
  total: number
  page: number
  page_size: number
}

const TYPE_MAP: Record<string, string> = {
  choice: '选择题', fill: '填空题', judge: '判断题', subjective: '主观题',
}

const SOURCE_MAP: Record<string, { label: string; color: string }> = {
  system: { label: '系统', color: 'blue' },
  user: { label: '用户', color: 'green' },
  ai_generated: { label: 'AI', color: 'orange' },
}

export default function AdminReview() {
  const [data, setData] = useState<PageRes | null>(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<QuestionItem | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
  const [batchLoading, setBatchLoading] = useState(false)

  const fetchData = () => {
    setLoading(true)
    adminFetch(`/admin/questions/pending?page=${page}&page_size=20`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [page])

  const handleBatchReview = async (action: 'approve' | 'reject') => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择题目')
      return
    }
    setBatchLoading(true)
    const res = await adminFetch('/admin/questions/batch-review', {
      method: 'POST',
      body: JSON.stringify({ question_ids: selectedRowKeys, action }),
    })
    setBatchLoading(false)
    if (!res.ok) {
      const d = await res.json()
      message.error(d.detail || '操作失败')
      return
    }
    message.success(`已${action === 'approve' ? '通过' : '驳回'} ${selectedRowKeys.length} 道题目`)
    setSelectedRowKeys([])
    fetchData()
  }

  const handleReview = async (id: number, action: 'approve' | 'reject') => {
    const res = await adminFetch(`/admin/questions/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ action }),
    })
    if (!res.ok) {
      const d = await res.json()
      message.error(d.detail || '操作失败')
      return
    }
    message.success(action === 'approve' ? '已审核通过' : '已驳回')
    fetchData()
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    {
      title: '内容', dataIndex: 'content', key: 'content', width: 280,
      render: (t: string) => (
        <div style={{ maxHeight: 48, overflow: 'hidden' }}>{renderLatex(t)}</div>
      ),
    },
    {
      title: '题型', dataIndex: 'question_type', key: 'question_type', width: 70,
      render: (t: string) => TYPE_MAP[t] || t,
    },
    { title: '知识点', dataIndex: 'knowledge_point', key: 'knowledge_point', width: 120 },
    {
      title: '来源', dataIndex: 'source', key: 'source', width: 70,
      render: (s: string) => {
        const m = SOURCE_MAP[s] || { label: s, color: 'default' }
        return <Tag color={m.color}>{m.label}</Tag>
      },
    },
    { title: '上传者ID', dataIndex: 'user_id', key: 'user_id', width: 80, render: (v: number | null) => v ?? '-' },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: unknown, record: QuestionItem) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => { setDetailItem(record); setDetailOpen(true) }}
          >
            查看
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<CheckOutlined />}
            onClick={() => handleReview(record.id, 'approve')}
          >
            通过
          </Button>
          <Button
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleReview(record.id, 'reject')}
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <h2 className="admin-page-title">内容审核</h2>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        审核用户上传的题目，通过后题目将进入学生端的题库
      </Typography.Text>

      {selectedRowKeys.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--tech-bg-secondary)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography.Text>已选 {selectedRowKeys.length} 项</Typography.Text>
          <Popconfirm title={`批量通过 ${selectedRowKeys.length} 道题目？`} onConfirm={() => handleBatchReview('approve')}>
            <Button type="primary" icon={<CheckOutlined />} loading={batchLoading} size="small">
              批量通过
            </Button>
          </Popconfirm>
          <Popconfirm title={`批量驳回 ${selectedRowKeys.length} 道题目？`} onConfirm={() => handleBatchReview('reject')}>
            <Button danger icon={<CloseOutlined />} loading={batchLoading} size="small">
              批量驳回
            </Button>
          </Popconfirm>
        </div>
      )}

      <Table
        dataSource={data?.items}
        columns={columns}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: <Empty description="暂无待审核题目" /> }}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.total || 0,
          onChange: setPage,
        }}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as number[]),
        }}
      />

      <Modal
        title={`题目详情 (#${detailItem?.id})`}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={
          detailItem ? (
            <Space>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => { handleReview(detailItem.id, 'reject'); setDetailOpen(false) }}
              >
                驳回
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => { handleReview(detailItem.id, 'approve'); setDetailOpen(false) }}
              >
                审核通过
              </Button>
            </Space>
          ) : null
        }
        width={640}
        destroyOnClose
      >
        {detailItem && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Typography.Text strong>题目内容：</Typography.Text>
              <div style={{ marginTop: 8, padding: 12, background: 'var(--tech-bg-secondary)', borderRadius: 8 }}>
                {renderLatex(detailItem.content)}
              </div>
            </div>

            {detailItem.question_type === 'choice' && detailItem.options.length === 4 && (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong>选项：</Typography.Text>
                {['A', 'B', 'C', 'D'].map((label, i) => (
                  <div key={label} style={{ marginTop: 4, padding: '4px 8px' }}>
                    <Typography.Text>{label}. {detailItem.options[i]}</Typography.Text>
                    {detailItem.answer === label && (
                      <Tag color="green" style={{ marginLeft: 8 }}>正确答案</Tag>
                    )}
                  </div>
                ))}
              </div>
            )}

            {detailItem.question_type !== 'choice' && (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong>答案：</Typography.Text>
                <Tag color="green" style={{ marginLeft: 8 }}>{detailItem.answer}</Tag>
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <Typography.Text strong>知识点：</Typography.Text>
              <Tag style={{ marginLeft: 8 }}>{detailItem.knowledge_point}</Tag>
            </div>

            {detailItem.explanation && (
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong>解析：</Typography.Text>
                <div style={{ marginTop: 8, padding: 12, background: 'var(--tech-bg-secondary)', borderRadius: 8 }}>
                  {renderLatex(detailItem.explanation)}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
