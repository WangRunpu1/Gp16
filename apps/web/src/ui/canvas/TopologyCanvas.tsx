import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  Handle, Position,
  type Connection, type Edge, type Node, type NodeChange, type EdgeChange,
  useNodesState, useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useTopologyStore } from '@/state/topologyStore';
import type { DeviceType } from '@gp16/shared';
import { DEVICE_ICON } from './DeviceIcons';
import { ACCENT, BG, NODE_LABEL_KEY, CONN_LABEL_KEY } from '@/theme';

const ALLOWED: Record<DeviceType, DeviceType[]> = {
  pv_panel: ['inverter'],
  inverter: ['battery', 'load', 'grid', 'charger'],
  battery:  ['inverter', 'charger'],
  charger:  ['load'],
  load:     [],
  grid:     ['inverter', 'load'],
};

interface NodeData {
  label: string;
  deviceType: DeviceType;
  ratedPowerKw?: number;
  capacityKwh?: number;
  _t?: (k: string) => string;
}

function DeviceNode({ data, selected }: { data: NodeData; selected?: boolean }) {
  const { t } = useTranslation();
  const type   = data.deviceType;
  const accent = ACCENT[type] ?? '#999';
  const bg     = BG[type]     ?? '#f5f5f5';
  const Icon   = DEVICE_ICON[type];
  const spec   = data.capacityKwh != null ? `${data.capacityKwh} kWh`
               : data.ratedPowerKw != null ? `${data.ratedPowerKw} kW` : null;

  return (
    <div style={{
      width: 140, borderRadius: 10, background: bg,
      border: `2px solid ${selected ? accent : accent + '99'}`,
      boxShadow: selected ? `0 0 0 3px ${accent}44` : '0 2px 8px rgba(0,0,0,0.10)',
      position: 'relative',
    }}>
      <Handle type="target" position={Position.Left}
        style={{ width: 10, height: 10, background: '#fff', border: `2px solid ${accent}` }} />

      <div style={{ height: 4, background: accent, borderRadius: '8px 8px 0 0' }} />

      <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <Icon size={34} />
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', textAlign: 'center', lineHeight: 1.3 }}>
          {data.label}
        </div>
        {spec && (
          <div style={{ fontSize: 10, color: '#fff', background: accent, borderRadius: 10, padding: '1px 8px', fontWeight: 600 }}>
            {spec}
          </div>
        )}
        <div style={{ fontSize: 10, color: accent, fontWeight: 500 }}>{t(NODE_LABEL_KEY[type])}</div>
      </div>

      <Handle type="source" position={Position.Right}
        style={{ width: 10, height: 10, background: '#fff', border: `2px solid ${accent}` }} />
    </div>
  );
}

const nodeTypes = { device: DeviceNode };

function toRFNodes(storeNodes: any[], selectedId: string | null): Node[] {
  return storeNodes.map((n) => ({
    id: n.id,
    type: 'device',
    position: n.position,
    selected: n.id === selectedId,
    data: {
      label:        n.data.label,
      deviceType:   n.data.deviceType,
      ratedPowerKw: n.data.ratedPowerKw,
      capacityKwh:  n.data.capacityKwh,
    },
  }));
}

function toRFEdges(storeEdges: any[], storeNodes: any[], t: (k: string) => string): Edge[] {
  return storeEdges.map((e) => {
    const src = storeNodes.find((n) => n.id === e.source)?.data.deviceType;
    const tgt = storeNodes.find((n) => n.id === e.target)?.data.deviceType;
    const labelKey = src && tgt ? CONN_LABEL_KEY[`${src}->${tgt}`] : undefined;
    const lbl = labelKey ? t(labelKey) : undefined;
    return {
      id: e.id, source: e.source, target: e.target,
      label: lbl,
      labelStyle: { fontSize: 10, fill: '#64748b' },
      labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.9 },
      labelBgPadding: [4, 2] as [number, number],
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      markerEnd: { type: 'arrowclosed' as any, color: '#94a3b8' },
    };
  });
}

export function TopologyCanvas() {
  const { t, i18n } = useTranslation();
  const storeNodes     = useTopologyStore((s) => s.nodes);
  const storeEdges     = useTopologyStore((s) => s.edges);
  const selectedId     = useTopologyStore((s) => s.selectedNodeId);
  const setStoreNodes  = useTopologyStore((s) => s.setNodes);
  const setStoreEdges  = useTopologyStore((s) => s.setEdges);
  const setSelectedId  = useTopologyStore((s) => s.setSelectedNodeId);

  const [nodes, setNodes, onNodesChange] = useNodesState(toRFNodes(storeNodes, selectedId));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toRFEdges(storeEdges, storeNodes, t));

  useEffect(() => {
    setNodes(toRFNodes(storeNodes, selectedId));
  }, [storeNodes, selectedId]);

  useEffect(() => {
    setEdges(toRFEdges(storeEdges, storeNodes, t));
  }, [storeEdges, storeNodes, i18n.language]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    const posChanges = changes.filter((c) => c.type === 'position' && c.position);
    if (posChanges.length > 0) {
      const cur = useTopologyStore.getState().nodes;
      const updated = cur.map((n) => {
        const ch = posChanges.find((c: any) => c.id === n.id) as any;
        return ch?.position ? { ...n, position: ch.position } : n;
      });
      setStoreNodes(updated);
    }
    const removeChanges = changes.filter((c) => c.type === 'remove');
    removeChanges.forEach((c: any) => {
      useTopologyStore.getState().deleteNode(c.id);
    });
  }, [onNodesChange, setStoreNodes]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    const removeChanges = changes.filter((c) => c.type === 'remove');
    if (removeChanges.length > 0) {
      const cur = useTopologyStore.getState().edges;
      const ids = new Set(removeChanges.map((c: any) => c.id));
      setStoreEdges(cur.filter((e) => !ids.has(e.id)));
    }
  }, [onEdgesChange, setStoreEdges]);

  const onConnect = useCallback((conn: Connection) => {
    if (!conn.source || !conn.target || conn.source === conn.target) return;

    const curNodes = useTopologyStore.getState().nodes;
    const srcType  = curNodes.find((n) => n.id === conn.source)?.data.deviceType as DeviceType;
    const tgtType  = curNodes.find((n) => n.id === conn.target)?.data.deviceType as DeviceType;
    if (!srcType || !tgtType) return;

    const srcLabel = t(NODE_LABEL_KEY[srcType]);
    const tgtLabel = t(NODE_LABEL_KEY[tgtType]);

    if (!(ALLOWED[srcType] ?? []).includes(tgtType)) {
      message.error(t('connNotAllowed', { src: srcLabel, tgt: tgtLabel }));
      return;
    }

    const curEdges = useTopologyStore.getState().edges;
    if (curEdges.some((e) => e.source === conn.source && e.target === conn.target)) {
      message.warning(t('connDuplicate'));
      return;
    }

    const newEdge = { id: `e-${conn.source}-${conn.target}`, source: conn.source, target: conn.target };
    setStoreEdges([...curEdges, newEdge]);
    const connKey = CONN_LABEL_KEY[`${srcType}->${tgtType}`];
    message.success(t('connSuccess', { src: srcLabel, tgt: tgtLabel, label: connKey ? t(connKey) : '' }));
  }, [setStoreEdges, t]);

  const onNodeClick = useCallback((_: any, node: Node) => setSelectedId(node.id), [setSelectedId]);
  const onPaneClick = useCallback(() => setSelectedId(null), [setSelectedId]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        deleteKeyCode="Delete"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        connectionLineStyle={{ stroke: '#94a3b8', strokeWidth: 2 }}
      >
        <MiniMap nodeColor={(n) => ACCENT[(n.data as NodeData)?.deviceType] ?? '#d9d9d9'} style={{ background: '#f8fafc' }} />
        <Controls />
        <Background color="#e2e8f0" gap={20} />
      </ReactFlow>
    </div>
  );
}
