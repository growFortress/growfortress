import { useMemo } from 'preact/hooks';

interface DataPoint {
  timestamp: string | number | Date;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  color?: string;
  height?: number;
}

export function LineChart({ data, color = '#6366f1', height = 150 }: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }} class="flex items-center justify-center text-gray-500 text-sm italic">
        No data available
      </div>
    );
  }

  const { points, minVal, maxVal, width } = useMemo(() => {
    const values = data.map(d => d.value);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 10);
    const range = maxVal - minVal;
    
    const w = 1000; // Virtual width
    const h = height;
    
    const stepX = w / (data.length - 1 || 1);
    
    const points = data.map((d, i) => {
      const x = i * stepX;
      const y = h - ((d.value - minVal) / (range || 1)) * h;
      return `${x},${y}`;
    }).join(' ');

    return { points, minVal, maxVal, width: w };
  }, [data, height]);

  return (
    <div class="relative w-full">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
      >
        {/* Gradient Fill */}
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color={color} stop-opacity="0.2" />
            <stop offset="100%" stop-color={color} stop-opacity="0" />
          </linearGradient>
        </defs>

        {/* Area */}
        <path
          d={`M 0,${height} L ${points} L ${width},${height} Z`}
          fill="url(#chartGradient)"
        />

        {/* Line */}
        <polyline
          fill="none"
          stroke={color}
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          points={points}
        />
      </svg>
      
      {/* Min/Max Labels */}
      <div class="absolute top-0 right-0 text-[10px] text-gray-500">{maxVal}</div>
      <div class="absolute bottom-0 right-0 text-[10px] text-gray-500">{minVal}</div>
    </div>
  );
}
