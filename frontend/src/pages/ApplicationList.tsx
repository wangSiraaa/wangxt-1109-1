import { useState, useEffect } from 'react';
import { 
  Table, 
  Button, 
  Space, 
  Input, 
  Select, 
  Tag, 
  Modal, 
  message,
  Popconfirm,
  Row,
  Col,
  Descriptions,
  List
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined, 
  CheckOutlined, 
  CloseOutlined,
  DeleteOutlined,
  UserOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { applicationsApi } from '../api/applications';
import { BorrowApplication, ApplicationStatus, ToolRiskLevel, BorrowApplicationItem } from '../types';
import { 
  applicationStatusLabels, 
  applicationStatusColors, 
  riskLevelLabels, 
  riskLevelColors 
} from '../utils/constants';
import dayjs from 'dayjs';

const { Option } = Select;

export default function ApplicationList() {
  const [applications, setApplications] = useState<BorrowApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [riskFilter, setRiskFilter] = useState<string | undefined>();
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<BorrowApplication & { items: BorrowApplicationItem[] } | null>(null);
  const { hasRole, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadApplications();
  }, [page, pageSize]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const params: any = {
        keyword: keyword || undefined,
        status: statusFilter,
        risk_level: riskFilter,
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

  const handleSearch = () => {
    setPage(1);
    loadApplications();
  };

  const handleReset = () => {
    setKeyword('');
    setStatusFilter(undefined);
    setRiskFilter(undefined);
    setPage(1);
    setTimeout(loadApplications, 0);
  };

  const handleViewDetail = async (id: string) => {
    try {
      const response = await applicationsApi.getApplication(id);
      if (response.success && response.data) {
        setCurrentDetail(response.data);
        setDetailVisible(true);
      }
    } catch (error) {
      console.error('Failed to load application detail:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await applicationsApi.approveApplication(id);
      if (response.success) {
        message.success('审批通过');
        loadApplications();
      }
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await applicationsApi.rejectApplication(id);
      if (response.success) {
        message.success('已驳回');
        loadApplications();
      }
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await applicationsApi.deleteApplication(id);
      if (response.success) {
        message.success('删除成功');
        loadApplications();
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleSecondConfirm = async (id: string) => {
    try {
      const response = await applicationsApi.secondConfirm(id);
      if (response.success) {
        message.success('双人确认成功');
        loadApplications();
      }
    } catch (error) {
      console.error('Failed to second confirm:', error);
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
      title: '维修类型',
      dataIndex: 'work_type',
      width: 100
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
      render: (status: ApplicationStatus) => (
        <Tag color={applicationStatusColors[status]}>
          {applicationStatusLabels[status]}
        </Tag>
      )
    },
    {
      title: '预计归还日期',
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
      width: 200,
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
          
          {hasRole('admin') && record.status === 'pending_approval' && (
            <>
              <Button 
                type="link" 
                size="small" 
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                通过
              </Button>
              <Button 
                type="link" 
                size="small" 
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReject(record.id)}
              >
                驳回
              </Button>
            </>
          )}

          {hasRole('technician') && record.risk_level === 'high' && 
           record.status === 'approved' && !record.second_confirmer_id &&
           record.applicant_id !== user?.id && (
            <Button 
              type="link" 
              size="small"
              onClick={() => handleSecondConfirm(record.id)}
            >
              双人确认
            </Button>
          )}

          {(record.status === 'draft' || record.status === 'rejected') && 
           record.applicant_id === user?.id && (
            <Popconfirm
              title="确定要删除这个申请单吗？"
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
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">申请管理</h2>
        {hasRole('technician') && (
          <Button type="primary" onClick={() => navigate('/apply')}>
            新建申请
          </Button>
        )}
      </div>

      <div className="search-bar">
        <Row gutter={16}>
          <Col span={6}>
            <Input 
              placeholder="搜索申请单号/工单号/用途" 
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
              <Option value="draft">草稿</Option>
              <Option value="pending_approval">待审批</Option>
              <Option value="approved">已审批</Option>
              <Option value="rejected">已驳回</Option>
              <Option value="issued">已发放</Option>
              <Option value="returned">已归还</Option>
              <Option value="partial_returned">部分归还</Option>
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
          showTotal: (total) => `共 ${total} 条`,
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
        {currentDetail && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="申请单号">{currentDetail.application_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={applicationStatusColors[currentDetail.status]}>
                  {applicationStatusLabels[currentDetail.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申请人">{currentDetail.applicant_name}</Descriptions.Item>
              <Descriptions.Item label="工单号">{currentDetail.work_order_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="维修类型">{currentDetail.work_type || '-'}</Descriptions.Item>
              <Descriptions.Item label="风险等级">
                {currentDetail.risk_level ? (
                  <Tag color={riskLevelColors[currentDetail.risk_level]}>
                    {riskLevelLabels[currentDetail.risk_level]}
                  </Tag>
                ) : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="预计归还日期">{currentDetail.expected_return_date || '-'}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {dayjs(currentDetail.created_at).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              {currentDetail.second_confirmer_name && (
                <Descriptions.Item label="第二确认人">
                  {currentDetail.second_confirmer_name}
                  <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 8 }}>
                    {dayjs(currentDetail.second_confirm_time).format('YYYY-MM-DD HH:mm')}
                  </span>
                </Descriptions.Item>
              )}
              {currentDetail.quality_confirmer_name && (
                <Descriptions.Item label="校准确认人">
                  {currentDetail.quality_confirmer_name}
                  <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 8 }}>
                    {dayjs(currentDetail.quality_confirm_time).format('YYYY-MM-DD HH:mm')}
                  </span>
                </Descriptions.Item>
              )}
              {currentDetail.approver_name && (
                <Descriptions.Item label="审批人">
                  {currentDetail.approver_name}
                  <span style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 8 }}>
                    {dayjs(currentDetail.approve_time).format('YYYY-MM-DD HH:mm')}
                  </span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="用途" span={2}>
                {currentDetail.purpose || '-'}
              </Descriptions.Item>
              {currentDetail.remark && (
                <Descriptions.Item label="备注" span={2}>
                  {currentDetail.remark}
                </Descriptions.Item>
              )}
            </Descriptions>

            <h4 style={{ marginBottom: 12 }}>工具清单</h4>
            <List
              size="small"
              bordered
              dataSource={currentDetail.items || []}
              renderItem={(item: BorrowApplicationItem) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.tool_code}</span>
                        <span style={{ fontWeight: 500 }}>{item.tool_name}</span>
                      </Space>
                    }
                    description={
                      <Space size="large">
                        <span>规格：{item.specification || '-'}</span>
                        <span>申请数量：{item.apply_quantity}</span>
                        <span>实发数量：{item.actual_quantity || 0}</span>
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
    </div>
  );
}
