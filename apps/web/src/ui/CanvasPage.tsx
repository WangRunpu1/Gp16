import { Space } from 'antd';
import { AILayoutBar } from './canvas/AILayoutBar';
import { DevicePalette } from './canvas/DevicePalette';
import { TopologyCanvas } from './canvas/TopologyCanvas';
import { AnalyticsPanel } from './canvas/AnalyticsPanel';
import { ReportButton } from './canvas/ReportButton';
import { TopologyManager } from './canvas/TopologyManager';

export function CanvasPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* AI bar */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
        <AILayoutBar />
      </div>

      {/* Main 3-column layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: device palette */}
        <div style={{
          width: 210, flexShrink: 0, borderRight: '1px solid #e5e7eb',
          overflowY: 'auto', background: '#fff',
        }}>
          <DevicePalette />
          <div style={{ padding: '8px 10px', borderTop: '1px solid #f0f0f0' }}>
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              <TopologyManager />
              <ReportButton />
            </Space>
          </div>
        </div>

        {/* Center: canvas */}
        <div style={{ flex: 1, position: 'relative', background: '#f8fafc' }}>
          <TopologyCanvas />
        </div>

        {/* Right: analytics */}
        <div style={{
          width: 280, flexShrink: 0, borderLeft: '1px solid #e5e7eb',
          overflowY: 'auto', background: '#fff',
        }}>
          <AnalyticsPanel />
        </div>
      </div>
    </div>
  );
}
