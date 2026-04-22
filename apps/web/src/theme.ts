import type { DeviceType } from '@gp16/shared';
import type { ThemeConfig } from 'antd';

export const ACCENT: Record<DeviceType, string> = {
  pv_panel: '#f59e0b',
  inverter: '#3b82f6',
  battery:  '#22c55e',
  charger:  '#ec4899',
  load:     '#8b5cf6',
  grid:     '#f97316',
};

export const BG: Record<DeviceType, string> = {
  pv_panel: '#fffbeb',
  inverter: '#eff6ff',
  battery:  '#f0fdf4',
  charger:  '#fdf2f8',
  load:     '#f5f3ff',
  grid:     '#fff7ed',
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
    colorPrimary: '#0ea5e9',
    borderRadius: 10,
    fontSize: 14,
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    boxShadowSecondary: '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#f1f5f9',
  },
  components: {
    Card: {
      boxShadowTertiary: '0 1px 3px rgba(0,0,0,0.04)',
      borderRadiusLG: 12,
      borderRadiusSM: 8,
    },
    Button: {
      borderRadius: 8,
      fontWeight: 500,
    },
    Input: {
      borderRadius: 8,
    },
    Select: {
      borderRadius: 8,
    },
    Collapse: {
      borderRadiusLG: 10,
      borderRadiusSM: 8,
    },
    Drawer: {
      borderRadiusLG: 12,
    },
    Modal: {
      borderRadiusLG: 14,
    },
    Tag: {
      borderRadiusMD: 6,
    },
    Statistic: {
      contentFontSize: 20,
    },
    Layout: {
      headerBg: '#0f172a',
      bodyBg: '#f8fafc',
    },
  },
};
