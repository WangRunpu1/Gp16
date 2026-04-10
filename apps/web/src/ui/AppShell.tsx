import { Button, Layout, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { clearToken } from '../api/client';
import { CanvasPage } from './CanvasPage';

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

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', height: 48, lineHeight: '48px',
        background: 'linear-gradient(90deg,#1677ff 0%,#0ea5e9 100%)',
      }}>
        <Space>
          <span style={{ fontSize: 18 }}>⚡</span>
          <Typography.Text style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
            {t('appTitle')}
          </Typography.Text>
        </Space>
        <Space>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
            {userEmail}
          </Typography.Text>
          <Button size="small" ghost onClick={toggleLang}>{t('lang')}</Button>
          <Button size="small" ghost onClick={logout}>{t('logout')}</Button>
        </Space>
      </Header>
      <Content style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <CanvasPage />
      </Content>
    </Layout>
  );
}
