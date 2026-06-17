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
  Divider,
  Alert
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { investigationApi } from '../api/misc';
import { shiftsApi } from '../api/shifts';
import { InvestigationReport, InvestigationStatus, ShiftHandover } from '../types';
import { investigationStatusLabels, investigationStatusColors } from '../utils/constants';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

export default function InvestigationList() {
  const { user, hasRole } = useAuth();
  const [reports, setReports] = useState<InvestigationReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [detailVisible, setDetailVisible] = useState(false);
  const [submitInvestigationVisible, setSubmitInvestigationVisible] = useState(false);
  const [qualityReviewVisible, setQualityReviewVisible] = useState(false);
  const [currentReport, setCurrentReport] = useState<InvestigationReport | null>(null);
  const [relatedHandover, setRelatedHandover] = useState<ShiftHandover | null>(null);
  const [submitForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    loadReports();
  }, [page, pageSize]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await investigationApi.getReports({
        keyword: keyword || undefined,
        status: statusFilter,
        page,
        pageSize
      });
      if (response.success) {
        setReports(response.data || []);
        setTotal(response.total || 0);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadReports();
  };

  const handleReset = () => {
    setKeyword('');
    setStatusFilter(undefined);
    setPage(1);
    setTimeout(loadReports, 0);
  };

  const loadRelatedHandover = async (handoverId: string) => {
    try {
      const response = await shiftsApi.getHandover(handoverId);
      if (response.success && response.data) {
        setRelatedHandover(response.data);
      }
    } catch (error) {
      console.error('Failed to load handover:', error);
    }
  };

  const handleViewDetail = async (id: string) => {
    try {
      const response = await investigationApi.getReport(id);
      if (response.success && response.data) {
        setCurrentReport(response.data);
        setRelatedHandover(null);
        if (response.data.handover_id) {
          await loadRelatedHandover(response.data.handover_id);
        }
        setDetailVisible(true);
      }
    } catch (error) {
      console.error('Failed to load report detail:', error);
    }
  };

  const handleSubmitInvestigation = (report: InvestigationReport) => {
    setCurrentReport(report);
    submitForm.resetFields();
    setSubmitInvestigationVisible(true);
  };

  const handleQualityReview = (report: InvestigationReport) => {
    setCurrentReport(report);
    reviewForm.resetFields();
    setQualityReviewVisible(true);
  };

  const doSubmitInvestigation = async () => {
    if (!currentReport) return;

    try {
      const values = await submitForm.validateFields();
      setSubmitting(true);

      const response = await investigationApi.submitInvestigation(
        currentReport.id,
        values.investigation_result,
        values.handle_remark
      );
      
      if (response.success) {
        message.success('调查结果已提交，等待质量员复核');
        setSubmitInvestigationVisible(false);
        loadReports();
      } else {
        message.error(response.message || '提交失败');
      }
    } catch (error) {
      console.error('Failed to submit investigation:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const doQualityReview = async (passed: boolean) => {
    if (!currentReport) return;

    try {
      const values = await reviewForm.validateFields();
      setReviewing(true);

      const response = await investigationApi.qualityReview(
        currentReport.id,
        passed,
        values.review_remark
      );
      
      if (response.success) {
        message.success(passed ? '复核通过，工具状态已恢复可借' : '复核驳回，返回调查中');
        setQualityReviewVisible(false);
        loadReports();
      } else {
        message.error(response.message || '复核失败');
      }
    } catch (error) {
      console.error('Failed to quality review:', error);
    } finally {
      setReviewing(false);
    }
  };

  const renderActionButtons = (record: InvestigationReport) => {
    const buttons: JSX.Element[] = [
      <Button 
        key="detail"
        type="link" 
        size="small" 
        icon={<EyeOutlined />}
        onClick={() => handleViewDetail(record.id)}
      >
        详情
      </Button>
    ];

    if (record.status === 'closed') return <Space size="small">{buttons}</Space>;

    if (hasRole('admin') && (record.status === 'pending' || record.status === 'investigating')) {
      buttons.push(
        <Button 
          key="submit"
          type="primary" 
          size="small" 
          onClick={() => handleSubmitInvestigation(record)}
        >
          提交调查
        </Button>
      );
    }

    if (hasRole('quality') && record.status === 'quality_review') {
      buttons.push(
        <Button 
          key="review"
          type="primary" 
          size="small" 
          onClick={() => handleQualityReview(record)}
        >
          质量复核
        </Button>
      );
    }

    return <Space size="small">{buttons}</Space>;
  };

  const columns = [
    {
      title: '调查单号',
      dataIndex: 'report_no',
      width: 160,
      render: (no: string) => <span style={{ fontWeight: 500 }}>{no}</span>
    },
    {
      title: '关联申请单',
      dataIndex: 'application_no',
      width: 160
    },
    {
      title: '关联交接单',
      dataIndex: 'handover_id',
      width: 160,
      render: (id?: string) => id ? (
        <Tag color="blue" icon={<FileTextOutlined />}>
          已绑定
        </Tag>
      ) : <span style={{ color: '#999' }}>未绑定</span>
    },
    {
      title: '报告人',
      dataIndex: 'reporter_name',
      width: 100
    },
    {
      title: '缺失工具',
      dataIndex: 'missing_tools',
      width: 200,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (status: InvestigationStatus) => (
        <Tag color={investigationStatusColors[status]}>
          {investigationStatusLabels[status]}
        </Tag>
      )
    },
    {
      title: '处理人',
      dataIndex: 'handler_name',
      width: 100,
      render: (name?: string) => name || '-'
    },
    {
      title: '报告时间',
      dataIndex: 'report_time',
      width: 160,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, record: InvestigationReport) => renderActionButtons(record)
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">调查单管理</h2>
      </div>

      {hasRole('quality') && (
        <Alert
          message="质量员须知"
          description="调查单状态为「待质量复核」时，您可以进行复核。复核通过后，工具状态将恢复为可借；复核驳回则返回调查中状态。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div className="search-bar">
        <Row gutter={16}>
          <Col span={8}>
            <Input 
              placeholder="搜索调查单号/申请单号/缺失工具" 
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
              <Option value="pending">待处理</Option>
              <Option value="investigating">调查中</Option>
              <Option value="quality_review">待质量复核</Option>
              <Option value="closed">已关闭</Option>
            </Select>
          </Col>
          <Col span={12}>
            <Space>
              <Button type="primary" onClick={handleSearch}>搜索</Button>
              <Button onClick={handleReset}>重置</Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Table
        columns={columns}
        dataSource={reports}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1400 }}
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
        title="调查单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {currentReport && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="调查单号">{currentReport.report_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={investigationStatusColors[currentReport.status]}>
                  {investigationStatusLabels[currentReport.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="关联申请单">{currentReport.application_no}</Descriptions.Item>
              <Descriptions.Item label="报告人">{currentReport.reporter_name}</Descriptions.Item>
              <Descriptions.Item label="报告时间">
                {dayjs(currentReport.report_time).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
              <Descriptions.Item label="处理人">
                {currentReport.handler_name || '-'}
              </Descriptions.Item>
              {currentReport.handle_time && (
                <Descriptions.Item label="处理时间">
                  {dayjs(currentReport.handle_time).format('YYYY-MM-DD HH:mm')}
                </Descriptions.Item>
              )}
              {currentReport.quality_reviewer_name && (
                <>
                  <Descriptions.Item label="质量复核人">
                    {currentReport.quality_reviewer_name}
                  </Descriptions.Item>
                  {currentReport.quality_review_time && (
                    <Descriptions.Item label="质量复核时间">
                      {dayjs(currentReport.quality_review_time).format('YYYY-MM-DD HH:mm')}
                    </Descriptions.Item>
                  )}
                </>
              )}
              <Descriptions.Item label="缺失工具" span={2}>
                {currentReport.missing_tools}
              </Descriptions.Item>
            </Descriptions>

            {relatedHandover && (
              <>
                <Divider orientation="left" style={{ margin: '16px 0 8px' }}>
                  关联交接记录
                </Divider>
                <div style={{ 
                  padding: 12, 
                  background: '#f0f5ff', 
                  borderRadius: 4,
                  marginBottom: 16 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span><strong>交接单号：</strong>{relatedHandover.handover_no}</span>
                    <Tag color={relatedHandover.status === 'confirmed' ? 'green' : relatedHandover.status === 'rejected' ? 'red' : 'orange'}>
                      {relatedHandover.status === 'confirmed' ? '已确认' : relatedHandover.status === 'rejected' ? '已拒绝' : '待确认'}
                    </Tag>
                  </div>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <span><UserOutlined /> 交班人：{relatedHandover.from_user_name}</span>
                    <span><UserOutlined /> 接班人：{relatedHandover.to_user_name}</span>
                    <span><ClockCircleOutlined /> 交接时间：{dayjs(relatedHandover.handover_time).format('YYYY-MM-DD HH:mm')}</span>
                  </div>
                  {relatedHandover.remark && (
                    <div style={{ marginTop: 8 }}>
                      <strong>交接备注：</strong>{relatedHandover.remark}
                    </div>
                  )}
                </div>
              </>
            )}

            {currentReport.incident_description && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>事件描述</h4>
                <p style={{ 
                  padding: 12, 
                  background: '#fafafa', 
                  borderRadius: 4,
                  margin: 0 
                }}>
                  {currentReport.incident_description}
                </p>
              </div>
            )}

            {currentReport.investigation_result && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>调查结果</h4>
                <p style={{ 
                  padding: 12, 
                  background: '#fafafa', 
                  borderRadius: 4,
                  margin: 0 
                }}>
                  {currentReport.investigation_result}
                </p>
              </div>
            )}

            {currentReport.quality_review_remark && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 8 }}>质量复核意见</h4>
                <p style={{ 
                  padding: 12, 
                  background: '#f0f5ff', 
                  borderRadius: 4,
                  margin: 0 
                }}>
                  {currentReport.quality_review_remark}
                </p>
              </div>
            )}

            {currentReport.handle_remark && (
              <div>
                <h4 style={{ marginBottom: 8 }}>处理备注</h4>
                <p style={{ 
                  padding: 12, 
                  background: '#fafafa', 
                  borderRadius: 4,
                  margin: 0 
                }}>
                  {currentReport.handle_remark}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="提交调查结果"
        open={submitInvestigationVisible}
        onCancel={() => setSubmitInvestigationVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {currentReport && (
          <Form form={submitForm} layout="vertical">
            <Alert
              message="提交调查结果后，调查单将进入「待质量复核」状态，需质量员复核后才能关闭。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
              <div><strong>调查单号：</strong>{currentReport.report_no}</div>
              <div><strong>缺失工具：</strong>{currentReport.missing_tools}</div>
            </div>

            <Form.Item
              name="investigation_result"
              label="调查结果"
              rules={[{ required: true, message: '请输入调查结果' }]}
            >
              <TextArea rows={4} placeholder="请详细描述调查结果，包括原因分析、责任认定等" />
            </Form.Item>

            <Form.Item
              name="handle_remark"
              label="处理备注"
            >
              <TextArea rows={3} placeholder="请输入处理备注（可选）" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setSubmitInvestigationVisible(false)}>取消</Button>
                <Button 
                  type="primary" 
                  loading={submitting}
                  onClick={doSubmitInvestigation}
                >
                  提交调查
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="质量员复核"
        open={qualityReviewVisible}
        onCancel={() => setQualityReviewVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {currentReport && (
          <Form form={reviewForm} layout="vertical">
            <Alert
              message="复核通过后，工具状态将恢复为「可借」；复核驳回则返回「调查中」状态。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
              <div><strong>调查单号：</strong>{currentReport.report_no}</div>
              <div><strong>缺失工具：</strong>{currentReport.missing_tools}</div>
              <div><strong>调查结果：</strong>{currentReport.investigation_result || '未填写'}</div>
            </div>

            <Form.Item
              name="review_remark"
              label="复核意见"
              rules={[{ required: true, message: '请输入复核意见' }]}
            >
              <TextArea rows={3} placeholder="请输入复核意见" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setQualityReviewVisible(false)}>取消</Button>
                <Button 
                  icon={<CloseCircleOutlined />}
                  loading={reviewing}
                  onClick={() => doQualityReview(false)}
                >
                  驳回
                </Button>
                <Button 
                  type="primary" 
                  icon={<CheckCircleOutlined />}
                  loading={reviewing}
                  onClick={() => doQualityReview(true)}
                >
                  通过
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
