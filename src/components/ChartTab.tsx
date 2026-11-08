import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Crosshair, ChevronDown, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Candle, Position, QuoteData, Timeframe } from '../types/mt5';

interface ChartTabProps {
  symbol: string;
  quotes: Record<string, QuoteData>;
  watchlist: string[];
  timeframe: Timeframe;
  candles: Candle[];
  positions: Position[];
  onChangeSymbol: (sym: string) => void;
  onChangeTimeframe: (tf: Timeframe) => void;
  onOpenNewOrder: (sym: string) => void;
  onQuickExecuteOrder: (sym: string, type: 'buy' | 'sell', lots: number) => void;
}

const TIMEFRAMES: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

export const ChartTab: React.FC<ChartTabProps> = ({
  symbol,
  quotes,
  watchlist,
  timeframe,
  candles,
  positions,
  onChangeSymbol,
  onChangeTimeframe,
  onOpenNewOrder,
  onQuickExecuteOrder,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [crosshairActive, setCrosshairActive] = useState(false);
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number } | null>(null);
  const [showMA, setShowMA] = useState(true);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [showOneClickBar, setShowOneClickBar] = useState(false);
  const [quickLots, setQuickLots] = useState('0.10');

  // Pan and zoom state:
  // candleStep = width + gap per candle in CSS pixels
  // scrollOffset = how many candles scrolled back from the right edge
  const [candleStep, setCandleStep] = useState(9);
  const [scrollOffset, setScrollOffset] = useState(0);

  const dragStateRef = useRef<{
    isDragging: boolean;
    startX: number;
    startOffset: number;
    pinchStartDist: number | null;
    startCandleStep: number;
  }>({
    isDragging: false,
    startX: 0,
    startOffset: 0,
    pinchStartDist: null,
    startCandleStep: 9,
  });

  const currentQuote = quotes[symbol];
  const digits = currentQuote?.digits ?? 2;

  const formatChartDate = (unixSec: number): string => {
    const d = new Date(unixSec * 1000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = d.getDate();
    const mon = months[d.getMonth()];
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${mon} ${h}:${m}`;
  };

  // Compute Simple Moving Average (SMA 20) and Exponential Moving Average (EMA 50)
  const computeSMA = useCallback((data: Candle[], period: number): (number | null)[] => {
    const res: (number | null)[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i].close;
      if (i >= period) {
        sum -= data[i - period].close;
      }
      if (i >= period - 1) {
        res.push(sum / period);
      } else {
        res.push(null);
      }
    }
    return res;
  }, []);

  const computeEMA = useCallback((data: Candle[], period: number): (number | null)[] => {
    const res: (number | null)[] = [];
    const k = 2 / (period + 1);
    let ema: number | null = null;
    for (let i = 0; i < data.length; i++) {
      const c = data[i].close;
      if (ema === null) {
        ema = c;
      } else {
        ema = c * k + ema * (1 - k);
      }
      res.push(i >= Math.min(10, period - 1) ? ema : null);
    }
    return res;
  }, []);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || candles.length === 0) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = rect.width;
    const height = rect.height;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Layout constants matching MT5 iOS Screenshot 6
    const priceAxisWidth = 66;
    const timeAxisHeight = 26;
    const chartWidth = width - priceAxisWidth;
    const chartHeight = height - timeAxisHeight;
    const rightPaddingCandles = 4; // Empty breathing space to the right of the live candle

    // Background
    ctx.fillStyle = '#0D1117';
    ctx.fillRect(0, 0, width, height);

    // Determine visible candle slice
    const maxVisibleCandles = Math.max(10, Math.floor(chartWidth / candleStep));
    const endIdx = Math.max(
      10,
      Math.min(candles.length, candles.length - Math.floor(scrollOffset))
    );
    const startIdx = Math.max(0, endIdx - maxVisibleCandles + rightPaddingCandles);
    const visibleCandles = candles.slice(startIdx, endIdx);

    if (visibleCandles.length === 0) return;

    // Compute min/max price in visible window
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const c of visibleCandles) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    }

    // Also include active symbol's open positions / SL / TP if close to range
    const symbolPositions = positions.filter((p) => p.symbol === symbol);
    for (const p of symbolPositions) {
      if (Math.abs(p.openPrice - minPrice) < (maxPrice - minPrice) * 1.5) {
        minPrice = Math.min(minPrice, p.openPrice);
        maxPrice = Math.max(maxPrice, p.openPrice);
      }
    }

    const rawRange = Math.max(maxPrice - minPrice, (currentQuote?.point ?? 0.01) * 20);
    const pad = rawRange * 0.14;
    const lowBound = minPrice - pad;
    const highBound = maxPrice + pad;
    const priceSpan = highBound - lowBound;

    const priceToY = (p: number) =>
      chartHeight - ((p - lowBound) / priceSpan) * chartHeight;
    const yToPrice = (y: number) =>
      lowBound + ((chartHeight - y) / chartHeight) * priceSpan;

    // 1. Draw Horizontal & Vertical Dashed Grid Lines
    ctx.strokeStyle = '#1E242C';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    const horizontalSteps = 10;
    for (let i = 1; i < horizontalSteps; i++) {
      const y = Math.round((chartHeight / horizontalSteps) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      // Right axis price labels
      const pVal = yToPrice(y);
      ctx.fillStyle = '#8B949E';
      ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(pVal.toFixed(digits), chartWidth + 6, y + 3.5);
    }

    // Vertical Grid Lines + Bottom Time Labels
    const verticalStepPx = Math.max(85, Math.floor(chartWidth / 4));
    ctx.textAlign = 'center';
    for (let x = chartWidth - candleStep * rightPaddingCandles; x > 20; x -= verticalStepPx) {
      const gx = Math.round(x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, chartHeight);
      ctx.stroke();

      // Find corresponding candle index
      const offsetFromEnd = Math.round(
        (chartWidth - candleStep * rightPaddingCandles - gx) / candleStep
      );
      const cIdx = endIdx - 1 - offsetFromEnd;
      if (cIdx >= 0 && cIdx < candles.length) {
        ctx.fillStyle = '#8B949E';
        ctx.font = '500 10.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        ctx.fillText(formatChartDate(candles[cIdx].time), gx, chartHeight + 17);
      }
    }
    ctx.setLineDash([]);

    // 2. Draw Moving Averages if enabled
    if (showMA) {
      const sma20 = computeSMA(candles, 20);
      const ema50 = computeEMA(candles, 50);

      // Draw EMA 50 (#2962FF)
      ctx.strokeStyle = '#2962FF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let startedEma = false;
      for (let i = startIdx; i < endIdx; i++) {
        const val = ema50[i];
        if (val === null) continue;
        const posFromRight = endIdx - 1 - i;
        const cx =
          chartWidth - candleStep * rightPaddingCandles - posFromRight * candleStep;
        const cy = priceToY(val);
        if (!startedEma) {
          ctx.moveTo(cx, cy);
          startedEma = true;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.stroke();

      // Draw SMA 20 (#F59E0B)
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let startedSma = false;
      for (let i = startIdx; i < endIdx; i++) {
        const val = sma20[i];
        if (val === null) continue;
        const posFromRight = endIdx - 1 - i;
        const cx =
          chartWidth - candleStep * rightPaddingCandles - posFromRight * candleStep;
        const cy = priceToY(val);
        if (!startedSma) {
          ctx.moveTo(cx, cy);
          startedSma = true;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.stroke();
    }

    // 3. Draw Candlesticks
    const bodyWidth = Math.max(2, Math.floor(candleStep * 0.68));
    for (let i = startIdx; i < endIdx; i++) {
      const c = candles[i];
      const posFromRight = endIdx - 1 - i;
      const cx = Math.round(
        chartWidth - candleStep * rightPaddingCandles - posFromRight * candleStep
      );
      if (cx < -candleStep || cx > chartWidth + candleStep) continue;

      const isBull = c.close >= c.open;
      const color = isBull ? '#089981' : '#F23645';

      const highY = Math.round(priceToY(c.high));
      const lowY = Math.round(priceToY(c.low));
      const openY = Math.round(priceToY(c.open));
      const closeY = Math.round(priceToY(c.close));

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, highY);
      ctx.lineTo(cx + 0.5, lowY);
      ctx.stroke();

      // Body
      const topY = Math.min(openY, closeY);
      const bHeight = Math.max(1.5, Math.abs(closeY - openY));
      ctx.fillStyle = color;
      ctx.fillRect(cx - Math.floor(bodyWidth / 2), topY, bodyWidth, bHeight);
    }

    // 4. Draw Open Positions lines on chart
    for (const pos of symbolPositions) {
      const py = Math.round(priceToY(pos.openPrice)) + 0.5;
      if (py >= 0 && py <= chartHeight) {
        ctx.strokeStyle = pos.type === 'buy' ? '#2962FF' : '#F23645';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(chartWidth, py);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label on left of chart
        const label = `${pos.type} ${pos.lots}`;
        ctx.fillStyle = pos.type === 'buy' ? '#2962FF' : '#F23645';
        ctx.fillRect(6, py - 9, 54, 16);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, 10, py + 2.5);
      }
    }

    // 5. Draw Axes Border Lines
    ctx.strokeStyle = '#21262D';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartWidth + 0.5, 0);
    ctx.lineTo(chartWidth + 0.5, height);
    ctx.moveTo(0, chartHeight + 0.5);
    ctx.lineTo(width, chartHeight + 0.5);
    ctx.stroke();

    // 6. Draw Live Bid & Ask Price Line + Right Axis Pill Badge (like 4070.19 in Screenshot 6)
    const liveBid = currentQuote ? currentQuote.bid : candles[candles.length - 1].close;
    const liveAsk = currentQuote ? currentQuote.ask : liveBid;
    const bidY = Math.round(priceToY(liveBid)) + 0.5;
    const askY = Math.round(priceToY(liveAsk)) + 0.5;

    if (askY >= 0 && askY <= chartHeight && Math.abs(askY - bidY) > 1.5) {
      ctx.strokeStyle = 'rgba(242, 54, 69, 0.55)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, askY);
      ctx.lineTo(chartWidth, askY);
      ctx.stroke();
    }

    if (bidY >= 0 && bidY <= chartHeight) {
      ctx.strokeStyle = '#089981';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(0, bidY);
      ctx.lineTo(chartWidth, bidY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price pill on right axis
      const badgeH = 19;
      ctx.fillStyle = '#089981';
      ctx.fillRect(chartWidth + 1, bidY - badgeH / 2, priceAxisWidth - 1, badgeH);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(liveBid.toFixed(digits), chartWidth + 5, bidY + 3.5);
    }

    // 7. Draw Crosshair Inspector if active
    if (crosshairActive && crosshairPos) {
      const cx = Math.max(0, Math.min(chartWidth, crosshairPos.x));
      const cy = Math.max(0, Math.min(chartHeight, crosshairPos.y));

      // Snap X to nearest candle
      const offsetFromRight = Math.round(
        (chartWidth - candleStep * rightPaddingCandles - cx) / candleStep
      );
      const snappedIdx = Math.max(
        startIdx,
        Math.min(endIdx - 1, endIdx - 1 - offsetFromRight)
      );
      const snappedX =
        Math.round(
          chartWidth -
            candleStep * rightPaddingCandles -
            (endIdx - 1 - snappedIdx) * candleStep
        ) + 0.5;

      ctx.strokeStyle = '#8B949E';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(snappedX, 0);
      ctx.lineTo(snappedX, chartHeight);
      ctx.moveTo(0, cy + 0.5);
      ctx.lineTo(chartWidth, cy + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Right axis crosshair price badge
      const chPrice = yToPrice(cy);
      ctx.fillStyle = '#2962FF';
      ctx.fillRect(chartWidth + 1, cy - 9.5, priceAxisWidth - 1, 19);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px -apple-system, monospace';
      ctx.textAlign = 'left';
      ctx.fillText(chPrice.toFixed(digits), chartWidth + 5, cy + 3.5);

      // Bottom axis crosshair date badge
      const inspectedCandle = candles[snappedIdx];
      if (inspectedCandle) {
        const timeStr = formatChartDate(inspectedCandle.time);
        const boxW = 92;
        const bx = Math.max(4, Math.min(chartWidth - boxW - 4, snappedX - boxW / 2));
        ctx.fillStyle = '#2962FF';
        ctx.fillRect(bx, chartHeight + 2, boxW, 20);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10.5px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(timeStr, bx + boxW / 2, chartHeight + 15.5);
      }
    }
  }, [
    candles,
    candleStep,
    scrollOffset,
    currentQuote,
    digits,
    showMA,
    crosshairActive,
    crosshairPos,
    positions,
    symbol,
    computeSMA,
    computeEMA,
  ]);

  // Determine the candle being inspected (crosshair candle or latest candle)
  const getInspectedCandle = (): Candle | null => {
    if (candles.length === 0) return null;
    if (!crosshairActive || !crosshairPos || !containerRef.current) {
      return candles[candles.length - 1];
    }
    const width = containerRef.current.clientWidth;
    const chartWidth = width - 66;
    const rightPaddingCandles = 4;
    const endIdx = Math.max(
      10,
      Math.min(candles.length, candles.length - Math.floor(scrollOffset))
    );
    const offsetFromRight = Math.round(
      (chartWidth - candleStep * rightPaddingCandles - crosshairPos.x) / candleStep
    );
    const idx = Math.max(0, Math.min(candles.length - 1, endIdx - 1 - offsetFromRight));
    return candles[idx];
  };

  const activeCandle = getInspectedCandle();

  // Touch & Mouse Handlers for smooth Pan, Pinch-Zoom, and Crosshair
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (crosshairActive) {
      const rect = e.currentTarget.getBoundingClientRect();
      setCrosshairPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      return;
    }
    dragStateRef.current.isDragging = true;
    dragStateRef.current.startX = e.clientX;
    dragStateRef.current.startOffset = scrollOffset;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (crosshairActive) {
      if (e.buttons > 0 || e.pointerType === 'touch') {
        const rect = e.currentTarget.getBoundingClientRect();
        setCrosshairPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      return;
    }
    if (!dragStateRef.current.isDragging) return;
    const dx = e.clientX - dragStateRef.current.startX;
    const deltaCandles = dx / candleStep;
    const nextOffset = Math.max(
      0,
      Math.min(candles.length - 25, dragStateRef.current.startOffset + deltaCandles)
    );
    setScrollOffset(nextOffset);
  };

  const handlePointerUp = () => {
    dragStateRef.current.isDragging = false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      dragStateRef.current.pinchStartDist = Math.hypot(dx, dy);
      dragStateRef.current.startCandleStep = candleStep;
      dragStateRef.current.isDragging = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && dragStateRef.current.pinchStartDist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / dragStateRef.current.pinchStartDist;
      const nextStep = Math.max(
        4,
        Math.min(26, Math.round(dragStateRef.current.startCandleStep * ratio))
      );
      setCandleStep(nextStep);
    }
  };

  const handleTouchEnd = () => {
    dragStateRef.current.pinchStartDist = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY < 0 ? 1 : -1;
    setCandleStep((prev) => Math.max(4, Math.min(26, prev + delta)));
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1117] text-[#E6EDF3] relative">
      {/* Top MT5 iOS Chart Header */}
      <header className="pt-safe bg-[#161B22] border-b border-[#21262D] shrink-0 z-20">
        <div className="h-11 px-2.5 flex items-center justify-between">
          {/* Left: Current Timeframe Label + Quick Cycle */}
          <button
            onClick={() => {
              const idx = TIMEFRAMES.indexOf(timeframe);
              onChangeTimeframe(TIMEFRAMES[(idx + 1) % TIMEFRAMES.length]);
            }}
            className="min-w-[44px] min-h-[38px] px-2 flex items-center justify-start text-[16px] font-bold text-[#2962FF] active:opacity-70"
          >
            {timeframe}
          </button>

          {/* Center MT5 Chart Tool Icons: Crosshair (+), Indicators (f), Zoom, One-Click */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => {
                setCrosshairActive((prev) => !prev);
                if (!crosshairActive && containerRef.current) {
                  setCrosshairPos({
                    x: containerRef.current.clientWidth * 0.45,
                    y: containerRef.current.clientHeight * 0.45,
                  });
                }
              }}
              className={`min-w-[40px] min-h-[38px] rounded-lg flex items-center justify-center transition-colors ${
                crosshairActive
                  ? 'bg-[#2962FF]/20 text-[#2962FF]'
                  : 'text-[#8B949E] hover:text-[#E6EDF3]'
              }`}
              title="Crosshair Inspector"
            >
              <Crosshair className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowMA((prev) => !prev)}
              className={`min-w-[40px] min-h-[38px] rounded-lg flex items-center justify-center font-serif italic text-[19px] font-bold transition-colors ${
                showMA
                  ? 'bg-[#2962FF]/20 text-[#2962FF]'
                  : 'text-[#8B949E] hover:text-[#E6EDF3]'
              }`}
              title="Moving Average Overlay (f)"
            >
              f
            </button>

            <button
              onClick={() => setCandleStep((p) => Math.min(26, p + 2))}
              className="min-w-[36px] min-h-[38px] rounded-lg flex items-center justify-center text-[#8B949E] active:text-[#E6EDF3]"
              title="Zoom In"
            >
              <ZoomIn className="w-[18px] h-[18px]" />
            </button>

            <button
              onClick={() => setCandleStep((p) => Math.max(4, p - 2))}
              className="min-w-[36px] min-h-[38px] rounded-lg flex items-center justify-center text-[#8B949E] active:text-[#E6EDF3]"
              title="Zoom Out"
            >
              <ZoomOut className="w-[18px] h-[18px]" />
            </button>

            {/* One-Click Trading Quick Panel Toggle */}
            <button
              onClick={() => setShowOneClickBar((prev) => !prev)}
              className={`min-w-[38px] min-h-[38px] rounded-lg flex items-center justify-center transition-colors ${
                showOneClickBar ? 'bg-[#2962FF]/20' : ''
              }`}
              title="One-Click Trading Panel"
            >
              <div className="w-5 h-4 rounded-xs overflow-hidden flex border border-[#8B949E]/40">
                <div className="w-1/2 h-full bg-[#F23645]" />
                <div className="w-1/2 h-full bg-[#2962FF]" />
              </div>
            </button>
          </div>

          {/* Right: Quick "Trade" Button matching MT5 iOS */}
          <button
            onClick={() => onOpenNewOrder(symbol)}
            className="min-h-[34px] px-2.5 rounded-lg bg-[#2962FF]/15 border border-[#2962FF]/40 flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            <div className="w-4 h-3.5 rounded-[2px] overflow-hidden flex relative items-center justify-center">
              <div className="w-1/2 h-full bg-[#F23645]" />
              <div className="w-1/2 h-full bg-[#2962FF]" />
              <span className="absolute text-[9px] font-bold text-white leading-none">
                +
              </span>
            </div>
            <span className="text-[13px] font-semibold text-[#2962FF]">Trade</span>
          </button>
        </div>

        {/* Dedicated Timeframe Bar (M1, M5, M15, M30, H1, H4, D1) */}
        <div className="px-2 py-1 bg-[#0D1117] border-t border-[#21262D] grid grid-cols-7 gap-1">
          {TIMEFRAMES.map((tf) => {
            const active = tf === timeframe;
            return (
              <button
                key={tf}
                onClick={() => {
                  onChangeTimeframe(tf);
                  setScrollOffset(0);
                }}
                className={`h-7 rounded text-[12px] font-semibold transition-colors ${
                  active
                    ? 'bg-[#2962FF] text-white'
                    : 'text-[#8B949E] hover:text-[#E6EDF3] active:bg-[#161B22]'
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>
      </header>

      {/* Interactive Chart Viewport */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className="flex-1 relative overflow-hidden touch-none select-none"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Top-Left MT5 Symbol, Description & Live OHLC Overlay (Screenshot 6) */}
        <div className="absolute top-2.5 left-3 z-10 pointer-events-auto">
          <button
            onClick={() => setShowSymbolDropdown((prev) => !prev)}
            className="flex items-center gap-1 text-[14px] font-bold text-[#E6EDF3] active:opacity-75"
          >
            <span>{symbol}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8B949E]" />
            <span className="text-[#8B949E] font-medium ml-0.5">{timeframe}</span>
          </button>

          <div className="text-[11.5px] text-[#8B949E] leading-tight pointer-events-none">
            {currentQuote?.description || symbol}
          </div>

          {activeCandle && (
            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[#8B949E] mt-1 font-mono pointer-events-none">
              <span>O: {activeCandle.open.toFixed(digits)}</span>
              <span>H: {activeCandle.high.toFixed(digits)}</span>
              <span>L: {activeCandle.low.toFixed(digits)}</span>
              <span
                className={
                  activeCandle.close >= activeCandle.open
                    ? 'text-[#089981] font-semibold'
                    : 'text-[#F23645] font-semibold'
                }
              >
                C: {activeCandle.close.toFixed(digits)}
              </span>
            </div>
          )}

          {showMA && (
            <div className="flex items-center gap-2.5 text-[10.5px] mt-0.5 pointer-events-none">
              <span className="text-[#F59E0B] font-medium">SMA(20)</span>
              <span className="text-[#2962FF] font-medium">EMA(50)</span>
            </div>
          )}
        </div>

        {/* Symbol Switcher Dropdown Menu */}
        {showSymbolDropdown && (
          <div
            className="absolute top-10 left-3 z-30 w-52 bg-[#161B22] border border-[#21262D] rounded-xl shadow-2xl overflow-hidden divide-y divide-[#21262D]"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {watchlist.map((sym) => {
              const q = quotes[sym];
              return (
                <button
                  key={sym}
                  onClick={() => {
                    onChangeSymbol(sym);
                    setShowSymbolDropdown(false);
                    setScrollOffset(0);
                  }}
                  className={`w-full px-3 py-2.5 flex items-center justify-between text-left active:bg-[#21262D] ${
                    sym === symbol ? 'bg-[#2962FF]/15 text-[#2962FF]' : 'text-[#E6EDF3]'
                  }`}
                >
                  <div>
                    <div className="text-[13px] font-bold">{sym}</div>
                    <div className="text-[10px] text-[#8B949E] truncate max-w-[110px]">
                      {q?.description}
                    </div>
                  </div>
                  {q && (
                    <span className="text-[12px] font-mono font-semibold">
                      {q.bid.toFixed(q.digits)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Optional One-Click Trading Floating Bar at Top of Chart */}
        {showOneClickBar && currentQuote && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-2 right-[72px] z-20 flex items-center bg-[#161B22]/95 border border-[#21262D] rounded-lg overflow-hidden shadow-lg"
          >
            <button
              onClick={() =>
                onQuickExecuteOrder(
                  symbol,
                  'sell',
                  Math.max(0.01, parseFloat(quickLots) || 0.1)
                )
              }
              className="px-2.5 py-1.5 bg-[#F23645] text-white text-left active:opacity-80"
            >
              <div className="text-[9px] font-semibold uppercase leading-none opacity-90">
                SELL
              </div>
              <div className="text-[12px] font-bold leading-tight mt-0.5">
                {currentQuote.bid.toFixed(digits)}
              </div>
            </button>

            <input
              type="number"
              step="0.01"
              min="0.01"
              value={quickLots}
              onChange={(e) => setQuickLots(e.target.value)}
              className="w-14 text-center bg-[#0D1117] text-[12px] font-bold text-[#E6EDF3] py-2 focus:outline-none"
            />

            <button
              onClick={() =>
                onQuickExecuteOrder(
                  symbol,
                  'buy',
                  Math.max(0.01, parseFloat(quickLots) || 0.1)
                )
              }
              className="px-2.5 py-1.5 bg-[#2962FF] text-white text-right active:opacity-80"
            >
              <div className="text-[9px] font-semibold uppercase leading-none opacity-90">
                BUY
              </div>
              <div className="text-[12px] font-bold leading-tight mt-0.5">
                {currentQuote.ask.toFixed(digits)}
              </div>
            </button>
          </div>
        )}

        {/* Reset Scroll to Latest Candle Button when scrolled back */}
        {scrollOffset > 2 && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setScrollOffset(0)}
            className="absolute bottom-9 right-[76px] z-20 px-2.5 py-1.5 rounded-full bg-[#161B22]/90 border border-[#21262D] text-[11px] font-medium text-[#2962FF] flex items-center gap-1 shadow-md active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Latest</span>
          </button>
        )}
      </div>
    </div>
  );
};
