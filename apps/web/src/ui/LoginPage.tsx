import { Button, Form, Input, Card, Typography, message } from 'antd';
import { LockOutlined, MailOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { postJson, setToken } from '@/api/client';
import { Logo } from './Logo';
import { AnimatedCharacters } from './canvas/AnimatedCharacters';

interface Props { onLogin: () => void; }

export function LoginPage({ onLogin }: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isPasswordGuardMode = passwordFocused && passwordValue.length === 0;

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
      background: 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 50%, #1e40af 100%)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative background elements */}
      <div style={{
        position: 'absolute', top: '15%', right: '10%', width: 300, height: 300,
        background: 'rgba(59,130,246,0.25)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', left: '5%', width: 400, height: 400,
        background: 'rgba(30,64,175,0.30)', borderRadius: '50%', filter: 'blur(100px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', inset: 0, backgroundImage:
          'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px', pointerEvents: 'none',
      }} />

      <div style={{
        display: 'flex', alignItems: 'stretch', maxWidth: 900, width: '100%',
        margin: '0 24px', position: 'relative', zIndex: 10,
      }}>
        {/* Left: animated characters */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '48px 32px', minWidth: 550,
        }}>
          <AnimatedCharacters
            isTyping={isTyping}
            showPassword={showPassword}
            passwordLength={passwordValue.length}
            isPasswordGuardMode={isPasswordGuardMode}
          />
        </div>

        {/* Right: login card */}
        <Card style={{
          width: 420, flexShrink: 0, alignSelf: 'center',
          borderRadius: 24,
          boxShadow: '0 24px 50px rgba(30,41,59,0.12)',
          border: '1px solid rgba(148,163,184,0.24)',
          backdropFilter: 'blur(14px)',
          background: 'rgba(255,255,255,0.86)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <Logo size={48} />
            </div>
            <Typography.Title level={3} style={{ margin: '0 0 4px', letterSpacing: '-0.02em' }}>
              {t('loginWelcome')}
            </Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 13, lineHeight: 1.6 }}>
              {t('appTitle')}
            </Typography.Text>
          </div>

          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              {t('email')}
            </div>
            <Form.Item name="email" rules={[{ required: true }]}>
              <Input
                prefix={<MailOutlined style={{ color: '#94a3b8', fontSize: 15 }} />}
                placeholder="name@example.com"
                autoComplete="email" size="large"
                style={{ height: 50, borderRadius: 14 }}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
              />
            </Form.Item>

            <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
              {t('password')}
            </div>
            <Form.Item name="password" rules={[{ required: true }]}>
              <Input
                type={showPassword ? 'text' : 'password'}
                prefix={<LockOutlined style={{ color: '#94a3b8', fontSize: 15 }} />}
                placeholder="Enter your access key"
                autoComplete="current-password" size="large"
                style={{ height: 50, borderRadius: 14 }}
                value={passwordValue}
                onChange={(e) => setPasswordValue(e.target.value)}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                suffix={
                  <span
                    style={{ cursor: 'pointer', color: '#64748b', fontSize: 16, display: 'flex', alignItems: 'center' }}
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#0f766e'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#64748b'; }}
                  >
                    {showPassword ? <EyeOutlined /> : <EyeInvisibleOutlined />}
                  </span>
                }
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 12, marginTop: 8 }}>
              <Button
                type="primary" htmlType="submit" block loading={loading} size="large"
                style={{
                  height: 52, fontWeight: 600, borderRadius: 14, fontSize: 15,
                  background: 'linear-gradient(135deg, #0958d9 0%, #1677ff 55%, #0ea5e9 100%)',
                  border: 'none',
                  boxShadow: '0 14px 26px rgba(15,118,110,0.24)',
                  letterSpacing: '0.5px',
                }}
              >
                {loading ? t('loggingIn') : t('loginBtn')}
              </Button>
            </Form.Item>
          </Form>

          <div style={{
            padding: '10px 14px', background: '#f8fafc', borderRadius: 12,
            border: '1px solid #f0f0f0', fontSize: 12, color: '#6b7280',
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#374151' }}>{t('demoCredentials')}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, lineHeight: 1.8 }}>
              staff@gp16.local / Staff123!<br />
              customer@gp16.local / Customer123!
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
