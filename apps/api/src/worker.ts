import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DeviceType } from '@gp16/shared';

// ── Schema ────────────────────────────────────────────────────────────────────
const layoutSchema = z.object({
  layoutVersion: z.string(),
  topology: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
      data: z.object({
        label: z.string(),
        deviceType: z.enum(['pv_panel', 'inverter', 'battery', 'charger', 'load', 'grid']),
        ratedPowerKw: z.number().optional(),
        capacityKwh: z.number().optional(),
      }),
    })),
    edges: z.array(z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
    })),
  }),
  assumptions: z.array(z.string()),
});

// ── Heuristic fallback ────────────────────────────────────────────────────────
function heuristicLayout(prompt: string) {
  const kwMatch  = prompt.match(/(\d+(?:\.\d+)?)\s*kW/i);
  const kwhMatch = prompt.match(/(\d+(?:\.\d+)?)\s*kWh/i);
  const pvKw    = kwMatch  ? Number(kwMatch[1])  : 10;
  const battKwh = kwhMatch ? Number(kwhMatch[1]) : 20;
  return {
    layoutVersion: 'v1',
    topology: {
      nodes: [
        { id: 'pv1',   position: { x: 100, y: 100 }, data: { label: `光伏阵列 ${pvKw}kW`,              deviceType: 'pv_panel' as DeviceType, ratedPowerKw: pvKw } },
        { id: 'inv1',  position: { x: 340, y: 100 }, data: { label: `逆变器 ${pvKw}kW`,               deviceType: 'inverter' as DeviceType, ratedPowerKw: pvKw } },
        { id: 'bat1',  position: { x: 340, y: 260 }, data: { label: `储能 ${battKwh}kWh`,             deviceType: 'battery'  as DeviceType, capacityKwh: battKwh } },
        { id: 'load1', position: { x: 580, y: 100 }, data: { label: `负载 ${(pvKw*0.6).toFixed(1)}kW`, deviceType: 'load'    as DeviceType, ratedPowerKw: pvKw * 0.6 } },
        { id: 'grid1', position: { x: 580, y: 260 }, data: { label: '电网',                           deviceType: 'grid'     as DeviceType } },
      ],
      edges: [
        { id: 'e1', source: 'pv1',   target: 'inv1'  },
        { id: 'e2', source: 'inv1',  target: 'load1' },
        { id: 'e3', source: 'bat1',  target: 'inv1'  },
        { id: 'e4', source: 'grid1', target: 'inv1'  },
      ],
    },
    assumptions: [
      `光伏装机容量：${pvKw} kW`,
      `储能容量：${battKwh} kWh`,
      '并网 + 储能拓扑',
      '逆变器功率与光伏匹配',
    ],
  };
}

// ── LLM call ──────────────────────────────────────────────────────────────────
async function callLLM(prompt: string): Promise<unknown> {
  const base  = process.env.LLM_API_BASE;
  const key   = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? 'qwen-plus';
  if (!base || !key) return null;

  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  const system = [
    '你是资深电气工程师，只输出严格 JSON，不含任何 markdown 代码块或解释文字。',
    '输出格式：{"layoutVersion":"v1","topology":{"nodes":[...],"edges":[...]},"assumptions":[...]}',
    'nodes[i].data.deviceType 必须是：pv_panel | inverter | battery | charger | load | grid',
    'nodes[i] 必须有 id、position({x,y})、data({label,deviceType,ratedPowerKw?,capacityKwh?})',
    'edges[i] 必须有 id、source、target（对应 nodes 的 id）',
    '只输出 JSON，不输出其他任何内容。',
  ].join('\n');

  const res = await fetch(`${trimmed}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0.2, messages: [
      { role: 'system', content: system },
      { role: 'user',   content: prompt },
    ]}),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json() as any;
  const text = json?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') return null;

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) return JSON.parse(cleaned.slice(s, e + 1));
    return null;
  }
}

// ── SVG helper ────────────────────────────────────────────────────────────────
function esc(s: string) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
const COLORS: Record<string, string> = {
  pv_panel:'#fffbe6', inverter:'#e6f4ff', battery:'#f6ffed',
  charger:'#fff0f6',  load:'#f9f0ff',     grid:'#fff7e6',
};
function topologyToSvg(topology: any, lang: 'zh' | 'en' = 'zh'): string {
  const nodes: any[] = topology.nodes ?? [];
  const edges: any[] = topology.edges ?? [];
  if (!nodes.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="20" y="50" fill="#999">${lang === 'zh' ? '（无设备）' : '(No devices)'}</text></svg>`;
  const xs = nodes.map((n:any)=>n.position.x), ys = nodes.map((n:any)=>n.position.y);
  const minX=Math.min(...xs), minY=Math.min(...ys), maxX=Math.max(...xs), maxY=Math.max(...ys);
  const W=Math.max(800,maxX-minX+240), H=Math.max(400,maxY-minY+200), pad=100;
  const byId = new Map(nodes.map((n:any)=>[n.id,n]));
  const lines = edges.map((e:any)=>{
    const s=byId.get(e.source) as any, t=byId.get(e.target) as any;
    if(!s||!t) return '';
    return `<line x1="${s.position.x-minX+pad}" y1="${s.position.y-minY+pad}" x2="${t.position.x-minX+pad}" y2="${t.position.y-minY+pad}" stroke="#94a3b8" stroke-width="2" marker-end="url(#arr)"/>`;
  }).join('');
  const rects = nodes.map((n:any)=>{
    const x=n.position.x-minX+pad, y=n.position.y-minY+pad;
    return `<g><rect x="${x-50}" y="${y-22}" width="100" height="44" rx="8" fill="${COLORS[n.data?.deviceType]??'#f5f5f5'}" stroke="#1677ff" stroke-width="1.5"/><text x="${x}" y="${y+5}" font-size="11" text-anchor="middle" fill="#111">${esc(n.data?.label??n.id)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8"/></marker></defs><rect width="100%" height="100%" fill="#fff"/>${lines}${rects}</svg>`;
}

// ── HTML Report (bilingual + html2pdf.js) ─────────────────────────────────────
async function generateReport(payload: any): Promise<{ reportId: string; htmlPath: string }> {
  const reportId  = String(payload.reportId ?? payload.taskId ?? Date.now());
  const topology  = payload.topology  ?? { nodes: [], edges: [] };
  const analysis  = payload.analysis  ?? null;
  const lang: 'zh' | 'en' = payload.lang === 'en' ? 'en' : 'zh';
  const svg = topologyToSvg(topology, lang);

  const L = {
    title: lang === 'zh' ? 'GP16 光伏/电力系统 AI 辅助设计报告' : 'GP16 PV System AI-Assisted Design Report',
    genTime: lang === 'zh' ? '生成时间' : 'Generated',
    reportNo: lang === 'zh' ? '报告编号' : 'Report No.',
    secTopo: lang === 'zh' ? '系统拓扑图' : 'System Topology',
    secKpi: lang === 'zh' ? '绿色效益摘要' : 'Green Impact Summary',
    secDevices: lang === 'zh' ? '设备清单' : 'Device List',
    secCost: lang === 'zh' ? '累计成本对比（10年）' : 'Cumulative Cost Comparison (10yr)',
    thName: lang === 'zh' ? '名称' : 'Name',
    thType: lang === 'zh' ? '类型' : 'Type',
    thPower: lang === 'zh' ? '额定功率' : 'Rated Power',
    thCapacity: lang === 'zh' ? '容量' : 'Capacity',
    thYear: lang === 'zh' ? '年份' : 'Year',
    thTraditional: lang === 'zh' ? '传统模式累计' : 'Traditional Cum.',
    thScheme: lang === 'zh' ? '本方案累计(含CAPEX)' : 'This Scheme (incl. CAPEX)',
    thSavings: lang === 'zh' ? '累计节省' : 'Cum. Savings',
    kpiPv: lang === 'zh' ? '光伏装机' : 'PV Installed',
    kpiGen: lang === 'zh' ? '年发电量' : 'Annual Generation',
    kpiCo2: lang === 'zh' ? '年减排' : 'CO₂ Saved/yr',
    kpiTrees: lang === 'zh' ? '等效植树' : 'Equiv. Trees',
    kpiCapex: lang === 'zh' ? '总投资' : 'Total CAPEX',
    kpiPayback: lang === 'zh' ? '回收期' : 'Payback',
    noData: lang === 'zh' ? '暂无分析数据' : 'No analysis data',
    noDevices: lang === 'zh' ? '（无设备）' : '(No devices)',
    btnPrint: lang === 'zh' ? '🖨️ 打印 / 保存为 PDF' : '🖨️ Print / Save as PDF',
    btnDownload: lang === 'zh' ? '📥 一键下载 PDF' : '📥 Download PDF',
    treesUnit: lang === 'zh' ? '棵' : 'trees',
    yrUnit: lang === 'zh' ? '年' : 'yr',
  };

  const typeLabel: Record<string,string> = lang === 'zh'
    ? { pv_panel:'光伏板', inverter:'逆变器', battery:'电池/储能', charger:'充电桩', load:'负载', grid:'电网' }
    : { pv_panel:'PV Panel', inverter:'Inverter', battery:'Battery', charger:'EV Charger', load:'Load', grid:'Grid' };

  const deviceRows = (topology.nodes??[]).map((n:any)=>{
    return `<tr><td>${esc(n.data?.label??n.id)}</td><td>${esc(typeLabel[n.data?.deviceType]??'')}</td><td>${n.data?.ratedPowerKw!=null?`${n.data.ratedPowerKw} kW`:'-'}</td><td>${n.data?.capacityKwh!=null?`${n.data.capacityKwh} kWh`:'-'}</td></tr>`;
  }).join('');

  const s = analysis?.summary, payback = analysis?.simplePaybackYears, costSeries: any[] = analysis?.costSeries??[];
  const kpiHtml = s ? `<div class="kpi-grid">
    <div class="kpi-card"><div class="kpi-label">${L.kpiPv}</div><div class="kpi-val">${Number(s.pvInstalledKw).toFixed(1)} kW</div></div>
    <div class="kpi-card"><div class="kpi-label">${L.kpiGen}</div><div class="kpi-val">${Math.round(s.annualGenerationKwh).toLocaleString()} kWh</div></div>
    <div class="kpi-card"><div class="kpi-label">${L.kpiCo2}</div><div class="kpi-val">${Number(s.annualCo2SavedTons).toFixed(2)} tCO₂</div></div>
    <div class="kpi-card"><div class="kpi-label">${L.kpiTrees}</div><div class="kpi-val">${Math.round(s.equivalentTrees).toLocaleString()} ${L.treesUnit}</div></div>
    <div class="kpi-card"><div class="kpi-label">${L.kpiCapex}</div><div class="kpi-val">¥${Math.round(s.totalCapex).toLocaleString()}</div></div>
    ${payback!=null?`<div class="kpi-card"><div class="kpi-label">${L.kpiPayback}</div><div class="kpi-val">${Number(payback).toFixed(1)} ${L.yrUnit}</div></div>`:''}
  </div>` : `<p style="color:#6b7280">${L.noData}</p>`;

  const costRows = costSeries.map((p:any)=>{
    const saving=p.traditionalCost-p.schemeCost, color=saving>0?'#16a34a':'#dc2626';
    return `<tr><td>${p.year}</td><td>¥${Math.round(p.traditionalCost).toLocaleString()}</td><td>¥${Math.round(p.schemeCost).toLocaleString()}</td><td style="color:${color}">¥${Math.round(saving).toLocaleString()}</td></tr>`;
  }).join('');

  const dateLocale = lang === 'zh' ? 'zh-CN' : 'en-US';

  const html = `<!doctype html><html lang="${lang === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><title>${L.title}</title>
<style>
  body{font-family:${lang === 'zh' ? '"PingFang SC","Microsoft YaHei",Arial,sans-serif' : 'Arial,"Helvetica Neue",sans-serif'};padding:32px;color:#111;font-size:13px;line-height:1.6}
  h1{font-size:20px;font-weight:700;margin:0 0 4px}.sub{color:#6b7280;font-size:12px;margin-bottom:24px}
  .sec{font-size:14px;font-weight:700;margin:20px 0 8px;padding-left:10px;border-left:4px solid #1677ff}
  .card{border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:12px}
  table{width:100%;border-collapse:collapse}th,td{border:1px solid #e5e7eb;padding:7px 10px;font-size:12px}
  th{background:#f9fafb;font-weight:600}.kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .kpi-card{background:#f0f9ff;border-radius:8px;padding:12px}.kpi-label{font-size:11px;color:#6b7280}
  .kpi-val{font-size:18px;font-weight:700;color:#1677ff;margin-top:4px}svg{max-width:100%;height:auto}
  .btn-row{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap}
  .btn{padding:8px 20px;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}
  .btn-print{background:#1677ff;color:#fff}.btn-pdf{background:#16a34a;color:#fff}
  @media print{.no-print{display:none}}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
</head><body>
  <div class="no-print btn-row">
    <button class="btn btn-print" onclick="window.print()">${L.btnPrint}</button>
    <button class="btn btn-pdf" id="btn-download-pdf">${L.btnDownload}</button>
  </div>
  <div id="report-content">
    <h1>${L.title}</h1>
    <div class="sub">${L.genTime}：${esc(new Date().toLocaleString(dateLocale))}　${L.reportNo}：${esc(reportId)}</div>
    <div class="sec">${L.secTopo}</div><div class="card">${svg}</div>
    <div class="sec">${L.secKpi}</div><div class="card">${kpiHtml}</div>
    <div class="sec">${L.secDevices}</div>
    <div class="card"><table><thead><tr><th>${L.thName}</th><th>${L.thType}</th><th>${L.thPower}</th><th>${L.thCapacity}</th></tr></thead>
    <tbody>${deviceRows||`<tr><td colspan="4" style="text-align:center;color:#999">${L.noDevices}</td></tr>`}</tbody></table></div>
    ${costSeries.length?`<div class="sec">${L.secCost}</div>
    <div class="card"><table><thead><tr><th>${L.thYear}</th><th>${L.thTraditional}</th><th>${L.thScheme}</th><th>${L.thSavings}</th></tr></thead>
    <tbody>${costRows}</tbody></table></div>`:''}
  </div>
<script>
  document.getElementById('btn-download-pdf').addEventListener('click', function() {
    var el = document.getElementById('report-content');
    var btn = document.getElementById('btn-download-pdf');
    btn.textContent = '${lang === 'zh' ? '生成中...' : 'Generating...'}';
    btn.disabled = true;
    html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: 'GP16-Report-${reportId}.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    }).from(el).save().then(function() {
      btn.textContent = '${L.btnDownload}';
      btn.disabled = false;
    });
  });
</script>
</body></html>`;

  const outDir = process.env.REPORT_DIR ?? path.resolve(process.cwd(), 'data', 'reports');
  await fs.mkdir(outDir, { recursive: true });
  const htmlPath = path.join(outDir, `${reportId}.html`);
  await fs.writeFile(htmlPath, html, 'utf-8');
  return { reportId, htmlPath };
}

// ── Export startWorker ────────────────────────────────────────────────────────
export function startWorker() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

  const worker = new Worker('gp16-jobs', async (job) => {
    if (job.name === 'ping') return { ok: true, at: new Date().toISOString() };

    if (job.name === 'ai_layout') {
      const prompt = String((job.data as any)?.prompt ?? '');
      const llmResult = await callLLM(prompt).catch((e) => {
        console.error('[worker][llm] error', e);
        return null;
      });
      const candidate = llmResult ?? heuristicLayout(prompt);
      const parsed = layoutSchema.safeParse(candidate);
      if (!parsed.success) {
        console.warn('[worker][llm] schema fail, using heuristic');
        return layoutSchema.parse(heuristicLayout(prompt));
      }
      return parsed.data;
    }

    if (job.name === 'report_generate') {
      return generateReport({ ...job.data as any, reportId: String(job.id) });
    }

    throw new Error(`Unknown job: ${job.name}`);
  }, { connection });

  worker.on('completed', (job) => console.log(`[worker] done  ${job.id} ${job.name}`));
  worker.on('failed',    (job, err) => console.error(`[worker] fail  ${job?.id} ${job?.name}`, err.message));
  console.log('[worker] started inline, queue: gp16-jobs');
}
