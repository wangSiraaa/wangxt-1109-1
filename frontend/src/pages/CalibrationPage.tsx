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
  DatePicker,
  message,
  Row,
  Col,
  Card,
  Statistic
} from 'antd';
import { 
  SearchOutlined, 
  PlusOutlined,
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { toolsApi } from '../api/tools';
import { calibrationApi } from '../api/misc';
import { Tool, CalibrationRecord, CalibrationResult } from '../types';
import { calibrationResultLabels, calibrationResultColors } from '../utils/constants';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function CalibrationPage() {
  const [records, setRecords] = useState<CalibrationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [expiredTools, setExpiredTools] = useState<Tool[]>([]);
  const [dueTools, setDueTools] = useState<Tool[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [toolOptions, setToolOptions] = useState<Tool[]>([]);

  useEffect(() => {
    loadRecords();
    loadExpiredTools();
    loadDueTools();
    loadToolOptions();
  }, [page, pageSize]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const response = await calibrationApi.getRecords({
        keyword: keyword || undefined,
        page,
        pageSize
      });
      if (response.success) {
        setRecords(response.data || []);
        setTotal(response.total || 0);
      }
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExpiredTools = async () => {
    try {
      const response = await toolsApi.getCalibrationExpired();
      if (response.success) {
        setExpiredTools(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load expired tools:', error);
    }
  };

  const loadDueTools = async () => {
    try {
      const response = await toolsApi.getCalibrationDue(30);
      if (response.success) {
        setDueTools(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load due tools:', error);
    }
  };

  const loadToolOptions = async () => {
    try {
      const response = await toolsApi.getTools({ pageSize: 100 });
      if (response.success) {
        setToolOptions(response.data || []);
      }
    } catch (error) {
      console.error('Failed to load tools:', error);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadRecords();
  };

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const data = {
        tool_id: values.tool_id,
        calibration_date: values.calibration_date.format('YYYY-MM-DD'),
        calibration_expiry_date: values.calibration_expiry_date?.format('YYYY-MM-DD'),
        calibration_result: values.calibration_result,
        calibration_certificate_no: values.calibration_certificate_no,
        remark: values.remark
      };

      const response = await calibrationApi.createRecord(data);
      
      if (response.success) {
        message.success('校准记录创建成功');
        setModalVisible(false);
        loadRecords();
        loadExpiredTools();
        loadDueTools();
      }
    } catch (error) {
      console.error('Failed to create record:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: '校准日期',
      dataIndex: 'calibration_date',
      width: 120
    },
    {
      title: '工具编码',
      dataIndex: 'tool_code',
      width: 120
    },
    {
      title: '工具名称',
      dataIndex: 'tool_name',
      width: 150
    },
    {
      title: '校准结果',
      dataIndex: 'calibration_result',
      width: 100,
      render: (result: CalibrationResult) => (
        <Tag color={calibrationResultColors[result]}>
          {calibrationResultLabels[result]}
        </Tag>
      )
    },
    {
      title: '校准有效期',
      dataIndex: 'calibration_expiry_date',
      width: 120
    },
    {
      title: '校准证书号',
      dataIndex: 'calibration_certificate_no',
      width: 150
    },
    {
      title: '校准人',
      dataIndex: 'calibrator_name',
      width: 100
    },
    {
      title: '备注',
      dataIndex: 'remark',
      ellipsis: true
    }
  ];

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">校准管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增校准记录
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="校准过期工具"
              value={expiredTools.length}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="30天内到期"
              value={dueTools.length}
              valueStyle={{ color: '#faad14' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="本月校准记录"
              value={records.filter(r => 
                dayjs(r.calibration_date).isSame(dayjs(), 'month')
              ).length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <div className="search-bar">
        <Row gutter={16}>
          <Col span={8}>
            <Input 
              placeholder="搜索工具编码/名称/证书号" 
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
            />
          </Col>
          <Col span={16}>
            <Space>
              <Button type="primary" onClick={handleSearch}>搜索</Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1000 }}
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
        title="新增校准记录"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="tool_id"
            label="工具"
            rules={[{ required: true, message: '请选择工具' }]}
          >
            <Select placeholder="请选择工具" showSearch optionFilterProp="children">
              {toolOptions.map(tool => (
                <Option key={tool.id} value={tool.id}>
                  {tool.tool_code} - {tool.tool_name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="calibration_date"
                label="校准日期"
                rules={[{ required: true, message: '请选择校准日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="calibration_expiry_date"
                label="校准有效期"
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="calibration_result"
                label="校准结果"
                rules={[{ required: true, message: '请选择校准结果' }]}
              >
                <Select placeholder="请选择校准结果">
                  <Option value="pass">合格</Option>
                  <Option value="fail">不合格</Option>
                  <Option value="limited">限用</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="calibration_certificate_no"
                label="校准证书号"
              >
                <Input placeholder="请输入校准证书号" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
