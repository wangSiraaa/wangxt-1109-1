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
  DatePicker,
  Row,
  Col,
  Descriptions,
  Card
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  StopOutlined,
  UserOutlined
} from '@ant-design/icons';
import { shiftsApi } from '../api/shifts';
import { Shift, ShiftType, ShiftStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

const shiftTypeLabels: Record<ShiftType, string> = {
  day: '白班',
  middle: '中班',
  night: '夜班'
};

const shiftTypeColors: Record<ShiftType, string> = {
  day: 'blue',
  middle: 'orange',
  night: 'purple'
};

const shiftStatusLabels: Record<ShiftStatus, string> = {
  active: '进行中',
  ended: '已结束'
};

const shiftStatusColors: Record<ShiftStatus, string> = {
  active: 'green',
  ended: 'default'
};

export default function ShiftManagementPage() {
  const { user, hasRole } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [createForm] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    loadShifts();
    loadCurrentShift();
  }, [page, pageSize]);

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

  const loadShifts = async () => {
    setLoading(true);
    try {
      const response = await shiftsApi.getShifts({
        status: statusFilter,
        page,
        pageSize
      });
      if (response.success) {
        setShifts(response.data || []);
        setTotal(response.total || 0);
      }
    } catch (error) {
      console.error('Failed to load shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (currentShift) {
      message.warning('当前已有进行中的班次，请先结束当前班次');
      return;
    }

    try {
      const values = await createForm.validateFields();
      setCreating(true);
      
      const response = await shiftsApi.createShift({
        shift_name: values.shift_name,
        shift_type: values.shift_type,
        start_time: values.time_range[0].toISOString(),
        end_time: values.time_range[1].toISOString(),
        leader_id: user?.userId
      });

      if (response.success) {
        message.success('班次创建成功');
        setCreateVisible(false);
        createForm.resetFields();
        loadShifts();
        loadCurrentShift();
      }
    } catch (error: any) {
      if (error?.message) {
        message.error(error.message);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleEndShift = async (shift: Shift) => {
    if (shift.status !== 'active') {
      message.warning('仅进行中的班次可结束');
      return;
    }

    Modal.confirm({
      title: '确认结束班次',
      content: `确定要结束班次「${shift.shift_name}」吗？结束前请确保所有工具已归还，所有调查单已处理。`,
      onOk: async () => {
        try {
          setEnding(true);
          const response = await shiftsApi.endShift(shift.id);
          if (response.success) {
            message.success('班次已结束');
            loadShifts();
            loadCurrentShift();
          }
        } catch (error: any) {
          if (error?.message) {
            message.error(error.message);
          }
        } finally {
          setEnding(false);
        }
      }
    });
  };

  const handleViewDetail = async (shift: Shift) => {
    setSelectedShift(shift);
    setDetailVisible(true);
  };

  const columns = [
    {
      title: '班次名称',
      dataIndex: 'shift_name',
      key: 'shift_name',
      render: (text: string, record: Shift) => (
        <Space>
          <ClockCircleOutlined />
          <span>{text}</span>
          {record.status === 'active' && <Tag color="green">当前班次</Tag>}
        </Space>
      )
    },
    {
      title: '班次类型',
      dataIndex: 'shift_type',
      key: 'shift_type',
      render: (type: ShiftType) => (
        <Tag color={shiftTypeColors[type]}>{shiftTypeLabels[type]}</Tag>
      )
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '负责人',
      dataIndex: 'leader_name',
      key: 'leader_name',
      render: (name: string) => name ? (
        <Space>
          <UserOutlined />
          <span>{name}</span>
        </Space>
      ) : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ShiftStatus) => (
        <Tag color={shiftStatusColors[status]}>{shiftStatusLabels[status]}</Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Shift) => (
        <Space>
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          {record.status === 'active' && hasRole('admin', 'quality') && (
            <Button 
              type="link" 
              size="small" 
              danger
              icon={<StopOutlined />}
              onClick={() => handleEndShift(record)}
              loading={ending}
            >
              结束班次
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Select
              placeholder="状态筛选"
              style={{ width: 150 }}
              allowClear
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
                setTimeout(loadShifts, 0);
              }}
            >
              <Option value="active">进行中</Option>
              <Option value="ended">已结束</Option>
            </Select>
          </Col>
          <Col>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={loadShifts}>
                查询
              </Button>
              {hasRole('admin', 'quality') && (
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setCreateVisible(true)}
                  disabled={!!currentShift}
                >
                  创建班次
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={shifts}
        rowKey="id"
        loading={loading}
        pagination={{
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
        }}
      />

      <Modal
        title="创建班次"
        open={createVisible}
        onOk={handleCreate}
        onCancel={() => setCreateVisible(false)}
        confirmLoading={creating}
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="shift_name"
            label="班次名称"
            rules={[{ required: true, message: '请输入班次名称' }]}
          >
            <Input placeholder="例如：2025-02-15 白班" />
          </Form.Item>
          <Form.Item
            name="shift_type"
            label="班次类型"
            rules={[{ required: true, message: '请选择班次类型' }]}
          >
            <Select placeholder="请选择班次类型">
              <Option value="day">白班 (08:00-16:00)</Option>
              <Option value="middle">中班 (16:00-00:00)</Option>
              <Option value="night">夜班 (00:00-08:00)</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="time_range"
            label="起止时间"
            rules={[{ required: true, message: '请选择起止时间' }]}
          >
            <RangePicker
              showTime={{ format: 'HH:mm' }}
              format="YYYY-MM-DD HH:mm"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="班次详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedShift && (
          <Descriptions column={2} bordered>
            <Descriptions.Item label="班次名称">{selectedShift.shift_name}</Descriptions.Item>
            <Descriptions.Item label="班次类型">
              <Tag color={shiftTypeColors[selectedShift.shift_type]}>
                {shiftTypeLabels[selectedShift.shift_type]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {dayjs(selectedShift.start_time).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="结束时间">
              {dayjs(selectedShift.end_time).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="负责人">
              {selectedShift.leader_name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={shiftStatusColors[selectedShift.status]}>
                {shiftStatusLabels[selectedShift.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              {dayjs(selectedShift.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
