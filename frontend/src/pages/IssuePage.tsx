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
  InputNumber,
  Form,
  Input,
  Alert,
  Card
} from 'antd';
import { 
  SendOutlined, 
  EyeOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { applicationsApi } from '../api/applications';
import { 
  BorrowApplication, 
  BorrowApplicationItem, 
  ApplicationStatus,
  ToolRiskLevel 
} from '../types';
import { 
  applicationStatusLabels, 
  applicationStatusColors,
  riskLevelLabels,
  riskLevelColors
} from '../utils/constants';
import dayjs from 'dayjs';

export default function IssuePage() {
  const [applications, setApplications] = useState<BorrowApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailVisible, setDetailVisible] = useState(false);
  const [issueModalVisible, setIssueModalVisible] = useState(false);
  const [currentApp, setCurrentApp] = useState<(BorrowApplication & { items: BorrowApplicationItem[] }) | null>(null);
  const [issueForm] = Form.useForm();
  const [issuing, setIssuing] = useState(false);
  const { hasRole } = useAuth();

  useEffect(() => {
    loadApplications();
  }, [page, pageSize]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const response = await applicationsApi.getPendingIssue({ page, pageSize });
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

  const handleIssue = async (id: string) => {
    try {
      const response = await applicationsApi.getApplication(id);
      if (response.success && response.data) {
        setCurrentApp(response.data);
        issueForm.resetFields();
        
        const initialItems = (response.data.items || []).map(item => ({
          tool_id: item.tool_id,
          actual_quantity: item.apply_quantity
        }));
        issueForm.setFieldsValue({
          actualItems: initialItems,
          remark: ''
        });
        
        setIssueModalVisible(true);
      }
    } catch (error) {
      console.error('Failed to load application:', error);
    }
  };

  const handleIssueSubmit = async () => {
    if (!currentApp) return;

    try {
      const values = await issueForm.validateFields();
      setIssuing(true);

      const response = await applicationsApi.issueTools(
        currentApp.id,
        values.actualItems,
        values.remark
      );

      if (response.success) {
        message.success('发放成功');
        setIssueModalVisible(false);
        loadApplications();
      }
    } catch (error) {
      console.error('Failed to issue:', error);
    } finally {
      setIssuing(false);
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
      title: '双人确认',
      dataIndex: 'second_confirmer_name',
      width: 120,
      render: (name?: string, record?: BorrowApplication) => {
        if (record?.risk_level !== 'high') return '-';
        return name ? (
          <Tag color="green">已确认 - {name}</Tag>
        ) : (
          <Tag color="orange">待确认</Tag>
        );
      }
    },
    {
      title: '校准确认',
      dataIndex: 'quality_confirmer_name',
      width: 120,
      render: (name?: string) => name ? (
        <Tag color="green">已确认 - {name}</Tag>
      ) : (
        <Tag color="orange">待确认</Tag>
      )
    },
    {
      title: '预计归还',
      dataIndex: 'expected_return_date',
      width: 120
    },
    {
      title: '申请时间',
      dataIndex: 'created_at',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
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
          {hasRole('admin') && (
            <Button 
              type="primary" 
              size="small" 
              icon={<SendOutlined />}
              disabled={
                (record.risk_level === 'high' && !record.second_confirmer_id) ||
                !record.quality_confirmer_id
              }
              onClick={() => handleIssue(record.id)}
            >
              发放
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">工具发放</h2>
      </div>

      <Alert
        message="发放说明"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>高风险维修任务需要双人确认工具清单</li>
            <li>所有工具借用均需质量员确认校准状态</li>
            <li>校准过期的工具不能借出</li>
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
        scroll={{ x: 1300 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条待发放`,
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

            <h4 style={{ marginBottom: 12 }}>工具清单</h4>
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
                        <span>申请数量：{item.apply_quantity}</span>
                        {item.calibration_verified ? (
                          <Tag color="green">校准已核验</Tag>
                        ) : (
                          <Tag color="default">待核验</Tag>
                        )}
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
        title="工具发放确认"
        open={issueModalVisible}
        onCancel={() => setIssueModalVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {currentApp && (
          <Form form={issueForm} layout="vertical">
            <Alert
              message="请核对实际发放的工具数量"
              type="warning"
              showIcon
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

            <Form.List name="actualItems">
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
                    <div style={{ flex: 1, textAlign: 'center' }}>申请数量</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>实发数量</div>
                  </div>
                  {fields.map((field, index) => {
                    const item = currentApp.items?.[index];
                    return (
                      <div 
                        key={field.key}
                        style={{ 
                          display: 'flex', 
                          padding: '8px 16px',
                          borderBottom: index < (currentApp.items?.length || 0) - 1 ? '1px solid #f0f0f0' : 'none',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 2 }}>
                          <div style={{ fontWeight: 500 }}>{item?.tool_name}</div>
                          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{item?.tool_code}</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          {item?.apply_quantity}
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <Form.Item
                            {...field}
                            name={[field.name, 'actual_quantity']}
                            style={{ marginBottom: 0 }}
                          >
                            <InputNumber 
                              min={0} 
                              max={item?.apply_quantity || 999}
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
                      </div>
                    );
                  })}
                </div>
              )}
            </Form.List>

            <Form.Item name="remark" label="备注" style={{ marginTop: 16 }}>
              <Input.TextArea rows={2} placeholder="请输入备注信息" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setIssueModalVisible(false)}>取消</Button>
                <Button 
                  type="primary" 
                  loading={issuing}
                  onClick={handleIssueSubmit}
                >
                  确认发放
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
