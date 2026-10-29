// Small SVG charts drawn from the overview's daily trends. Colours come from the design.

function points(values: number[], width: number, height: number, max: number) {
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values.map((v, i) => `${(i * step).toFixed(1)},${(height - (max ? (v / max) * height : 0)).toFixed(1)}`).join(" ");
}

export function Sparkline({ values, colour }: { values: number[]; colour: string }) {
  const max = Math.max(...values, 0);
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="mt-3 h-7 w-full" aria-hidden>
      <polyline points={points(values, 100, 26, max)} fill="none" stroke={colour} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

// The axis top: the data's maximum rounded up so that quarters are round numbers (2,000 → 500 steps).
export function niceMax(value: number) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 4, 5, 8, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

// Two lines on one scale, with y labels from `formatY` and x labels from `labels`.
export function LineChart({
  series,
  labels,
  formatY,
  title,
}: {
  series: { values: number[]; colour: string }[];
  labels: string[];
  formatY: (value: number) => string;
  title: string;
}) {
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const ticks = [1, 0.75, 0.5, 0.25, 0].map((f) => f * max);
  return (
    <div className="mt-4 flex gap-3">
      <div className="flex h-[220px] flex-col justify-between pb-6 text-right text-[9px] text-text-faint" aria-hidden>
        {ticks.map((tick) => (
          <span key={tick}>{formatY(tick)}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-[194px] border-b border-l border-[#efedf4]">
          {[0.25, 0.5, 0.75].map((f) => (
            <i key={f} className="absolute inset-x-0 border-t border-dashed border-[#f0eff4]" style={{ top: `${f * 100}%` }} aria-hidden />
          ))}
          <svg viewBox="0 0 760 194" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label={title}>
            {series.map((s) => (
              <polyline key={s.colour} points={points(s.values, 760, 190, max)} fill="none" stroke={s.colour} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
            ))}
          </svg>
        </div>
        <div className="mt-2 flex justify-between text-[9px] text-text-faint" aria-hidden>
          {labels.map((label, i) => (
            <span key={`${label}-${i}`}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
