import { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  message,
  Descriptions,
  List,
  Form,
  Input,
  InputNumber,
  Alert,
  Card,
  Select
} from 'antd';
import { 
  UndoOutlined, 
  EyeOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { applicationsApi } from '../api/applications';
import { 
  BorrowApplication, 
  BorrowApplicationItem, 
  ToolRiskLevel 
} from '../types';
import { 
  applicationStatusLabels, 
  applicationStatusColors,
  riskLevelLabels,
  riskLevelColors
} from '../utils/constants';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

interface ReturnItemData {
  tool_id: string;
  return_quantity: number;
  status: string;
  remark?: string;
}

export default function ReturnPage() {
  const [applications, setApplications] = useState<BorrowApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailVisible, setDetailVisible] = useState(false);
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [currentApp, setCurrentApp] = useState<(BorrowApplication & { items: BorrowApplicationItem[] }) | null>(null);
  const [returnForm] = Form.useForm();
  const [returning, setReturning] = useState(false);
  const { hasRole, user } = useAuth();

  useEffect(() => {
    loadApplications();
  }, [page, pageSize]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const params: any = {
        status: 'issued',
        page,
        pageSize
      };

      if (hasRole('technician') && user) {
        params.applicant_id = user.id;
      }

      const response = await applicationsApi.getApplications(params);
      if (response.success) {
        setApplications(response.data || []);
        setTotal(response.total || 0);
      }
    } catch (error) {
      console.error('Failed to load applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (id: string) => {
    try {
      const response = await applicationsApi.getApplication(id);
      if (response.success && response.data) {
        setCurrentApp(response.data);
        setDetailVisible(true);
      }
    } catch (error) {
      console.error('Failed to load detail:', error);
    }
  };

  const handleReturn = async (id: string) => {
    try {
      const response = await applicationsApi.getApplication(id);
      if (response.success && response.data) {
        setCurrentApp(response.data);
        returnForm.resetFields();
        
        const initialItems: ReturnItemData[] = (response.data.items || []).map(item => ({
          tool_id: item.tool_id,
          return_quantity: item.actual_quantity || item.apply_quantity,
          status: 'returned',
          remark: ''
        }));
        returnForm.setFieldsValue({
          returnItems: initialItems,
          remark: ''
        });
        
        setReturnModalVisible(true);
      }
    } catch (error) {
      console.error('Failed to load application:', error);
    }
  };

  const handleReturnSubmit = async () => {
    if (!currentApp) return;

    try {
      const values = await returnForm.validateFields();
      setReturning(true);

      const hasMissing = values.returnItems.some((item: ReturnItemData) => 
        item.status === 'missing' || item.return_quantity < (currentApp.items?.find(i => i.tool_id === item.tool_id)?.apply_quantity || 0)
      );

      const response = await applicationsApi.returnTools(
        currentApp.id,
        values.returnItems,
        values.remark
      );

      if (response.success) {
        if (response.data?.has_missing) {
          message.warning('归还成功，已自动生成缺件调查单');
        } else {
          message.success('归还成功');
        }
        setReturnModalVisible(false);
        loadApplications();
      }
    } catch (error) {
      console.error('Failed to return:', error);
    } finally {
      setReturning(false);
    }
  };

  const columns = [
    {
      title: '申请单号',
      dataIndex: 'application_no',
      width: 160,
      render: (no: string) => <span style={{ fontWeight: 500 }}>{no}</span>
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      width: 100
    },
    {
      title: '工单号',
      dataIndex: 'work_order_no',
      width: 120
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      width: 100,
      render: (level?: ToolRiskLevel) => level ? (
        <Tag color={riskLevelColors[level]}>
          {riskLevelLabels[level]}
        </Tag>
      ) : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: any) => (
        <Tag color={applicationStatusColors[status as keyof typeof applicationStatusColors]}>
          {applicationStatusLabels[status as keyof typeof applicationStatusLabels]}
        </Tag>
      )
    },
    {
      title: '发放时间',
      dataIndex: 'approve_time',
      width: 160,
      render: (date?: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '预计归还',
      dataIndex: 'expected_return_date',
      width: 120
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: BorrowApplication) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}
          >
            详情
          </Button>
          <Button 
            type="primary" 
            size="small" 
            icon={<UndoOutlined />}
            onClick={() => handleReturn(record.id)}
          >
            归还
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">工具归还</h2>
      </div>

      <Alert
        message="归还说明"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>请核对实际归还的工具数量</li>
            <li>如有缺件，系统将自动生成缺件调查单</li>
            <li>缺件调查单由管理员或质量员跟进处理</li>
          </ul>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={applications}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条借用中`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          }
        }}
      />

      <Modal
        title="申请单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {currentApp && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="申请单号">{currentApp.application_no}</Descriptions.Item>
              <Descriptions.Item label="申请人">{currentApp.applicant_name}</Descriptions.Item>
              <Descriptions.Item label="工单号">{currentApp.work_order_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="维修类型">{currentApp.work_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="风险等级">
                {currentApp.risk_level ? (
                  <Tag color={riskLevelColors[currentApp.risk_level]}>
                    {riskLevelLabels[currentApp.risk_level]}
                  </Tag>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="预计归还日期">{currentApp.expected_return_date || '-'}</Descriptions.Item>
            </Descriptions>

            <h4 style={{ marginBottom: 12 }}>借用工具清单</h4>
            <List
              size="small"
              bordered
              dataSource={currentApp.items || []}
              renderItem={(item: BorrowApplicationItem) => (
                <List.Item>
                  <List.Item.Meta
                    title={`${item.tool_code} ${item.tool_name}`}
                    description={
                      <Space size="large">
                        <span>规格：{item.specification || '-'}</span>
                        <span>实发数量：{item.actual_quantity || item.apply_quantity}</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>

      <Modal
        title="工具归还确认"
        open={returnModalVisible}
        onCancel={() => setReturnModalVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {currentApp && (
          <Form form={returnForm} layout="vertical">
            <Alert
              message="请核对实际归还的工具和数量，如有缺件将自动生成调查单"
              type="warning"
              showIcon
              icon={<WarningOutlined />}
              style={{ marginBottom: 16 }}
            />

            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>
                申请单号：{currentApp.application_no}
              </div>
              <div style={{ marginBottom: 8 }}>
                申请人：{currentApp.applicant_name}
              </div>
            </div>

            <Form.List name="returnItems">
              {(fields) => (
                <div style={{ 
                  border: '1px solid #f0f0f0', 
                  borderRadius: 8,
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    background: '#fafafa',
                    padding: '8px 16px',
                    borderBottom: '1px solid #f0f0f0',
                    fontWeight: 500,
                    fontSize: 12
                  }}>
                    <div style={{ flex: 2 }}>工具</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>借用数量</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>归还数量</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>状态</div>
                  </div>
                  {fields.map((field, index) => {
                    const item = currentApp.items?.[index];
                    const borrowQty = item?.actual_quantity || item?.apply_quantity || 0;
                    return (
                      <div 
                        key={field.key}
                        style={{ 
                          display: 'flex', 
                          padding: '12px 16px',
                          borderBottom: index < (currentApp.items?.length || 0) - 1 ? '1px solid #f0f0f0' : 'none',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 2 }}>
                          <div style={{ fontWeight: 500 }}>{item?.tool_name}</div>
                          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{item?.tool_code}</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          {borrowQty}
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <Form.Item
                            {...field}
                            name={[field.name, 'return_quantity']}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber 
                              min={0} 
                              max={borrowQty}
                              size="small"
                            />
                          </Form.Item>
                          <Form.Item
                            {...field}
                            name={[field.name, 'tool_id']}
                            hidden
                          >
                            <Input />
                          </Form.Item>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <Form.Item
                            {...field}
                            name={[field.name, 'status']}
                            style={{ marginBottom: 0 }}
                          >
                            <Select size="small">
                              <Option value="returned">已归还</Option>
                              <Option value="missing">缺件</Option>
                              <Option value="damaged">损坏</Option>
                            </Select>
                          </Form.Item>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Form.List>

            <Form.Item name="remark" label="备注" style={{ marginTop: 16 }}>
              <TextArea rows={2} placeholder="请输入备注信息" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setReturnModalVisible(false)}>取消</Button>
                <Button 
                  type="primary" 
                  icon={<UndoOutlined />}
                  loading={returning}
                  onClick={handleReturnSubmit}
                >
                  确认归还
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
