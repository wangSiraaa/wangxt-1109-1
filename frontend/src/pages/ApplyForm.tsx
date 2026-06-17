import { useState, useEffect } from 'react';
import { 
  Form, 
  Input, 
  Select, 
  Button, 
  DatePicker, 
  Space, 
  Table, 
  InputNumber, 
  message,
  Card,
  Row,
  Col,
  Tag,
  Modal,
  Alert
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined, 
  MinusOutlined,
  SaveOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { toolsApi } from '../api/tools';
import { applicationsApi } from '../api/applications';
import { Tool, ToolRiskLevel } from '../types';
import { riskLevelLabels, riskLevelColors } from '../utils/constants';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface ToolItem extends Tool {
  apply_quantity: number;
}

export default function ApplyForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTools, setSelectedTools] = useState<ToolItem[]>([]);
  const [keyword, setKeyword] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toolModalVisible, setToolModalVisible] = useState(false);
  const [riskLevel, setRiskLevel] = useState<ToolRiskLevel | undefined>();

  useEffect(() => {
    searchTools();
  }, []);

  const searchTools = async () => {
    setSearchLoading(true);
    try {
      const response = await toolsApi.getTools({
        keyword: keyword || undefined,
        status: 'available',
        pageSize: 50
      });
      if (response.success) {
        setTools(response.data || []);
      }
    } catch (error) {
      console.error('Failed to search tools:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const addTool = (tool: Tool) => {
    const existing = selectedTools.find(t => t.id === tool.id);
    if (existing) {
      message.info('该工具已在清单中');
      return;
    }
    
    if (tool.is_calibration_expired) {
      message.warning('该工具校准已过期，不能借用');
      return;
    }

    setSelectedTools([...selectedTools, { ...tool, apply_quantity: 1 }]);
    setToolModalVisible(false);
    updateRiskLevel([...selectedTools, { ...tool, apply_quantity: 1 }]);
  };

  const removeTool = (toolId: string) => {
    const newTools = selectedTools.filter(t => t.id !== toolId);
    setSelectedTools(newTools);
    updateRiskLevel(newTools);
  };

  const updateQuantity = (toolId: string, quantity: number) => {
    const newTools = selectedTools.map(t => 
      t.id === toolId ? { ...t, apply_quantity: Math.max(1, quantity) } : t
    );
    setSelectedTools(newTools);
  };

  const updateRiskLevel = (toolList: ToolItem[]) => {
    if (toolList.length === 0) {
      setRiskLevel(undefined);
      return;
    }
    
    const levels: ToolRiskLevel[] = ['low', 'medium', 'high'];
    let maxLevel: ToolRiskLevel = 'low';
    
    for (const tool of toolList) {
      if (levels.indexOf(tool.risk_level) > levels.indexOf(maxLevel)) {
        maxLevel = tool.risk_level;
      }
    }
    
    setRiskLevel(maxLevel);
  };

  const handleSubmit = async (submitType: 'save' | 'submit') => {
    if (selectedTools.length === 0) {
      message.warning('请至少选择一个工具');
      return;
    }

    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const data = {
        work_order_no: values.work_order_no,
        work_type: values.work_type,
        risk_level: riskLevel,
        purpose: values.purpose,
        expected_return_date: values.expected_return_date?.format('YYYY-MM-DD'),
        remark: values.remark,
        items: selectedTools.map(t => ({
          tool_id: t.id,
          apply_quantity: t.apply_quantity
        }))
      };

      const response = await applicationsApi.createApplication(data);
      
      if (response.success && response.data) {
        if (submitType === 'save') {
          message.success('草稿保存成功');
          navigate('/applications');
        } else {
          const { id } = response.data;
          const submitResponse = await applicationsApi.submitApplication(id);
          if (submitResponse.success) {
            message.success('申请提交成功');
            navigate('/applications');
          }
        }
      }
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const toolColumns = [
    {
      title: '工具编码',
      dataIndex: 'tool_code',
      width: 100
    },
    {
      title: '工具名称',
      dataIndex: 'tool_name',
      width: 120
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
      title: '校准有效期',
      dataIndex: 'calibration_expiry_date',
      width: 120,
      render: (date?: string, record?: Tool) => (
        record?.is_calibration_expired ? (
          <Tag color="red">已过期</Tag>
        ) : date || '-'
      )
    },
    {
      title: '库存数量',
      dataIndex: 'quantity',
      width: 80
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: Tool) => (
        <Button 
          type="primary" 
          size="small" 
          icon={<PlusOutlined />}
          disabled={record.is_calibration_expired}
          onClick={() => addTool(record)}
        >
          添加
        </Button>
      )
    }
  ];

  const selectedColumns = [
    {
      title: '工具编码',
      dataIndex: 'tool_code',
      width: 100
    },
    {
      title: '工具名称',
      dataIndex: 'tool_name',
      width: 120
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
      title: '申请数量',
      dataIndex: 'apply_quantity',
      width: 150,
      render: (_: any, record: ToolItem) => (
        <InputNumber 
          min={1} 
          max={record.quantity}
          value={record.apply_quantity}
          onChange={(v) => updateQuantity(record.id, v || 1)}
          size="small"
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: ToolItem) => (
        <Button 
          type="text" 
          danger
          size="small" 
          icon={<MinusOutlined />}
          onClick={() => removeTool(record.id)}
        >
          移除
        </Button>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/applications')}
          >
            返回
          </Button>
          <h2 className="page-title">申请工具</h2>
        </Space>
      </div>

      {riskLevel === 'high' && (
        <Alert
          message="高风险维修提示"
          description={
            <div>
              <p>本次借用包含高风险工具，需要：</p>
              <ul style={{ margin: '8px 0 0 20px' }}>
                <li>双人确认工具清单</li>
                <li>质量员校准确认</li>
              </ul>
            </div>
          }
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          style={{ marginBottom: 24 }}
        />
      )}

      <Form form={form} layout="vertical">
        <Card title="申请信息" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="work_order_no"
                label="工单号"
              >
                <Input placeholder="请输入工单号" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="work_type"
                label="维修类型"
              >
                <Select placeholder="请选择维修类型">
                  <Option value="routine">例行维修</Option>
                  <Option value="engine">发动机维修</Option>
                  <Option value="airframe">机体维修</Option>
                  <Option value="avionics">航电维修</Option>
                  <Option value="other">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="expected_return_date"
                label="预计归还日期"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="purpose"
                label="用途说明"
              >
                <TextArea rows={3} placeholder="请输入用途说明" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                name="remark"
                label="备注"
              >
                <TextArea rows={2} placeholder="请输入备注信息" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        <Card 
          title="工具清单" 
          extra={
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => setToolModalVisible(true)}
            >
              添加工具
            </Button>
          }
        >
          {selectedTools.length > 0 ? (
            <Table
              columns={selectedColumns}
              dataSource={selectedTools}
              rowKey="id"
              pagination={false}
              size="small"
            />
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 0', 
              color: '#8c8c8c' 
            }}>
              暂无工具，点击右上角"添加工具"按钮选择工具
            </div>
          )}
          
          {selectedTools.length > 0 && riskLevel && (
            <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
              <Space>
                <span>整体风险等级：</span>
                <Tag color={riskLevelColors[riskLevel]} style={{ fontSize: 14, padding: '4px 12px' }}>
                  {riskLevelLabels[riskLevel]}
                </Tag>
                {riskLevel === 'high' && (
                  <span style={{ color: '#fa8c16' }}>
                    需要双人确认和质量员校准确认
                  </span>
                )}
              </Space>
            </div>
          )}
        </Card>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Space size="large">
            <Button 
              size="large" 
              icon={<SaveOutlined />}
              loading={submitting}
              onClick={() => handleSubmit('save')}
            >
              保存草稿
            </Button>
            <Button 
              type="primary" 
              size="large"
              icon={<SendOutlined />}
              loading={submitting}
              onClick={() => handleSubmit('submit')}
            >
              提交申请
            </Button>
          </Space>
        </div>
      </Form>

      <Modal
        title="选择工具"
        open={toolModalVisible}
        onCancel={() => setToolModalVisible(false)}
        footer={null}
        width={900}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="搜索工具编码/名称/规格"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={searchTools}
              style={{ width: 400 }}
            />
            <Button type="primary" onClick={searchTools} loading={searchLoading}>
              搜索
            </Button>
          </Space.Compact>
        </div>

        <Table
          columns={toolColumns}
          dataSource={tools}
          rowKey="id"
          loading={searchLoading}
          pagination={{ pageSize: 8, size: 'small' }}
          size="small"
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  );
}
