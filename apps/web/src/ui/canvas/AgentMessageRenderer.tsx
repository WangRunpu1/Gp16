import { Tag, Typography } from 'antd';
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  BulbOutlined,
  ToolOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AgentMessage } from '@gp16/shared';

const { Text } = Typography;

interface Props {
  msg: AgentMessage;
  isLast: boolean;
}

export function AgentMessageRenderer({ msg, isLast }: Props) {
  const { t } = useTranslation();

  if (msg.role === 'user') {
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>;
  }

  switch (msg.reactionType) {
    case 'thinking':
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <BulbOutlined style={{ fontSize: 12, color: '#f59e0b', marginTop: 2, flexShrink: 0 }} />
          <div>
            <Text style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 2 }}>
              {isLast && !msg.content ? t('agentThinking') : ''}
            </Text>
            <Text style={{ fontSize: 11.5, color: '#78716c', whiteSpace: 'pre-wrap' }}>
              {msg.content}
            </Text>
          </div>
        </div>
      );

    case 'planning':
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <FileTextOutlined style={{ fontSize: 12, color: '#3b82f6', marginTop: 2, flexShrink: 0 }} />
          <div>
            <Text style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 2 }}>
              {isLast && !msg.content ? t('agentPlanning') : ''}
            </Text>
            <Text style={{ fontSize: 11.5, color: '#1e3a5f', whiteSpace: 'pre-wrap', display: 'block' }}>
              {msg.content}
            </Text>
          </div>
        </div>
      );

    case 'tool_call':
      return (
        <div style={{
          padding: '6px 10px', borderRadius: 8, background: '#f0f9ff',
          border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <ToolOutlined style={{ fontSize: 12, color: '#0284c7' }} />
          <div style={{ flex: 1 }}>
            <Tag color="blue" style={{ margin: 0, fontSize: 10, borderRadius: 6 }}>{msg.toolName}</Tag>
            <Text style={{ fontSize: 11, color: '#0369a1', marginLeft: 6 }}>{msg.content}</Text>
          </div>
          {isLast && !msg.toolSuccess !== undefined && (
            <div style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '2px solid #0284c7', borderTopColor: 'transparent',
              animation: 'spin 0.8s linear infinite',
            }} />
          )}
        </div>
      );

    case 'tool_result':
      return (
        <div style={{
          padding: '6px 10px', borderRadius: 8,
          background: msg.toolSuccess ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${msg.toolSuccess ? '#bbf7d0' : '#fecaca'}`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {msg.toolSuccess
            ? <CheckCircleOutlined style={{ fontSize: 12, color: '#16a34a' }} />
            : <CloseCircleOutlined style={{ fontSize: 12, color: '#dc2626' }} />
          }
          <Text style={{ fontSize: 11, color: msg.toolSuccess ? '#166534' : '#991b1b' }}>
            {msg.content}
          </Text>
        </div>
      );

    case 'question':
      return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <QuestionCircleOutlined style={{ fontSize: 12, color: '#8b5cf6', marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <Text style={{ fontSize: 11.5, color: '#5b21b6', whiteSpace: 'pre-wrap', display: 'block', marginBottom: 6 }}>
              {msg.content}
            </Text>
            <Text style={{ fontSize: 10, color: '#a78bfa', fontWeight: 500 }}>
              {t('agentQuestion')}
            </Text>
          </div>
        </div>
      );

    case 'error':
      return (
        <div style={{
          padding: '6px 10px', borderRadius: 8, background: '#fef2f2',
          border: '1px solid #fecaca',
        }}>
          <Text style={{ fontSize: 11.5, color: '#dc2626', whiteSpace: 'pre-wrap' }}>
            {msg.content}
          </Text>
        </div>
      );

    default: // response
      return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>;
  }
}
