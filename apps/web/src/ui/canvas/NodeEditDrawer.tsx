import { Button, Divider, Drawer, InputNumber, Select, Space, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopologyStore } from '@/state/topologyStore';
import { DEVICE_ICON } from './DeviceIcons';
import type { DeviceType, TopologyNode } from '@gp16/shared';

const ACCENT: Record<DeviceType, string> = {
  pv_panel: '#faad14', inverter: '#1677ff', battery: '#52c41a',
  charger: '#eb2f96',  load: '#722ed1',     grid: '#fa8c16',
};
const LABEL_KEY: Record<DeviceType, string> = {
  pv_panel: 'pvPanel', inverter: 'inverter', battery: 'battery',
  charger: 'charger',  load: 'load',         grid: 'grid',
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>{label}</div>
      {children}
    </div>
  );
}

function NumField({ label, value, min, step, suffix, onChange }: {
  label: string; value?: number; min: number; step: number; suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <InputNumber size="small" min={min} step={step} value={value}
        onChange={(v) => v != null && onChange(v)} addonAfter={suffix} style={{ width: '100%' }} />
    </Field>
  );
}

function SelField({ label, value, opts, onChange }: {
  label: string; value?: string; opts: string[]; onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Select size="small" value={value} onChange={onChange} style={{ width: '100%' }}>
        {opts.map((o) => <Select.Option key={o} value={o}>{o}</Select.Option>)}
      </Select>
    </Field>
  );
}

function NodeFields({ node, update, t }: {
  node: TopologyNode;
  update: (d: Partial<TopologyNode['data']>) => void;
  t: (k: string) => string;
}) {
  const d = node.data;
  const u = (k: keyof TopologyNode['data']) => (v: any) => update({ [k]: v });

  if (d.deviceType === 'pv_panel') return <>
    <NumField label={`${t('ratedPower')} (kW)`}  value={d.ratedPowerKw} min={0.5} step={0.5} suffix="kW" onChange={u('ratedPowerKw')} />
    <NumField label={t('panelCount')}             value={d.panelCount}   min={1}   step={1}   suffix={t('panelCountUnit')} onChange={u('panelCount')} />
    <NumField label={t('efficiency')}             value={d.efficiency}   min={10}  step={0.5} suffix="%" onChange={u('efficiency')} />
    <NumField label={t('tiltAngle')}              value={d.tiltAngle}    min={0}   step={5}   suffix="°" onChange={u('tiltAngle')} />
    <NumField label={t('azimuth')}                value={d.azimuth}      min={0}   step={10}  suffix="°" onChange={u('azimuth')} />
  </>;

  if (d.deviceType === 'inverter') return <>
    <NumField label={`${t('ratedPower')} (kW)`}  value={d.ratedPowerKw} min={0.5} step={0.5} suffix="kW" onChange={u('ratedPowerKw')} />
    <NumField label={t('convEfficiency')}         value={d.efficiency}   min={80}  step={0.5} suffix="%" onChange={u('efficiency')} />
    <SelField label={t('inverterTypeLabel')}      value={d.inverterType}
      opts={[t('invTypeString'), t('invTypeCentral'), t('invTypeMicro')]} onChange={u('inverterType')} />
  </>;

  if (d.deviceType === 'battery') return <>
    <NumField label={`${t('battCapacity')} (kWh)`} value={d.capacityKwh}  min={1}   step={1}   suffix="kWh" onChange={u('capacityKwh')} />
    <NumField label={`${t('ratedPower')} (kW)`}    value={d.ratedPowerKw} min={0.5} step={0.5} suffix="kW"  onChange={u('ratedPowerKw')} />
    <SelField label={t('chemistry')}               value={d.chemistry}
      opts={['LFP', 'NMC', 'NCA', t('chemLead')]} onChange={u('chemistry')} />
    <NumField label={t('cycleLife')}               value={d.cycleLife}    min={500} step={100} suffix={t('cycleUnit')} onChange={u('cycleLife')} />
  </>;

  if (d.deviceType === 'charger') return <>
    <NumField label={`${t('chargerPower')} (kW)`}  value={d.ratedPowerKw} min={3.5} step={3.5} suffix="kW" onChange={u('ratedPowerKw')} />
    <NumField label={t('chargerCountLabel')}        value={d.chargerCount} min={1}   step={1}   suffix={t('chargerCountUnit')} onChange={u('chargerCount')} />
    <SelField label={t('connectorType')}            value={d.connectorType}
      opts={[t('connAC'), t('connDC'), t('connBoth')]} onChange={u('connectorType')} />
  </>;

  if (d.deviceType === 'load') return <>
    <NumField label={`${t('ratedPower')} (kW)`}  value={d.ratedPowerKw} min={0.5} step={0.5} suffix="kW" onChange={u('ratedPowerKw')} />
    <SelField label={t('loadTypeLabel')}          value={d.loadType}
      opts={[t('loadResidential'), t('loadCommercial'), t('loadIndustrial'), t('loadDataCenter')]} onChange={u('loadType')} />
    <NumField label={t('dailyHours')}             value={d.dailyHours}   min={1}   step={0.5} suffix="h" onChange={u('dailyHours')} />
  </>;

  if (d.deviceType === 'grid') return <>
    <NumField label={`${t('voltageLevel')} (kV)`} value={d.voltageKv}  min={0.4} step={0.4} suffix="kV" onChange={u('voltageKv')} />
    <SelField label={t('gridConnection')}          value={d.gridType}
      opts={[t('gridParallel'), t('gridOffGrid'), t('gridMicro')]} onChange={u('gridType')} />
  </>;

  return null;
}

export function NodeEditDrawer() {
  const { t } = useTranslation();
  const nodes         = useTopologyStore((s) => s.nodes);
  const selectedId    = useTopologyStore((s) => s.selectedNodeId);
  const setSelectedId = useTopologyStore((s) => s.setSelectedNodeId);
  const updateNode    = useTopologyStore((s) => s.updateNode);
  const deleteNode    = useTopologyStore((s) => s.deleteNode);

  const node = nodes.find((n) => n.id === selectedId) ?? null;

  function handleDelete() {
    if (!node) return;
    deleteNode(node.id);
    message.success(`${t('deletedNodeMsg')}: ${node.data.label}`);
  }

  if (!node) return null;

  const type   = node.data.deviceType;
  const accent = ACCENT[type];
  const Icon   = DEVICE_ICON[type];

  return (
    <Drawer
      open={!!node}
      onClose={() => setSelectedId(null)}
      width={280}
      placement="right"
      mask={false}
      style={{ position: 'absolute' }}
      getContainer={false}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={22} />
          <span style={{ fontWeight: 700, color: accent }}>{t(LABEL_KEY[type])}</span>
          <Tag color={accent} style={{ marginLeft: 4, fontSize: 10 }}>{t('editParams')}</Tag>
        </div>
      }
      extra={
        <Button danger size="small" icon={<DeleteOutlined />} onClick={handleDelete}>
          {t('deleteBtn')}
        </Button>
      }
      styles={{ body: { padding: '16px 16px 0' } }}
    >
      <Field label={t('deviceName')}>
        <Typography.Text
          editable={{
            icon: <EditOutlined style={{ color: accent }} />,
            onChange: (v) => updateNode(node.id, { label: v }),
          }}
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          {node.data.label}
        </Typography.Text>
      </Field>

      <Divider style={{ margin: '8px 0 12px' }} />

      <NodeFields node={node} update={(d) => updateNode(node.id, d)} t={t} />

      <Divider style={{ margin: '8px 0 12px' }} />

      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
        <Typography.Text style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>
          {t('paramSummary')}
        </Typography.Text>
        <Space wrap size={4}>
          {node.data.ratedPowerKw != null && <Tag color="blue">{node.data.ratedPowerKw} kW</Tag>}
          {node.data.capacityKwh  != null && <Tag color="green">{node.data.capacityKwh} kWh</Tag>}
          {node.data.efficiency   != null && <Tag color="orange">{t('efficiencyTag')} {node.data.efficiency}%</Tag>}
          {node.data.chemistry    && <Tag color="purple">{node.data.chemistry}</Tag>}
          {node.data.inverterType && <Tag>{node.data.inverterType}</Tag>}
          {node.data.loadType     && <Tag>{node.data.loadType}</Tag>}
          {node.data.gridType     && <Tag>{node.data.gridType}</Tag>}
        </Space>
      </div>
    </Drawer>
  );
}
