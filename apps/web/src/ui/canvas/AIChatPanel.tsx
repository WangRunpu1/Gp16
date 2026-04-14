import { Button, Input, message, Spin, Tag, Typography } from 'antd';
import { SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useRef, useState } from 'react';
import { useTopologyStore } from '@/state/topologyStore';
import { postJson, apiFetch } from '@/api/client';
import type { AILayoutResult } from '@gp16/shared';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

const QUICK_SCENARIOS = [
  { label: '工商业储能', prompt: '50kW 光伏 + 100kWh 储能，工商业用户，含逆变器和并网接入' },
  { label: '居民屋顶', prompt: '10kW 屋顶光伏 + 20kWh 家用储能，居民用户，含充电桩 7kW' },
  { label: '园区微网', prompt: '200kW 光伏 + 400kWh 储能 + 2台 60kW 直流充电桩，工业园区微网' },
  { label: '离网系统', prompt: '30kW 光伏 + 60kWh 储能，离网独立供电，农村电气化项目' },
];

export function AIChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '你好！我是光伏系统 AI 设计助手。\n\n描述你的需求，我来生成系统拓扑布局。也可以点击下方快捷场景快速开始。',
    },
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
          const assumptions = res.result.assumptions?.length
            ? '\n\n设计假设：\n' + res.result.assumptions.map((a) => `• ${a}`).join('\n')
            : '';
          const reply = `✅ 布局已生成！\n\n共 ${nodeCount} 台设备、${edgeCount} 条连接已放置到画布。\n点击设备可在右侧面板编辑参数，也可拖拽调整位置。${assumptions}`;
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
        { role: 'assistant', content: `生成失败：${e?.message ?? e}，请重试。` },
      ]);
      scrollToBottom();
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    reset();
    setMessages([{ role: 'assistant', content: '画布已清空，请描述新的系统需求。' }]);
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
              AI 布局助手
            </Typography.Text>
            <Typography.Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>
              GP16 智能设计
            </Typography.Text>
          </div>
        </div>
        <Button size="small" ghost onClick={handleClear} style={{ fontSize: 11 }}>
          清空画布
        </Button>
      </div>

      {/* Quick scenarios */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ThunderboltOutlined style={{ fontSize: 10 }} /> 快捷场景
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {QUICK_SCENARIOS.map((s) => (
            <Tag
              key={s.label}
              color="blue"
              style={{ cursor: 'pointer', fontSize: 10, padding: '1px 7px', borderRadius: 10 }}
              onClick={() => !loading && sendMessage(s.prompt)}
            >
              {s.label}
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
                  <span style={{ color: '#64748b', fontSize: 11 }}>AI 正在生成布局...</span>
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
            placeholder="描述系统需求，例如：50kW 光伏 + 100kWh 储能，工商业用户..."
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
          Enter 发送 · Shift+Enter 换行
        </div>
      </div>
    </div>
  );
}
