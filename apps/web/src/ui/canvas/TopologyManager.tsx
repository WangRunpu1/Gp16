import { Button, Drawer, Input, List, message, Modal, Popconfirm, Space, Typography } from 'antd';
import { SaveOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopologyStore } from '@/state/topologyStore';
import { apiFetch, postJson } from '@/api/client';
import type { SavedTopology } from '@gp16/shared';

export function TopologyManager() {
  const { t, i18n } = useTranslation();
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
      <Space style={{ width: '100%' }}>
        <Button size="small" icon={<SaveOutlined />} onClick={() => setSaveOpen(true)} disabled={nodes.length === 0}
          style={{ borderRadius: 8, fontWeight: 500, flex: 1 }}>
          {t('saveTopology')}
        </Button>
        <Button size="small" icon={<FolderOpenOutlined />} onClick={() => setOpen(true)}
          style={{ borderRadius: 8, fontWeight: 500, flex: 1 }}>
          {t('loadTopology')}
        </Button>
      </Space>

      {/* Save modal */}
      <Modal
        title={t('saveTopology')} open={saveOpen}
        onOk={save} onCancel={() => setSaveOpen(false)}
        confirmLoading={saving} okText={t('saveTopology')}
        centered
      >
        <Input
          placeholder={t('saveName')}
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onPressEnter={save}
          style={{ borderRadius: 8 }}
          size="large"
        />
      </Modal>

      {/* Load drawer */}
      <Drawer title={t('loadTopology')} open={open} onClose={() => setOpen(false)} width={380}>
        {list.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>{t('noSaved')}</Typography.Text>
          </div>
        ) : (
          <List
            dataSource={list}
            renderItem={(item) => (
              <List.Item
                style={{ borderRadius: 10, padding: '12px 14px', background: '#fafbfc', marginBottom: 8, border: '1px solid #f1f5f9' }}
                actions={[
                  <Button size="small" type="primary" onClick={() => load(item)} style={{ borderRadius: 7, fontWeight: 500, fontSize: 11 }}>{t('loadBtn')}</Button>,
                  <Popconfirm title={t('confirmDelete')} onConfirm={() => del(item.id)}>
                    <Button size="small" type="text" danger style={{ fontSize: 11 }}>{t('deleteBtn')}</Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  title={<span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{item.name}</span>}
                  description={<span style={{ fontSize: 11.5, color: '#94a3b8' }}>{t('deviceCount', { count: item.nodes.length })} · {new Date(item.updatedAt).toLocaleDateString(i18n.language === 'zh' ? 'zh-CN' : 'en-US')}</span>}
                />
              </List.Item>
            )}
          />
        )}
      </Drawer>
    </>
  );
}
