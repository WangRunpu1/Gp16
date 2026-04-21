import { Button, Form, Input, Card, Typography, message, Space } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { postJson, setToken } from '@/api/client';
import { Logo } from './Logo';

interface Props { onLogin: () => void; }

export function LoginPage({ onLogin }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function onFinish(values: { email: string; password: string }) {
    setLoading(true);
    try {
      const { token } = await postJson<{ token: string }>('/api/auth/login', values);
      setToken(token);
      onLogin();
    } catch {
      message.error(t('loginFail'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 40%, #f0fdf4 100%)',
      backgroundImage: `
        linear-gradient(135deg, #e0f2fe 0%, #dbeafe 40%, #f0fdf4 100%),
        radial-gradient(circle at 20% 80%, rgba(22,119,255,0.06) 0%, transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(250,173,20,0.06) 0%, transparent 50%)
      `,
    }}>
      <div style={{ display: 'flex', alignItems: 'stretch', maxWidth: 820, width: '100%', margin: '0 24px' }}>
        {/* Left: illustration area */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '40px 32px', minWidth: 340,
        }}>
          <Logo size={80} />
          <Typography.Title level={2} style={{ marginTop: 20, marginBottom: 8, color: '#0958d9' }}>
            GP16
          </Typography.Title>
          <Typography.Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 1.7 }}>
            {t('appTitle')}
          </Typography.Text>
          <div style={{ marginTop: 32, display: 'flex', gap: 24 }}>
            {[
              { icon: '☀️', label: 'PV' },
              { icon: '🔋', label: 'Storage' },
              { icon: '🤖', label: 'AI' },
              { icon: '📊', label: 'Analytics' },
            ].map((item) => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28 }}>{item.icon}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: login card */}
        <Card style={{
          width: 380, flexShrink: 0,
          borderRadius: 16,
          boxShadow: '0 12px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
          border: '1px solid rgba(255,255,255,0.8)',
          backdropFilter: 'blur(12px)',
          background: 'rgba(255,255,255,0.92)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <Typography.Title level={4} style={{ margin: '0 0 4px' }}>
              {t('login')}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              GP16 · UCD
            </Typography.Text>
          </div>
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item name="email" label={t('email')} rules={[{ required: true }]}>
              <Input prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} placeholder="staff@gp16.local" autoComplete="email" size="large" />
            </Form.Item>
            <Form.Item name="password" label={t('password')} rules={[{ required: true }]}>
              <Input.Password prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} placeholder="Staff123!" autoComplete="current-password" size="large" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 12 }}>
              <Button type="primary" htmlType="submit" block loading={loading} size="large"
                style={{ height: 44, fontWeight: 600 }}>
                {t('loginBtn')}
              </Button>
            </Form.Item>
          </Form>
          <div style={{
            padding: '10px 14px', background: '#f8fafc', borderRadius: 8,
            border: '1px solid #f0f0f0', fontSize: 12, color: '#6b7280',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#374151' }}>{t('demoCredentials')}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11 }}>staff@gp16.local / Staff123!</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11 }}>customer@gp16.local / Customer123!</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
