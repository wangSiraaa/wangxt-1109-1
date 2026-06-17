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
  InputNumber,
  DatePicker,
  message,
  Popconfirm,
  Row,
  Col
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { toolsApi } from '../api/tools';
import { Tool, ToolRiskLevel, ToolStatus } from '../types';
import { riskLevelLabels, riskLevelColors, toolStatusLabels, toolStatusColors } from '../utils/constants';
import dayjs from 'dayjs';

const { Option } = Select;

export default function ToolList() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [riskFilter, setRiskFilter] = useState<string | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [form] = Form.useForm();
  const { hasRole } = useAuth();

  useEffect(() => {
    loadTools();
  }, [page, pageSize]);

  const loadTools = async () => {
    setLoading(true);
    try {
      const response = await toolsApi.getTools({
        keyword: keyword || undefined,
        status: statusFilter,
        risk_level: riskFilter,
        page,
        pageSize
      });
      if (response.success) {
        setTools(response.data || []);
        setTotal(response.total || 0);
      }
    } catch (error) {
      console.error('Failed to load tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadTools();
  };

  const handleReset = () => {
    setKeyword('');
    setStatusFilter(undefined);
    setRiskFilter(undefined);
    setPage(1);
    setTimeout(loadTools, 0);
  };

  const handleAdd = () => {
    setEditingTool(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (tool: Tool) => {
    setEditingTool(tool);
    form.setFieldsValue({
      ...tool,
      calibration_date: tool.calibration_date ? dayjs(tool.calibration_date) : undefined,
      calibration_expiry_date: tool.calibration_expiry_date ? dayjs(tool.calibration_expiry_date) : undefined
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await toolsApi.deleteTool(id);
      if (response.success) {
        message.success('删除成功');
        loadTools();
      }
    } catch (error) {
      console.error('Failed to delete tool:', error);
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const data = {
        ...values,
        calibration_date: values.calibration_date?.format('YYYY-MM-DD'),
        calibration_expiry_date: values.calibration_expiry_date?.format('YYYY-MM-DD')
      };

      if (editingTool) {
        const response = await toolsApi.updateTool(editingTool.id, data);
        if (response.success) {
          message.success('更新成功');
        }
      } else {
        const response = await toolsApi.createTool(data);
        if (response.success) {
          message.success('创建成功');
        }
      }
      setModalVisible(false);
      loadTools();
    } catch (error) {
      console.error('Failed to save tool:', error);
    }
  };

  const columns = [
    {
      title: '工具编码',
      dataIndex: 'tool_code',
      width: 120,
      render: (code: string, record: Tool) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontWeight: 500 }}>{code}</span>
          {record.is_calibration_expired && (
            <Tag color="red" style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>
              校准过期
            </Tag>
          )}
        </Space>
      )
    },
    {
      title: '工具名称',
      dataIndex: 'tool_name',
      width: 150
    },
    {
      title: '类别',
      dataIndex: 'category',
      width: 100
    },
    {
      title: '规格型号',
      dataIndex: 'specification',
      width: 120
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      width: 100,
      render: (level: ToolRiskLevel) => (
        <Tag color={riskLevelColors[level]}>
          {riskLevelLabels[level]}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: ToolStatus) => (
        <Tag color={toolStatusColors[status]}>
          {toolStatusLabels[status]}
        </Tag>
      )
    },
    {
      title: '校准有效期',
      dataIndex: 'calibration_expiry_date',
      width: 120,
      render: (date?: string) => date || '-'
    },
    {
      title: '存放位置',
      dataIndex: 'location',
      width: 100
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 80
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: Tool) => (
        hasRole('admin') && (
          <Space size="small">
            <Button 
              type="link" 
              size="small" 
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确定要删除这个工具吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button 
                type="link" 
                size="small" 
                danger
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          </Space>
        )
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">工具管理</h2>
        {hasRole('admin') && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增工具
          </Button>
        )}
      </div>

      <div className="search-bar">
        <Row gutter={16}>
          <Col span={6}>
            <Input 
              placeholder="搜索工具编码/名称/规格" 
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="状态"
              allowClear
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
            >
              <Option value="available">可用</Option>
              <Option value="borrowed">已借出</Option>
              <Option value="maintenance">维修中</Option>
              <Option value="calibrating">校准中</Option>
              <Option value="scrapped">已报废</Option>
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="风险等级"
              allowClear
              style={{ width: '100%' }}
              value={riskFilter}
              onChange={(v) => setRiskFilter(v)}
            >
              <Option value="low">低风险</Option>
              <Option value="medium">中风险</Option>
              <Option value="high">高风险</Option>
            </Select>
          </Col>
          <Col span={10}>
            <Space>
              <Button type="primary" onClick={handleSearch}>搜索</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Table
        columns={columns}
        dataSource={tools}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
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
        title={editingTool ? '编辑工具' : '新增工具'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="tool_code"
                label="工具编码"
                rules={[{ required: true, message: '请输入工具编码' }]}
              >
                <Input placeholder="请输入工具编码" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="tool_name"
                label="工具名称"
                rules={[{ required: true, message: '请输入工具名称' }]}
              >
                <Input placeholder="请输入工具名称" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="category" label="类别">
                <Input placeholder="请输入类别" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="specification" label="规格型号">
                <Input placeholder="请输入规格型号" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="risk_level"
                label="风险等级"
                rules={[{ required: true, message: '请选择风险等级' }]}
              >
                <Select placeholder="请选择风险等级">
                  <Option value="low">低风险</Option>
                  <Option value="medium">中风险</Option>
                  <Option value="high">高风险</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态" initialValue="available">
                <Select placeholder="请选择状态">
                  <Option value="available">可用</Option>
                  <Option value="borrowed">已借出</Option>
                  <Option value="maintenance">维修中</Option>
                  <Option value="calibrating">校准中</Option>
                  <Option value="scrapped">已报废</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="calibration_date" label="校准日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="calibration_expiry_date" label="校准有效期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="location" label="存放位置">
                <Input placeholder="请输入存放位置" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quantity" label="数量" initialValue={1}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="请输入描述" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                {editingTool ? '更新' : '创建'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
