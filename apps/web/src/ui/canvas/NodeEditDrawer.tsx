import { Button, Divider, Drawer, InputNumber, Select, Space, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useTopologyStore } from '@/state/topologyStore';
import { DEVICE_ICON } from './DeviceIcons';
import type { DeviceType, TopologyNode } from '@gp16/shared';

const ACCENT: Record<DeviceType, string> = {
  pv_panel: '#faad14', inverter: '#1677ff', battery: '#52c41a',
  charger: '#eb2f96',  load: '#722ed1',     grid: '#fa8c16',
};
const LABEL: Record<DeviceType, string> = {
  pv_panel: '光伏板', inverter: '逆变器', battery: '储能',
  charger: '充电桩',  load: '负载',       grid: '电网',
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

function NodeFields({ node, update }: { node: TopologyNode; update: (d: Partial<TopologyNode['data']>) => void }) {
  const d = node.data;
  const u = (k: keyof TopologyNode['data']) => (v: any) => update({ [k]: v });

  if (d.deviceType === 'pv_panel') return <>
    <NumField label="额定功率 (kW)" value={d.ratedPowerKw} min={0.5} step={0.5} suffix="kW" onChange={u('ratedPowerKw')} />
    <NumField label="组件数量" value={d.panelCount} min={1} step={1} suffix="块" onChange={u('panelCount')} />
    <NumField label="组件效率" value={d.efficiency} min={10} step={0.5} suffix="%" onChange={u('efficiency')} />
    <NumField label="倾斜角度" value={d.tiltAngle} min={0} step={5} suffix="°" onChange={u('tiltAngle')} />
    <NumField label="方位角" value={d.azimuth} min={0} step={10} suffix="°" onChange={u('azimuth')} />
  </>;

  if (d.deviceType === 'inverter') return <>
    <NumField label="额定功率 (kW)" value={d.ratedPowerKw} min={0.5} step={0.5} suffix="kW" onChange={u('ratedPowerKw')} />
    <NumField label="转换效率" value={d.efficiency} min={80} step={0.5} suffix="%" onChange={u('efficiency')} />
    <SelField label="逆变器类型" value={d.inverterType} opts={['组串式', '集中式', '微型']} onChange={u('inverterType')} />
  </>;

  if (d.deviceType === 'battery') return <>
    <NumField label="储能容量 (kWh)" value={d.capacityKwh} min={1} step={1} suffix="kWh" onChange={u('capacityKwh')} />
    <NumField label="额定功率 (kW)" value={d.ratedPowerKw} min={0.5} step={0.5} suffix="kW" onChange={u('ratedPowerKw')} />
    <SelField label="电池化学体系" value={d.chemistry} opts={['LFP', 'NMC', 'NCA', '铅酸']} onChange={u('chemistry')} />
    <NumField label="循环寿命" value={d.cycleLife} min={500} step={100} suffix="次" onChange={u('cycleLife')} />
  </>;

  if (d.deviceType === 'charger') return <>
    <NumField label="单桩功率 (kW)" value={d.ratedPowerKw} min={3.5} step={3.5} suffix="kW" onChange={u('ratedPowerKw')} />
    <NumField label="充电桩数量" value={d.chargerCount} min={1} step={1} suffix="台" onChange={u('chargerCount')} />
    <SelField label="接口类型" value={d.connectorType} opts={['AC慢充', 'DC快充', 'AC/DC双枪']} onChange={u('connectorType')} />
  </>;

  if (d.deviceType === 'load') return <>
    <NumField label="额定功率 (kW)" value={d.ratedPowerKw} min={0.5} step={0.5} suffix="kW" onChange={u('ratedPowerKw')} />
    <SelField label="负载类型" value={d.loadType} opts={['居民', '商业', '工业', '数据中心']} onChange={u('loadType')} />
    <NumField label="日用电时长" value={d.dailyHours} min={1} step={0.5} suffix="h" onChange={u('dailyHours')} />
  </>;

  if (d.deviceType === 'grid') return <>
    <NumField label="电压等级 (kV)" value={d.voltageKv} min={0.4} step={0.4} suffix="kV" onChange={u('voltageKv')} />
    <SelField label="接入方式" value={d.gridType} opts={['并网', '离网', '微网']} onChange={u('gridType')} />
  </>;

  return null;
}

export function NodeEditDrawer() {
  const nodes         = useTopologyStore((s) => s.nodes);
  const selectedId    = useTopologyStore((s) => s.selectedNodeId);
  const setSelectedId = useTopologyStore((s) => s.setSelectedNodeId);
  const updateNode    = useTopologyStore((s) => s.updateNode);
  const deleteNode    = useTopologyStore((s) => s.deleteNode);

  const node = nodes.find((n) => n.id === selectedId) ?? null;

  function handleDelete() {
    if (!node) return;
    deleteNode(node.id);
    message.success(`已删除 ${node.data.label}`);
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
          <span style={{ fontWeight: 700, color: accent }}>{LABEL[type]}</span>
          <Tag color={accent} style={{ marginLeft: 4, fontSize: 10 }}>编辑参数</Tag>
        </div>
      }
      extra={
        <Button danger size="small" icon={<DeleteOutlined />} onClick={handleDelete}>
          删除
        </Button>
      }
      styles={{ body: { padding: '16px 16px 0' } }}
    >
      {/* Label */}
      <Field label="设备名称">
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

      <NodeFields node={node} update={(d) => updateNode(node.id, d)} />

      <Divider style={{ margin: '8px 0 12px' }} />

      {/* Spec summary */}
      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
        <Typography.Text style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 6 }}>
          参数摘要
        </Typography.Text>
        <Space wrap size={4}>
          {node.data.ratedPowerKw != null && (
            <Tag color="blue">{node.data.ratedPowerKw} kW</Tag>
          )}
          {node.data.capacityKwh != null && (
            <Tag color="green">{node.data.capacityKwh} kWh</Tag>
          )}
          {node.data.efficiency != null && (
            <Tag color="orange">效率 {node.data.efficiency}%</Tag>
          )}
          {node.data.chemistry && (
            <Tag color="purple">{node.data.chemistry}</Tag>
          )}
          {node.data.inverterType && (
            <Tag>{node.data.inverterType}</Tag>
          )}
          {node.data.loadType && (
            <Tag>{node.data.loadType}</Tag>
          )}
          {node.data.gridType && (
            <Tag>{node.data.gridType}</Tag>
          )}
        </Space>
      </div>
    </Drawer>
  );
}
