import { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Input, 
  Select, 
  Tag, 
  Modal, 
  Form,
  message,
  Row,
  Col,
  Descriptions,
  Card,
  List,
  Badge,
  Typography
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined,
  PlusOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  ToolOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { shiftsApi } from '../api/shifts';
import { ShiftHandover, HandoverStatus, Shift } from '../types';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

const handoverStatusLabels: Record<HandoverStatus, string> = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已拒绝'
};

const handoverStatusColors: Record<HandoverStatus, string> = {
  pending: 'orange',
  confirmed: 'green',
  rejected: 'red'
};

const itemTypeLabels: Record<string, string> = {
  borrowed_tool: '借出工具',
  pending_investigation: '待处理调查单',
  other: '其他'
};

export default function ShiftHandoverPage() {
  const { user, hasRole } = useAuth();
  const [handovers, setHandovers] = useState<ShiftHandover[]>([]);
  const [pendingHandovers, setPendingHandovers] = useState<ShiftHandover[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedHandover, setSelectedHandover] = useState<ShiftHandover | null>(null);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [allShifts, setAllShifts] = useState<Shift[]>([]);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectForm] = Form.useForm();

  useEffect(() => {
    loadData();
  }, [page, pageSize, activeTab]);

  const loadData = async () => {
    loadCurrentShift();
    loadAllShifts();
    if (activeTab === 'pending') {
      loadPendingHandovers();
    } else {
      loadHandovers();
    }
  };

  const loadCurrentShift = async () => {
    try {
      const response = await shiftsApi.getCurrentShift();
      if (response.success && response.data) {
        setCurrentShift(response.data);
      }
    } catch (error) {
      console.error('Failed to load current shift:', error);
    }
  };

  const loadAllShifts = async () => {
    try {
      const response = await shiftsApi.getShifts({ pageSize: 100 });
      if (response.success && response.data) {
        setAllShifts(response.data);
      }
    } catch (error) {
      console.error('Failed to load shifts:', error);
    }
  };

  const loadPendingHandovers = async () => {
    setLoading(true);
    try {
      const response = await shiftsApi.getPendingHandovers();
      if (response.success) {
        setPendingHandovers(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load pending handovers:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHandovers = async () => {
    setLoading(true);
    try {
      const response = await shiftsApi.getHandovers({
        status: statusFilter,
        page,
        pageSize
      });
      if (response.success) {
        setHandovers(response.data || []);
        setTotal(response.total || 0);
      }
    } catch (error) {
      console.error('Failed to load handovers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!currentShift) {
      message.warning('当前没有进行中的班次，无法创建交接');
      return;
    }

    try {
      const values = await createForm.validateFields();
      setCreating(true);
      
      const response = await shiftsApi.createHandover({
        from_shift_id: currentShift.id,
        to_shift_id: values.to_shift_id,
        to_user_id: values.to_user_id,
        to_user_name: values.to_user_name,
        remark: values.remark
      });

      if (response.success) {
        message.success('交接单创建成功');
        setCreateVisible(false);
        createForm.resetFields();
        loadData();
      }
    } catch (error: any) {
      if (error?.message) {
        message.error(error.message);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = async (handover: ShiftHandover) => {
    Modal.confirm({
      title: '确认交接',
      content: `确定要确认交接单「${handover.handover_no}」吗？确认后将承担该班次的责任。`,
      onOk: async () => {
        try {
          setConfirming(true);
          const response = await shiftsApi.confirmHandover(handover.id);
          if (response.success) {
            message.success('交接已确认');
            loadData();
            loadCurrentShift();
          }
        } catch (error: any) {
          if (error?.message) {
            message.error(error.message);
          }
        } finally {
          setConfirming(false);
        }
      }
    });
  };

  const handleReject = (handover: ShiftHandover) => {
    setSelectedHandover(handover);
    rejectForm.resetFields();
    setRejectVisible(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedHandover) return;

    try {
      const values = await rejectForm.validateFields();
      setRejecting(true);
      
      const response = await shiftsApi.rejectHandover(selectedHandover.id, values.remark);
      if (response.success) {
        message.success('交接已拒绝');
        setRejectVisible(false);
        loadData();
      }
    } catch (error: any) {
      if (error?.message) {
        message.error(error.message);
      }
    } finally {
      setRejecting(false);
    }
  };

  const handleViewDetail = async (handover: ShiftHandover) => {
    try {
      const response = await shiftsApi.getHandover(handover.id);
      if (response.success && response.data) {
        setSelectedHandover(response.data);
        setDetailVisible(true);
      }
    } catch (error) {
      console.error('Failed to load handover detail:', error);
    }
  };

  const columns = [
    {
      title: '交接单号',
      dataIndex: 'handover_no',
      key: 'handover_no',
      render: (text: string) => (
        <Space>
          <SwapOutlined />
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: '交班人',
      dataIndex: 'from_user_name',
      key: 'from_user_name',
      render: (name: string) => (
        <Space>
          <UserOutlined />
          <span>{name}</span>
        </Space>
      )
    },
    {
      title: '接班人',
      dataIndex: 'to_user_name',
      key: 'to_user_name',
      render: (name: string) => (
        <Space>
          <UserOutlined />
          <span>{name}</span>
        </Space>
      )
    },
    {
      title: '交接时间',
      dataIndex: 'handover_time',
      key: 'handover_time',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: HandoverStatus) => (
        <Tag color={handoverStatusColors[status]}>
          {handoverStatusLabels[status]}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: ShiftHandover) => (
        <Space>
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status === 'pending' && record.to_user_id === user?.userId && (
            <>
              <Button 
                type="link" 
                size="small" 
                icon={<CheckCircleOutlined />}
                onClick={() => handleConfirm(record)}
                loading={confirming}
              >
                确认交接
              </Button>
              <Button 
                type="link" 
                size="small" 
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => handleReject(record)}
              >
                拒绝交接
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card 
        style={{ marginBottom: 16 }}
        tabList={[
          { key: 'pending', tab: `待我确认 (${pendingHandovers.length})` },
          { key: 'history', tab: '历史记录' }
        ]}
        activeTabKey={activeTab}
        onTabChange={(key) => setActiveTab(key as 'pending' | 'history')}
        extra={
          hasRole('admin', 'quality') && (
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => setCreateVisible(true)}
              disabled={!currentShift}
            >
              创建交接
            </Button>
          )
        }
      >
        {activeTab === 'history' && (
          <Row gutter={16} style={{ marginBottom: 16 }} align="middle">
            <Col>
              <Select
                placeholder="状态筛选"
                style={{ width: 150 }}
                allowClear
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                  setTimeout(loadHandovers, 0);
                }}
              >
                <Option value="pending">待确认</Option>
                <Option value="confirmed">已确认</Option>
                <Option value="rejected">已拒绝</Option>
              </Select>
            </Col>
            <Col>
              <Button type="primary" icon={<SearchOutlined />} onClick={loadHandovers}>
                查询
              </Button>
            </Col>
          </Row>
        )}

        <Table
          columns={columns}
          dataSource={activeTab === 'pending' ? pendingHandovers : handovers}
          rowKey="id"
          loading={loading}
          pagination={activeTab === 'history' ? {
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            }
          } : false}
        />
      </Card>

      <Modal
        title="创建交接单"
        open={createVisible}
        onOk={handleCreate}
        onCancel={() => setCreateVisible(false)}
        confirmLoading={creating}
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="交班班次">
              {currentShift?.shift_name}
            </Descriptions.Item>
          </Descriptions>
          <Form.Item
            name="to_shift_id"
            label="接班班次"
            rules={[{ required: true, message: '请选择接班班次' }]}
          >
            <Select placeholder="请选择接班班次">
              {allShifts.filter(s => s.id !== currentShift?.id && s.status === 'active').map(shift => (
                <Option key={shift.id} value={shift.id}>{shift.shift_name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="to_user_name"
            label="接班人姓名"
            rules={[{ required: true, message: '请输入接班人姓名' }]}
          >
            <Input placeholder="请输入接班人姓名" />
          </Form.Item>
          <Form.Item
            name="to_user_id"
            label="接班人ID"
            rules={[{ required: true, message: '请输入接班人ID' }]}
          >
            <Input placeholder="请输入接班人ID" />
          </Form.Item>
          <Form.Item
            name="remark"
            label="备注"
          >
            <TextArea rows={3} placeholder="请输入交接备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="拒绝交接"
        open={rejectVisible}
        onOk={handleConfirmReject}
        onCancel={() => setRejectVisible(false)}
        confirmLoading={rejecting}
        width={500}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="remark"
            label="拒绝原因"
            rules={[{ required: true, message: '请输入拒绝原因' }]}
          >
            <TextArea rows={4} placeholder="请详细说明拒绝原因" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="交接单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
      >
        {selectedHandover && (
          <div>
            <Descriptions column={2} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="交接单号">{selectedHandover.handover_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={handoverStatusColors[selectedHandover.status]}>
                  {handoverStatusLabels[selectedHandover.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="交班人">{selectedHandover.from_user_name}</Descriptions.Item>
              <Descriptions.Item label="接班人">{selectedHandover.to_user_name}</Descriptions.Item>
              <Descriptions.Item label="交接时间">
                {dayjs(selectedHandover.handover_time).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="确认时间">
                {selectedHandover.confirmed_time 
                  ? dayjs(selectedHandover.confirmed_time).format('YYYY-MM-DD HH:mm') 
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {selectedHandover.remark || '-'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 24, marginBottom: 16 }}>
              交接明细
            </Title>

            {selectedHandover.items && selectedHandover.items.length > 0 ? (
              <List
                dataSource={selectedHandover.items}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        item.item_type === 'borrowed_tool' 
                          ? <ToolOutlined style={{ color: '#1890ff' }} />
                          : item.item_type === 'pending_investigation'
                          ? <WarningOutlined style={{ color: '#faad14' }} />
                          : <Badge status="default" />
                      }
                      title={
                        <Space>
                          <span>{item.item_name}</span>
                          <Tag size="small">{itemTypeLabels[item.item_type] || item.item_type}</Tag>
                        </Space>
                      }
                      description={
                        <div>
                          <div>{item.item_description}</div>
                          {item.status && (
                            <div style={{ marginTop: 4 }}>
                              <Text type="secondary">状态：{item.status}</Text>
                            </div>
                          )}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>
                暂无交接明细
              </div>
            )}

            {selectedHandover.tool_snapshot && (
              <div style={{ marginTop: 16 }}>
                <Title level={5} style={{ marginBottom: 8 }}>工具快照</Title>
                <pre style={{ 
                  background: '#f5f5f5', 
                  padding: 12, 
                  borderRadius: 4,
                  fontSize: 12,
                  maxHeight: 200,
                  overflow: 'auto'
                }}>
                  {selectedHandover.tool_snapshot}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
