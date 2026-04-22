import { Alert, Card, Collapse, InputNumber, Spin, Statistic, Tag, Typography } from 'antd';
import {
  ThunderboltOutlined, CloudOutlined, DollarOutlined,
  FieldTimeOutlined, RiseOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTopologyStore } from '@/state/topologyStore';
import { useConfigStore } from '@/state/configStore';
import { useDebouncedAnalysis } from '@/hooks/useDebouncedAnalysis';

function StatCard({ title, value, prefix, color }: { title: string; value: React.ReactNode; prefix: React.ReactNode; color: string }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '10px 12px',
      border: '1px solid #f1f5f9', transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: color + '12',
        }}>
          {prefix}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, lineHeight: 1.2 }}>{title}</div>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  );
}

export function AnalyticsPanel() {
  const { t } = useTranslation();
  const nodes = useTopologyStore((s) => s.nodes);
  const { config, setConfig } = useConfigStore();
  const { data, loading, error } = useDebouncedAnalysis(1200);

  const chartOption = useMemo(() => {
    const series = data?.costSeries ?? [];
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: number) => `¥${Number(v).toLocaleString()}` },
      legend: { data: [t('traditional'), t('scheme')], top: 0, textStyle: { fontSize: 11 }, itemGap: 12 },
      grid: { top: 36, bottom: 30, left: 65, right: 12 },
      xAxis: { type: 'category', data: series.map((p) => `${p.year}`), name: t('years'), nameLocation: 'end', nameTextStyle: { fontSize: 10, color: '#94a3b8' }, axisLine: { lineStyle: { color: '#e2e8f0' } }, axisTick: { show: false }, axisLabel: { fontSize: 10, color: '#64748b' } },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: (v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`, fontSize: 10, color: '#64748b' },
        splitLine: { lineStyle: { color: '#f1f5f9' } },
        axisLine: { show: false },
      },
      series: [
        { name: t('traditional'), type: 'line', data: series.map((p) => p.traditionalCost), smooth: true, lineStyle: { width: 2.5 }, itemStyle: { color: '#3b82f6' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#3b82f620' }, { offset: 1, color: '#3b82f603' }] } } },
        { name: t('scheme'),      type: 'line', data: series.map((p) => p.schemeCost),      smooth: true, lineStyle: { width: 2.5 }, itemStyle: { color: '#22c55e' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#22c55e20' }, { offset: 1, color: '#22c55e03' }] } } },
      ],
    };
  }, [data, t]);

  const payback = data?.simplePaybackYears;

  return (
    <div style={{ padding: '14px 12px', overflowY: 'auto', height: '100%', background: '#fafbfc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'linear-gradient(135deg,#22c55e,#16a34a)', boxShadow: '0 2px 6px rgba(34,197,94,0.25)',
        }}>
          <RiseOutlined style={{ color: '#fff', fontSize: 15 }} />
        </div>
        <Typography.Text style={{ fontWeight: 700, fontSize: 14.5, color: '#0f172a', letterSpacing: '-0.01em' }}>
          {t('analysis')}
        </Typography.Text>
      </div>

      {/* KPI summary */}
      <div style={{ marginBottom: 10 }}>
        {error && <Alert type="error" message={t('analysisFail')} description={error} style={{ marginBottom: 8, borderRadius: 8, fontSize: 12 }} />}
        {nodes.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 10, padding: '20px 14px', border: '1px solid #f1f5f9',
            textAlign: 'center',
          }}>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>{t('noDevice')}</Typography.Text>
          </div>
        ) : (
          <Spin spinning={loading}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <StatCard
                title={`${t('pvInstalled')} (kW)`}
                value={Number((data?.summary.pvInstalledKw ?? 0).toFixed(1))}
                prefix={<ThunderboltOutlined style={{ color: '#f59e0b', fontSize: 14 }} />}
                color="#f59e0b"
              />
              <StatCard
                title={`${t('annualGen')} (kWh)`}
                value={data ? Math.round(data.summary.annualGenerationKwh).toLocaleString() : '-'}
                prefix={<span style={{ fontSize: 14 }}>⚡</span>}
                color="#f59e0b"
              />
              <StatCard
                title={`${t('co2Saved')} (tCO₂)`}
                value={data ? Number(data.summary.annualCo2SavedTons.toFixed(2)) : '-'}
                prefix={<CloudOutlined style={{ color: '#22c55e', fontSize: 14 }} />}
                color="#22c55e"
              />
              <StatCard
                title={t('trees')}
                value={data ? Math.round(data.summary.equivalentTrees).toLocaleString() : '-'}
                prefix={<span style={{ fontSize: 14 }}>🌳</span>}
                color="#22c55e"
              />
              <StatCard
                title={`${t('totalCapex')} (¥)`}
                value={data ? `¥${Math.round(data.summary.totalCapex).toLocaleString()}` : '-'}
                prefix={<DollarOutlined style={{ color: '#f97316', fontSize: 14 }} />}
                color="#f97316"
              />
            </div>
            {payback != null && (
              <div style={{
                marginTop: 10, background: '#fff', borderRadius: 10, padding: '10px 14px',
                border: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <FieldTimeOutlined style={{ color: '#64748b', fontSize: 13 }} />
                <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>{t('payback')}:</Typography.Text>
                <Tag color={payback <= 8 ? 'success' : payback <= 15 ? 'warning' : 'error'} style={{ fontSize: 12, fontWeight: 600, padding: '1px 8px' }}>
                  {payback.toFixed(1)} {t('years')}
                </Tag>
              </div>
            )}
            {payback == null && data && (
              <div style={{ marginTop: 10 }}>
                <Tag color="default" style={{ fontSize: 11, borderRadius: 8 }}>{t('paybackNA')}</Tag>
              </div>
            )}
          </Spin>
        )}
      </div>

      {/* Cost chart */}
      <Card
        size="small"
        title={<span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{t('costChart')}</span>}
        style={{
          marginBottom: 10, borderRadius: 12, border: '1px solid #f1f5f9',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        }}
        headStyle={{ borderBottom: '1px solid #f1f5f9', padding: '10px 14px' }}
        bodyStyle={{ padding: '8px 4px 4px' }}
      >
        {data ? (
          <ReactECharts option={chartOption} style={{ height: 220 }} />
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>{t('noDevice')}</Typography.Text>
          </div>
        )}
      </Card>

      {/* Config panel */}
      <Collapse
        size="small"
        bordered={false}
        style={{
          background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)', overflow: 'hidden',
        }}
        expandIconPosition="end"
        items={[{
          key: 'cfg',
          label: <span style={{ fontSize: 12.5, fontWeight: 600, color: '#334155' }}>{t('config')}</span>,
          children: (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px', padding: '4px 2px 8px' }}>
              {([
                ['electricityPricePerKwh', t('elecPrice'),    0.01, 0.01],
                ['fullLoadHoursPerYear',   t('fullLoadHours'), 100,  50],
                ['gridEmissionFactor',     t('emissionFactor'),0.01, 0.01],
                ['performanceRatio',       t('perfRatio'),     0.01, 0.01],
                ['pvUnitCostPerKw',        t('pvCost'),        10,   50],
                ['inverterUnitCostPerKw',  t('invCost'),       10,   10],
                ['battUnitCostPerKwh',     t('battCost'),      10,   10],
              ] as [keyof typeof config, string, number, number][]).map(([key, label, min, step]) => (
                <div key={key}>
                  <div style={{ fontSize: 10.5, color: '#94a3b8', marginBottom: 3, fontWeight: 500 }}>{label}</div>
                  <InputNumber
                    size="small" min={min} step={step}
                    value={(config as any)[key]}
                    onChange={(v) => v != null && setConfig({ [key]: v })}
                    style={{ width: '100%', borderRadius: 8, borderColor: '#e2e8f0' }}
                    controls={false}
                  />
                </div>
              ))}
            </div>
          ),
        }]}
      />
    </div>
  );
}
