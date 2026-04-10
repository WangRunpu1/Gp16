import { useEffect, useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { useTranslation } from 'react-i18next';
import { getToken, apiFetch } from './api/client';
import { LoginPage } from './ui/LoginPage';
import { AppShell } from './ui/AppShell';
import './i18n';

export default function App() {
  const { i18n } = useTranslation();
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setChecking(false); return; }
    apiFetch<{ email: string }>('/api/me')
      .then((u) => { setEmail(u.email); setAuthed(true); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;

  return (
    <ConfigProvider
      locale={i18n.language === 'zh' ? zhCN : enUS}
      theme={{ algorithm: theme.defaultAlgorithm, token: { colorPrimary: '#1677ff' } }}
    >
      {authed
        ? <AppShell onLogout={() => { setAuthed(false); setEmail(''); }} userEmail={email} />
        : <LoginPage onLogin={() => {
            apiFetch<{ email: string }>('/api/me').then((u) => { setEmail(u.email); setAuthed(true); });
          }} />
      }
    </ConfigProvider>
  );
}
