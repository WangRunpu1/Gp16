import { Button, Divider, InputNumber, Modal, Popconfirm, Popover, Select, Switch, Tag, Tooltip, Typography, message } from 'antd';
import {
  DeleteOutlined, PlusOutlined, RobotOutlined,
  UndoOutlined, RedoOutlined, LayoutOutlined,
  AppstoreOutlined, ClearOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeviceType, TopologyNode, TopologyEdge } from '@gp16/shared';
import { nanoid } from '@/utils/nanoid';
import { useTopologyStore } from '@/state/topologyStore';
import { DEVICE_ICON } from './DeviceIcons';
import { ACCENT, BG, LABEL_KEY } from '@/theme';

// ── Device parameter types & defaults ────────────────────────────────────────

type Params = {
  pv_panel_kw: number; pv_panel_count: number; pv_panel_eff: number; pv_panel_tilt: number; pv_panel_az: number;
  inverter_kw: number; inverter_eff: number; inverter_type: string;
  battery_kwh: number; battery_kw: number; battery_chem: string; battery_cycles: number;
  charger_kw: number; charger_count: number; charger_conn: string;
  load_kw: number; load_type: string; load_hours: number;
  grid_kv: number; grid_type: string;
};

function useDefaults(): Params {
  return {
    pv_panel_kw: 10, pv_panel_count: 20, pv_panel_eff: 20, pv_panel_tilt: 30, pv_panel_az: 180,
    inverter_kw: 10, inverter_eff: 98, inverter_type: 'String',
    battery_kwh: 20, battery_kw: 10, battery_chem: 'LFP', battery_cycles: 6000,
    charger_kw: 7, charger_count: 2, charger_conn: 'AC Slow',
    load_kw: 5, load_type: 'Commercial', load_hours: 10,
    grid_kv: 10, grid_type: 'Grid-tied',
  };
}

// ── ParamForm (unchanged) ────────────────────────────────────────────────────

function ParamForm({ type, params, set, t }: {
  type: DeviceType; params: Params;
  set: (k: keyof Params, v: any) => void;
  t: (k: string) => string;
}) {
  const num = (k: keyof Params, labelKey: string, min: number, step: number, suffix: string) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>{t(labelKey)}</div>
      <InputNumber size="small" min={min} step={step} value={params[k] as number}
        onChange={(v) => v != null && set(k, v)} addonAfter={suffix} style={{ width: '100%', borderRadius: 8, borderColor: '#e2e8f0' }} />
    </div>
  );
  const sel = (k: keyof Params, labelKey: string, opts: string[]) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>{t(labelKey)}</div>
      <Select size="small" value={params[k] as string} onChange={(v) => set(k, v)} style={{ width: '100%', borderRadius: 8 }}>
        {opts.map((o) => <Select.Option key={o} value={o}>{o}</Select.Option>)}
      </Select>
    </div>
  );

  if (type === 'pv_panel') return <div style={{ width: 200 }}>
    {num('pv_panel_kw', 'ratedPower', 0.5, 0.5, 'kW')}
    {num('pv_panel_count', 'panelCount', 1, 1, t('panelCountUnit'))}
    {num('pv_panel_eff', 'efficiency', 10, 0.5, '%')}
    {num('pv_panel_tilt', 'tiltAngle', 0, 5, '°')}
    {num('pv_panel_az', 'azimuth', 0, 10, '°')}
  </div>;

  if (type === 'inverter') return <div style={{ width: 200 }}>
    {num('inverter_kw', 'ratedPower', 0.5, 0.5, 'kW')}
    {num('inverter_eff', 'convEfficiency', 80, 0.5, '%')}
    {sel('inverter_type', 'inverterTypeLabel', [t('invTypeString'), t('invTypeCentral'), t('invTypeMicro')])}
  </div>;

  if (type === 'battery') return <div style={{ width: 200 }}>
    {num('battery_kwh', 'battCapacity', 1, 1, 'kWh')}
    {num('battery_kw', 'ratedPower', 0.5, 0.5, 'kW')}
    {sel('battery_chem', 'chemistry', ['LFP', 'NMC', 'NCA', t('chemLead')])}
    {num('battery_cycles', 'cycleLife', 500, 100, t('cycleUnit'))}
  </div>;

  if (type === 'charger') return <div style={{ width: 200 }}>
    {num('charger_kw', 'chargerPower', 3.5, 3.5, 'kW')}
    {num('charger_count', 'chargerCountLabel', 1, 1, t('chargerCountUnit'))}
    {sel('charger_conn', 'connectorType', [t('connAC'), t('connDC'), t('connBoth')])}
  </div>;

  if (type === 'load') return <div style={{ width: 200 }}>
    {num('load_kw', 'ratedPower', 0.5, 0.5, 'kW')}
    {sel('load_type', 'loadTypeLabel', [t('loadResidential'), t('loadCommercial'), t('loadIndustrial'), t('loadDataCenter')])}
    {num('load_hours', 'dailyHours', 1, 0.5, 'h')}
  </div>;

  if (type === 'grid') return <div style={{ width: 200 }}>
    {num('grid_kv', 'voltageLevel', 0.4, 0.4, 'kV')}
    {sel('grid_type', 'gridConnection', [t('gridParallel'), t('gridOffGrid'), t('gridMicro')])}
  </div>;

  return null;
}

// ── Node data builder (unchanged) ────────────────────────────────────────────

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

// ── Template definitions ─────────────────────────────────────────────────────

interface TemplateDef {
  key: string;
  i18nKey: string;
  icon: React.ReactNode;
  color: string;
  nodes: { type: DeviceType; x: number; y: number; dataFn: (p: Params, t: (k: string) => string) => TopologyNode['data'] }[];
  edges: { fromIdx: number; toIdx: number }[];
}

function makeTemplates(t: (k: string) => string, params: Params): TemplateDef[] {
  const pv = (p: Params) => buildNodeData('pv_panel', p, t);
  const inv = (p: Params) => buildNodeData('inverter', p, t);
  const bat = (p: Params) => buildNodeData('battery', p, t);
  const chg = (p: Params) => buildNodeData('charger', p, t);
  const load = (p: Params) => buildNodeData('load', p, t);
  const grid = (p: Params) => buildNodeData('grid', p, t);

  return [
    {
      key: 'grid_tied',
      i18nKey: 'templateGridTied',
      icon: <ThunderboltOutlined style={{ fontSize: 14 }} />,
      color: '#f59e0b',
      nodes: [
        { type: 'pv_panel', x: 80, y: 100, dataFn: pv },
        { type: 'inverter', x: 300, y: 100, dataFn: inv },
        { type: 'load', x: 520, y: 100, dataFn: load },
        { type: 'grid', x: 520, y: 260, dataFn: grid },
      ],
      edges: [{ fromIdx: 0, toIdx: 1 }, { fromIdx: 1, toIdx: 2 }, { fromIdx: 3, toIdx: 1 }],
    },
    {
      key: 'pv_storage',
      i18nKey: 'templatePVStorage',
      icon: <ThunderboltOutlined style={{ fontSize: 14 }} />,
      color: '#22c55e',
      nodes: [
        { type: 'pv_panel', x: 80, y: 100, dataFn: pv },
        { type: 'inverter', x: 300, y: 100, dataFn: inv },
        { type: 'battery', x: 300, y: 260, dataFn: bat },
        { type: 'load', x: 520, y: 100, dataFn: load },
      ],
      edges: [{ fromIdx: 0, toIdx: 1 }, { fromIdx: 2, toIdx: 1 }, { fromIdx: 1, toIdx: 2 }, { fromIdx: 1, toIdx: 3 }],
    },
    {
      key: 'pv_storage_charger',
      i18nKey: 'templatePVStorageCharger',
      icon: <ThunderboltOutlined style={{ fontSize: 14 }} />,
      color: '#ec4899',
      nodes: [
        { type: 'pv_panel', x: 80, y: 100, dataFn: pv },
        { type: 'inverter', x: 280, y: 100, dataFn: inv },
        { type: 'battery', x: 280, y: 260, dataFn: bat },
        { type: 'charger', x: 480, y: 260, dataFn: chg },
        { type: 'load', x: 480, y: 100, dataFn: load },
      ],
      edges: [{ fromIdx: 0, toIdx: 1 }, { fromIdx: 2, toIdx: 1 }, { fromIdx: 1, toIdx: 2 }, { fromIdx: 1, toIdx: 4 }, { fromIdx: 3, toIdx: 4 }],
    },
    {
      key: 'off_grid',
      i18nKey: 'templateOffGrid',
      icon: <ThunderboltOutlined style={{ fontSize: 14 }} />,
      color: '#8b5cf6',
      nodes: [
        { type: 'pv_panel', x: 80, y: 100, dataFn: pv },
        { type: 'inverter', x: 300, y: 100, dataFn: inv },
        { type: 'battery', x: 300, y: 260, dataFn: bat },
        { type: 'load', x: 520, y: 100, dataFn: load },
      ],
      edges: [{ fromIdx: 0, toIdx: 1 }, { fromIdx: 2, toIdx: 1 }, { fromIdx: 1, toIdx: 2 }, { fromIdx: 1, toIdx: 3 }],
    },
  ];
}

const DEVICES: DeviceType[] = ['pv_panel', 'inverter', 'battery', 'charger', 'load', 'grid'];

// ── Validation logic (simplified client-side) ────────────────────────────────

function validateTopology(nodes: TopologyNode[], edges: TopologyEdge[]): { pass: boolean; errors: string[] } {
  const errors: string[] = [];
  if (nodes.length === 0) {
    errors.push('No devices');
    return { pass: false, errors };
  }

  // Check isolated nodes (no connections)
  const connectedIds = new Set<string>();
  edges.forEach(e => { connectedIds.add(e.source); connectedIds.add(e.target); });
  const isolated = nodes.filter(n => !connectedIds.has(n.id));
  if (isolated.length > 0) {
    errors.push(`${isolated.length} isolated device(s)`);
  }

  // Must have at least one power source (PV or grid)
  const hasSource = nodes.some(n => n.data.deviceType === 'pv_panel' || n.data.deviceType === 'grid');
  if (!hasSource) errors.push('No power source (PV or grid)');

  // Must have at least one load
  const hasLoad = nodes.some(n => n.data.deviceType === 'load');
  if (!hasLoad) errors.push('No load');

  // Inverter should be present if PV exists
  const hasPV = nodes.some(n => n.data.deviceType === 'pv_panel');
  const hasInverter = nodes.some(n => n.data.deviceType === 'inverter');
  if (hasPV && !hasInverter) errors.push('PV without inverter');

  return { pass: errors.length === 0, errors };
}

// ── Main component ───────────────────────────────────────────────────────────

const TOOLBAR_HEIGHT = 120;

export function BottomToolbar() {
  const { t } = useTranslation();
  const nodes = useTopologyStore((s) => s.nodes);
  const edges = useTopologyStore((s) => s.edges);
  const setNodes = useTopologyStore((s) => s.setNodes);
  const setEdges = useTopologyStore((s) => s.setEdges);
  const selectedNodeId = useTopologyStore((s) => s.selectedNodeId);
  const deleteNode = useTopologyStore((s) => s.deleteNode);
  const addNode = useTopologyStore((s) => s.addNode);
  const addEdge = useTopologyStore((s) => s.addEdge);
  const undo = useTopologyStore((s) => s.undo);
  const redo = useTopologyStore((s) => s.redo);
  const canUndo = useTopologyStore((s) => s.canUndo);
  const canRedo = useTopologyStore((s) => s.canRedo);
  const autoLayout = useTopologyStore((s) => s.autoLayout);
  const reset = useTopologyStore((s) => s.reset);

  const [params, setParams] = useState<Params>(() => useDefaults());
  const [open, setOpen] = useState<DeviceType | null>(null);
  const [gridSnap, setGridSnap] = useState(true);
  const [validationResult, setValidationResult] = useState<{ pass: boolean; errors: string[] } | null>(null);

  function setParam(k: keyof Params, v: any) {
    setParams((p) => ({ ...p, [k]: v }));
  }

  function addNodeByType(type: DeviceType) {
    const data = buildNodeData(type, params, t);
    const col = nodes.length % 5;
    const row = Math.floor(nodes.length / 5);
    const pos = gridSnap
      ? { x: Math.round((80 + col * 200) / 20) * 20, y: Math.round((80 + row * 130) / 20) * 20 }
      : { x: 80 + col * 200, y: 80 + row * 130 };
    addNode({ id: nanoid(), position: pos, data });
    setOpen(null);
    message.success(`${t('addedMsg')}: ${data.label}`);
  }

  function handleDelete() {
    if (!selectedNodeId) return message.warning(t('deleteNoSelectMsg'));
    deleteNode(selectedNodeId);
    setValidationResult(null);
    message.success(t('deletedMsg'));
  }

  function handleClear() {
    Modal.confirm({
      title: t('clearCanvas'),
      content: t('confirmClear'),
      centered: true,
      onOk: () => {
        reset();
        setValidationResult(null);
        message.success(t('canvasCleared'));
      },
    });
  }

  function handleValidate() {
    const result = validateTopology(nodes, edges);
    setValidationResult(result);
    if (result.pass) {
      message.success(t('validatePass'));
    } else {
      message.warning(`${t('validateFail')}: ${result.errors.join(', ')}`);
    }
  }

  function applyTemplate(template: TemplateDef) {
    const nodeIds: string[] = [];
    // Add nodes
    for (const n of template.nodes) {
      const id = nanoid();
      nodeIds.push(id);
      addNode({
        id,
        position: gridSnap
          ? { x: Math.round(n.x / 20) * 20, y: Math.round(n.y / 20) * 20 }
          : { x: n.x, y: n.y },
        data: n.dataFn(params, t),
      });
    }
    // Add edges
    for (const e of template.edges) {
      addEdge({
        id: `e-${nodeIds[e.fromIdx]}-${nodeIds[e.toIdx]}`,
        source: nodeIds[e.fromIdx],
        target: nodeIds[e.toIdx],
      });
    }
    setValidationResult(null);
    message.success(t('templateApplied', { name: t(template.i18nKey) }));
  }

  // ── Status calculations ──────────────────────────────────────────────────

  const totalPvKw = nodes
    .filter(n => n.data.deviceType === 'pv_panel')
    .reduce((sum, n) => sum + (n.data.ratedPowerKw ?? 0), 0);

  const totalBattKwh = nodes
    .filter(n => n.data.deviceType === 'battery')
    .reduce((sum, n) => sum + (n.data.capacityKwh ?? 0), 0);

  const connectedNodes = new Set<string>();
  edges.forEach(e => { connectedNodes.add(e.source); connectedNodes.add(e.target); });
  const connectRate = nodes.length > 0
    ? Math.round((connectedNodes.size / nodes.length) * 100)
    : 0;

  // ── Quick action button style ────────────────────────────────────────────

  const actionBtnStyle = (disabled?: boolean): React.CSSProperties => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    width: 48, height: 72, border: '1px solid #e8ecf0', borderRadius: 10,
    background: disabled ? '#f8f9fa' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1, transition: 'all 0.15s', gap: 4,
  });

  const templates = makeTemplates(t, params);

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 0,
      background: 'linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)',
      borderTop: '1px solid #e2e8f0',
      height: TOOLBAR_HEIGHT, flexShrink: 0, overflow: 'hidden',
      boxShadow: '0 -2px 8px rgba(0,0,0,0.03)',
    }}>
      {/* Region 1: Quick Actions */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
        borderRight: '1px solid #e2e8f0', background: '#fafbfc',
      }}>
        <Tooltip title={t('undo')}><button style={actionBtnStyle(!canUndo)} onClick={undo} disabled={!canUndo}>
          <UndoOutlined style={{ fontSize: 16, color: '#64748b' }} />
          <Typography.Text style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 500 }}>{t('undo')}</Typography.Text>
        </button></Tooltip>

        <Tooltip title={t('redo')}><button style={actionBtnStyle(!canRedo)} onClick={redo} disabled={!canRedo}>
          <RedoOutlined style={{ fontSize: 16, color: '#64748b' }} />
          <Typography.Text style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 500 }}>{t('redo')}</Typography.Text>
        </button></Tooltip>

        <Tooltip title={t('autoLayout')}><button style={actionBtnStyle(nodes.length === 0)} onClick={autoLayout} disabled={nodes.length === 0}>
          <LayoutOutlined style={{ fontSize: 16, color: '#64748b' }} />
          <Typography.Text style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 500 }}>{t('autoLayout')}</Typography.Text>
        </button></Tooltip>

        <Tooltip title={t('gridSnap')}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 48, height: 72, gap: 4 }}>
            <AppstoreOutlined style={{ fontSize: 16, color: gridSnap ? '#0ea5e9' : '#cbd5e1' }} />
            <Switch size="small" checked={gridSnap} onChange={setGridSnap} style={{ transform: 'scale(0.75)' }} />
          </div>
        </Tooltip>

        <Tooltip title={t('clearCanvas')}><button style={actionBtnStyle(nodes.length === 0)} onClick={handleClear} disabled={nodes.length === 0}>
          <ClearOutlined style={{ fontSize: 16, color: '#ef4444' }} />
          <Typography.Text style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 500 }}>{t('clearCanvas')}</Typography.Text>
        </button></Tooltip>
      </div>

      {/* Region 2: Templates */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px',
        borderRight: '1px solid #e2e8f0', background: '#fafbfc',
      }}>
        {templates.map((tmpl) => (
          <Tooltip key={tmpl.key} title={t(tmpl.i18nKey)}>
            <button
              onClick={() => applyTemplate(tmpl)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                width: 72, height: 72, border: '1px solid ' + tmpl.color + '33', borderRadius: 10,
                background: '#fff', cursor: 'pointer', transition: 'all 0.15s', gap: 4,
                boxShadow: `0 1px 3px ${tmpl.color}10`,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = tmpl.color; (e.currentTarget as HTMLElement).style.boxShadow = `0 2px 8px ${tmpl.color}25`; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = tmpl.color + '33'; (e.currentTarget as HTMLElement).style.boxShadow = `0 1px 3px ${tmpl.color}10`; }}
            >
              <div style={{ color: tmpl.color, fontSize: 18 }}>{tmpl.icon}</div>
              <Typography.Text style={{ fontSize: 9.5, color: '#334155', fontWeight: 600, lineHeight: 1.2, textAlign: 'center' }}>
                {t(tmpl.i18nKey)}
              </Typography.Text>
            </button>
          </Tooltip>
        ))}
      </div>

      {/* Region 3: Device Cards (existing, slightly compressed) */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', overflowX: 'auto' }}>
        {DEVICES.map((type) => {
          const Icon = DEVICE_ICON[type];
          const accent = ACCENT[type];
          const bg = BG[type];
          const label = t(LABEL_KEY[type]);
          return (
            <Popover
              key={type}
              open={open === type}
              onOpenChange={(v) => setOpen(v ? type : null)}
              trigger="click"
              placement="top"
              overlayStyle={{ borderRadius: 12 }}
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon size={20} />
                  <span style={{ color: accent, fontWeight: 600, fontSize: 13 }}>{label} {t('paramSettings')}</span>
                </div>
              }
              content={
                <div>
                  <ParamForm type={type} params={params} set={setParam} t={t} />
                  <Button type="primary" block size="small" icon={<PlusOutlined />}
                    style={{
                      background: accent, borderColor: accent, marginTop: 6, borderRadius: 8,
                      fontWeight: 600, height: 32, boxShadow: `0 2px 6px ${accent}30`,
                    }}
                    onClick={() => addNodeByType(type)}>
                    {t('addToCanvas')}
                  </Button>
                </div>
              }
            >
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
                width: 76, height: 80, padding: '6px 6px 5px',
                background: open === type ? '#fff' : '#fafbfc',
                border: `1.5px solid ${open === type ? accent : '#e8ecf0'}`,
                borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                transition: 'all 0.2s ease',
                boxShadow: open === type
                  ? `0 4px 14px ${accent}22, 0 0 0 3px ${accent}15`
                  : '0 1px 3px rgba(0,0,0,0.03)',
              }}
                onMouseEnter={(e) => { if (open !== type) { (e.currentTarget as HTMLElement).style.borderColor = accent + '88'; (e.currentTarget as HTMLElement).style.background = '#fff'; } }}
                onMouseLeave={(e) => { if (open !== type) { (e.currentTarget as HTMLElement).style.borderColor = '#e8ecf0'; (e.currentTarget as HTMLElement).style.background = '#fafbfc'; } }}
              >
                <Icon size={28} />
                <Typography.Text style={{ fontSize: 10.5, fontWeight: 600, color: '#334155', lineHeight: 1.2 }}>
                  {label}
                </Typography.Text>
                <Tooltip title={t('clickToAdd')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 9.5, color: accent, fontWeight: 600 }}>
                    <PlusOutlined style={{ fontSize: 8 }} /> {t('addDevice')}
                  </div>
                </Tooltip>
              </div>
            </Popover>
          );
        })}
      </div>

      <Divider type="vertical" style={{ height: '60%', alignSelf: 'center', margin: '0 4px' }} />

      {/* Region 4: Validation */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 10px', gap: 4, minWidth: 90,
      }}>
        <Button
          size="small"
          type={validationResult?.pass ? 'primary' : validationResult === null ? 'default' : 'dashed'}
          icon={validationResult?.pass ? <CheckCircleOutlined /> : validationResult && !validationResult.pass ? <CloseCircleOutlined /> : undefined}
          onClick={handleValidate}
          disabled={nodes.length === 0}
          style={{
            fontSize: 10, borderRadius: 8, fontWeight: 600, height: 28,
            background: validationResult?.pass ? '#22c55e' : undefined,
            borderColor: validationResult?.pass ? '#22c55e' : validationResult && !validationResult.pass ? '#ef4444' : undefined,
          }}
        >
          {t('validate')}
        </Button>
        {validationResult && (
          <Tooltip title={validationResult.errors.join(', ')}>
            <Tag
              color={validationResult.pass ? 'success' : 'error'}
              style={{ fontSize: 9, borderRadius: 6, margin: 0, padding: '0 6px', lineHeight: '18px' }}
            >
              {validationResult.pass ? t('validatePass') : t('validateErrors', { count: validationResult.errors.length })}
            </Tag>
          </Tooltip>
        )}
      </div>

      <Divider type="vertical" style={{ height: '60%', alignSelf: 'center', margin: '0 4px' }} />

      {/* Region 5: Status Bar */}
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 12px', gap: 4, minWidth: 130,
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography.Text style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 500 }}>{t('nodeCount')}</Typography.Text>
            <Typography.Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{nodes.length}</Typography.Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography.Text style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 500 }}>{t('edgeCount')}</Typography.Text>
            <Typography.Text style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{edges.length}</Typography.Text>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {totalPvKw > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Typography.Text style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 500 }}>{t('totalCapacity')}</Typography.Text>
              <Typography.Text style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>{totalPvKw.toFixed(1)} kW</Typography.Text>
            </div>
          )}
          {totalBattKwh > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Typography.Text style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 500 }}>{t('batteryCapacity')}</Typography.Text>
              <Typography.Text style={{ fontSize: 11, fontWeight: 700, color: '#22c55e' }}>{totalBattKwh.toFixed(0)} kWh</Typography.Text>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography.Text style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 500 }}>{t('connectRate')}</Typography.Text>
            <Typography.Text style={{ fontSize: 11, fontWeight: 700, color: connectRate === 100 ? '#22c55e' : '#f59e0b' }}>{connectRate}%</Typography.Text>
          </div>
        </div>
      </div>

      <Divider type="vertical" style={{ height: '60%', alignSelf: 'center', margin: '0 4px' }} />

      {/* Region 6: Delete (existing) */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px' }}>
        <Tooltip title={selectedNodeId ? t('deleteSelectedTip') : t('selectFirstTip')}>
          <Button
            danger icon={<DeleteOutlined />} size="small"
            disabled={!selectedNodeId}
            onClick={handleDelete}
            style={{ fontSize: 12, borderRadius: 8, fontWeight: 500 }}
          >
            {t('deleteSelected')}
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}
