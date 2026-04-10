import { Button, Divider, InputNumber, Space, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DeviceType, TopologyNode } from '@gp16/shared';
import { nanoid } from '../utils/nanoid';
import { useTopologyStore } from '../state/topologyStore';

type Item = { deviceType: DeviceType; labelKey: string; defaultKw?: number; defaultKwh?: number };

const ITEMS: Item[] = [
  { deviceType: 'pv_panel',  labelKey: 'pvPanel',  defaultKw: 5 },
  { deviceType: 'inverter',  labelKey: 'inverter',  defaultKw: 10 },
  { deviceType: 'battery',   labelKey: 'battery',   defaultKwh: 20 },
  { deviceType: 'charger',   labelKey: 'charger',   defaultKw: 7 },
  { deviceType: 'load',      labelKey: 'load',      defaultKw: 5 },
  { deviceType: 'grid',      labelKey: 'grid' },
];

const COLORS: Record<DeviceType, string> = {
  pv_panel: '#faad14', inverter: '#1677ff', battery: '#52c41a',
  charger: '#eb2f96',  load: '#722ed1',     grid: '#fa8c16',
};

export function DevicePalette() {
  const { t } = useTranslation();
  const nodes = useTopologyStore((s: ReturnType<typeof useTopologyStore.getState>) => s.nodes);
  const setNodes = useTopologyStore((s: ReturnType<typeof useTopologyStore.getState>) => s.setNodes);

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

    const col = nodes.length % 3;
    const row = Math.floor(nodes.length / 3);
    const node: TopologyNode = {
      id: nanoid(),
      position: { x: 80 + col * 200, y: 80 + row * 130 },
      data: { label, deviceType: item.deviceType, ratedPowerKw: kw, capacityKwh: kwh },
    };
    setNodes([...nodes, node]);
  }

  return (
    <div style={{ padding: '12px 10px' }}>
      <Typography.Title level={5} style={{ marginTop: 0, marginBottom: 4 }}>
        {t('deviceLib')}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 10 }}>
        {t('deviceHint')}
      </Typography.Text>
      <Divider style={{ margin: '8px 0' }} />
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        {ITEMS.map((item) => {
          const hasKw  = item.defaultKw  != null;
          const hasKwh = item.defaultKwh != null;
          const color  = COLORS[item.deviceType];
          return (
            <div key={item.deviceType}>
              <Space.Compact style={{ width: '100%' }}>
                {hasKw && (
                  <InputNumber
                    size="small" min={0.1} step={0.5}
                    value={params[item.deviceType + '_kw']}
                    onChange={(v) => setParams((p) => ({ ...p, [item.deviceType + '_kw']: v ?? item.defaultKw ?? 1 }))}
                    addonAfter="kW" style={{ width: 108 }}
                  />
                )}
                {hasKwh && (
                  <InputNumber
                    size="small" min={0.1} step={1}
                    value={params[item.deviceType + '_kwh']}
                    onChange={(v) => setParams((p) => ({ ...p, [item.deviceType + '_kwh']: v ?? item.defaultKwh ?? 10 }))}
                    addonAfter="kWh" style={{ width: 118 }}
                  />
                )}
                <Button
                  size="small"
                  block={!hasKw && !hasKwh}
                  onClick={() => addNode(item)}
                  style={{ flex: 1, borderLeft: `3px solid ${color}` }}
                >
                  + {t(item.labelKey)}
                </Button>
              </Space.Compact>
            </div>
          );
        })}
      </Space>
    </div>
  );
}
