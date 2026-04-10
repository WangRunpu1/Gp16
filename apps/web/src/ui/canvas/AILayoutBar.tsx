import { Button, Input, message, Space, Tooltip } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopologyStore } from '@/state/topologyStore';
import { postJson, apiFetch } from '@/api/client';
import type { AILayoutResult } from '@gp16/shared';

export function AILayoutBar() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const setNodes = useTopologyStore((s) => s.setNodes);
  const setEdges = useTopologyStore((s) => s.setEdges);
  const reset    = useTopologyStore((s) => s.reset);

  async function generate() {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const { taskId } = await postJson<{ taskId: string }>('/api/ai/layout', { prompt });

      // Poll
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const res = await apiFetch<{ state: string; result?: AILayoutResult; failedReason?: string }>(
          `/api/ai/layout/${taskId}`
        );
        if (res.state === 'completed' && res.result) {
          setNodes(res.result.topology.nodes);
          setEdges(res.result.topology.edges);
          message.success(t('aiSuccess'));
          return;
        }
        if (res.state === 'failed') throw new Error(res.failedReason ?? 'failed');
      }
      throw new Error('timeout');
    } catch (e: any) {
      message.error(`${t('aiFail')}：${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input
        placeholder={t('aiPrompt')}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onPressEnter={generate}
        disabled={loading}
        style={{ flex: 1 }}
      />
      <Button type="primary" loading={loading} onClick={generate} disabled={!prompt.trim()}>
        {loading ? t('aiGenerating') : t('aiGenerate')}
      </Button>
      <Tooltip title={t('aiClear')}>
        <Button onClick={reset} disabled={loading}>✕</Button>
      </Tooltip>
    </Space.Compact>
  );
}
