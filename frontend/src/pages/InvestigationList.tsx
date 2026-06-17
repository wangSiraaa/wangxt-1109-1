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
  Descriptions
} from 'antd';
import { 
  SearchOutlined, 
  EyeOutlined,
  CheckCircleOutlined
} from '@ant-design/icons';
import { investigationApi } from '../api/misc';
import { InvestigationReport, InvestigationStatus } from '../types';
import { investigationStatusLabels, investigationStatusColors } from '../utils/constants';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

export default function InvestigationList() {
  const [reports, setReports] = useState<InvestigationReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [detailVisible, setDetailVisible] = useState(false);
  const [handleVisible, setHandleVisible] = useState(false);
  const [currentReport, setCurrentReport] = useState<InvestigationReport | null>(null);
  const [handleForm] = Form.useForm();
  const [handling, setHandling] = useState(false);

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

  const handleViewDetail = async (id: string) => {
    try {
      const response = await investigationApi.getReport(id);
      if (response.success && response.data) {
        setCurrentReport(response.data);
        setDetailVisible(true);
      }
    } catch (error) {
      console.error('Failed to load report detail:', error);
    }
  };

  const handleProcess = async (report: InvestigationReport) => {
    setCurrentReport(report);
    handleForm.resetFields();
    handleForm.setFieldsValue({
      status: report.status,
      investigation_result: report.investigation_result,
      handle_remark: report.handle_remark
    });
    setHandleVisible(true);
  };

  const handleSubmit = async () => {
    if (!currentReport) return;

    try {
      const values = await handleForm.validateFields();
      setHandling(true);

      const response = await investigationApi.updateReport(currentReport.id, values);
      
      if (response.success) {
        message.success('处理成功');
        setHandleVisible(false);
        loadReports();
      }
    } catch (error) {
      console.error('Failed to process:', error);
    } finally {
      setHandling(false);
    }
  };

  const handleClose = async () => {
    if (!currentReport) return;

    try {
      const values = await handleForm.validateFields();
      setHandling(true);

      const response = await investigationApi.closeReport(
        currentReport.id,
        values.investigation_result,
        values.handle_remark
      );
      
      if (response.success) {
        message.success('调查单已关闭');
        setHandleVisible(false);
        loadReports();
      }
    } catch (error) {
      console.error('Failed to close:', error);
    } finally {
      setHandling(false);
    }
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
      width: 100,
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
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: InvestigationReport) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}
          >
            详情
          </Button>
          {record.status !== 'closed' && (
            <Button 
              type="primary" 
              size="small" 
              onClick={() => handleProcess(record)}
            >
              处理
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">调查单管理</h2>
      </div>

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
        title="调查单详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
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
              <Descriptions.Item label="缺失工具" span={2}>
                {currentReport.missing_tools}
              </Descriptions.Item>
            </Descriptions>

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
        title="处理调查单"
        open={handleVisible}
        onCancel={() => setHandleVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {currentReport && (
          <Form form={handleForm} layout="vertical">
            <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 4 }}>
              <div><strong>调查单号：</strong>{currentReport.report_no}</div>
              <div><strong>缺失工具：</strong>{currentReport.missing_tools}</div>
            </div>

            <Form.Item
              name="status"
              label="状态"
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select>
                <Option value="investigating">调查中</Option>
                <Option value="closed">已关闭</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="investigation_result"
              label="调查结果"
            >
              <TextArea rows={4} placeholder="请输入调查结果" />
            </Form.Item>

            <Form.Item
              name="handle_remark"
              label="处理备注"
            >
              <TextArea rows={3} placeholder="请输入处理备注" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setHandleVisible(false)}>取消</Button>
                <Button onClick={handleSubmit}>保存</Button>
                <Button 
                  type="primary" 
                  icon={<CheckCircleOutlined />}
                  loading={handling}
                  onClick={handleClose}
                >
                  关闭调查单
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
