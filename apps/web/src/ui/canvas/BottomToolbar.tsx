import { Button, InputNumber, Popover, Space, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeviceType, TopologyNode } from '@gp16/shared';
import { nanoid } from '@/utils/nanoid';
import { useTopologyStore } from '@/state/topologyStore';

type Item = { deviceType: DeviceType; labelKey: string; icon: string; defaultKw?: number; defaultKwh?: number };

const ITEMS: Item[] = [
  { deviceType: 'pv_panel',  labelKey: 'pvPanel',  icon: '☀️', defaultKw: 5 },
  { deviceType: 'inverter',  labelKey: 'inverter',  icon: '⚡', defaultKw: 10 },
  { deviceType: 'battery',   labelKey: 'battery',   icon: '🔋', defaultKwh: 20 },
  { deviceType: 'charger',   labelKey: 'charger',   icon: '🔌', defaultKw: 7 },
  { deviceType: 'load',      labelKey: 'load',      icon: '🏭', defaultKw: 5 },
  { deviceType: 'grid',      labelKey: 'grid',      icon: '🔆' },
];

const COLORS: Record<DeviceType, string> = {
  pv_panel: '#faad14', inverter: '#1677ff', battery: '#52c41a',
  charger: '#eb2f96',  load: '#722ed1',     grid: '#fa8c16',
};

export function BottomToolbar() {
  const { t } = useTranslation();
  const nodes = useTopologyStore((s: any) => s.nodes);
  const setNodes = useTopologyStore((s: any) => s.setNodes);

  const [params, setParams] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const item of ITEMS) {
      if (item.defaultKw  != null) init[item.deviceType + '_kw']  = item.defaultKw;
      if (item.defaultKwh != null) init[item.deviceType + '_kwh'] = item.defaultKwh;
    }
    return init;
  });

  function addNode(item: Item) {
    const kw  = params[item.deviceType + '_kw'];
    const kwh = params[item.deviceType + '_kwh'];
    let label = t(item.labelKey);
    if (kw  != null) label += ` ${kw}kW`;
    else if (kwh != null) label += ` ${kwh}kWh`;

    const col = nodes.length % 4;
    const row = Math.floor(nodes.length / 4);
    const node: TopologyNode = {
      id: nanoid(),
      position: { x: 80 + col * 220, y: 80 + row * 140 },
      data: { label, deviceType: item.deviceType, ratedPowerKw: kw, capacityKwh: kwh },
    };
    setNodes([...nodes, node]);
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', background: '#fff',
      borderTop: '1px solid #e5e7eb', flexWrap: 'wrap',
    }}>
      <Typography.Text style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>
        + Add Device:
      </Typography.Text>
      {ITEMS.map((item) => {
        const hasKw  = item.defaultKw  != null;
        const hasKwh = item.defaultKwh != null;
        const color  = COLORS[item.deviceType];

        const popoverContent = (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {hasKw && (
              <InputNumber
                size="small" min={0.1} step={0.5}
                value={params[item.deviceType + '_kw']}
                onChange={(v) => setParams((p) => ({ ...p, [item.deviceType + '_kw']: v ?? item.defaultKw ?? 1 }))}
                addonAfter="kW" style={{ width: 110 }}
              />
            )}
            {hasKwh && (
              <InputNumber
                size="small" min={0.1} step={1}
                value={params[item.deviceType + '_kwh']}
                onChange={(v) => setParams((p) => ({ ...p, [item.deviceType + '_kwh']: v ?? item.defaultKwh ?? 10 }))}
                addonAfter="kWh" style={{ width: 120 }}
              />
            )}
            <Button size="small" type="primary" onClick={() => addNode(item)}>
              Add
            </Button>
          </div>
        );

        return (
          <Popover
            key={item.deviceType}
            content={hasKw || hasKwh ? popoverContent : null}
            title={`${item.icon} ${t(item.labelKey)}`}
            trigger={hasKw || hasKwh ? 'click' : undefined}
          >
            <Button
              size="small"
              onClick={!hasKw && !hasKwh ? () => addNode(item) : undefined}
              style={{
                borderLeft: `3px solid ${color}`,
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12,
              }}
            >
              {item.icon} {t(item.labelKey)}
            </Button>
          </Popover>
        );
      })}
    </div>
  );
}
