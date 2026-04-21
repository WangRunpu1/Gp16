import type { DeviceType } from '@gp16/shared';
import type { ThemeConfig } from 'antd';

export const ACCENT: Record<DeviceType, string> = {
  pv_panel: '#faad14',
  inverter: '#1677ff',
  battery:  '#52c41a',
  charger:  '#eb2f96',
  load:     '#722ed1',
  grid:     '#fa8c16',
};

export const BG: Record<DeviceType, string> = {
  pv_panel: '#fffbe6',
  inverter: '#e6f4ff',
  battery:  '#f6ffed',
  charger:  '#fff0f6',
  load:     '#f9f0ff',
  grid:     '#fff7e6',
};

export const LABEL_KEY: Record<DeviceType, string> = {
  pv_panel: 'pvPanel',
  inverter: 'inverter',
  battery:  'battery',
  charger:  'charger',
  load:     'load',
  grid:     'grid',
};

export const NODE_LABEL_KEY: Record<DeviceType, string> = {
  pv_panel: 'nodeLabelPv',
  inverter: 'nodeLabelInv',
  battery:  'nodeLabelBat',
  charger:  'nodeLabelChg',
  load:     'nodeLabelLoad',
  grid:     'nodeLabelGrid',
};

export const CONN_LABEL_KEY: Record<string, string> = {
  'pv_panel->inverter': 'connLabelPvToInv',
  'inverter->battery':  'connLabelInvToBat',
  'inverter->load':     'connLabelInvToLoad',
  'inverter->grid':     'connLabelInvToGrid',
  'inverter->charger':  'connLabelInvToChg',
  'battery->inverter':  'connLabelBatToInv',
  'battery->charger':   'connLabelBatToChg',
  'grid->inverter':     'connLabelGridToInv',
  'grid->load':         'connLabelGridToLoad',
  'charger->load':      'connLabelChgToLoad',
};

export const appTheme: ThemeConfig = {
  algorithm: undefined,
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 8,
    fontSize: 14,
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
    boxShadowSecondary: '0 4px 16px rgba(0,0,0,0.10)',
  },
  components: {
    Card: {
      boxShadowTertiary: '0 1px 4px rgba(0,0,0,0.06)',
    },
    Button: {
      borderRadius: 6,
    },
    Input: {
      borderRadius: 6,
    },
    Select: {
      borderRadius: 6,
    },
  },
};
