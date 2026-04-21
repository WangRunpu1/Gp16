import { Avatar, Button, Dropdown, Layout, Space, Typography } from 'antd';
import { GlobalOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { clearToken } from '@/api/client';
import { CanvasPage } from './CanvasPage';
import { Logo } from './Logo';

const { Header, Content } = Layout;

interface Props { onLogout: () => void; userEmail: string; }

export function AppShell({ onLogout, userEmail }: Props) {
  const { t, i18n } = useTranslation();

  function toggleLang() {
    i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh');
  }

  function logout() {
    clearToken();
    onLogout();
  }

  const initial = userEmail ? userEmail[0].toUpperCase() : '?';

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 56, lineHeight: '56px',
        background: 'linear-gradient(90deg, #0958d9 0%, #1677ff 50%, #0ea5e9 100%)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <Space align="center" size={10}>
          <Logo size={30} />
          <Typography.Text style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: 0.3 }}>
            {t('appTitle')}
          </Typography.Text>
        </Space>
        <Space size={12} align="center">
          <Space size={6} align="center">
            <Avatar size={26} style={{ background: 'rgba(255,255,255,0.25)', fontSize: 12, fontWeight: 600 }}>
              {initial}
            </Avatar>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
              {userEmail}
            </Typography.Text>
          </Space>
          <Button size="small" ghost icon={<GlobalOutlined />} onClick={toggleLang}
            style={{ borderColor: 'rgba(255,255,255,0.35)' }}>
            {t('lang')}
          </Button>
          <Button size="small" ghost icon={<LogoutOutlined />} onClick={logout}
            style={{ borderColor: 'rgba(255,255,255,0.35)' }}>
            {t('logout')}
          </Button>
        </Space>
      </Header>
      <Content style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <CanvasPage />
      </Content>
    </Layout>
  );
}
