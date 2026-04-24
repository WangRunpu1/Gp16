import { Button, Input, Tag, Typography } from 'antd';
import {
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  BulbOutlined,
  ToolOutlined,
  FileTextOutlined,
  SendOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AgentMessage } from '@gp16/shared';

const { Text } = Typography;

interface Props {
  msg: AgentMessage;
  isLast: boolean;
  onReply?: (text: string) => void;
  onExecute?: () => void;
}

export function AgentMessageRenderer({ msg, isLast, onReply, onExecute }: Props) {
  const { t } = useTranslation();
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <QuestionCircleOutlined style={{ fontSize: 12, color: '#8b5cf6', marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Text style={{ fontSize: 11.5, color: '#5b21b6', whiteSpace: 'pre-wrap', display: 'block', marginBottom: 4 }}>
                {msg.content}
              </Text>
              <Text style={{ fontSize: 10, color: '#a78bfa', fontWeight: 500 }}>
                {t('agentQuestion')}
              </Text>
            </div>
          </div>
          {isLast && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {onExecute && (
                <Button
                  size="small"
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={onExecute}
                  style={{
                    fontSize: 10.5, borderRadius: 8, fontWeight: 600, height: 28,
                    background: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
                    border: 'none', boxShadow: '0 1px 4px rgba(139,92,246,0.3)',
                  }}
                >
                  {t('executeOnCanvas')}
                </Button>
              )}
              <Button
                size="small"
                icon={<SendOutlined />}
                onClick={() => onReply?.(t('confirmExecute'))}
                style={{ fontSize: 10.5, borderRadius: 8, fontWeight: 500, height: 28 }}
              >
                {t('replyContinue')}
              </Button>
              <Button
                size="small"
                type="text"
                icon={<PlusOutlined />}
                onClick={() => setShowInput(!showInput)}
                style={{ fontSize: 10.5, color: '#a78bfa', fontWeight: 500 }}
              >
                {t('addInfo')}
              </Button>
            </div>
          )}
          {showInput && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <Input
                size="small"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onPressEnter={() => {
                  const text = inputValue.trim();
                  if (text) {
                    onReply?.(text);
                    setInputValue('');
                    setShowInput(false);
                  }
                }}
                placeholder={t('addInfo')}
                style={{ fontSize: 10.5, borderRadius: 8 }}
                autoFocus
              />
              <Button
                size="small"
                type="primary"
                icon={<SendOutlined />}
                onClick={() => {
                  const text = inputValue.trim();
                  if (text) {
                    onReply?.(text);
                    setInputValue('');
                    setShowInput(false);
                  }
                }}
                style={{ height: 24, borderRadius: 6, fontSize: 10 }}
              />
            </div>
          )}
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
