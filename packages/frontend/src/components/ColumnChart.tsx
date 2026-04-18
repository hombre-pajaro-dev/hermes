import type { HistoricPeriod } from '../api/client';

interface Props {
  periods: HistoricPeriod[];
  groupBy: 'week' | 'month' | 'day';
  bestIndex: number;
  medianRevenue?: number | null;
}

const W = 760, H = 260;
const PAD = { left: 56, bottom: 38, top: 28, right: 8 };
const CW = W - PAD.left - PAD.right;
const CH = H - PAD.top - PAD.bottom;

const COL = { revenue: '#4d96ff', cost: '#ff6b35', profit: '#51cf66' };

function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default function ColumnChart({ periods, groupBy, bestIndex, medianRevenue }: Props) {
  const isDay = groupBy === 'day';
  const maxVal = Math.max(1, ...periods.flatMap(p => isDay ? [p.revenue] : [p.revenue, p.cost, p.profit > 0 ? p.profit : 0]));
  const scaleY = (v: number) => CH - Math.max(0, (v / maxVal) * CH);

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map(f => maxVal * f);

  const groupW = CW / Math.max(periods.length, 1);
  const BAR_W = isDay ? Math.max(1, groupW - 1) : Math.min(14, groupW / 4.2);
  const GROUP_OFFSET = isDay ? 0 : (groupW - BAR_W * 3 - 2) / 2;

  const bx = (i: number) => PAD.left + i * groupW;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* grid lines + Y labels */}
      {gridValues.map((v, gi) => {
        const y = PAD.top + scaleY(v);
        return (
          <g key={gi}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border, #e2e8f0)" strokeWidth={1} strokeDasharray={gi === 0 ? 'none' : '3 3'} />
            <text x={PAD.left - 4} y={y + 4} textAnchor="end" fontSize={10} fill="var(--text-muted, #94a3b8)">{fmt(v)}</text>
          </g>
        );
      })}

      {/* median line (day view) */}
      {isDay && medianRevenue != null && medianRevenue > 0 && (() => {
        const y = PAD.top + scaleY(medianRevenue);
        return (
          <g>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#4d96ff" strokeWidth={1.5} strokeDasharray="6 4" opacity={0.6} />
            <text x={W - PAD.right - 2} y={y - 3} textAnchor="end" fontSize={9} fill="#4d96ff" opacity={0.85}>med {fmt(medianRevenue)}</text>
          </g>
        );
      })()}

      {/* bars + labels */}
      {periods.map((p, i) => {
        const x = bx(i);
        const isBest = i === bestIndex && p.revenue > 0;

        return (
          <g key={p.period_start}>
            {/* best highlight */}
            {isBest && (
              <rect x={x + 1} y={PAD.top} width={groupW - 2} height={CH} fill="#fbbf24" opacity={0.08} rx={2} />
            )}

            {isDay ? (
              /* single revenue bar for day view */
              p.revenue > 0 && (
                <rect
                  x={x + 0.5}
                  y={PAD.top + scaleY(p.revenue)}
                  width={BAR_W}
                  height={CH - scaleY(p.revenue)}
                  fill={isBest ? '#fbbf24' : COL.revenue}
                  opacity={isBest ? 1 : 0.75}
                  rx={1}
                />
              )
            ) : (
              /* 3 bars: revenue, cost, profit */
              <>
                {p.revenue > 0 && <rect x={x + GROUP_OFFSET} y={PAD.top + scaleY(p.revenue)} width={BAR_W} height={CH - scaleY(p.revenue)} fill={COL.revenue} opacity={isBest ? 1 : 0.75} rx={1} />}
                {p.cost > 0 && <rect x={x + GROUP_OFFSET + BAR_W + 1} y={PAD.top + scaleY(p.cost)} width={BAR_W} height={CH - scaleY(p.cost)} fill={COL.cost} opacity={isBest ? 1 : 0.75} rx={1} />}
                {p.profit > 0 && <rect x={x + GROUP_OFFSET + (BAR_W + 1) * 2} y={PAD.top + scaleY(p.profit)} width={BAR_W} height={CH - scaleY(p.profit)} fill={COL.profit} opacity={isBest ? 1 : 0.75} rx={1} />}
              </>
            )}

            {/* best star */}
            {isBest && (
              <text x={x + groupW / 2} y={PAD.top - 8} textAnchor="middle" fontSize={10} fill="#fbbf24" fontWeight="bold">★</text>
            )}

            {/* X label */}
            {(isDay ? (p.label.length > 2 || i === 0) : true) && (
              <text
                x={x + groupW / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize={isDay ? 9 : 10}
                fill={isBest ? '#fbbf24' : 'var(--text-muted, #94a3b8)'}
                fontWeight={isBest ? 'bold' : 'normal'}
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}

      {/* legend (week/month only) */}
      {!isDay && (
        <g>
          {([['revenue', COL.revenue, 'Revenue'], ['cost', COL.cost, 'Cost'], ['profit', COL.profit, 'Profit']] as const).map(([, color, lbl], li) => (
            <g key={lbl} transform={`translate(${PAD.left + li * 72}, 10)`}>
              <rect width={10} height={10} fill={color} rx={2} />
              <text x={14} y={9} fontSize={10} fill="var(--text-muted, #94a3b8)">{lbl}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
