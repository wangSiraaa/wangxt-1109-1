import { useState } from 'react';
import { Form, Input, Button, Card, message, Spin } from 'antd';
import { UserOutlined, LockOutlined, ToolOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const success = await login(values.username, values.password);
      if (success) {
        message.success('登录成功');
        navigate(from, { replace: true });
      } else {
        message.error('用户名或密码错误');
      }
    } catch (error) {
      message.error('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card 
        style={{ 
          width: 400, 
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderRadius: 12
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ 
            fontSize: 48, 
            color: '#1890ff', 
            marginBottom: 12 
          }}>
            <ToolOutlined />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#262626', marginBottom: 8 }}>
            民航机务工具借用系统
          </h1>
          <p style={{ color: '#8c8c8c', fontSize: 14 }}>
            专业的工具管理与借用平台
          </p>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          size="large"
          initialValues={{ username: 'tech01', password: '123456' }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password 
              prefix={<LockOutlined />} 
              placeholder="密码"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              block
              loading={loading}
              style={{ height: 44, fontSize: 16 }}
            >
              登 录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #f0f0f0' }}>
          <p style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8 }}>测试账号：</p>
          <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: 1.8 }}>
            <div>机务员：tech01 / 123456</div>
            <div>工具管理员：admin01 / 123456</div>
            <div>质量员：quality01 / 123456</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
