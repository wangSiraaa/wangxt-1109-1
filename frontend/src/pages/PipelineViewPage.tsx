import { useState, useEffect } from 'react';
import { 
  Card, 
  Timeline, 
  Tag, 
  Button, 
  Space, 
  Input, 
  Select, 
  Table,
  Row,
  Col,
  Descriptions,
  Modal,
  Typography,
  Empty,
  Spin
} from 'antd';
import { 
  SearchOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  SendOutlined,
  SafetyCertificateOutlined,
  UndoOutlined,
  WarningOutlined,
  SwapOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  GitBranchOutlined
} from '@ant-design/icons';
import { applicationsApi } from '../api/applications';
import { shiftsApi } from '../api/shifts';
import { 
  BorrowApplication, 
  ApplicationStatus,
  OperationLog,
  Shift 
} from '../types';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Option } = Select;
const { Title, Text } = Typography;

const applicationStatusLabels: Record<ApplicationStatus, string> = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已审批',
  rejected: '已驳回',
  issued: '已发放',
  returned: '已归还',
  partial_returned: '部分归还'
};

const applicationStatusColors: Record<ApplicationStatus, string> = {
  draft: 'default',
  pending_approval: 'orange',
  approved: 'green',
  rejected: 'red',
  issued: 'blue',
  returned: 'green',
  partial_returned: 'orange'
};

const pipelineSteps = [
  { key: 'application', icon: <FileTextOutlined />, label: '申请', color: '#1890ff' },
  { key: 'approval', icon: <CheckCircleOutlined />, label: '审批', color: '#52c41a' },
  { key: 'second_confirm', icon: <UserOutlined />, label: '双人确认', color: '#722ed1' },
  { key: 'quality_confirm', icon: <SafetyCertificateOutlined />, label: '校准确认', color: '#13c2c2' },
  { key: 'issue', icon: <SendOutlined />, label: '发放', color: '#fa8c16' },
  { key: 'return', icon: <UndoOutlined />, label: '归还', color: '#eb2f96' },
  { key: 'investigation', icon: <WarningOutlined />, label: '调查', color: '#f5222d' },
  { key: 'quality_review', icon: <SafetyCertificateOutlined />, label: '质量复核', color: '#2f54eb' },
  { key: 'handover', icon: <SwapOutlined />, label: '交接', color: '#a0d911' }
];

interface PipelineNode {
  step: typeof pipelineSteps[number];
  status: 'pending' | 'active' | 'completed' | 'skipped';
  time?: string;
  operator?: string;
  detail?: string;
}

export default function PipelineViewPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<BorrowApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<BorrowApplication | null>(null);
  const [pipelineNodes, setPipelineNodes] = useState<PipelineNode[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    loadApplications();
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

  const loadApplications = async () => {
    setLoading(true);
    try {
      const response = await applicationsApi.getApplications({
        keyword: keyword || undefined,
        status: statusFilter,
        page,
        pageSize
      });
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

  const loadOperationLogs = async (applicationId: string) => {
    setLoadingLogs(true);
    try {
      const response = await shiftsApi.getOperationLogs({
        business_id: applicationId,
        pageSize: 100
      });
      if (response.success && response.data) {
        setOperationLogs(response.data);
      }
    } catch (error) {
      console.error('Failed to load operation logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const buildPipeline = (application: BorrowApplication): PipelineNode[] => {
    const nodes: PipelineNode[] = [];
    const isHighRisk = application.risk_level === 'high';

    nodes.push({
      step: pipelineSteps[0],
      status: 'completed',
      time: application.created_at,
      operator: application.applicant_name,
      detail: `创建申请单：${application.application_no}`
    });

    if (application.status === 'draft') {
      nodes.push({ step: pipelineSteps[1], status: 'pending' });
      if (isHighRisk) nodes.push({ step: pipelineSteps[2], status: 'pending' });
      nodes.push({ step: pipelineSteps[3], status: 'pending' });
      nodes.push({ step: pipelineSteps[4], status: 'pending' });
      return nodes;
    }

    nodes.push({
      step: pipelineSteps[1],
      status: application.status === 'rejected' ? 'skipped' : application.status !== 'pending_approval' ? 'completed' : 'active',
      time: application.approve_time,
      operator: application.approver_name,
      detail: application.status === 'rejected' ? '申请已驳回' : `审批${application.approver_name ? '通过' : '待处理'}`
    });

    if (isHighRisk) {
      nodes.push({
        step: pipelineSteps[2],
        status: application.second_confirmer_id ? 'completed' : 
                (application.status === 'approved' || application.status === 'issued' || application.status === 'returned' ? 'active' : 'pending'),
        time: application.second_confirm_time,
        operator: application.second_confirmer_name,
        detail: application.second_confirmer_name 
          ? `双人确认：${application.second_confirmer_name}` 
          : '高风险维修需双人确认'
      });
    }

    nodes.push({
      step: pipelineSteps[3],
      status: application.quality_confirmer_id ? 'completed' : 
              (application.status === 'approved' || application.status === 'issued' || application.status === 'returned' ? 'active' : 'pending'),
      time: application.quality_confirm_time,
      operator: application.quality_confirmer_name,
      detail: application.quality_confirmer_name 
        ? `校准确认：${application.quality_confirmer_name}` 
        : '待质量员校准确认'
    });

    nodes.push({
      step: pipelineSteps[4],
      status: application.status === 'issued' || application.status === 'returned' || application.status === 'partial_returned' ? 'completed' : 'pending',
      time: undefined,
      operator: undefined,
      detail: application.status === 'issued' || application.status === 'returned' || application.status === 'partial_returned' 
        ? '工具已发放' : '待发放'
    });

    if (application.status === 'returned' || application.status === 'partial_returned') {
      nodes.push({
        step: pipelineSteps[5],
        status: 'completed',
        operator: application.applicant_name,
        detail: application.status === 'partial_returned' ? '部分归还，存在缺件' : '全部归还完成'
      });
    } else {
      nodes.push({ step: pipelineSteps[5], status: 'pending' });
    }

    if (application.status === 'partial_returned') {
      nodes.push({
        step: pipelineSteps[6],
        status: 'active',
        detail: '缺件调查中'
      });
      nodes.push({
        step: pipelineSteps[7],
        status: 'pending',
        detail: '待质量员复核'
      });
    }

    return nodes;
  };

  const handleViewPipeline = async (application: BorrowApplication) => {
    setSelectedApplication(application);
    setPipelineNodes(buildPipeline(application));
    loadOperationLogs(application.id);
    setDetailVisible(true);
  };

  const columns = [
    {
      title: '申请单号',
      dataIndex: 'application_no',
      key: 'application_no',
      width: 140,
      render: (text: string) => (
        <Space>
          <FileTextOutlined />
          <span style={{ fontFamily: 'monospace' }}>{text}</span>
        </Space>
      )
    },
    {
      title: '申请人',
      dataIndex: 'applicant_name',
      key: 'applicant_name',
      width: 100
    },
    {
      title: '工单/用途',
      key: 'purpose',
      width: 150,
      render: (_: any, record: BorrowApplication) => (
        <div>
          {record.work_order_no && <div><Tag color="blue">工单</Tag> {record.work_order_no}</div>}
          {record.purpose && <div style={{ color: '#666', fontSize: 12 }}>{record.purpose}</div>}
        </div>
      )
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 80,
      render: (level: string) => {
        const colors: Record<string, string> = {
          low: 'green',
          medium: 'orange',
          high: 'red'
        };
        const labels: Record<string, string> = {
          low: '低',
          medium: '中',
          high: '高'
        };
        return <Tag color={colors[level] || 'default'}>{labels[level] || level}</Tag>;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ApplicationStatus) => (
        <Tag color={applicationStatusColors[status]}>
          {applicationStatusLabels[status]}
        </Tag>
      )
    },
    {
      title: '当前阶段',
      key: 'current_step',
      render: (_: any, record: BorrowApplication) => {
        const nodes = buildPipeline(record);
        const activeNode = nodes.find(n => n.status === 'active');
        const lastCompleted = [...nodes].reverse().find(n => n.status === 'completed');
        const current = activeNode || lastCompleted;
        return current ? (
          <Tag color={current.step.color} style={{ border: 0, padding: '4px 8px' }}>
            {current.step.icon} {current.step.label}
          </Tag>
        ) : '-';
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (time: string) => dayjs(time).format('MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: BorrowApplication) => (
        <Button 
          type="link" 
          size="small" 
          icon={<GitBranchOutlined />}
          onClick={() => handleViewPipeline(record)}
        >
          查看流水线
        </Button>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            {currentShift && (
              <Tag color="green" style={{ padding: '4px 12px', fontSize: 13 }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                当前班次：{currentShift.shift_name}
              </Tag>
            )}
          </Col>
          <Col flex="auto">
            <Space>
              <Input.Search
                placeholder="搜索申请单号/工单/申请人"
                allowClear
                style={{ width: 250 }}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onSearch={() => { setPage(1); loadApplications(); }}
              />
              <Select
                placeholder="状态筛选"
                style={{ width: 150 }}
                allowClear
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                  setTimeout(loadApplications, 0);
                }}
              >
                <Option value="pending_approval">待审批</Option>
                <Option value="approved">已审批</Option>
                <Option value="issued">进行中</Option>
                <Option value="partial_returned">缺件待处理</Option>
                <Option value="returned">已完成</Option>
              </Select>
              <Button type="primary" icon={<SearchOutlined />} onClick={loadApplications}>
                查询
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={applications}
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
        title="作业流水线"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={900}
        bodyStyle={{ maxHeight: '75vh', overflow: 'auto' }}
      >
        {selectedApplication && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={3} size="small">
                <Descriptions.Item label="申请单号">
                  <span style={{ fontFamily: 'monospace' }}>{selectedApplication.application_no}</span>
                </Descriptions.Item>
                <Descriptions.Item label="申请人">{selectedApplication.applicant_name}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={applicationStatusColors[selectedApplication.status]}>
                    {applicationStatusLabels[selectedApplication.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="风险等级">
                  {selectedApplication.risk_level === 'high' 
                    ? <Tag color="red">高风险（需双人确认）</Tag>
                    : selectedApplication.risk_level === 'medium'
                    ? <Tag color="orange">中风险</Tag>
                    : <Tag color="green">低风险</Tag>
                  }
                </Descriptions.Item>
                <Descriptions.Item label="工单">{selectedApplication.work_order_no || '-'}</Descriptions.Item>
                <Descriptions.Item label="用途">{selectedApplication.purpose || '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Title level={5} style={{ marginTop: 0, marginBottom: 16 }}>
              <GitBranchOutlined style={{ marginRight: 8 }} />
              流程追踪
            </Title>

            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              {pipelineNodes.length > 0 ? (
                <Timeline
                  mode="left"
                  items={pipelineNodes.map(node => ({
                    color: node.status === 'completed' ? node.step.color : 
                           node.status === 'active' ? node.step.color : '#d9d9d9',
                    dot: node.status === 'active' 
                      ? <div style={{ 
                          width: 16, height: 16, borderRadius: '50%', 
                          background: node.step.color,
                          display: 'flex', alignItems: 'center', 
                          justifyContent: 'center',
                          animation: 'pulse 1.5s infinite'
                        }}>
                          <span style={{ color: '#fff', fontSize: 10 }}>{node.step.icon}</span>
                        </div>
                      : node.step.icon,
                    children: (
                      <div style={{ 
                        opacity: node.status === 'pending' ? 0.5 : 1,
                        padding: '4px 0'
                      }}>
                        <Space>
                          <Tag 
                            color={node.step.color} 
                            style={{ 
                              border: 0, 
                              padding: '4px 10px',
                              fontWeight: 600
                            }}
                          >
                            {node.step.label}
                          </Tag>
                          {node.status === 'active' && (
                            <Tag color="processing" style={{ animation: 'pulse 1.5s infinite' }}>
                              进行中
                            </Tag>
                          )}
                          {node.status === 'skipped' && <Tag>已跳过</Tag>}
                        </Space>
                        <div style={{ marginTop: 8, color: '#666' }}>
                          {node.detail}
                        </div>
                        <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
                          {node.operator && <><UserOutlined /> {node.operator}  </>}
                          {node.time && <><ClockCircleOutlined /> {dayjs(node.time).format('MM-DD HH:mm')}</>}
                        </div>
                      </div>
                    )
                  }))}
                />
              ) : (
                <Empty description="暂无流程数据" />
              )}
            </Card>

            <Title level={5} style={{ marginBottom: 12 }}>
              操作日志
            </Title>

            <Spin spinning={loadingLogs}>
              {operationLogs.length > 0 ? (
                <Table
                  size="small"
                  dataSource={operationLogs}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    {
                      title: '操作时间',
                      dataIndex: 'created_at',
                      key: 'created_at',
                      width: 160,
                      render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss')
                    },
                    {
                      title: '操作人',
                      dataIndex: 'operator_name',
                      key: 'operator_name',
                      width: 100,
                      render: (name: string, record: OperationLog) => (
                        <Space>
                          <span>{name}</span>
                          <Tag size="small">
                            {record.operator_role === 'admin' ? '管理员' : 
                             record.operator_role === 'quality' ? '质量员' : '机务员'}
                          </Tag>
                        </Space>
                      )
                    },
                    {
                      title: '操作类型',
                      dataIndex: 'operation_type',
                      key: 'operation_type',
                      width: 140,
                      render: (type: string) => {
                        const labels: Record<string, string> = {
                          create_application: '创建申请',
                          submit_application: '提交申请',
                          approve_application: '审批申请',
                          reject_application: '驳回申请',
                          second_confirm_application: '双人确认',
                          quality_confirm_calibration: '校准确认',
                          issue_tools: '发放工具',
                          return_tools: '归还工具',
                          return_tools_missing: '归还缺件',
                          create_investigation_report: '创建调查单',
                          submit_investigation_result: '提交调查结果',
                          quality_review_investigation: '质量复核',
                          close_investigation_report: '关闭调查单'
                        };
                        return <code style={{ background: '#f5f5f5', padding: '2px 6px' }}>
                          {labels[type] || type}
                        </code>;
                      }
                    },
                    {
                      title: '操作详情',
                      dataIndex: 'detail',
                      key: 'detail',
                      render: (detail: string) => detail || '-'
                    }
                  ]}
                />
              ) : (
                <Empty description="暂无操作日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
            </Spin>
          </div>
        )}
      </Modal>
    </div>
  );
}
