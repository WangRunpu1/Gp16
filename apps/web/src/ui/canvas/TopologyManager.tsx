import { Button, Drawer, Input, List, message, Modal, Popconfirm, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopologyStore } from '@/state/topologyStore';
import { apiFetch, postJson } from '@/api/client';
import type { SavedTopology } from '@gp16/shared';

export function TopologyManager() {
  const { t } = useTranslation();
  const nodes = useTopologyStore((s) => s.nodes);
  const edges = useTopologyStore((s) => s.edges);
  const setNodes = useTopologyStore((s) => s.setNodes);
  const setEdges = useTopologyStore((s) => s.setEdges);

  const [open, setOpen] = useState(false);
  const [list, setList] = useState<SavedTopology[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadList() {
    try {
      const data = await apiFetch<SavedTopology[]>('/api/topologies');
      setList(data);
    } catch { /* ignore */ }
  }

  useEffect(() => { if (open) loadList(); }, [open]);

  async function save() {
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      await postJson('/api/topologies', { name: saveName.trim(), nodes, edges });
      message.success(t('saveSuccess'));
      setSaveOpen(false);
      setSaveName('');
    } catch {
      message.error(t('saveFail'));
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    await apiFetch(`/api/topologies/${id}`, { method: 'DELETE' });
    message.success(t('deleteSuccess'));
    loadList();
  }

  function load(item: SavedTopology) {
    setNodes(item.nodes);
    setEdges(item.edges);
    setOpen(false);
  }

  return (
    <>
      <Space>
        <Button size="small" onClick={() => setSaveOpen(true)} disabled={nodes.length === 0}>
          💾 {t('saveTopology')}
        </Button>
        <Button size="small" onClick={() => setOpen(true)}>
          📂 {t('loadTopology')}
        </Button>
      </Space>

      {/* Save modal */}
      <Modal
        title={t('saveTopology')} open={saveOpen}
        onOk={save} onCancel={() => setSaveOpen(false)}
        confirmLoading={saving} okText={t('saveTopology')}
      >
        <Input
          placeholder={t('saveName')}
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onPressEnter={save}
        />
      </Modal>

      {/* Load drawer */}
      <Drawer title={t('loadTopology')} open={open} onClose={() => setOpen(false)} width={360}>
        {list.length === 0 ? (
          <Typography.Text type="secondary">{t('noSaved')}</Typography.Text>
        ) : (
          <List
            dataSource={list}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button size="small" type="link" onClick={() => load(item)}>加载</Button>,
                  <Popconfirm title="确认删除？" onConfirm={() => del(item.id)}>
                    <Button size="small" type="link" danger>删除</Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={item.name}
                  description={`${item.nodes.length} 设备 · ${new Date(item.updatedAt).toLocaleDateString('zh-CN')}`}
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </>
  );
}
