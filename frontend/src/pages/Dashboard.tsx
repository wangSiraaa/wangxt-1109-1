import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, List, Tag, Button, Space } from 'antd';
import { 
  ToolOutlined, 
  FileTextOutlined, 
  WarningOutlined, 
  ClockCircleOutlined,
  ArrowRightOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { statsApi } from '../api/misc';
import { DashboardStats, BorrowApplication } from '../types';
import { applicationStatusLabels, applicationStatusColors, riskLevelColors, riskLevelLabels } from '../utils/constants';
import dayjs from 'dayjs';

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await statsApi.getDashboard();
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">工作台</h2>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card loading={loading}>
            <Statistic
              title="工具总数"
              value={stats?.tools.total || 0}
              prefix={<ToolOutlined style={{ color: '#1890ff' }} />}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>
              可用: {stats?.tools.available || 0} / 借出: {stats?.tools.borrowed || 0}
            </div>
          </Card>
        </Col>

        {hasRole('admin', 'quality') && (
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="待审批申请"
                value={stats?.applications.pending_approval || 0}
                valueStyle={{ color: '#faad14' }}
                prefix={<FileTextOutlined />}
              />
              <Button 
                type="link" 
                size="small" 
                style={{ padding: 0, marginTop: 8 }}
                onClick={() => navigate('/applications')}
              >
                前往审批 <ArrowRightOutlined />
              </Button>
            </Card>
          </Col>
        )}

        {hasRole('admin') && (
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="待发放申请"
                value={stats?.applications.pending_issue || 0}
                valueStyle={{ color: '#52c41a' }}
                prefix={<ClockCircleOutlined />}
              />
              <Button 
                type="link" 
                size="small" 
                style={{ padding: 0, marginTop: 8 }}
                onClick={() => navigate('/issue')}
              >
                前往发放 <ArrowRightOutlined />
              </Button>
            </Card>
          </Col>
        )}

        {hasRole('admin', 'quality') && (
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="校准过期工具"
                value={stats?.tools.calibration_expired || 0}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<ExclamationCircleOutlined />}
              />
              <Button 
                type="link" 
                size="small" 
                style={{ padding: 0, marginTop: 8 }}
                onClick={() => navigate('/tools')}
              >
                查看详情 <ArrowRightOutlined />
              </Button>
            </Card>
          </Col>
        )}

        {hasRole('technician') && (
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="借用中"
                value={stats?.applications.borrowed || 0}
                valueStyle={{ color: '#1890ff' }}
                prefix={<FileTextOutlined />}
              />
              <Button 
                type="link" 
                size="small" 
                style={{ padding: 0, marginTop: 8 }}
                onClick={() => navigate('/return')}
              >
                我的借用 <ArrowRightOutlined />
              </Button>
            </Card>
          </Col>
        )}

        {hasRole('admin', 'quality') && (
          <Col xs={24} sm={12} md={6}>
            <Card loading={loading}>
              <Statistic
                title="待处理调查单"
                value={stats?.investigation.pending || 0}
                valueStyle={{ color: '#ff4d4f' }}
                prefix={<WarningOutlined />}
              />
              <Button 
                type="link" 
                size="small" 
                style={{ padding: 0, marginTop: 8 }}
                onClick={() => navigate('/investigation')}
              >
                前往处理 <ArrowRightOutlined />
              </Button>
            </Card>
          </Col>
        )}
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card 
            title="最近申请单" 
            extra={
              <Button type="link" onClick={() => navigate('/applications')}>
                查看全部
              </Button>
            }
            loading={loading}
          >
            <List
              dataSource={stats?.recent_applications || []}
              renderItem={(item: BorrowApplication) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.application_no}</span>
                        <Tag color={applicationStatusColors[item.status as keyof typeof applicationStatusColors]}>
                          {applicationStatusLabels[item.status as keyof typeof applicationStatusLabels]}
                        </Tag>
                        {item.risk_level && (
                          <Tag color={riskLevelColors[item.risk_level]}>
                            {riskLevelLabels[item.risk_level]}
                          </Tag>
                        )}
                      </Space>
                    }
                    description={
                      <Space size="large">
                        <span>申请人：{item.applicant_name}</span>
                        {item.work_order_no && <span>工单号：{item.work_order_no}</span>}
                        <span>申请时间：{dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
