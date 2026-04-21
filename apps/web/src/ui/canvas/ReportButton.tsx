import { Button, message } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopologyStore } from '@/state/topologyStore';
import { postJson, apiFetch } from '@/api/client';
import { useDebouncedAnalysis } from '@/hooks/useDebouncedAnalysis';

export function ReportButton() {
  const { t } = useTranslation();
  const nodes = useTopologyStore((s) => s.nodes);
  const edges = useTopologyStore((s) => s.edges);
  const { data: analysis } = useDebouncedAnalysis(1200);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const { taskId } = await postJson<{ taskId: string }>('/api/reports', {
        topology: { nodes, edges }, analysis,
      });

      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const res = await apiFetch<{ state: string; downloadUrl?: string; failedReason?: string }>(
          `/api/reports/${taskId}`
        );
        if (res.state === 'completed' && res.downloadUrl) {
          window.open(res.downloadUrl, '_blank');
          return;
        }
        if (res.state === 'failed') throw new Error(res.failedReason ?? 'failed');
      }
      throw new Error('timeout');
    } catch (e: any) {
      message.error(`${t('reportFail')}: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="primary"
      loading={loading}
      onClick={generate}
      disabled={nodes.length === 0}
      icon={<FilePdfOutlined />}
      block
      style={{ fontWeight: 600 }}
    >
      {loading ? t('reportGenerating') : t('generateReport')}
    </Button>
  );
}
