import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DeviceType } from '@gp16/shared';

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

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
  const kwMatch = prompt.match(/(\d+(?:\.\d+)?)\s*kW/i);
  const kwhMatch = prompt.match(/(\d+(?:\.\d+)?)\s*kWh/i);
  const pvKw = kwMatch ? Number(kwMatch[1]) : 10;
  const battKwh = kwhMatch ? Number(kwhMatch[1]) : 20;

  return {
    layoutVersion: 'v1',
    topology: {
      nodes: [
        { id: 'pv1',   position: { x: 100, y: 100 }, data: { label: `光伏阵列 ${pvKw}kW`,   deviceType: 'pv_panel'  as DeviceType, ratedPowerKw: pvKw } },
        { id: 'inv1',  position: { x: 340, y: 100 }, data: { label: `逆变器 ${pvKw}kW`,     deviceType: 'inverter'  as DeviceType, ratedPowerKw: pvKw } },
        { id: 'bat1',  position: { x: 340, y: 260 }, data: { label: `储能 ${battKwh}kWh`,   deviceType: 'battery'   as DeviceType, capacityKwh: battKwh } },
        { id: 'load1', position: { x: 580, y: 100 }, data: { label: `负载 ${(pvKw*0.6).toFixed(1)}kW`, deviceType: 'load' as DeviceType, ratedPowerKw: pvKw * 0.6 } },
        { id: 'grid1', position: { x: 580, y: 260 }, data: { label: '电网',                 deviceType: 'grid'      as DeviceType } },
      ],
      edges: [
        { id: 'e1', source: 'pv1',  target: 'inv1'  },
        { id: 'e2', source: 'inv1', target: 'load1' },
        { id: 'e3', source: 'bat1', target: 'inv1'  },
        { id: 'e4', source: 'grid1',target: 'inv1'  },
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
  const base = process.env.LLM_API_BASE;
  const key  = process.env.LLM_API_KEY;
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
  try {
    return JSON.parse(cleaned);
  } catch {
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
  pv_panel: '#fffbe6', inverter: '#e6f4ff', battery: '#f6ffed',
  charger: '#fff0f6',  load: '#f9f0ff',     grid: '#fff7e6',
};

function topologyToSvg(topology: any, lang: 'zh' | 'en' = 'zh'): string {
  const nodes: any[] = topology.nodes ?? [];
  const edges: any[] = topology.edges ?? [];
  if (nodes.length === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><text x="20" y="50" fill="#999">${lang === 'zh' ? '（无设备）' : '(No devices)'}</text></svg>`;

  const xs = nodes.map((n: any) => n.position.x);
  const ys = nodes.map((n: any) => n.position.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const maxX = Math.max(...xs), maxY = Math.max(...ys);
  const W = Math.max(800, maxX - minX + 240);
  const H = Math.max(400, maxY - minY + 200);
  const pad = 100;

  const byId = new Map(nodes.map((n: any) => [n.id, n]));
  const lines = edges.map((e: any) => {
    const s = byId.get(e.source) as any, t = byId.get(e.target) as any;
    if (!s || !t) return '';
    return `<line x1="${s.position.x-minX+pad}" y1="${s.position.y-minY+pad}" x2="${t.position.x-minX+pad}" y2="${t.position.y-minY+pad}" stroke="#94a3b8" stroke-width="2" marker-end="url(#arr)"/>`;
  }).join('');

  const rects = nodes.map((n: any) => {
    const x = n.position.x - minX + pad, y = n.position.y - minY + pad;
    const fill = COLORS[n.data?.deviceType] ?? '#f5f5f5';
    const label = esc(n.data?.label ?? n.id);
    return `<g><rect x="${x-50}" y="${y-22}" width="100" height="44" rx="8" fill="${fill}" stroke="#1677ff" stroke-width="1.5"/><text x="${x}" y="${y+5}" font-size="11" text-anchor="middle" fill="#111">${label}</text></g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#94a3b8"/></marker></defs>
  <rect width="100%" height="100%" fill="#fff"/>
  ${lines}${rects}
</svg>`;
}

// ── AI Commentary ──────────────────────────────────────────────────────────────
async function callLLMForCommentary(payload: { topology: any; analysis: any; lang: 'zh' | 'en' }): Promise<string> {
  const base  = process.env.LLM_API_BASE;
  const key   = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? 'qwen-plus';
  if (!base || !key) return '';

  const isZh = payload.lang === 'zh';
  const topology = payload.topology ?? { nodes: [], edges: [] };
  const analysis = payload.analysis ?? {};

  const nodeList = (topology.nodes ?? []).map((n: any) =>
    `- ${n.data?.label ?? n.id} (${n.data?.deviceType ?? 'unknown'}${n.data?.ratedPowerKw ? `, ${n.data.ratedPowerKw}kW` : ''}${n.data?.capacityKwh ? `, ${n.data.capacityKwh}kWh` : ''})`
  ).join('\n');

  const s = analysis?.summary;
  const kpiText = s
    ? `PV ${s.pvInstalledKw}kW, Annual Gen ${s.annualGenerationKwh}kWh, CO₂ Saved ${s.annualCo2SavedTons}t/yr, Trees ${s.equivalentTrees}, CAPEX ¥${s.totalCapex}, Payback ${analysis?.simplePaybackYears}yr`
    : '';

  const system = isZh
    ? '你是资深光伏/电力系统工程师。请用专业、简洁的中文撰写报告章节。150-250字。只输出正文，不含标题或markdown。'
    : 'You are a senior PV/power systems engineer. Write a professional, concise report section in English. 150-250 words. Output body text only, no title or markdown.';

  const userPrompt = isZh
    ? `请为此光伏系统设计方案撰写一段"项目概述与技术亮点"：\n\n设备清单：\n${nodeList}\n\n性能指标：${kpiText}\n\n要求：突出设计合理性、绿色效益和技术亮点。`
    : `Write a "Project Overview & Technical Highlights" section for this PV system design:\n\nDevices:\n${nodeList}\n\nKPIs: ${kpiText}\n\nHighlight design rationale, green benefits, and technical merits.`;

  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;

  try {
    const res = await fetch(`${trimmed}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, temperature: 0.6, messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ]}),
    });
    if (!res.ok) return '';
    const json = await res.json() as any;
    const text = json?.choices?.[0]?.message?.content;
    return typeof text === 'string' ? text.trim() : '';
  } catch {
    return '';
  }
}

// ── HTML Report (professional bilingual + html2pdf.js) ────────────────────────
async function generateReport(payload: any): Promise<{ reportId: string; htmlPath: string }> {
  const reportId  = String(payload.reportId ?? payload.taskId ?? Date.now());
  const topology  = payload.topology  ?? { nodes: [], edges: [] };
  const analysis  = payload.analysis  ?? null;
  const lang: 'zh' | 'en' = payload.lang === 'en' ? 'en' : 'zh';
  const svg = topologyToSvg(topology, lang);
  const commentary = await callLLMForCommentary({ topology, analysis, lang });

  const L = {
    title: lang === 'zh' ? '光伏/电力系统 AI 辅助设计报告' : 'PV System AI-Assisted Design Report',
    subtitle: lang === 'zh' ? 'GP16 智能设计平台' : 'GP16 Smart Design Platform',
    genTime: lang === 'zh' ? '生成时间' : 'Generated',
    reportNo: lang === 'zh' ? '报告编号' : 'Report No.',
    preparedBy: lang === 'zh' ? '编制单位' : 'Prepared by',
    preparedVal: 'GP16 AI',
    secOverview: lang === 'zh' ? '项目概述与技术亮点' : 'Project Overview & Technical Highlights',
    secTopo: lang === 'zh' ? '系统拓扑图' : 'System Topology',
    secKpi: lang === 'zh' ? '绿色效益指标' : 'Green Impact Metrics',
    secDevices: lang === 'zh' ? '设备清单' : 'Device Inventory',
    secCost: lang === 'zh' ? '累计成本对比（10年）' : 'Cumulative Cost Comparison (10-Year)',
    thName: lang === 'zh' ? '设备名称' : 'Device Name',
    thType: lang === 'zh' ? '类型' : 'Type',
    thPower: lang === 'zh' ? '额定功率' : 'Rated Power',
    thCapacity: lang === 'zh' ? '容量' : 'Capacity',
    thYear: lang === 'zh' ? '年份' : 'Year',
    thTraditional: lang === 'zh' ? '传统模式累计费用' : 'Traditional Cumulative',
    thScheme: lang === 'zh' ? '本方案累计费用(含CAPEX)' : 'Scheme Cumulative (incl. CAPEX)',
    thSavings: lang === 'zh' ? '累计节省' : 'Cum. Savings',
    kpiPv: lang === 'zh' ? '光伏装机容量' : 'PV Installed Capacity',
    kpiGen: lang === 'zh' ? '年发电量' : 'Annual Generation',
    kpiCo2: lang === 'zh' ? '年碳减排量' : 'Annual CO₂ Reduction',
    kpiTrees: lang === 'zh' ? '等效植树量' : 'Equivalent Trees Planted',
    kpiCapex: lang === 'zh' ? '系统总投资' : 'Total System CAPEX',
    kpiPayback: lang === 'zh' ? '简单投资回收期' : 'Simple Payback Period',
    noData: lang === 'zh' ? '暂无分析数据' : 'No analysis data available',
    noDevices: lang === 'zh' ? '（无设备）' : '(No devices)',
    btnPrint: lang === 'zh' ? '🖨️ 打印 / 保存为 PDF' : '🖨️ Print / Save as PDF',
    btnDownload: lang === 'zh' ? '📥 一键下载 PDF' : '📥 Download PDF',
    treesUnit: lang === 'zh' ? '棵' : 'trees',
    yrUnit: lang === 'zh' ? '年' : 'yr',
    pageOf: lang === 'zh' ? '第' : 'Page',
    disclaimer: lang === 'zh' ? '本报告由 GP16 AI 自动生成，仅供设计参考，不构成工程建议。' : 'This report is auto-generated by GP16 AI for design reference only and does not constitute engineering advice.',
  };

  const typeLabel: Record<string, string> = lang === 'zh'
    ? { pv_panel:'光伏板', inverter:'逆变器', battery:'电池/储能', charger:'充电桩', load:'负载', grid:'电网' }
    : { pv_panel:'PV Panel', inverter:'Inverter', battery:'Battery', charger:'EV Charger', load:'Load', grid:'Grid' };

  const deviceRows = (topology.nodes ?? []).map((n: any) => {
    return `<tr><td><strong>${esc(n.data?.label ?? n.id)}</strong></td><td>${esc(typeLabel[n.data?.deviceType] ?? '')}</td><td>${n.data?.ratedPowerKw != null ? `${n.data.ratedPowerKw} kW` : '—'}</td><td>${n.data?.capacityKwh != null ? `${n.data.capacityKwh} kWh` : '—'}</td></tr>`;
  }).join('');

  const s = analysis?.summary;
  const payback = analysis?.simplePaybackYears;
  const costSeries: any[] = analysis?.costSeries ?? [];

  const fmtMoney = (v: number) => `¥${Math.round(v).toLocaleString()}`;
  const kpiItems = s ? [
    { label: L.kpiPv,     value: `${Number(s.pvInstalledKw).toFixed(1)} <small>kW</small>`,    icon: '☀️' },
    { label: L.kpiGen,    value: `${Math.round(s.annualGenerationKwh).toLocaleString()} <small>kWh</small>`, icon: '⚡' },
    { label: L.kpiCo2,    value: `${Number(s.annualCo2SavedTons).toFixed(2)} <small>tCO₂</small>`, icon: '🌱' },
    { label: L.kpiTrees,  value: `${Math.round(s.equivalentTrees).toLocaleString()} <small>${L.treesUnit}</small>`, icon: '🌳' },
    { label: L.kpiCapex,  value: `${fmtMoney(s.totalCapex)}`, icon: '💰' },
    ...(payback != null ? [{ label: L.kpiPayback, value: `${Number(payback).toFixed(1)} <small>${L.yrUnit}</small>`, icon: '📅' }] : []),
  ] : [];

  const kpiHtml = kpiItems.length
    ? `<div class="kpi-grid">${kpiItems.map(k => `
      <div class="kpi-card">
        <div class="kpi-icon">${k.icon}</div>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-val">${k.value}</div>
      </div>`).join('')}</div>`
    : `<div class="empty-state">${L.noData}</div>`;

  const costRows = costSeries.map((p: any) => {
    const saving = p.traditionalCost - p.schemeCost;
    return `<tr>
      <td>${lang === 'zh' ? '第' : 'Y'}${p.year}${lang === 'zh' ? '年' : ''}</td>
      <td>${fmtMoney(p.traditionalCost)}</td>
      <td>${fmtMoney(p.schemeCost)}</td>
      <td class="${saving >= 0 ? 'text-green' : 'text-red'}"><strong>${saving >= 0 ? '+' : ''}${fmtMoney(saving)}</strong></td>
    </tr>`;
  }).join('');

  const dateLocale = lang === 'zh' ? 'zh-CN' : 'en-US';
  const now = new Date();
  const dateStr = now.toLocaleDateString(dateLocale, { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });

  const commentaryHtml = commentary
    ? `<p style="white-space:pre-wrap;margin:0">${esc(commentary)}</p>`
    : `<p class="text-muted">${lang === 'zh' ? '（AI 概述生成中...）' : '(AI overview pending...)'}</p>`;

  const nodeCount = (topology.nodes ?? []).length;
  const edgeCount = (topology.edges ?? []).length;

  const html = `<!doctype html><html lang="${lang === 'zh' ? 'zh-CN' : 'en'}"><head><meta charset="utf-8"><title>GP16 — ${L.title}</title>
<style>
  :root {
    --navy: #1a365d; --navy-light: #2a4a7f; --blue: #2b6cb0; --blue-light: #ebf4ff;
    --green: #276749; --green-light: #f0fff4; --red: #c53030; --red-light: #fff5f5;
    --gray-50: #f7fafc; --gray-100: #edf2f7; --gray-200: #e2e8f0; --gray-400: #a0aec0;
    --gray-600: #718096; --gray-700: #4a5568; --gray-900: #1a202c;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${lang === 'zh' ? '"PingFang SC","Microsoft YaHei","Noto Sans SC",Arial,sans-serif' : 'Arial,"Helvetica Neue",sans-serif'};color:var(--gray-900);font-size:12pt;line-height:1.7;background:#fff}
  .no-print{position:fixed;top:16px;right:16px;z-index:100;display:flex;gap:8px}
  .btn{padding:10px 22px;border:none;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:600;letter-spacing:.3px;box-shadow:0 2px 8px rgba(0,0,0,.12);transition:all .15s}
  .btn:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(0,0,0,.18)}
  .btn-print{background:var(--navy);color:#fff}.btn-pdf{background:var(--green);color:#fff}

  .cover{background:linear-gradient(135deg, var(--navy) 0%, var(--navy-light) 100%);color:#fff;padding:48px 40px 36px;border-radius:0;margin:-32px -32px 32px;position:relative;overflow:hidden}
  .cover::after{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;background:rgba(255,255,255,.04);border-radius:50%}
  .cover-logo{font-size:11px;letter-spacing:3px;text-transform:uppercase;opacity:.7;margin-bottom:8px}
  .cover h1{font-size:26px;font-weight:800;letter-spacing:.5px;margin-bottom:8px;line-height:1.3}
  .cover .subtitle{font-size:13px;opacity:.8;margin-bottom:20px}

  .meta-bar{display:flex;flex-wrap:wrap;gap:20px 36px;padding:16px 20px;background:var(--gray-50);border-radius:8px;border:1px solid var(--gray-200);margin-bottom:28px;font-size:11px;color:var(--gray-600)}
  .meta-item{display:flex;flex-direction:column;gap:2px}
  .meta-item .meta-label{font-weight:600;color:var(--gray-400);text-transform:uppercase;letter-spacing:1px;font-size:9px}
  .meta-item .meta-val{color:var(--gray-900);font-size:12px;font-weight:600}

  .sec{font-size:16px;font-weight:700;color:var(--navy);margin:36px 0 14px;padding-bottom:8px;border-bottom:2px solid var(--gray-200);display:flex;align-items:center;gap:10px}
  .sec .sec-num{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;background:var(--navy);color:#fff;border-radius:6px;font-size:12px;font-weight:800;flex-shrink:0}
  .card{background:var(--gray-50);border:1px solid var(--gray-200);border-radius:10px;padding:20px;margin-bottom:16px}

  .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
  .kpi-card{background:#fff;border:1px solid var(--gray-200);border-radius:10px;padding:18px 16px;display:flex;flex-direction:column;gap:4px;box-shadow:0 1px 3px rgba(0,0,0,.04);transition:box-shadow .15s}
  .kpi-card:hover{box-shadow:0 4px 12px rgba(0,0,0,.08)}
  .kpi-icon{font-size:22px;line-height:1}
  .kpi-label{font-size:10px;font-weight:600;color:var(--gray-400);text-transform:uppercase;letter-spacing:.5px}
  .kpi-val{font-size:22px;font-weight:800;color:var(--navy);line-height:1.2}
  .kpi-val small{font-size:11px;font-weight:500;color:var(--gray-600)}

  table{width:100%;border-collapse:collapse;font-size:11px}
  thead th{background:var(--navy);color:#fff;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:10px 12px;text-align:left}
  thead th:first-child{border-radius:6px 0 0 0}thead th:last-child{border-radius:0 6px 0 0}
  tbody td{padding:9px 12px;border-bottom:1px solid var(--gray-100)}
  tbody tr:nth-child(even){background:var(--gray-50)}
  tbody tr:hover{background:var(--blue-light)}
  .text-green{color:var(--green)}.text-red{color:var(--red)}.text-muted{color:var(--gray-400)}

  .svg-wrap{display:flex;justify-content:center;background:#fff;border-radius:8px;padding:12px}
  .svg-wrap svg{max-width:100%;height:auto}

  .empty-state{text-align:center;padding:24px;color:var(--gray-400);font-style:italic}

  .report-footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--gray-200);display:flex;justify-content:space-between;font-size:9px;color:var(--gray-400)}
  .disclaimer{margin-top:28px;padding:12px 16px;background:var(--gray-50);border-radius:6px;font-size:9px;color:var(--gray-400);text-align:center;line-height:1.5}

  @media print {
    body{font-size:10pt}
    .no-print{display:none !important}
    .cover{margin:0;padding:36px 24px 28px;page-break-after:avoid}
    .sec{page-break-after:avoid}
    .card{page-break-inside:avoid}
    .kpi-grid{page-break-inside:avoid}
    table{page-break-inside:avoid}
    @page{size:A4;margin:16mm 14mm}
  }
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
</head><body>
  <div class="no-print">
    <button class="btn btn-print" onclick="window.print()">${L.btnPrint}</button>
    <button class="btn btn-pdf" id="btn-download-pdf">${L.btnDownload}</button>
  </div>
  <div id="report-content">

    <!-- COVER -->
    <div class="cover">
      <div class="cover-logo">GP16</div>
      <h1>${L.title}</h1>
      <div class="subtitle">${L.subtitle}</div>
    </div>

    <!-- META -->
    <div class="meta-bar">
      <div class="meta-item"><span class="meta-label">${L.genTime}</span><span class="meta-val">${dateStr} ${timeStr}</span></div>
      <div class="meta-item"><span class="meta-label">${L.reportNo}</span><span class="meta-val">${esc(reportId)}</span></div>
      <div class="meta-item"><span class="meta-label">${L.preparedBy}</span><span class="meta-val">${L.preparedVal}</span></div>
      <div class="meta-item"><span class="meta-label">${lang === 'zh' ? '设备数量' : 'Devices'}</span><span class="meta-val">${nodeCount} ${lang === 'zh' ? '台设备' : 'devices'}, ${edgeCount} ${lang === 'zh' ? '条连接' : 'connections'}</span></div>
    </div>

    <!-- 1. OVERVIEW -->
    <div class="sec"><span class="sec-num">1</span>${L.secOverview}</div>
    <div class="card">${commentaryHtml}</div>

    <!-- 2. TOPOLOGY -->
    <div class="sec"><span class="sec-num">2</span>${L.secTopo}</div>
    <div class="card"><div class="svg-wrap">${svg}</div></div>

    <!-- 3. KPI -->
    <div class="sec"><span class="sec-num">3</span>${L.secKpi}</div>
    <div class="card">${kpiHtml}</div>

    <!-- 4. DEVICE LIST -->
    <div class="sec"><span class="sec-num">4</span>${L.secDevices}</div>
    <div class="card">
      <table><thead><tr><th>${L.thName}</th><th>${L.thType}</th><th>${L.thPower}</th><th>${L.thCapacity}</th></tr></thead>
      <tbody>${deviceRows || `<tr><td colspan="4" class="empty-state">${L.noDevices}</td></tr>`}</tbody></table>
    </div>

    <!-- 5. COST -->
    ${costSeries.length ? `
    <div class="sec"><span class="sec-num">5</span>${L.secCost}</div>
    <div class="card">
      <table><thead><tr><th>${L.thYear}</th><th>${L.thTraditional}</th><th>${L.thScheme}</th><th>${L.thSavings}</th></tr></thead>
      <tbody>${costRows}</tbody></table>
    </div>` : ''}

    <!-- DISCLAIMER -->
    <div class="disclaimer">${L.disclaimer}</div>
    <div class="report-footer">
      <span>GP16 &copy; ${now.getFullYear()}</span>
      <span>${L.pageOf} <span class="page-num"></span></span>
    </div>

  </div>
<script>
  (function() {
    var btn = document.getElementById('btn-download-pdf');
    btn.addEventListener('click', function() {
      btn.textContent = '${lang === 'zh' ? '生成中...' : 'Generating...'}';
      btn.disabled = true;
      html2pdf().set({
        margin: [12, 12, 12, 12],
        filename: 'GP16-Report-${reportId}.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      }).from(document.getElementById('report-content')).save().then(function() {
        btn.textContent = '${L.btnDownload}';
        btn.disabled = false;
      });
    });
  })();
</script>
</body></html>`;

  const outDir = process.env.REPORT_DIR ?? path.resolve(process.cwd(), 'data', 'reports');
  await fs.mkdir(outDir, { recursive: true });
  const htmlPath = path.join(outDir, `${reportId}.html`);
  await fs.writeFile(htmlPath, html, 'utf-8');

  return { reportId, htmlPath };
}

// ── Worker ────────────────────────────────────────────────────────────────────
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
console.log('[worker] started, queue: gp16-jobs');
