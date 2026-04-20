import { ReactFlowProvider } from 'reactflow';
import { AIChatPanel } from './canvas/AIChatPanel';
import { BottomToolbar } from './canvas/BottomToolbar';
import { TopologyCanvas } from './canvas/TopologyCanvas';
import { AnalyticsPanel } from './canvas/AnalyticsPanel';
import { TopologyManager } from './canvas/TopologyManager';
import { ReportButton } from './canvas/ReportButton';
import { NodeEditDrawer } from './canvas/NodeEditDrawer';
import { Space } from 'antd';

export function CanvasPage() {
  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Left: AI Chat Panel */}
      <div style={{
        width: 300, flexShrink: 0,
        borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column',
        background: '#fff',
      }}>
        <AIChatPanel />
      </div>

      {/* Center: Canvas + Bottom Toolbar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Canvas area — position:relative so the Drawer anchors here */}
        <ReactFlowProvider>
          <div style={{ flex: 1, position: 'relative', background: '#f8fafc', overflow: 'hidden' }}>
            <TopologyCanvas />
            <NodeEditDrawer />
          </div>

          {/* Bottom toolbar */}
          <BottomToolbar />
        </ReactFlowProvider>
      </div>

      {/* Right: Analytics Panel */}
      <div style={{
        width: 290, flexShrink: 0,
        borderLeft: '1px solid #e5e7eb',
        overflowY: 'auto', background: '#fff',
        display: 'flex', flexDirection: 'column',
      }}>
        <AnalyticsPanel />
        <div style={{ padding: '8px 10px', borderTop: '1px solid #f0f0f0', marginTop: 'auto' }}>
          <Space direction="vertical" style={{ width: '100%' }} size={6}>
            <TopologyManager />
            <ReportButton />
          </Space>
        </div>
      </div>

    </div>
  );
}
