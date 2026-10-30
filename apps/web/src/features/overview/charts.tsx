// Small SVG charts drawn from the overview's daily trends. Colours come from the design.

// The design's KPI mini chart: the last 7 days as bars. They are scaled between the week's lowest
// (20%) and highest (100%) value, so small day-to-day changes stay visible.
export function MiniBars({ values, colour }: { values: number[]; colour: string }) {
  const last = values.slice(-7);
  const max = Math.max(...last, 0);
  const min = Math.min(...last, max);
  const height = (v: number) => (max === min ? (max ? 60 : 8) : 20 + ((v - min) / (max - min)) * 80);
  return (
    <span className="absolute right-[18px] bottom-[17px] flex h-[38px] w-[72px] items-end gap-[5px]" aria-hidden>
      {last.map((v, i) => (
        <i key={i} className="w-[7px] rounded-t" style={{ height: `${height(v)}%`, background: colour }} />
      ))}
    </span>
  );
}

// A smooth line through the points that never overshoots them (monotone cubic, Fritsch–Carlson),
// so a sharp drop in the data does not dip below the real values.
export function smoothPath(values: number[], width: number, height: number, max: number) {
  if (values.length === 0) return "";
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const y = values.map((v) => height - (max ? (v / max) * height : 0));
  const n = y.length;
  if (n === 1) return `M0,${y[0].toFixed(1)}`;
  const slope = Array.from({ length: n - 1 }, (_, i) => (y[i + 1] - y[i]) / step);
  const tangent = y.map((_, i) => {
    if (i === 0) return slope[0];
    if (i === n - 1) return slope[n - 2];
    return slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  });
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      tangent[i] = k * a * slope[i];
      tangent[i + 1] = k * b * slope[i];
    }
  }
  let d = `M0,${y[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const x0 = i * step;
    const x1 = x0 + step;
    d += ` C${(x0 + step / 3).toFixed(1)},${(y[i] + (tangent[i] * step) / 3).toFixed(1)} ${(x1 - step / 3).toFixed(1)},${(y[i + 1] - (tangent[i + 1] * step) / 3).toFixed(1)} ${x1.toFixed(1)},${y[i + 1].toFixed(1)}`;
  }
  return d;
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
    <div className="flex h-[230px] gap-[11px]">
      <div className="flex w-[34px] flex-col justify-between pt-0.5 pb-[25px] text-[9px] text-[#a1a2ae]" aria-hidden>
        {ticks.map((tick) => (
          <span key={tick}>{formatY(tick)}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative h-[205px]">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <i key={f} className="absolute inset-x-0 border-t border-[#efeff4]" style={{ top: `${f * 100}%` }} aria-hidden />
          ))}
          <svg viewBox="0 0 760 205" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" role="img" aria-label={title}>
            {series.map((s) => (
              <path key={s.colour} d={smoothPath(s.values, 760, 205, max)} fill="none" stroke={s.colour} strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        </div>
        <div className="mt-2.5 flex justify-between text-[9px] text-[#a1a2ae]" aria-hidden>
          {labels.map((label, i) => (
            <span key={`${label}-${i}`}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
