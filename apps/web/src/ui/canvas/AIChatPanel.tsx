import { Button, Input, Spin, Tag, Typography } from 'antd';
import {
  SendOutlined,
  ThunderboltOutlined,
  RobotOutlined,
  UserOutlined,
  BulbOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopologyStore } from '@/state/topologyStore';
import { postJson, apiFetch } from '@/api/client';
import type { AILayoutResult, AgentMessage, AgentMode } from '@gp16/shared';
import { AgentMessageRenderer } from './AgentMessageRenderer';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
  reactionType?: AgentMessage['reactionType'];
  toolName?: string;
  toolSuccess?: boolean;
}

interface Props {
  agentMode?: AgentMode;
  onModeChange?: (mode: AgentMode) => void;
}

export function AIChatPanel({ agentMode = 'plan', onModeChange }: Props) {
  const { t } = useTranslation();

  const QUICK_SCENARIOS = [
    { labelKey: 'scenarioC1Label', promptKey: 'scenarioC1Prompt' },
    { labelKey: 'scenarioC2Label', promptKey: 'scenarioC2Prompt' },
    { labelKey: 'scenarioC3Label', promptKey: 'scenarioC3Prompt' },
    { labelKey: 'scenarioC4Label', promptKey: 'scenarioC4Prompt' },
  ];

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: t('agentWelcome') },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const setNodes = useTopologyStore((s) => s.setNodes);
  const setEdges = useTopologyStore((s) => s.setEdges);
  const nodes = useTopologyStore((s) => s.nodes);
  const edges = useTopologyStore((s) => s.edges);
  const reset = useTopologyStore((s) => s.reset);

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  // Create a new conversation when mode changes
  useEffect(() => {
    createConversation();
  }, [agentMode]);

  async function createConversation() {
    try {
      const res = await postJson<{ id: string }>('/api/agent/conversations', { mode: agentMode });
      setConvId(res.id);
    } catch {
      // Fallback: use a local ID
      setConvId('local-' + Date.now());
    }
  }

  async function sendMessage(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: text };
    const thinkingMsg: ChatMessage = { role: 'assistant', content: '', loading: true };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    scrollToBottom();
    setLoading(true);

    try {
      // If no conversation exists, create one on the fly
      let cid = convId;
      if (!cid) {
        const res = await postJson<{ id: string }>('/api/agent/conversations', { mode: agentMode });
        cid = res.id;
        setConvId(cid);
      }

      const topology = agentMode === 'agent' ? { nodes, edges } : undefined;

      const res = await postJson<{ messages: AgentMessage[]; layout?: AILayoutResult }>(
        `/api/agent/${cid}/message`,
        { content: text, topology },
      );

      // Apply layout if agent mode returned one
      if (agentMode === 'agent' && res.layout) {
        setNodes(res.layout.topology.nodes);
        setEdges(res.layout.topology.edges);
      }

      // Render messages with different reaction types
      const newMsgs: ChatMessage[] = (res.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content,
        reactionType: m.reactionType,
        toolName: m.toolName,
        toolSuccess: m.toolSuccess,
      }));

      setMessages((prev) => [...prev.slice(0, -1), ...newMsgs]);
      scrollToBottom();
    } catch (e: any) {
      // Fallback: use legacy AI flow if agent endpoint is not available
      try {
        const { taskId } = await postJson<{ taskId: string }>('/api/ai/layout', { prompt: text });
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const pollRes = await apiFetch<{ state: string; result?: AILayoutResult; failedReason?: string }>(
            `/api/ai/layout/${taskId}`,
          );
          if (pollRes.state === 'completed' && pollRes.result) {
            if (agentMode === 'agent') {
              setNodes(pollRes.result.topology.nodes);
              setEdges(pollRes.result.topology.edges);
            }
            const nodeCount = pollRes.result.topology.nodes.length;
            const edgeCount = pollRes.result.topology.edges.length;
            const assumptionLines = pollRes.result.assumptions?.length
              ? '\n\n' + t('aiAssumptions') + '\n' + pollRes.result.assumptions.map((a) => `• ${a}`).join('\n')
              : '';
            const reply = t('aiSuccessMsg', { nodes: nodeCount, edges: edgeCount }) + assumptionLines;
            setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: reply }]);
            scrollToBottom();
            return;
          }
          if (pollRes.state === 'failed') throw new Error(pollRes.failedReason ?? 'failed');
        }
        throw new Error('timeout');
      } catch (e2: any) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: t('aiFailMsg', { err: e2?.message ?? e }) },
        ]);
        scrollToBottom();
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    reset();
    setMessages([{ role: 'assistant', content: t('aiCleared') }]);
  }

  const isAgent = agentMode === 'agent';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fafbfc' }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid #e5e7eb',
        background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: isAgent
              ? 'linear-gradient(135deg,#8b5cf6,#6366f1)'
              : 'linear-gradient(135deg,#06b6d4,#3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: isAgent
              ? '0 2px 6px rgba(139,92,246,0.3)'
              : '0 2px 6px rgba(6,182,212,0.3)',
          }}>
            {isAgent
              ? <ThunderboltOutlined style={{ fontSize: 16, color: '#fff' }} />
              : <RobotOutlined style={{ fontSize: 16, color: '#fff' }} />
            }
          </div>
          <div>
            <Typography.Text style={{ color: '#fff', fontWeight: 700, fontSize: 13.5, display: 'block', lineHeight: 1.3, letterSpacing: '-0.01em' }}>
              {isAgent ? t('agentMode') : t('planMode')}
            </Typography.Text>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10.5 }}>
              {t('aiSubtitle')}
            </Typography.Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Mode toggle */}
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.08)', borderRadius: 8,
            padding: 2, border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <button
              onClick={() => onModeChange?.('plan')}
              style={{
                padding: '3px 10px', border: 'none', borderRadius: 6, fontSize: 10.5,
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                background: !isAgent ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: !isAgent ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
              title={t('modeSwitchTip')}
            >
              <BulbOutlined style={{ marginRight: 3, fontSize: 10 }} />
              {t('planMode')}
            </button>
            <button
              onClick={() => onModeChange?.('agent')}
              style={{
                padding: '3px 10px', border: 'none', borderRadius: 6, fontSize: 10.5,
                fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                background: isAgent ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: isAgent ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
            >
              <ThunderboltOutlined style={{ marginRight: 3, fontSize: 10 }} />
              {t('agentMode')}
            </button>
          </div>
          <Button size="small" ghost onClick={handleClear} style={{
            fontSize: 11, color: 'rgba(255,255,255,0.65)', borderColor: 'rgba(255,255,255,0.15)',
            borderRadius: 7, height: 28, fontWeight: 500,
          }}>
            {t('clearCanvas')}
          </Button>
        </div>
      </div>

      {/* Quick scenarios */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #f1f5f9', background: '#fff' }}>
        <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <ThunderboltOutlined style={{ fontSize: 10, color: '#f59e0b' }} /> {t('quickScenarios')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {QUICK_SCENARIOS.map((s) => (
            <Tag
              key={s.labelKey}
              style={{
                cursor: 'pointer', fontSize: 11, padding: '2px 10px', borderRadius: 8,
                background: isAgent ? '#f5f3ff' : '#eff6ff',
                border: isAgent ? '1px solid #e9e5ff' : '1px solid #dbeafe',
                color: isAgent ? '#7c3aed' : '#2563eb',
                fontWeight: 500, transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = isAgent ? '#ede9fe' : '#dbeafe';
                (e.currentTarget as HTMLElement).style.borderColor = isAgent ? '#c4b5fd' : '#bfdbfe';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = isAgent ? '#f5f3ff' : '#eff6ff';
                (e.currentTarget as HTMLElement).style.borderColor = isAgent ? '#e9e5ff' : '#dbeafe';
              }}
              onClick={() => !loading && sendMessage(t(s.promptKey))}
            >
              {t(s.labelKey)}
            </Tag>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14, background: '#fafbfc' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start', gap: 8,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 9, flexShrink: 0,
              background: msg.role === 'user'
                ? 'linear-gradient(135deg,#3b82f6,#2563eb)'
                : isAgent
                  ? 'linear-gradient(135deg,#8b5cf6,#6366f1)'
                  : 'linear-gradient(135deg,#06b6d4,#22c55e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              color: '#fff', fontSize: 13, fontWeight: 600,
            }}>
              {msg.role === 'user' ? <UserOutlined /> : (isAgent ? <ThunderboltOutlined /> : <RobotOutlined />)}
            </div>
            <div style={{
              maxWidth: msg.role === 'user' ? '84%' : '90%',
              padding: msg.reactionType ? '8px 10px' : '9px 13px',
              borderRadius: msg.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg,#3b82f6,#2563eb)'
                : msg.reactionType === 'thinking' ? '#fffbeb'
                  : msg.reactionType === 'tool_call' ? '#f0f9ff'
                    : msg.reactionType === 'tool_result' ? (msg.toolSuccess ? '#f0fdf4' : '#fef2f2')
                      : '#fff',
              border: msg.role === 'assistant' && msg.reactionType ? 'none' : '1px solid #e2e8f0',
              boxShadow: msg.role === 'user'
                ? '0 2px 8px rgba(37,99,235,0.25)'
                : '0 1px 3px rgba(0,0,0,0.04)',
              fontSize: 12.5, lineHeight: 1.7,
              color: msg.role === 'user' ? '#fff'
                : msg.reactionType === 'thinking' ? '#92400e'
                  : msg.reactionType === 'tool_call' ? '#0369a1'
                    : msg.reactionType === 'tool_result' ? (msg.toolSuccess ? '#166534' : '#991b1b')
                      : '#334155',
            }}>
              {msg.loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spin size="small" style={{ color: '#94a3b8' }} />
                  <span style={{ color: '#94a3b8', fontSize: 11.5 }}>
                    {isAgent ? t('agentExecuting') : t('agentThinking')}
                  </span>
                </div>
              ) : msg.reactionType ? (
                <AgentMessageRenderer msg={msg as any} isLast={i === messages.length - 1} />
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #e2e8f0', background: '#fff' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Input.TextArea
            placeholder={isAgent ? t('aiInputPlaceholder') : t('aiPrompt')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            disabled={loading}
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{
              fontSize: 12.5, resize: 'none', borderRadius: 10,
              border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          />
          <Button
            type="primary" icon={<SendOutlined />}
            onClick={() => sendMessage()}
            loading={loading}
            disabled={!input.trim()}
            style={{
              height: 38, borderRadius: 10, paddingInline: 14,
              background: isAgent
                ? 'linear-gradient(135deg,#8b5cf6,#6366f1)'
                : 'linear-gradient(135deg,#0ea5e9,#06b6d4)',
              border: 'none',
              boxShadow: isAgent
                ? '0 2px 6px rgba(139,92,246,0.3)'
                : '0 2px 6px rgba(14,165,233,0.3)',
              fontSize: 13, fontWeight: 500, flexShrink: 0,
            }}
          />
        </div>
        <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 5, textAlign: 'center' }}>
          {t('aiEnterHint')}
        </div>
      </div>
    </div>
  );
}
