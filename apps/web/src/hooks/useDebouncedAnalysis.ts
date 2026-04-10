import { useEffect, useRef, useState } from 'react';
import { useTopologyStore } from '../state/topologyStore';
import { useConfigStore } from '../state/configStore';
import { postJson } from '../api/client';
import type { AnalysisResponse } from '@gp16/shared';

export function useDebouncedAnalysis(debounceMs = 1200) {
  const nodes = useTopologyStore((s) => s.nodes);
  const edges = useTopologyStore((s) => s.edges);
  const config = useConfigStore((s) => s.config);

  const key = JSON.stringify({ nodes, edges, config });
  const keyRef = useRef(key);
  keyRef.current = key;

  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (nodes.length === 0) { setData(null); setError(null); return; }
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      const { nodes: n, edges: e, config: c } = JSON.parse(keyRef.current);
      postJson<AnalysisResponse>('/api/analysis', { topology: { nodes: n, edges: e }, config: c }, ctrl.signal)
        .then((r) => { if (!ctrl.signal.aborted) { setData(r); setLoading(false); } })
        .catch((err) => { if (!ctrl.signal.aborted) { setError(String(err?.message ?? err)); setLoading(false); } });
    }, debounceMs);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [key, debounceMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}
