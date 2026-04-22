import { Avatar, Button, Dropdown, Layout, Popconfirm, Space, Typography } from 'antd';
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
    <Layout style={{ height: '100vh', background: '#f1f5f9' }}>
      <Header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 60, lineHeight: '60px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)',
        borderBottom: '1px solid rgba(148,163,184,0.15)',
      }}>
        <Space align="center" size={12}>
          <Logo size={32} />
          <div>
            <Typography.Text style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '-0.01em', display: 'block', lineHeight: '22px' }}>
              {t('appTitle')}
            </Typography.Text>
          </div>
        </Space>
        <Space size={14} align="center">
          <Space size={8} align="center" style={{
            padding: '5px 12px 5px 6px',
            background: 'rgba(255,255,255,0.07)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <Avatar size={28} style={{
              background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
              fontSize: 12, fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }}>
              {initial}
            </Avatar>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12.5, fontWeight: 500 }}>
              {userEmail}
            </Typography.Text>
          </Space>
          <Button size="small" ghost icon={<GlobalOutlined />} onClick={toggleLang}
            style={{
              borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.75)',
              fontSize: 12, fontWeight: 500, borderRadius: 8, height: 32,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)'; }}
          >
            {t('lang')}
          </Button>
          <Popconfirm
            title={t('confirmLogout')}
            onConfirm={logout}
            okText={t('confirm')}
            cancelText={t('cancel')}
            okButtonProps={{ danger: true }}
          >
            <Button size="small" ghost icon={<LogoutOutlined />}
              style={{
                borderColor: 'rgba(239,68,68,0.35)', color: 'rgba(252,165,165,0.85)',
                fontSize: 12, fontWeight: 500, borderRadius: 8, height: 32,
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.6)'; (e.currentTarget as HTMLElement).style.color = '#fca5a5'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.35)'; (e.currentTarget as HTMLElement).style.color = 'rgba(252,165,165,0.85)'; }}
            >
              {t('logout')}
            </Button>
          </Popconfirm>
        </Space>
      </Header>
      <Content style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <CanvasPage />
      </Content>
    </Layout>
  );
}
