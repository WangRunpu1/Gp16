import { Button, Input, message, Spin, Typography } from 'antd';
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
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your PV System AI Assistant. Describe your requirements and I will generate a layout for you.\n\nExample: "10kW PV + 20kWh battery storage, commercial user with EV charger"',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const setNodes = useTopologyStore((s) => s.setNodes);
  const setEdges = useTopologyStore((s) => s.setEdges);
  const reset = useTopologyStore((s) => s.reset);

  function scrollToBottom() {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  async function sendMessage() {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: prompt };
    const thinkingMsg: ChatMessage = { role: 'assistant', content: '', loading: true };
    setMessages((prev) => [...prev, userMsg, thinkingMsg]);
    scrollToBottom();
    setLoading(true);

    try {
      const { taskId } = await postJson<{ taskId: string }>('/api/ai/layout', { prompt });

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
          const reply = `Layout generated successfully! ✅\n\n${nodeCount} devices and ${edgeCount} connections have been placed on the canvas. You can drag to rearrange or connect them manually.\n\nWant to refine anything?`;
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: reply },
          ]);
          scrollToBottom();
          return;
        }
        if (res.state === 'failed') throw new Error(res.failedReason ?? 'failed');
      }
      throw new Error('timeout');
    } catch (e: any) {
      const errMsg = `Sorry, layout generation failed: ${e?.message ?? e}. Please try again.`;
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: errMsg },
      ]);
      scrollToBottom();
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    reset();
    setMessages([
      {
        role: 'assistant',
        content: 'Canvas cleared. Describe a new system to get started!',
      },
    ]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid #e5e7eb',
        background: 'linear-gradient(90deg,#1677ff 0%,#0ea5e9 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <Typography.Text style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>
            AI Layout Agent
          </Typography.Text>
        </div>
        <Button size="small" ghost onClick={handleClear} style={{ fontSize: 11 }}>
          Clear Canvas
        </Button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: msg.role === 'user' ? '#1677ff' : '#f0fdf4',
              border: msg.role === 'assistant' ? '1px solid #86efac' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
            }}>
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>

            {/* Bubble */}
            <div style={{
              maxWidth: '82%',
              padding: '8px 12px',
              borderRadius: msg.role === 'user' ? '12px 2px 12px 12px' : '2px 12px 12px 12px',
              background: msg.role === 'user' ? '#1677ff' : '#f8fafc',
              border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
              fontSize: 12,
              lineHeight: 1.6,
              color: msg.role === 'user' ? '#fff' : '#1e293b',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {msg.loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Spin size="small" />
                  <span style={{ color: '#64748b', fontSize: 11 }}>Generating layout...</span>
                </div>
              ) : msg.content}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 10px', borderTop: '1px solid #e5e7eb', background: '#fafafa' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Input.TextArea
            placeholder={t('aiPrompt')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            disabled={loading}
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{ fontSize: 12, resize: 'none' }}
          />
          <Button
            type="primary"
            onClick={sendMessage}
            loading={loading}
            disabled={!input.trim()}
            style={{ height: 'auto', alignSelf: 'flex-end' }}
          >
            Send
          </Button>
        </div>
        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>
          Press Enter to send · Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
