import { Button, Divider, InputNumber, Popover, Select, Tooltip, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeviceType, TopologyNode } from '@gp16/shared';
import { nanoid } from '@/utils/nanoid';
import { useTopologyStore } from '@/state/topologyStore';
import { DEVICE_ICON } from './DeviceIcons';

const ACCENT: Record<DeviceType, string> = {
  pv_panel: '#faad14', inverter: '#1677ff', battery: '#52c41a',
  charger: '#eb2f96',  load: '#722ed1',     grid: '#fa8c16',
};
const BG: Record<DeviceType, string> = {
  pv_panel: '#fffbe6', inverter: '#e6f4ff', battery: '#f6ffed',
  charger: '#fff0f6',  load: '#f9f0ff',     grid: '#fff7e6',
};

// i18n key for each device label
const LABEL_KEY: Record<DeviceType, string> = {
  pv_panel: 'pvPanel', inverter: 'inverter', battery: 'battery',
  charger: 'charger',  load: 'load',         grid: 'grid',
};

type Params = {
  pv_panel_kw: number; pv_panel_count: number; pv_panel_eff: number; pv_panel_tilt: number; pv_panel_az: number;
  inverter_kw: number; inverter_eff: number; inverter_type: string;
  battery_kwh: number; battery_kw: number; battery_chem: string; battery_cycles: number;
  charger_kw: number; charger_count: number; charger_conn: string;
  load_kw: number; load_type: string; load_hours: number;
  grid_kv: number; grid_type: string;
};

function useDefaults(_t: (k: string) => string): Params {
  return {
    pv_panel_kw: 10, pv_panel_count: 20, pv_panel_eff: 20, pv_panel_tilt: 30, pv_panel_az: 180,
    inverter_kw: 10, inverter_eff: 98, inverter_type: 'String',
    battery_kwh: 20, battery_kw: 10, battery_chem: 'LFP', battery_cycles: 6000,
    charger_kw: 7, charger_count: 2, charger_conn: 'AC Slow',
    load_kw: 5, load_type: 'Commercial', load_hours: 10,
    grid_kv: 10, grid_type: 'Grid-tied',
  };
}

function ParamForm({ type, params, set, t }: {
  type: DeviceType; params: Params;
  set: (k: keyof Params, v: any) => void;
  t: (k: string) => string;
}) {
  const num = (k: keyof Params, labelKey: string, min: number, step: number, suffix: string) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{t(labelKey)}</div>
      <InputNumber size="small" min={min} step={step} value={params[k] as number}
        onChange={(v) => v != null && set(k, v)} addonAfter={suffix} style={{ width: '100%' }} />
    </div>
  );
  const sel = (k: keyof Params, labelKey: string, opts: string[]) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{t(labelKey)}</div>
      <Select size="small" value={params[k] as string} onChange={(v) => set(k, v)} style={{ width: '100%' }}>
        {opts.map((o) => <Select.Option key={o} value={o}>{o}</Select.Option>)}
      </Select>
    </div>
  );

  if (type === 'pv_panel') return <div style={{ width: 200 }}>
    {num('pv_panel_kw',    'ratedPower',  0.5, 0.5, 'kW')}
    {num('pv_panel_count', 'panelCount',  1,   1,   t('panelCountUnit'))}
    {num('pv_panel_eff',   'efficiency',  10,  0.5, '%')}
    {num('pv_panel_tilt',  'tiltAngle',   0,   5,   '°')}
    {num('pv_panel_az',    'azimuth',     0,   10,  '°')}
  </div>;

  if (type === 'inverter') return <div style={{ width: 200 }}>
    {num('inverter_kw',  'ratedPower',       0.5, 0.5, 'kW')}
    {num('inverter_eff', 'convEfficiency',   80,  0.5, '%')}
    {sel('inverter_type','inverterTypeLabel', [t('invTypeString'), t('invTypeCentral'), t('invTypeMicro')])}
  </div>;

  if (type === 'battery') return <div style={{ width: 200 }}>
    {num('battery_kwh',    'battCapacity', 1,   1,   'kWh')}
    {num('battery_kw',     'ratedPower',   0.5, 0.5, 'kW')}
    {sel('battery_chem',   'chemistry',    ['LFP', 'NMC', 'NCA', t('chemLead')])}
    {num('battery_cycles', 'cycleLife',    500, 100, t('cycleUnit'))}
  </div>;

  if (type === 'charger') return <div style={{ width: 200 }}>
    {num('charger_kw',    'chargerPower',      3.5, 3.5, 'kW')}
    {num('charger_count', 'chargerCountLabel', 1,   1,   t('chargerCountUnit'))}
    {sel('charger_conn',  'connectorType',     [t('connAC'), t('connDC'), t('connBoth')])}
  </div>;

  if (type === 'load') return <div style={{ width: 200 }}>
    {num('load_kw',    'ratedPower',   0.5, 0.5, 'kW')}
    {sel('load_type',  'loadTypeLabel',[t('loadResidential'), t('loadCommercial'), t('loadIndustrial'), t('loadDataCenter')])}
    {num('load_hours', 'dailyHours',   1,   0.5, 'h')}
  </div>;

  if (type === 'grid') return <div style={{ width: 200 }}>
    {num('grid_kv',   'voltageLevel',   0.4, 0.4, 'kV')}
    {sel('grid_type', 'gridConnection', [t('gridParallel'), t('gridOffGrid'), t('gridMicro')])}
  </div>;

  return null;
}

function buildNodeData(type: DeviceType, params: Params, t: (k: string) => string): TopologyNode['data'] {
  if (type === 'pv_panel') return {
    label: `${t('nodeLabelPv')} ${params.pv_panel_kw}kW×${params.pv_panel_count}`,
    deviceType: type, ratedPowerKw: params.pv_panel_kw,
    panelCount: params.pv_panel_count, efficiency: params.pv_panel_eff,
    tiltAngle: params.pv_panel_tilt, azimuth: params.pv_panel_az,
  };
  if (type === 'inverter') return {
    label: `${t('nodeLabelInv')} ${params.inverter_kw}kW`,
    deviceType: type, ratedPowerKw: params.inverter_kw,
    efficiency: params.inverter_eff, inverterType: params.inverter_type,
  };
  if (type === 'battery') return {
    label: `${t('nodeLabelBat')} ${params.battery_kwh}kWh`,
    deviceType: type, capacityKwh: params.battery_kwh, ratedPowerKw: params.battery_kw,
    chemistry: params.battery_chem, cycleLife: params.battery_cycles,
  };
  if (type === 'charger') return {
    label: `${t('nodeLabelChg')} ${params.charger_kw}kW×${params.charger_count}`,
    deviceType: type, ratedPowerKw: params.charger_kw * params.charger_count,
    chargerCount: params.charger_count, connectorType: params.charger_conn,
  };
  if (type === 'load') return {
    label: `${params.load_type} ${t('nodeLabelLoad')} ${params.load_kw}kW`,
    deviceType: type, ratedPowerKw: params.load_kw,
    loadType: params.load_type, dailyHours: params.load_hours,
  };
  return {
    label: `${t('nodeLabelGrid')} ${params.grid_kv}kV`,
    deviceType: type, voltageKv: params.grid_kv, gridType: params.grid_type,
  };
}

const DEVICES: DeviceType[] = ['pv_panel', 'inverter', 'battery', 'charger', 'load', 'grid'];

export function BottomToolbar() {
  const { t } = useTranslation();
  const nodes          = useTopologyStore((s) => s.nodes);
  const setNodes       = useTopologyStore((s) => s.setNodes);
  const selectedNodeId = useTopologyStore((s) => s.selectedNodeId);
  const deleteNode     = useTopologyStore((s) => s.deleteNode);
  const [params, setParams] = useState<Params>(() => useDefaults(t));
  const [open, setOpen] = useState<DeviceType | null>(null);

  function setParam(k: keyof Params, v: any) {
    setParams((p) => ({ ...p, [k]: v }));
  }

  function addNode(type: DeviceType) {
    const data = buildNodeData(type, params, t);
    const col  = nodes.length % 5;
    const row  = Math.floor(nodes.length / 5);
    const node: TopologyNode = {
      id: nanoid(),
      position: { x: 80 + col * 200, y: 80 + row * 130 },
      data,
    };
    setNodes([...nodes, node]);
    setOpen(null);
    message.success(`${t('addedMsg')}: ${data.label}`);
  }

  function handleDelete() {
    if (!selectedNodeId) return message.warning(t('deleteNoSelectMsg'));
    deleteNode(selectedNodeId);
    message.success(t('deletedMsg'));
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 0,
      background: '#fff', borderTop: '1px solid #e5e7eb',
      height: 108, flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Left: AI hint */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 14px', gap: 6, background: 'linear-gradient(180deg,#f0f9ff 0%,#e0f2fe 100%)',
        borderRight: '1px solid #e5e7eb', minWidth: 90,
      }}>
        <RobotOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <Typography.Text style={{ fontSize: 10, color: '#1677ff', textAlign: 'center', lineHeight: 1.3, whiteSpace: 'pre-line' }}>
          {t('aiDialogHint')}
        </Typography.Text>
      </div>

      {/* Center: device cards */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', overflowX: 'auto' }}>
        {DEVICES.map((type) => {
          const Icon   = DEVICE_ICON[type];
          const accent = ACCENT[type];
          const bg     = BG[type];
          const label  = t(LABEL_KEY[type]);
          return (
            <Popover
              key={type}
              open={open === type}
              onOpenChange={(v) => setOpen(v ? type : null)}
              trigger="click"
              placement="top"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={20} />
                  <span style={{ color: accent, fontWeight: 600 }}>{label} {t('paramSettings')}</span>
                </div>
              }
              content={
                <div>
                  <ParamForm type={type} params={params} set={setParam} t={t} />
                  <Button type="primary" block size="small" icon={<PlusOutlined />}
                    style={{ background: accent, borderColor: accent, marginTop: 4 }}
                    onClick={() => addNode(type)}>
                    {t('addToCanvas')}
                  </Button>
                </div>
              }
            >
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                width: 82, height: 88, padding: '8px 6px 6px',
                background: open === type ? bg : '#fafafa',
                border: `1.5px solid ${open === type ? accent : '#e5e7eb'}`,
                borderRadius: 8, cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.15s',
                boxShadow: open === type ? `0 0 0 2px ${accent}33` : 'none',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = accent; (e.currentTarget as HTMLDivElement).style.background = bg; }}
                onMouseLeave={(e) => { if (open !== type) { (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLDivElement).style.background = '#fafafa'; } }}
              >
                <Icon size={32} />
                <Typography.Text style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginTop: 2 }}>
                  {label}
                </Typography.Text>
                <Tooltip title={t('clickToAdd')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: accent, fontWeight: 500 }}>
                    <PlusOutlined style={{ fontSize: 9 }} /> {t('addDevice')}
                  </div>
                </Tooltip>
              </div>
            </Popover>
          );
        })}
      </div>

      <Divider type="vertical" style={{ height: '60%', alignSelf: 'center', margin: '0 4px' }} />

      {/* Right: delete */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px' }}>
        <Tooltip title={selectedNodeId ? t('deleteSelectedTip') : t('selectFirstTip')}>
          <Button
            danger icon={<DeleteOutlined />} size="small"
            disabled={!selectedNodeId}
            onClick={handleDelete}
            style={{ fontSize: 12 }}
          >
            {t('deleteSelected')}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
