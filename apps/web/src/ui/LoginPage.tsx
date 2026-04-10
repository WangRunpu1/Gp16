import { Button, Form, Input, Card, Typography, message } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { postJson, setToken } from '@/api/client';

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
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'linear-gradient(135deg,#e0f2fe 0%,#f0fdf4 100%)',
    }}>
      <Card style={{ width: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40 }}>⚡</div>
          <Typography.Title level={4} style={{ margin: '8px 0 4px' }}>
            {t('appTitle')}
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            GP16 · UCD
          </Typography.Text>
        </div>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="email" label={t('email')} rules={[{ required: true }]}>
            <Input placeholder="staff@gp16.local" autoComplete="email" />
          </Form.Item>
          <Form.Item name="password" label={t('password')} rules={[{ required: true }]}>
            <Input.Password placeholder="Staff123!" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {t('loginBtn')}
            </Button>
          </Form.Item>
        </Form>
        <div style={{ marginTop: 16, padding: '10px 12px', background: '#f9fafb', borderRadius: 6, fontSize: 12, color: '#6b7280' }}>
          <div>staff@gp16.local / Staff123!</div>
          <div>customer@gp16.local / Customer123!</div>
        </div>
      </Card>
    </div>
  );
}
