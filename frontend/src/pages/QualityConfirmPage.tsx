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
  Checkbox,
  Alert
} from 'antd';
import { 
  CheckOutlined, 
  EyeOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { applicationsApi } from '../api/applications';
import { 
  BorrowApplication, 
  BorrowApplicationItem, 
  ToolRiskLevel 
} from '../types';
import { 
  riskLevelLabels,
  riskLevelColors
} from '../utils/constants';
import dayjs from 'dayjs';

interface QualityItemResult {
  tool_id: string;
  verified: boolean;
  remark?: string;
}

export default function QualityConfirmPage() {
  const [applications, setApplications] = useState<BorrowApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailVisible, setDetailVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [currentApp, setCurrentApp] = useState<(BorrowApplication & { items: BorrowApplicationItem[] }) | null>(null);
  const [confirmForm] = Form.useForm();
  const [confirming, setConfirming] = useState(false);

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

  const handleConfirm = async (id: string) => {
    try {
      const response = await applicationsApi.getApplication(id);
      if (response.success && response.data) {
        setCurrentApp(response.data);
        confirmForm.resetFields();
        
        const initialResults: QualityItemResult[] = (response.data.items || []).map(item => ({
          tool_id: item.tool_id,
          verified: false,
          remark: ''
        }));
        confirmForm.setFieldsValue({
          itemResults: initialResults,
          remark: ''
        });
        
        setConfirmModalVisible(true);
      }
    } catch (error) {
      console.error('Failed to load application:', error);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!currentApp) return;

    try {
      const values = await confirmForm.validateFields();
      setConfirming(true);

      const today = new Date().toISOString().split('T')[0];
      const items = currentApp.items || [];
      const hasExpired = items.some(item => {
        const appItem = items.find(i => i.tool_id === item.tool_id);
        return false;
      });

      const response = await applicationsApi.qualityConfirm(
        currentApp.id,
        values.itemResults,
        values.remark
      );

      if (response.success) {
        message.success('校准确认完成');
        setConfirmModalVisible(false);
        loadApplications();
      }
    } catch (error: any) {
      if (error?.response?.data?.message) {
        message.error(error.response.data.message);
      }
    } finally {
      setConfirming(false);
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
      title: '工具数量',
      key: 'toolCount',
      width: 100,
      render: (_: any, record: BorrowApplication) => {
        return record.items?.length || 0;
      }
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
          <Button 
            type="primary" 
            size="small" 
            icon={<SafetyCertificateOutlined />}
            onClick={() => handleConfirm(record.id)}
          >
            校准确认
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">校准确认</h2>
      </div>

      <Alert
        message="校准确认说明"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>质量员负责确认所有借用工具的校准状态</li>
            <li>校准过期的工具不能借出，需要退回申请</li>
            <li>请逐一核对工具的校准证书有效期</li>
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
          showTotal: (total) => `共 ${total} 条待确认`,
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
                        <span>数量：{item.apply_quantity}</span>
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
        title="校准确认"
        open={confirmModalVisible}
        onCancel={() => setConfirmModalVisible(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        {currentApp && (
          <Form form={confirmForm} layout="vertical">
            <Alert
              message="请逐一核对工具的校准状态"
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

            <Form.List name="itemResults">
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
                    <div style={{ flex: 3 }}>工具信息</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>校准状态</div>
                    <div style={{ flex: 1, textAlign: 'center' }}>核验</div>
                  </div>
                  {fields.map((field, index) => {
                    const item = currentApp.items?.[index];
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
                        <div style={{ flex: 3 }}>
                          <div style={{ fontWeight: 500 }}>{item?.tool_name}</div>
                          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                            {item?.tool_code} | 数量：{item?.apply_quantity}
                          </div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          {item?.calibration_verified ? (
                            <Tag color="green">已校准</Tag>
                          ) : (
                            <Tag color="orange">待核验</Tag>
                          )}
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <Form.Item
                            {...field}
                            name={[field.name, 'verified']}
                            valuePropName="checked"
                            style={{ marginBottom: 0 }}
                          >
                            <Checkbox />
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
                <Button onClick={() => setConfirmModalVisible(false)}>取消</Button>
                <Button 
                  type="primary" 
                  icon={<CheckOutlined />}
                  loading={confirming}
                  onClick={handleConfirmSubmit}
                >
                  确认通过
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
