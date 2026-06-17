import { Layout, Menu, Avatar, Dropdown, Button, theme, Tag } from 'antd';
import { 
  DashboardOutlined,
  ToolOutlined,
  FileTextOutlined,
  AppstoreAddOutlined,
  SendOutlined,
  CheckCircleOutlined,
  UndoOutlined,
  WarningOutlined,
  UserOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  GitBranchOutlined,
  ClockCircleOutlined,
  AuditOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole, Shift } from '../types';
import { useEffect, useState } from 'react';
import { shiftsApi } from '../api/shifts';

const { Header, Sider, Content } = Layout;

const roleLabels: Record<UserRole, string> = {
  technician: '机务员',
  admin: '工具管理员',
  quality: '质量员'
};

const menuItemsByRole = {
  technician: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/pipeline', icon: <GitBranchOutlined />, label: '作业流水线' },
    { key: '/applications', icon: <FileTextOutlined />, label: '我的申请' },
    { key: '/apply', icon: <AppstoreAddOutlined />, label: '申请工具' },
    { key: '/return', icon: <UndoOutlined />, label: '工具归还' },
    { key: '/handover', icon: <SwapOutlined />, label: '班次交接' },
  ],
  admin: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/pipeline', icon: <GitBranchOutlined />, label: '作业流水线' },
    { key: '/tools', icon: <ToolOutlined />, label: '工具管理' },
    { key: '/applications', icon: <FileTextOutlined />, label: '申请管理' },
    { key: '/issue', icon: <SendOutlined />, label: '工具发放' },
    { key: '/return', icon: <UndoOutlined />, label: '工具归还' },
    { key: '/investigation', icon: <WarningOutlined />, label: '调查单管理' },
    { key: '/shifts', icon: <ClockCircleOutlined />, label: '班次管理' },
    { key: '/handover', icon: <SwapOutlined />, label: '班次交接' },
  ],
  quality: [
    { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
    { key: '/pipeline', icon: <GitBranchOutlined />, label: '作业流水线' },
    { key: '/tools', icon: <ToolOutlined />, label: '工具管理' },
    { key: '/calibration', icon: <SafetyCertificateOutlined />, label: '校准管理' },
    { key: '/quality-confirm', icon: <CheckCircleOutlined />, label: '校准确认' },
    { key: '/investigation', icon: <WarningOutlined />, label: '调查单管理' },
    { key: '/shifts', icon: <ClockCircleOutlined />, label: '班次管理' },
    { key: '/handover', icon: <SwapOutlined />, label: '班次交接' },
  ]
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, hasRole } = useAuth();
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [pendingHandoverCount, setPendingHandoverCount] = useState(0);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const menuItems = user ? menuItemsByRole[user.role] || [] : [];

  useEffect(() => {
    if (!user) return;
    
    shiftsApi.getCurrentShift().then(res => {
      if (res.success && res.data) {
        setCurrentShift(res.data);
      }
    }).catch(() => {});

    shiftsApi.getPendingHandovers().then(res => {
      if (res.success && res.data) {
        setPendingHandoverCount(res.data.length);
      }
    }).catch(() => {});
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenu = {
    items: [
      {
        key: '1',
        icon: <UserOutlined />,
        label: `${user?.name} (${user ? roleLabels[user.role] : ''})`,
        disabled: true
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout
      }
    ]
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220}>
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#fff',
          fontSize: 18,
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <ToolOutlined style={{ marginRight: 8 }} />
          工具借用系统
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ marginTop: 16 }}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: colorBgContainer,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {currentShift && (
              <Tag color="green" style={{ margin: 0, padding: '4px 12px', fontSize: 13 }}>
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                当前班次：{currentShift.shift_name}
                {currentShift.leader_name && ` (负责人: ${currentShift.leader_name})`}
              </Tag>
            )}
            {pendingHandoverCount > 0 && (
              <Link to="/handover">
                <Tag color="orange" style={{ margin: 0, padding: '4px 12px', fontSize: 13, cursor: 'pointer' }}>
                  <AuditOutlined style={{ marginRight: 4 }} />
                  {pendingHandoverCount} 个待交接
                </Tag>
              </Link>
            )}
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Button type="text" style={{ height: '100%' }}>
              <Avatar size="small" icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <span>{user?.name}</span>
            </Button>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px', overflow: 'auto' }}>
          <div style={{ 
            padding: 24, 
            minHeight: 360, 
            background: colorBgContainer,
            borderRadius: 8
          }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
