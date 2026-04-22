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
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#f1f5f9' }}>

      {/* Left: AI Chat Panel */}
      <div style={{
        width: 310, flexShrink: 0,
        borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column',
        background: '#fff',
        boxShadow: '2px 0 8px rgba(0,0,0,0.03)',
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
        width: 300, flexShrink: 0,
        borderLeft: '1px solid #e2e8f0',
        overflowY: 'auto', background: '#fff',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.03)',
      }}>
        <AnalyticsPanel />
        <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #f1f5f9', marginTop: 'auto', background: '#fafbfc' }}>
          <Space direction="vertical" style={{ width: '100%' }} size={6}>
            <TopologyManager />
            <ReportButton />
          </Space>
        </div>
      </div>

    </div>
  );
}
