import { useState } from 'react';
import { Layout, Menu, Typography, theme } from 'antd';
import { ShoppingOutlined, TeamOutlined, ShopOutlined, FileTextOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const { Sider, Header, Content } = Layout;

const items = [
  { key: '/billing', icon: <FileTextOutlined />, label: 'Billing' },
  { key: '/products', icon: <ShoppingOutlined />, label: 'Products' },
  { key: '/customers', icon: <TeamOutlined />, label: 'Customers' },
];

export const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { token } = theme.useToken();
  const selected = items.find((i) => pathname.startsWith(i.key))?.key ?? '/products';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="light">
        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <ShopOutlined style={{ fontSize: 20, color: token.colorPrimary }} />
          {!collapsed && <Typography.Text strong>POS</Typography.Text>}
        </div>
        <Menu mode="inline" selectedKeys={[selected]} items={items} onClick={(e) => navigate(e.key)} />
      </Sider>
      <Layout>
        <Header style={{ background: token.colorBgContainer, padding: '0 24px' }}>
          <Typography.Text strong>Point of Sale</Typography.Text>
        </Header>
        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
