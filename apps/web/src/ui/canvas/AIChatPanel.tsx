import { Button, Input, Spin, Tag, Typography } from 'antd';
import { SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopologyStore } from '@/state/topologyStore';
import { postJson, apiFetch } from '@/api/client';
import type { AILayoutResult } from '@gp16/shared';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

export function AIChatPanel() {
  const { t } = useTranslation();

  const QUICK_SCENARIOS = [
    { labelKey: 'scenarioC1Label', promptKey: 'scenarioC1Prompt' },
    { labelKey: 'scenarioC2Label', promptKey: 'scenarioC2Prompt' },
    { labelKey: 'scenarioC3Label', promptKey: 'scenarioC3Prompt' },
    { labelKey: 'scenarioC4Label', promptKey: 'scenarioC4Prompt' },
  ];

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: t('aiWelcome') },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const setNodes = useTopologyStore((s) => s.setNodes);
  const setEdges = useTopologyStore((s) => s.setEdges);
  const reset    = useTopologyStore((s) => s.reset);

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function sendMessage(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: ChatMessage     = { role: 'user', content: text };
    const thinkingMsg: ChatMessage = { role: 'assistant', content: '', loading: true };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    scrollToBottom();
    setLoading(true);

    try {
      const { taskId } = await postJson<{ taskId: string }>('/api/ai/layout', { prompt: text });

      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const res = await apiFetch<{ state: string; result?: AILayoutResult; failedReason?: string }>(
          `/api/ai/layout/${taskId}`
        );
        if (res.state === 'completed' && res.result) {
          setNodes(res.result.topology.nodes);
          setEdges(res.result.topology.edges);
          const nodeCount = res.result.topology.nodes.length;
          const edgeCount = res.result.topology.edges.length;
          const assumptionLines = res.result.assumptions?.length
            ? '\n\n' + t('aiAssumptions') + '\n' + res.result.assumptions.map((a) => `• ${a}`).join('\n')
            : '';
          const reply = t('aiSuccessMsg', { nodes: nodeCount, edges: edgeCount }) + assumptionLines;
          setMessages((prev) => [...prev.slice(0, -1), { role: 'assistant', content: reply }]);
          scrollToBottom();
          return;
        }
        if (res.state === 'failed') throw new Error(res.failedReason ?? 'failed');
      }
      throw new Error('timeout');
    } catch (e: any) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: t('aiFailMsg', { err: e?.message ?? e }) },
      ]);
      scrollToBottom();
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    reset();
    setMessages([{ role: 'assistant', content: t('aiCleared') }]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid #e5e7eb',
        background: 'linear-gradient(135deg,#1677ff 0%,#0ea5e9 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          }}>🤖</div>
          <div>
            <Typography.Text style={{ color: '#fff', fontWeight: 700, fontSize: 13, display: 'block', lineHeight: 1.2 }}>
              {t('aiAssistant')}
            </Typography.Text>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>
              {t('aiSubtitle')}
            </Typography.Text>
          </div>
        </div>
        <Button size="small" ghost onClick={handleClear} style={{ fontSize: 11 }}>
          {t('clearCanvas')}
        </Button>
      </div>

      {/* Quick scenarios */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ThunderboltOutlined style={{ fontSize: 10 }} /> {t('quickScenarios')}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {QUICK_SCENARIOS.map((s) => (
            <Tag
              key={s.labelKey}
              color="blue"
              style={{ cursor: 'pointer', fontSize: 10, padding: '1px 7px', borderRadius: 10 }}
              onClick={() => !loading && sendMessage(t(s.promptKey))}
            >
              {t(s.labelKey)}
            </Tag>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-start', gap: 8,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: msg.role === 'user' ? '#1677ff' : '#f0fdf4',
              border: msg.role === 'assistant' ? '1px solid #86efac' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
            }}>
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div style={{
              maxWidth: '82%', padding: '8px 11px',
              borderRadius: msg.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
              background: msg.role === 'user' ? '#1677ff' : '#f8fafc',
              border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
              fontSize: 12, lineHeight: 1.65,
              color: msg.role === 'user' ? '#fff' : '#1e293b',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spin size="small" />
                  <span style={{ color: '#64748b', fontSize: 11 }}>{t('aiGeneratingMsg')}</span>
                </div>
              ) : msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px', borderTop: '1px solid #e5e7eb', background: '#fafafa' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Input.TextArea
            placeholder={t('aiInputPlaceholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            disabled={loading}
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{ fontSize: 12, resize: 'none' }}
          />
          <Button
            type="primary" icon={<SendOutlined />}
            onClick={() => sendMessage()}
            loading={loading}
            disabled={!input.trim()}
            style={{ height: 'auto', alignSelf: 'flex-end', paddingInline: 12 }}
          />
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
          {t('aiEnterHint')}
        </div>
      </div>
    </div>
  );
}
