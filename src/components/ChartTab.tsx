import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Candle, ClosedDeal, Position, QuoteData, Timeframe } from '../types/mt5';
import {
  ALL_SYMBOL_CONFIGS,
  calculateClosedDealProfit,
  calculatePositionPL,
  splitMT5Price,
} from '../utils/mt5Formatters';
import { SriLankaMarketHours } from '../services/marketDataFeed';

interface ChartTabProps {
  symbol: string;
  quotes: Record<string, QuoteData>;
  watchlist: string[];
  timeframe: Timeframe;
  candles: Candle[];
  positions: Position[];
  closedDeals?: ClosedDeal[];
  onChangeSymbol: (sym: string) => void;
  onChangeTimeframe: (tf: Timeframe) => void;
  onOpenNewOrder: (sym: string) => void;
  onQuickExecuteOrder: (sym: string, type: 'buy' | 'sell', lots: number) => void;
  onUpdatePosition?: (pos: Position) => void;
  onUpdateHistoryDeal?: (deal: ClosedDeal) => void;
  onExtendHistory?: (sym: string, tf: Timeframe) => void;
}

const TIMEFRAMES: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'];

// Exact top 12 symbols shown in the user's MT5 iOS Chart Symbol Dropdown screenshot
const SCREENSHOT_DROPDOWN_ORDER = [
  'AUDCAD',
  'AUDCHF',
  'AUDJPY',
  'AUDNZD',
  'AUDUSD',
  'BTCUSD',
  'CADCHF',
  'CADJPY',
  'CHFJPY',
  'EURAUD',
  'EURCAD',
  'NAS100',
];

// Exact MT5 iOS Chart Color Constants matching the user's screenshots
const CHART_BULL_TEAL = '#26A69A';
const CHART_BEAR_RED = '#EF5350';
const CHART_TRADE_BLUE = '#0070E0';
const CHART_TRADE_DASH_BLUE = '#4A90E2';
const CHART_TRADE_LOSS_RED = '#E53935';
const CHART_BUY_ARROW_FILL = '#0070E0';
const CHART_SELL_ARROW_FILL = '#E53935';
const CHART_GRID_LIGHT = '#EBEBEB';

interface RenderedHistoryDeal {
  deal: ClosedDeal;
  openIdx: number;
  closeIdx: number;
  openX: number;
  openY: number;
  closeX: number;
  closeY: number;
}

interface RenderedRunningPosition {
  pos: Position;
  entryCandleIdx: number;
  entryMarkerX: number;
  entryY: number;
  prefixEndX: number;
}

export const ChartTab: React.FC<ChartTabProps> = ({
  symbol,
  quotes,
  watchlist,
  timeframe,
  candles,
  positions,
  closedDeals = [],
  onChangeSymbol,
  onChangeTimeframe,
  onOpenNewOrder,
  onQuickExecuteOrder,
  onUpdatePosition,
  onUpdateHistoryDeal,
  onExtendHistory,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [crosshairActive, setCrosshairActive] = useState(false);
  const [crosshairPos, setCrosshairPos] = useState<{ x: number; y: number } | null>(null);
  const [showMA, setShowMA] = useState(false);
  const [showTimeframeBar, setShowTimeframeBar] = useState(false);
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  // Default true so the bottom SELL / Lot / BUY bar is visible like in the user's screenshots
  const [showOneClickBar, setShowOneClickBar] = useState(true);
  const [quickLots, setQuickLots] = useState('0.01');

  // Interactive History Trade Move Mode (activated via long-press on a history trade's open/close arrow or line)
  const [editingDealState, setEditingDealState] = useState<{
    dealId: string;
    activeHandle: 'open' | 'close';
  } | null>(null);

  // Interactive Running Trade Move Mode (activated via long-press on a running trade's open arrow or line)
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);

  const [candleStep, setCandleStep] = useState(6.5);
  // Continuous floating-point candle scroll offset (0 = latest candle at right margin)
  const [scrollOffset, setScrollOffset] = useState(0);
  const [priceScale, setPriceScale] = useState(1.0);

  const scrollOffsetRef = useRef(0);
  const candleStepRef = useRef(6.5);
  const extendingRef = useRef(false);
  const inertiaRafRef = useRef<number | null>(null);
  const smoothedBoundsRef = useRef<{ low: number; high: number; key: string } | null>(null);
  const lockedDealBoundsRef = useRef<{ low: number; high: number } | null>(null);
  const renderedDealsRef = useRef<RenderedHistoryDeal[]>([]);
  const renderedPositionsRef = useRef<RenderedRunningPosition[]>([]);
  const chartGeometryRef = useRef<{
    chartWidth: number;
    chartHeight: number;
    rightMarginPx: number;
    lastIdx: number;
    lowBound: number;
    highBound: number;
    priceSpan: number;
  } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearLongPressTimer();
  }, [clearLongPressTimer]);

  useEffect(() => {
    scrollOffsetRef.current = scrollOffset;
  }, [scrollOffset]);

  useEffect(() => {
    candleStepRef.current = candleStep;
  }, [candleStep]);

  // Reset smoothed Y-axis bounds and editing deal/position when symbol or timeframe changes
  useEffect(() => {
    smoothedBoundsRef.current = null;
    lockedDealBoundsRef.current = null;
    extendingRef.current = false;
    setEditingDealState(null);
    setEditingPositionId(null);
  }, [symbol, timeframe]);

  // Release extension lock when candles length grows
  useEffect(() => {
    extendingRef.current = false;
  }, [candles.length]);

  const stopInertia = useCallback(() => {
    if (inertiaRafRef.current !== null) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopInertia();
  }, [stopInertia]);

  const dragStateRef = useRef<{
    mode: 'none' | 'pan' | 'scale' | 'pinch' | 'move-deal' | 'move-position';
    startX: number;
    startY: number;
    lastX: number;
    lastMoveTime: number;
    velocityCandlesPerMs: number;
    startOffset: number;
    startPriceScale: number;
    pinchStartDist: number;
    pinchStartStep: number;
    dealId?: string;
    dealEndpoint?: 'open' | 'close';
    positionId?: string;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    lastX: 0,
    lastMoveTime: 0,
    velocityCandlesPerMs: 0,
    startOffset: 0,
    startPriceScale: 1.0,
    pinchStartDist: 0,
    pinchStartStep: 6.5,
  });

  const currentQuote = quotes[symbol];
  const digits = currentQuote?.digits ?? 2;
  const isMarketOpen = SriLankaMarketHours.isMarketOpen();

  const formatChartDate = (unixSec: number): string => {
    const p = SriLankaMarketHours.getSriLankaDateParts(unixSec * 1000);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = p.day;
    const mon = months[p.month];
    const h = String(p.hour).padStart(2, '0');
    const m = String(p.minute).padStart(2, '0');
    return `${day} ${mon} ${h}:${m}`;
  };

  const formatMt5CandleTime = useCallback((unixSec: number, secPart: number): string => {
    const p = SriLankaMarketHours.getSriLankaDateParts(unixSec * 1000);
    const yyyy = p.year;
    const mm = String(p.month + 1).padStart(2, '0');
    const dd = String(p.day).padStart(2, '0');
    const hh = String(p.hour).padStart(2, '0');
    const mi = String(p.minute).padStart(2, '0');
    const ss = String(secPart).padStart(2, '0');
    return `${yyyy}.${mm}.${dd} ${hh}:${mi}:${ss}`;
  }, []);

  const parseMt5TimeCandidatesSec = (
    str: string
  ): { sltSec: number; localSec: number } | null => {
    const clean = str.split('|')[0]?.trim();
    if (!clean) return null;
    const m = clean.match(/^(\d{4})[.-](\d{2})[.-](\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const day = parseInt(m[3], 10);
    const hour = parseInt(m[4], 10);
    const min = parseInt(m[5], 10);
    const sec = parseInt(m[6] || '0', 10);

    // Sri Lanka Time (UTC+05:30) inverse of SriLankaMarketHours.getSriLankaDateParts
    const sltOffsetMs = (5 * 60 + 30) * 60 * 1000;
    const sltMs = Date.UTC(year, month, day, hour, min, sec) - sltOffsetMs;
    const localMs = new Date(year, month, day, hour, min, sec).getTime();

    return {
      sltSec: Math.floor(sltMs / 1000),
      localSec: Math.floor(localMs / 1000),
    };
  };

  const computeSMA = useCallback((data: Candle[], period: number): (number | null)[] => {
    const res: (number | null)[] = [];
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i].close;
      if (i >= period) sum -= data[i - period].close;
      res.push(i >= period - 1 ? sum / period : null);
    }
    return res;
  }, []);

  // Automatically extend older history before user ever reaches the left edge
  useEffect(() => {
    if (!onExtendHistory || candles.length === 0) return;
    const container = containerRef.current;
    const chartWidth = (container?.clientWidth ?? 380) - 62;
    const rightMarginPx = chartWidth * 0.34;
    const lastIdx = candles.length - 1;
    const firstVisibleIdx = Math.floor(
      lastIdx - scrollOffset - (chartWidth - rightMarginPx) / candleStep
    );
    if (firstVisibleIdx < 160 && !extendingRef.current) {
      extendingRef.current = true;
      onExtendHistory(symbol, timeframe);
    }
  }, [scrollOffset, candleStep, candles.length, symbol, timeframe, onExtendHistory]);

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

    const priceAxisWidth = 62;
    const timeAxisHeight = 24;
    const chartWidth = width - priceAxisWidth;
    const chartHeight = height - timeAxisHeight;

    // Right margin space when viewing the latest candle (scrollOffset === 0)
    const rightMarginPx = chartWidth * 0.34;
    const lastIdx = candles.length - 1;

    // Continuous sub-pixel X coordinate for any candle index i
    const indexToX = (i: number): number =>
      chartWidth - rightMarginPx - (lastIdx - i - scrollOffset) * candleStep;

    const xToIndexFloat = (x: number): number =>
      lastIdx - scrollOffset - (chartWidth - rightMarginPx - x) / candleStep;

    // Pure White Canvas Background (#FFFFFF)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Lock liveBid to the forming candle's regime so the price line and forming candle are 100% unified
    const lastCandle = candles[lastIdx];
    const liveBid =
      currentQuote &&
      Math.abs(currentQuote.bid - lastCandle.close) <= lastCandle.close * 0.012
        ? currentQuote.bid
        : lastCandle.close;
    const spreadOffset = currentQuote
      ? currentQuote.defaultSpreadPts * currentQuote.point
      : 0;
    const liveAsk = Number((liveBid + spreadOffset).toFixed(digits));

    // Determine visible candle range [startIdx, endIdx]
    const rawFirstIdx = Math.floor(xToIndexFloat(-candleStep * 2));
    const rawLastIdx = Math.ceil(xToIndexFloat(chartWidth + candleStep * 2));
    const startIdx = Math.max(0, Math.min(lastIdx, rawFirstIdx));
    const endIdx = Math.max(startIdx + 1, Math.min(candles.length, rawLastIdx + 1));

    const stepSec =
      candles.length >= 2 ? Math.max(60, candles[1].time - candles[0].time) : 60;

    // Helper: Find best matching candle index across the entire loaded candle series
    const matchCandleIndex = (
      timeStr: string
    ): { idx: number; minDiff: number } | null => {
      const cands = parseMt5TimeCandidatesSec(timeStr);
      if (!cands) return null;
      let bestIdx = -1;
      let minDiff = Infinity;
      for (let i = 0; i < candles.length; i++) {
        const dSlt = Math.abs(candles[i].time - cands.sltSec);
        const dLocal = Math.abs(candles[i].time - cands.localSec);
        const d = Math.min(dSlt, dLocal);
        if (d < minDiff) {
          minDiff = d;
          bestIdx = i;
        }
      }
      if (bestIdx === -1) return null;
      return { idx: bestIdx, minDiff };
    };

    // Pre-resolve historical deals for the current symbol
    const symbolDeals = closedDeals.filter(
      (d) =>
        d.symbol === symbol &&
        d.type !== 'balance' &&
        d.openPrice > 0 &&
        d.closePrice > 0
    );

    const resolvedHistoryDeals: {
      deal: ClosedDeal;
      openIdx: number;
      closeIdx: number;
    }[] = [];

    for (const deal of symbolDeals) {
      const openMatch = matchCandleIndex(deal.openTime);
      const closeMatch = matchCandleIndex(deal.closeTime);
      if (!openMatch || !closeMatch) continue;
      // Only plot deals whose timestamps belong to the loaded chart history window
      const maxToleranceSec = Math.max(stepSec * 180, 12 * 3600);
      if (openMatch.minDiff > maxToleranceSec && closeMatch.minDiff > maxToleranceSec) {
        continue;
      }
      let openIdx = openMatch.idx;
      const closeIdx = closeMatch.idx;
      if (openIdx === closeIdx && openIdx > 0 && deal.openTime === deal.closeTime) {
        openIdx = Math.max(0, closeIdx - 1);
      }
      resolvedHistoryDeals.push({ deal, openIdx, closeIdx });
    }

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (let i = startIdx; i < endIdx; i++) {
      const c = candles[i];
      const cClose = i === lastIdx ? liveBid : c.close;
      const cHigh = i === lastIdx ? Math.max(c.high, c.open, cClose) : c.high;
      const cLow = i === lastIdx ? Math.min(c.low, c.open, cClose) : c.low;
      if (cLow < minPrice) minPrice = cLow;
      if (cHigh > maxPrice) maxPrice = cHigh;
    }

    if (endIdx > lastIdx) {
      minPrice = Math.min(minPrice, liveBid);
      maxPrice = Math.max(maxPrice, liveAsk);
    }

    if (!isFinite(minPrice) || !isFinite(maxPrice)) {
      minPrice = Math.min(lastCandle.low, liveBid);
      maxPrice = Math.max(lastCandle.high, liveAsk);
    }

    const symbolPositions = positions.filter((p) => p.symbol === symbol);
    if (scrollOffset < 30) {
      for (const pos of symbolPositions) {
        if (pos.openPrice > 0) {
          minPrice = Math.min(minPrice, pos.openPrice);
          maxPrice = Math.max(maxPrice, pos.openPrice);
        }
        if (pos.sl && pos.sl > 0) {
          minPrice = Math.min(minPrice, pos.sl);
          maxPrice = Math.max(maxPrice, pos.sl);
        }
        if (pos.tp && pos.tp > 0) {
          minPrice = Math.min(minPrice, pos.tp);
          maxPrice = Math.max(maxPrice, pos.tp);
        }
      }
    }

    // Include visible history deals in Y-axis bounds so their open/close arrows & dashed connector are never clipped
    for (const item of resolvedHistoryDeals) {
      const minIdx = Math.min(item.openIdx, item.closeIdx);
      const maxIdx = Math.max(item.openIdx, item.closeIdx);
      if (maxIdx >= startIdx && minIdx <= endIdx) {
        minPrice = Math.min(minPrice, item.deal.openPrice, item.deal.closePrice);
        maxPrice = Math.max(maxPrice, item.deal.openPrice, item.deal.closePrice);
      }
    }

    const rawRange = Math.max(maxPrice - minPrice, (currentQuote?.point ?? 0.01) * 20);
    const midPrice = (minPrice + maxPrice) / 2;
    const halfSpan = ((rawRange * 1.48) / 2) / Math.max(0.25, Math.min(5.0, priceScale));
    const targetLow = midPrice - halfSpan;
    const targetHigh = midPrice + halfSpan;

    // Smooth vertical Y-axis bounds during active panning/inertia, or freeze during history deal move
    const seriesKey = `${symbol}_${timeframe}`;
    let lowBound = targetLow;
    let highBound = targetHigh;
    const isActivelyPanning =
      dragStateRef.current.mode === 'pan' || inertiaRafRef.current !== null;
    if (
      (dragStateRef.current.mode === 'move-deal' ||
        dragStateRef.current.mode === 'move-position') &&
      lockedDealBoundsRef.current
    ) {
      lowBound = lockedDealBoundsRef.current.low;
      highBound = lockedDealBoundsRef.current.high;
    } else if (
      isActivelyPanning &&
      smoothedBoundsRef.current &&
      smoothedBoundsRef.current.key === seriesKey
    ) {
      lowBound = smoothedBoundsRef.current.low + (targetLow - smoothedBoundsRef.current.low) * 0.42;
      highBound =
        smoothedBoundsRef.current.high + (targetHigh - smoothedBoundsRef.current.high) * 0.42;
    }
    smoothedBoundsRef.current = { low: lowBound, high: highBound, key: seriesKey };

    const priceSpan = Math.max(highBound - lowBound, 0.00001);

    chartGeometryRef.current = {
      chartWidth,
      chartHeight,
      rightMarginPx,
      lastIdx,
      lowBound,
      highBound,
      priceSpan,
    };

    const priceToY = (p: number) =>
      chartHeight - ((p - lowBound) / priceSpan) * chartHeight;
    const yToPrice = (y: number) =>
      lowBound + ((chartHeight - y) / chartHeight) * priceSpan;

    // 1. Moving World-Anchored Grid Lines (#EBEBEB, dash [3.5, 3.5])
    ctx.strokeStyle = CHART_GRID_LIGHT;
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3.5, 3.5]);

    const baseTimeBucket = Math.round(candles[0].time / stepSec);

    const rawCandleGridStep = Math.max(3, Math.round(chartWidth / 10.5 / candleStep));
    const niceCandleSteps = [3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30];
    const gridCandleInterval =
      niceCandleSteps.find((s) => s >= rawCandleGridStep) || rawCandleGridStep;
    const labelCandleInterval = gridCandleInterval * 3;

    const firstGridIdx = Math.floor(xToIndexFloat(0)) - 1;
    const lastGridIdx = Math.ceil(xToIndexFloat(chartWidth)) + 1;

    for (let k = firstGridIdx; k <= lastGridIdx; k++) {
      const bucketNum = baseTimeBucket + k;
      const modGrid =
        ((bucketNum % gridCandleInterval) + gridCandleInterval) % gridCandleInterval;
      if (modGrid !== 0) continue;

      const gx = Math.round(indexToX(k)) + 0.5;
      if (gx < 0 || gx > chartWidth) continue;

      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, chartHeight);
      ctx.stroke();

      const modLabel =
        ((bucketNum % labelCandleInterval) + labelCandleInterval) % labelCandleInterval;
      if (modLabel === 0) {
        let labelTime: number;
        if (k >= 0 && k < candles.length) {
          labelTime = candles[k].time;
        } else if (k < 0) {
          labelTime = candles[0].time + k * stepSec;
        } else {
          labelTime = candles[lastIdx].time + (k - lastIdx) * stepSec;
        }

        if (gx >= 18 && gx <= chartWidth - 28) {
          ctx.fillStyle = '#3A3A3C';
          ctx.font =
            '500 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(formatChartDate(labelTime), gx - 20, chartHeight + 16);
        }
      }
    }

    // Price-anchored horizontal grid lines (~12-14 rows matching screenshots)
    const rawPriceStep = priceSpan / 12.5;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rawPriceStep, 1e-7))));
    const norm = rawPriceStep / mag;
    let niceMult = 1;
    if (norm >= 7.5) niceMult = 10;
    else if (norm >= 3.8) niceMult = 5;
    else if (norm >= 2.2) niceMult = 2.5;
    else if (norm >= 1.4) niceMult = 2;
    const minPointStep = (currentQuote?.point ?? 0.01) * 2;
    const priceGridStep = Math.max(minPointStep, niceMult * mag);

    const firstPriceLevel = Math.ceil(lowBound / priceGridStep) * priceGridStep;
    let safetyCount = 0;
    for (
      let pVal = firstPriceLevel;
      pVal <= highBound && safetyCount < 45;
      pVal += priceGridStep, safetyCount++
    ) {
      const y = Math.round(priceToY(pVal)) + 0.5;
      if (y < 8 || y > chartHeight - 8) continue;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();

      ctx.fillStyle = '#3A3A3C';
      ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(pVal.toFixed(digits), chartWidth + 4, y + 3.5);
    }
    ctx.setLineDash([]);

    // Clip candlesticks, MA lines, and arrows inside [0, chartWidth]
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    // 2. Optional Moving Average (f)
    if (showMA) {
      const sma20 = computeSMA(candles, 20);
      ctx.strokeStyle = '#0D62C6';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let started = false;
      for (let i = startIdx; i < endIdx; i++) {
        const val = sma20[i];
        if (val === null) continue;
        const cx = indexToX(i);
        const cy = priceToY(val);
        if (!started) {
          ctx.moveTo(cx, cy);
          started = true;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
      ctx.stroke();
    }

    // 3. Candlesticks (#26A69A Bullish Teal, #EF5350 Bearish Red)
    const bodyWidth = Math.max(2.2, candleStep * 0.68);
    const halfBody = bodyWidth / 2;

    for (let i = startIdx; i < endIdx; i++) {
      const c = candles[i];
      const cx = indexToX(i);
      if (cx < -candleStep || cx > chartWidth + candleStep) continue;

      const openVal = c.open;
      const closeVal = i === lastIdx ? liveBid : c.close;
      const highVal = i === lastIdx ? Math.max(c.high, openVal, closeVal) : c.high;
      const lowVal = i === lastIdx ? Math.min(c.low, openVal, closeVal) : c.low;

      const isBull = closeVal >= openVal;
      const color = isBull ? CHART_BULL_TEAL : CHART_BEAR_RED;

      const highY = Math.round(priceToY(highVal)) + 0.5;
      const lowY = Math.round(priceToY(lowVal)) + 0.5;
      const openY = Math.round(priceToY(openVal)) + 0.5;
      const closeY = Math.round(priceToY(closeVal)) + 0.5;

      // High-Low Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(cx, highY);
      ctx.lineTo(cx, lowY);
      ctx.stroke();

      // Open-Close Body
      ctx.fillStyle = color;
      if (isBull) {
        const topY = closeY;
        const bottomY = Math.max(closeY + 1.5, openY);
        ctx.fillRect(cx - halfBody, topY, bodyWidth, bottomY - topY);
      } else {
        const bottomY = closeY;
        const topY = Math.min(closeY - 1.5, openY);
        ctx.fillRect(cx - halfBody, topY, bodyWidth, bottomY - topY);
      }
    }

    // Helper: Draw Exact MT5 iOS Blocky Vertical Deal Arrow (Upward Blue #0070E0 for BUY Deal, Downward Red #E53935 for SELL Deal)
    // Matches both running trade entry arrows and history trade open/close arrows in user's screenshots
    const drawMt5BlockArrow = (x: number, y: number, isBuyDeal: boolean) => {
      ctx.save();
      ctx.fillStyle = isBuyDeal ? CHART_BUY_ARROW_FILL : CHART_SELL_ARROW_FILL;
      ctx.beginPath();
      if (isBuyDeal) {
        // Solid Blue Upward Arrow: top tip anchored at (x, y), body extends downward 10px
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5.5, y + 5.5);
        ctx.lineTo(x - 2.4, y + 5.5);
        ctx.lineTo(x - 2.4, y + 10);
        ctx.lineTo(x + 2.4, y + 10);
        ctx.lineTo(x + 2.4, y + 5.5);
        ctx.lineTo(x + 5.5, y + 5.5);
      } else {
        // Solid Red Downward Arrow: bottom tip anchored at (x, y), body extends upward 10px
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5.5, y - 5.5);
        ctx.lineTo(x - 2.4, y - 5.5);
        ctx.lineTo(x - 2.4, y - 10);
        ctx.lineTo(x + 2.4, y - 10);
        ctx.lineTo(x + 2.4, y - 5.5);
        ctx.lineTo(x + 5.5, y - 5.5);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    // 4. Historical Trade Deals: Diagonal Dashed Connector Line + Solid Up/Down Deal Arrows (Matches WhatsApp_Image_2026-11-08_at_10.31.55_PM)
    const nextRenderedDeals: RenderedHistoryDeal[] = [];
    for (const { deal, openIdx, closeIdx } of resolvedHistoryDeals) {
      const openX = indexToX(openIdx);
      const closeX = indexToX(closeIdx);
      const openY = priceToY(deal.openPrice);
      const closeY = priceToY(deal.closePrice);

      nextRenderedDeals.push({
        deal,
        openIdx,
        closeIdx,
        openX,
        openY,
        closeX,
        closeY,
      });

      if (
        Math.max(openX, closeX) < -candleStep * 2 ||
        Math.min(openX, closeX) > chartWidth + candleStep * 2
      ) {
        continue;
      }

      const isBuyEntry = deal.type === 'buy';
      const isEditingThis = editingDealState?.dealId === deal.id;

      // Diagonal dashed connector line between open tip and close tip
      ctx.strokeStyle = isBuyEntry ? CHART_TRADE_BLUE : CHART_TRADE_LOSS_RED;
      ctx.lineWidth = isEditingThis ? 1.5 : 1.05;
      ctx.setLineDash([3.5, 3]);
      ctx.beginPath();
      ctx.moveTo(openX, openY);
      ctx.lineTo(closeX, closeY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Selection rings when deal is in Long-Press Move Mode
      if (isEditingThis) {
        const openCenterY = isBuyEntry ? openY + 4.5 : openY - 4.5;
        const closeCenterY = !isBuyEntry ? closeY + 4.5 : closeY - 4.5;

        // Open handle ring
        ctx.save();
        ctx.fillStyle = isBuyEntry ? 'rgba(0, 112, 224, 0.16)' : 'rgba(229, 57, 53, 0.16)';
        ctx.strokeStyle = isBuyEntry ? CHART_BUY_ARROW_FILL : CHART_SELL_ARROW_FILL;
        ctx.lineWidth = editingDealState?.activeHandle === 'open' ? 1.8 : 1.1;
        ctx.beginPath();
        ctx.arc(
          openX,
          openCenterY,
          editingDealState?.activeHandle === 'open' ? 11 : 8.5,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();

        // Close handle ring
        ctx.fillStyle = !isBuyEntry ? 'rgba(0, 112, 224, 0.16)' : 'rgba(229, 57, 53, 0.16)';
        ctx.strokeStyle = !isBuyEntry ? CHART_BUY_ARROW_FILL : CHART_SELL_ARROW_FILL;
        ctx.lineWidth = editingDealState?.activeHandle === 'close' ? 1.8 : 1.1;
        ctx.beginPath();
        ctx.arc(
          closeX,
          closeCenterY,
          editingDealState?.activeHandle === 'close' ? 11 : 8.5,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Open Deal Arrow (BUY -> Blue Upward Arrow, SELL -> Red Downward Arrow)
      drawMt5BlockArrow(openX, openY, isBuyEntry);
      // Close Deal Arrow (Closing a BUY is a SELL -> Red Downward Arrow; Closing a SELL is a BUY -> Blue Upward Arrow)
      drawMt5BlockArrow(closeX, closeY, !isBuyEntry);
    }
    renderedDealsRef.current = nextRenderedDeals;

    ctx.restore(); // End chart area clip

    // 4b. Active History Deal Move Guide Line & Right Price Axis Tag
    if (editingDealState) {
      const activeRendered = nextRenderedDeals.find(
        (r) => r.deal.id === editingDealState.dealId
      );
      if (activeRendered) {
        const isOpenHandle = editingDealState.activeHandle === 'open';
        const guidePrice = isOpenHandle
          ? activeRendered.deal.openPrice
          : activeRendered.deal.closePrice;
        const guideY = Math.round(priceToY(guidePrice)) + 0.5;
        const isBlueHandle =
          (activeRendered.deal.type === 'buy' && isOpenHandle) ||
          (activeRendered.deal.type === 'sell' && !isOpenHandle);
        const guideColor = isBlueHandle ? CHART_TRADE_BLUE : CHART_TRADE_LOSS_RED;

        if (guideY >= 0 && guideY <= chartHeight) {
          ctx.save();
          ctx.strokeStyle = guideColor;
          ctx.lineWidth = 0.95;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, guideY);
          ctx.lineTo(chartWidth, guideY);
          ctx.stroke();
          ctx.setLineDash([]);

          const badgeH = 18;
          const boxX = chartWidth + 0.5;
          const boxY = Math.round(guideY - badgeH / 2) + 0.5;
          const boxW = priceAxisWidth - 1.5;

          ctx.fillStyle = guideColor;
          ctx.fillRect(boxX, boxY, boxW, badgeH);
          ctx.fillStyle = '#FFFFFF';
          ctx.font =
            '600 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(guidePrice.toFixed(digits), chartWidth + 4, guideY + 3.8);
          ctx.restore();
        }
      }
    }

    // 5. Running Open Positions: Exact MT5 iOS Line, Dual-Color Unboxed Text, Entry Arrow & Outlined White Right-Axis Price Tag
    const rightBadgeHeight = 18;
    const nextRenderedPositions: RenderedRunningPosition[] = [];
    for (const pos of symbolPositions) {
      const entryY = Math.round(priceToY(pos.openPrice)) + 0.5;
      const pl = calculatePositionPL(pos, currentQuote);

      // Find the entry candle X coordinate to draw the solid blue/red entry arrow on the line
      const openMatch = matchCandleIndex(pos.openTime);
      const entryCandleIdx = openMatch ? openMatch.idx : Math.max(0, lastIdx - 1);
      const entryMarkerX = indexToX(entryCandleIdx);
      const isEditingThisPos = editingPositionId === pos.id;

      let prefixEndX = 90;

      if (entryY >= 0 && entryY <= chartHeight) {
        // 5a. Horizontal Dashed Blue Line across the chart (dash [5, 5])
        ctx.strokeStyle = CHART_TRADE_DASH_BLUE;
        ctx.lineWidth = isEditingThisPos ? 1.5 : 0.95;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, entryY);
        ctx.lineTo(chartWidth, entryY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Selection ring around the running trade's Open arrow when in Long-Press Move Mode
        if (isEditingThisPos && entryMarkerX >= 4 && entryMarkerX <= chartWidth - 4) {
          ctx.save();
          const isBuyPos = pos.type === 'buy';
          ctx.fillStyle = isBuyPos
            ? 'rgba(0, 112, 224, 0.18)'
            : 'rgba(229, 57, 53, 0.18)';
          ctx.strokeStyle = isBuyPos ? CHART_BUY_ARROW_FILL : CHART_SELL_ARROW_FILL;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(entryMarkerX, entryY, 11.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // 5b. Entry Arrow Marker on the Entry Candle (Solid Blue Up Arrow for BUY, Red Down Arrow for SELL)
        if (entryMarkerX >= 4 && entryMarkerX <= chartWidth - 4) {
          drawMt5BlockArrow(
            entryMarkerX,
            pos.type === 'buy' ? entryY - 4.5 : entryY + 4.5,
            pos.type === 'buy'
          );
        }

        // 5c. Left Inline Unboxed Text right above the dashed line:
        // "BUY 0.01, " in #0070E0 Blue (or Red for SELL) + "-0.25 USD" in #E53935 Red when < 0 or #0070E0 Blue when >= 0
        const sidePrefix = `${pos.type === 'buy' ? 'BUY' : 'SELL'} ${pos.lots.toFixed(2)}, `;
        const plValueText = `${pl.toFixed(2)} USD`;

        ctx.font =
          '500 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        ctx.textAlign = 'left';

        const prefixColor =
          pos.type === 'buy' ? CHART_TRADE_BLUE : CHART_TRADE_LOSS_RED;
        const plColor = pl >= 0 ? CHART_TRADE_BLUE : CHART_TRADE_LOSS_RED;

        ctx.fillStyle = prefixColor;
        ctx.fillText(sidePrefix, 4, entryY - 4);

        const prefixWidth = ctx.measureText(sidePrefix).width;
        prefixEndX = 4 + prefixWidth;
        ctx.fillStyle = plColor;
        ctx.fillText(plValueText, 4 + prefixWidth, entryY - 4);

        // 5d. Right Price Axis Tag: White Box with 1px Blue Border and Blue Price Text (75912.89)
        const boxX = chartWidth + 0.5;
        const boxY = Math.round(entryY - rightBadgeHeight / 2) + 0.5;
        const boxW = priceAxisWidth - 1.5;

        ctx.fillStyle = isEditingThisPos ? CHART_TRADE_BLUE : '#FFFFFF';
        ctx.fillRect(boxX, boxY, boxW, rightBadgeHeight);
        ctx.strokeStyle = CHART_TRADE_DASH_BLUE;
        ctx.lineWidth = 1;
        ctx.strokeRect(boxX, boxY, boxW, rightBadgeHeight);

        ctx.fillStyle = isEditingThisPos ? '#FFFFFF' : CHART_TRADE_BLUE;
        ctx.font =
          '500 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(pos.openPrice.toFixed(digits), chartWidth + 4, entryY + 3.8);
      }

      nextRenderedPositions.push({
        pos,
        entryCandleIdx,
        entryMarkerX,
        entryY,
        prefixEndX,
      });

      // Stop Loss (SL) line & inline label
      if (pos.sl && pos.sl > 0) {
        const slY = Math.round(priceToY(pos.sl)) + 0.5;
        if (slY >= 0 && slY <= chartHeight) {
          ctx.strokeStyle = CHART_TRADE_LOSS_RED;
          ctx.lineWidth = 0.95;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(0, slY);
          ctx.lineTo(chartWidth, slY);
          ctx.stroke();
          ctx.setLineDash([]);

          const slDiff =
            pos.type === 'buy' ? pos.sl - pos.openPrice : pos.openPrice - pos.sl;
          const slUsd = slDiff * pos.lots * (currentQuote?.contractSize ?? 100);
          const slPrefix = 'SL, ';
          const slPlText = `${slUsd.toFixed(2)} USD`;

          ctx.font =
            '500 12.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillStyle = CHART_TRADE_LOSS_RED;
          ctx.fillText(slPrefix + slPlText, 4, slY - 4);

          const boxX = chartWidth + 0.5;
          const boxY = Math.round(slY - rightBadgeHeight / 2) + 0.5;
          const boxW = priceAxisWidth - 1.5;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(boxX, boxY, boxW, rightBadgeHeight);
          ctx.strokeStyle = CHART_TRADE_LOSS_RED;
          ctx.lineWidth = 1;
          ctx.strokeRect(boxX, boxY, boxW, rightBadgeHeight);
          ctx.fillStyle = CHART_TRADE_LOSS_RED;
          ctx.font =
            '500 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          ctx.fillText(pos.sl.toFixed(digits), chartWidth + 4, slY + 3.8);
        }
      }

      // Take Profit (TP) line & inline label
      if (pos.tp && pos.tp > 0) {
        const tpY = Math.round(priceToY(pos.tp)) + 0.5;
        if (tpY >= 0 && tpY <= chartHeight) {
          ctx.strokeStyle = CHART_TRADE_DASH_BLUE;
          ctx.lineWidth = 0.95;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(0, tpY);
          ctx.lineTo(chartWidth, tpY);
          ctx.stroke();
          ctx.setLineDash([]);

          const tpDiff =
            pos.type === 'buy' ? pos.tp - pos.openPrice : pos.openPrice - pos.tp;
          const tpUsd = tpDiff * pos.lots * (currentQuote?.contractSize ?? 100);
          const tpPrefix = 'TP, ';
          const tpPlText = `${tpUsd.toFixed(2)} USD`;

          ctx.font =
            '500 12.5px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillStyle = CHART_TRADE_BLUE;
          ctx.fillText(tpPrefix + tpPlText, 4, tpY - 4);

          const boxX = chartWidth + 0.5;
          const boxY = Math.round(tpY - rightBadgeHeight / 2) + 0.5;
          const boxW = priceAxisWidth - 1.5;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(boxX, boxY, boxW, rightBadgeHeight);
          ctx.strokeStyle = CHART_TRADE_DASH_BLUE;
          ctx.lineWidth = 1;
          ctx.strokeRect(boxX, boxY, boxW, rightBadgeHeight);
          ctx.fillStyle = CHART_TRADE_BLUE;
          ctx.font =
            '500 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          ctx.fillText(pos.tp.toFixed(digits), chartWidth + 4, tpY + 3.8);
        }
      }
    }
    renderedPositionsRef.current = nextRenderedPositions;

    // 6. Axes Hairline Borders
    ctx.strokeStyle = '#D1D1D6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartWidth + 0.5, 0);
    ctx.lineTo(chartWidth + 0.5, chartHeight);
    ctx.moveTo(0, chartHeight + 0.5);
    ctx.lineTo(width, chartHeight + 0.5);
    ctx.stroke();

    // 7. Live Bid Price Line (Fine Dotted/Dashed #26A69A) + Solid #26A69A Right Axis Tag (Matches Screenshots)
    const bidY = Math.round(priceToY(liveBid)) + 0.5;

    if (bidY >= 0 && bidY <= chartHeight) {
      ctx.strokeStyle = CHART_BULL_TEAL;
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2.2, 2.2]);
      ctx.beginPath();
      ctx.moveTo(0, bidY);
      ctx.lineTo(chartWidth, bidY);
      ctx.stroke();
      ctx.setLineDash([]);

      const badgeH = 18;
      ctx.fillStyle = CHART_BULL_TEAL;
      ctx.fillRect(chartWidth + 1, bidY - badgeH / 2, priceAxisWidth - 2, badgeH);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(liveBid.toFixed(digits), chartWidth + 4, bidY + 3.8);
    }

    // Bottom-right ••• dots inside right price axis (Matches Screenshots)
    ctx.fillStyle = '#3A3A3C';
    for (let d = 0; d < 3; d++) {
      ctx.beginPath();
      ctx.arc(chartWidth + 24 + d * 7, chartHeight - 12, 2.0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 8. Crosshair Inspector if active
    if (crosshairActive && crosshairPos) {
      const cx = Math.max(0, Math.min(chartWidth, crosshairPos.x));
      const cy = Math.max(0, Math.min(chartHeight, crosshairPos.y));

      ctx.strokeStyle = '#3A3A3C';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(cx + 0.5, 0);
      ctx.lineTo(cx + 0.5, chartHeight);
      ctx.moveTo(0, cy + 0.5);
      ctx.lineTo(chartWidth, cy + 0.5);
      ctx.stroke();

      const chPrice = yToPrice(cy);
      ctx.fillStyle = '#3A3A3C';
      ctx.fillRect(chartWidth + 1, cy - 9, priceAxisWidth - 2, 18);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 10.5px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(chPrice.toFixed(digits), chartWidth + 4, cy + 3.5);
    }
  }, [
    candles,
    candleStep,
    scrollOffset,
    priceScale,
    currentQuote,
    digits,
    showMA,
    crosshairActive,
    crosshairPos,
    positions,
    closedDeals,
    symbol,
    timeframe,
    computeSMA,
    showOneClickBar,
    showTimeframeBar,
    editingDealState,
    editingPositionId,
  ]);

  const dropdownSymbols = useMemo(() => {
    const ordered: string[] = [...SCREENSHOT_DROPDOWN_ORDER];
    for (const s of watchlist) {
      if (!ordered.includes(s)) ordered.push(s);
    }
    for (const cfg of ALL_SYMBOL_CONFIGS) {
      if (!ordered.includes(cfg.symbol)) ordered.push(cfg.symbol);
    }
    return ordered;
  }, [watchlist]);

  const clampScrollOffset = useCallback(
    (next: number) => {
      const minOffset = -15;
      const maxOffset = Math.max(50, candles.length - 15);
      return Math.max(minOffset, Math.min(maxOffset, next));
    },
    [candles.length]
  );

  // Hit-test running open trade Open arrow marker or Open dashed line
  const findHitRunningPosition = useCallback(
    (localX: number, localY: number): { item: RenderedRunningPosition; dist: number } | null => {
      const rendered = renderedPositionsRef.current;
      if (!rendered || rendered.length === 0) return null;

      let bestMatch: { item: RenderedRunningPosition; dist: number } | null = null;

      // 1. Direct proximity to the running trade's Open arrow marker on the entry candle (28px radius)
      for (let i = rendered.length - 1; i >= 0; i--) {
        const item = rendered[i];
        const dArrow = Math.hypot(localX - item.entryMarkerX, localY - item.entryY);
        if (dArrow <= 28 && (!bestMatch || dArrow < bestMatch.dist)) {
          bestMatch = { item, dist: dArrow };
        }
      }
      if (bestMatch) return bestMatch;

      // 2. Proximity to the running trade's horizontal Open line or "BUY 0.01, ... USD" text (18px vertical tolerance)
      for (let i = rendered.length - 1; i >= 0; i--) {
        const item = rendered[i];
        const dy = Math.abs(localY - item.entryY);
        if (dy <= 18 && (!bestMatch || dy < bestMatch.dist)) {
          bestMatch = { item, dist: dy };
        }
      }

      return bestMatch;
    },
    []
  );

  // Move a running open trade's Open point to any position inside the candle at (localX, localY)
  const applyMovePositionAtPoint = useCallback(
    (positionId: string, localX: number, localY: number) => {
      if (!onUpdatePosition || candles.length === 0) return;
      const geom = chartGeometryRef.current;
      if (!geom) return;

      const pos = positions.find((p) => p.id === positionId);
      if (!pos) return;

      const step = candleStepRef.current;
      const offset = scrollOffsetRef.current;
      const clampedX = Math.max(4, Math.min(geom.chartWidth - 4, localX));
      const rawIdx = Math.round(
        geom.lastIdx - offset - (geom.chartWidth - geom.rightMarginPx - clampedX) / step
      );
      const targetIdx = Math.max(0, Math.min(candles.length - 1, rawIdx));
      const targetCandle = candles[targetIdx];
      if (!targetCandle) return;

      const lastCandle = candles[geom.lastIdx];
      const liveBid =
        currentQuote &&
        Math.abs(currentQuote.bid - lastCandle.close) <= lastCandle.close * 0.012
          ? currentQuote.bid
          : lastCandle.close;

      const cClose = targetIdx === geom.lastIdx ? liveBid : targetCandle.close;
      const cLow =
        targetIdx === geom.lastIdx
          ? Math.min(targetCandle.low, targetCandle.open, cClose)
          : Math.min(targetCandle.low, targetCandle.open, targetCandle.close);
      const cHigh =
        targetIdx === geom.lastIdx
          ? Math.max(targetCandle.high, targetCandle.open, cClose)
          : Math.max(targetCandle.high, targetCandle.open, targetCandle.close);

      const rawPrice =
        geom.lowBound + ((geom.chartHeight - localY) / geom.chartHeight) * geom.priceSpan;
      const clampedPrice = Number(
        Math.max(cLow, Math.min(cHigh, rawPrice)).toFixed(digits)
      );

      const nextOpenTime = formatMt5CandleTime(targetCandle.time, 15);

      onUpdatePosition({
        ...pos,
        openPrice: clampedPrice,
        openTime: nextOpenTime,
      });
    },
    [onUpdatePosition, candles, positions, currentQuote, digits, formatMt5CandleTime]
  );

  // Hit-test history trade Open arrow, Close arrow, or diagonal dashed connector line
  const findHitHistoryDeal = useCallback(
    (
      localX: number,
      localY: number
    ): { item: RenderedHistoryDeal; endpoint: 'open' | 'close'; dist: number } | null => {
      const rendered = renderedDealsRef.current;
      if (!rendered || rendered.length === 0) return null;

      let bestMatch: {
        item: RenderedHistoryDeal;
        endpoint: 'open' | 'close';
        dist: number;
      } | null = null;

      // 1. Check direct proximity to Open or Close arrows (26px touch radius)
      for (let i = rendered.length - 1; i >= 0; i--) {
        const item = rendered[i];
        const isBuy = item.deal.type === 'buy';
        const openCenterY = isBuy ? item.openY + 4.5 : item.openY - 4.5;
        const closeCenterY = !isBuy ? item.closeY + 4.5 : item.closeY - 4.5;

        const dOpen = Math.hypot(localX - item.openX, localY - openCenterY);
        const dClose = Math.hypot(localX - item.closeX, localY - closeCenterY);

        if (dOpen <= 26 && (!bestMatch || dOpen < bestMatch.dist)) {
          bestMatch = { item, endpoint: 'open', dist: dOpen };
        }
        if (dClose <= 26 && (!bestMatch || dClose < bestMatch.dist)) {
          bestMatch = { item, endpoint: 'close', dist: dClose };
        }
      }

      if (bestMatch) return bestMatch;

      // 2. Check proximity to the diagonal dashed line connecting Open and Close (18px touch radius)
      for (let i = rendered.length - 1; i >= 0; i--) {
        const item = rendered[i];
        const ax = item.openX;
        const ay = item.openY;
        const bx = item.closeX;
        const by = item.closeY;
        const dx = bx - ax;
        const dy = by - ay;
        const lenSq = dx * dx + dy * dy;
        let t = 0;
        if (lenSq > 0.0001) {
          t = Math.max(0, Math.min(1, ((localX - ax) * dx + (localY - ay) * dy) / lenSq));
        }
        const projX = ax + t * dx;
        const projY = ay + t * dy;
        const segDist = Math.hypot(localX - projX, localY - projY);
        if (segDist <= 18) {
          const dOpen = Math.hypot(localX - ax, localY - ay);
          const dClose = Math.hypot(localX - bx, localY - by);
          const endpoint: 'open' | 'close' = dOpen <= dClose ? 'open' : 'close';
          if (!bestMatch || segDist < bestMatch.dist) {
            bestMatch = { item, endpoint, dist: segDist };
          }
        }
      }

      return bestMatch;
    },
    []
  );

  // Move Open or Close point of a history deal to any position inside the candle at (localX, localY)
  // and auto-recalculate openPrice, closePrice, openTime, closeTime, TP, and Profit
  const applyMoveDealAtPoint = useCallback(
    (dealId: string, endpoint: 'open' | 'close', localX: number, localY: number) => {
      if (!onUpdateHistoryDeal || candles.length === 0) return;
      const geom = chartGeometryRef.current;
      if (!geom) return;

      const deal = closedDeals.find((d) => d.id === dealId);
      if (!deal || deal.type === 'balance') return;

      const step = candleStepRef.current;
      const offset = scrollOffsetRef.current;
      const clampedX = Math.max(4, Math.min(geom.chartWidth - 4, localX));
      const rawIdx = Math.round(
        geom.lastIdx - offset - (geom.chartWidth - geom.rightMarginPx - clampedX) / step
      );
      const targetIdx = Math.max(0, Math.min(candles.length - 1, rawIdx));
      const targetCandle = candles[targetIdx];
      if (!targetCandle) return;

      const lastCandle = candles[geom.lastIdx];
      const liveBid =
        currentQuote &&
        Math.abs(currentQuote.bid - lastCandle.close) <= lastCandle.close * 0.012
          ? currentQuote.bid
          : lastCandle.close;

      // Full candle vertical range [cLow, cHigh] so the user can move Open or Close to ANY position inside the candle
      const cClose = targetIdx === geom.lastIdx ? liveBid : targetCandle.close;
      const cLow =
        targetIdx === geom.lastIdx
          ? Math.min(targetCandle.low, targetCandle.open, cClose)
          : Math.min(targetCandle.low, targetCandle.open, targetCandle.close);
      const cHigh =
        targetIdx === geom.lastIdx
          ? Math.max(targetCandle.high, targetCandle.open, cClose)
          : Math.max(targetCandle.high, targetCandle.open, targetCandle.close);

      const rawPrice =
        geom.lowBound + ((geom.chartHeight - localY) / geom.chartHeight) * geom.priceSpan;
      const clampedPrice = Number(
        Math.max(cLow, Math.min(cHigh, rawPrice)).toFixed(digits)
      );

      let nextOpenPrice = deal.openPrice;
      let nextClosePrice = deal.closePrice;
      let nextOpenTime = deal.openTime;
      let nextCloseTime = deal.closeTime;

      if (endpoint === 'open') {
        nextOpenPrice = clampedPrice;
        nextOpenTime = formatMt5CandleTime(targetCandle.time, 12);
      } else {
        nextClosePrice = clampedPrice;
        nextCloseTime = formatMt5CandleTime(targetCandle.time, 45);
      }

      // Auto-calculate Profit using 1:500 contract math
      const nextProfit = calculateClosedDealProfit(
        deal.symbol,
        deal.type,
        deal.lots,
        nextOpenPrice,
        nextClosePrice
      );

      // Auto-calculate TP to match the new closePrice whenever profitable or when TP is active
      const isProfitable =
        deal.type === 'buy'
          ? nextClosePrice >= nextOpenPrice
          : nextClosePrice <= nextOpenPrice;
      const nextTp =
        isProfitable || deal.tp !== null || deal.closeReason === 'tp'
          ? nextClosePrice
          : null;
      const nextCloseReason = isProfitable
        ? 'tp'
        : deal.closeReason === 'tp'
          ? 'manual'
          : deal.closeReason;

      const updatedDeal: ClosedDeal = {
        ...deal,
        openPrice: nextOpenPrice,
        closePrice: nextClosePrice,
        openTime: nextOpenTime,
        closeTime: nextCloseTime,
        profit: nextProfit,
        tp: nextTp,
        closeReason: nextCloseReason,
      };

      onUpdateHistoryDeal(updatedDeal);
    },
    [onUpdateHistoryDeal, candles, closedDeals, currentQuote, digits, formatMt5CandleTime]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    stopInertia();
    clearLongPressTimer();
    if (showSymbolDropdown) {
      setShowSymbolDropdown(false);
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const localY = e.clientY - rect.top;

    if (crosshairActive) {
      setCrosshairPos({ x: localX, y: localY });
      return;
    }

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture errors on synthetic events
    }

    if (localX >= rect.width - 62) {
      dragStateRef.current = {
        ...dragStateRef.current,
        mode: 'scale',
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastMoveTime: performance.now(),
        velocityCandlesPerMs: 0,
        startOffset: scrollOffsetRef.current,
        startPriceScale: priceScale,
      };
      return;
    }

    // Check if user touched a Running Open Trade's Open arrow or Open line, or a History Trade
    const hitPos = findHitRunningPosition(localX, localY);
    const hitDeal = findHitHistoryDeal(localX, localY);

    // If a Running Trade is ALREADY in Move Mode and user touches it, start moving immediately
    if (hitPos && editingPositionId === hitPos.item.pos.id) {
      if (chartGeometryRef.current) {
        lockedDealBoundsRef.current = {
          low: chartGeometryRef.current.lowBound,
          high: chartGeometryRef.current.highBound,
        };
      }
      dragStateRef.current = {
        ...dragStateRef.current,
        mode: 'move-position',
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastMoveTime: performance.now(),
        velocityCandlesPerMs: 0,
        startOffset: scrollOffsetRef.current,
        startPriceScale: priceScale,
        positionId: hitPos.item.pos.id,
      };
      return;
    }

    // If a History Trade is ALREADY in Move Mode, immediately start moving the touched endpoint ('open' or 'close')
    if (hitDeal && editingDealState?.dealId === hitDeal.item.deal.id) {
      if (chartGeometryRef.current) {
        lockedDealBoundsRef.current = {
          low: chartGeometryRef.current.lowBound,
          high: chartGeometryRef.current.highBound,
        };
      }
      setEditingDealState({
        dealId: hitDeal.item.deal.id,
        activeHandle: hitDeal.endpoint,
      });
      dragStateRef.current = {
        ...dragStateRef.current,
        mode: 'move-deal',
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastMoveTime: performance.now(),
        velocityCandlesPerMs: 0,
        startOffset: scrollOffsetRef.current,
        startPriceScale: priceScale,
        dealId: hitDeal.item.deal.id,
        dealEndpoint: hitDeal.endpoint,
      };
      return;
    }

    // Decide whether the touch is closer to a Running Trade's Open point or a History Trade
    const preferRunningPos =
      hitPos && (!hitDeal || hitPos.dist <= hitDeal.dist + 4);

    if (preferRunningPos && hitPos) {
      const targetPosId = hitPos.item.pos.id;
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        if (chartGeometryRef.current) {
          lockedDealBoundsRef.current = {
            low: chartGeometryRef.current.lowBound,
            high: chartGeometryRef.current.highBound,
          };
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(20);
          } catch {
            // Ignore vibration permission errors
          }
        }
        setEditingDealState(null);
        setEditingPositionId(targetPosId);
        dragStateRef.current.mode = 'move-position';
        dragStateRef.current.positionId = targetPosId;
        applyMovePositionAtPoint(targetPosId, localX, localY);
      }, 220);
    } else if (hitDeal) {
      // If user touched a History Trade (not yet in Move Mode), start long-press timer (~220ms) to activate Move Mode
      const targetDealId = hitDeal.item.deal.id;
      const targetEndpoint = hitDeal.endpoint;
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        if (chartGeometryRef.current) {
          lockedDealBoundsRef.current = {
            low: chartGeometryRef.current.lowBound,
            high: chartGeometryRef.current.highBound,
          };
        }
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(20);
          } catch {
            // Ignore vibration permission errors
          }
        }
        setEditingPositionId(null);
        setEditingDealState({
          dealId: targetDealId,
          activeHandle: targetEndpoint,
        });
        dragStateRef.current.mode = 'move-deal';
        dragStateRef.current.dealId = targetDealId;
        dragStateRef.current.dealEndpoint = targetEndpoint;
        applyMoveDealAtPoint(targetDealId, targetEndpoint, localX, localY);
      }, 220);
    }

    dragStateRef.current = {
      ...dragStateRef.current,
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastMoveTime: performance.now(),
      velocityCandlesPerMs: 0,
      startOffset: scrollOffsetRef.current,
      startPriceScale: priceScale,
      dealId: hitDeal?.item.deal.id,
      dealEndpoint: hitDeal?.endpoint,
      positionId: hitPos?.item.pos.id,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (crosshairActive) {
      if (e.buttons > 0 || e.pointerType === 'touch') {
        const rect = e.currentTarget.getBoundingClientRect();
        setCrosshairPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
      return;
    }

    // Actively dragging a Running Open Trade's Open point inside any candle
    if (dragStateRef.current.mode === 'move-position') {
      const posId = dragStateRef.current.positionId;
      if (posId) {
        const rect = e.currentTarget.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        applyMovePositionAtPoint(posId, localX, localY);
      }
      return;
    }

    // Actively dragging a History Trade's Open or Close point inside any candle
    if (dragStateRef.current.mode === 'move-deal') {
      const dealId = dragStateRef.current.dealId;
      const endpoint = dragStateRef.current.dealEndpoint;
      if (dealId && endpoint) {
        const rect = e.currentTarget.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        applyMoveDealAtPoint(dealId, endpoint, localX, localY);
      }
      return;
    }

    // Cancel pending long-press if user pans more than 9px before the timer fires
    if (longPressTimerRef.current !== null) {
      const moveDist = Math.hypot(
        e.clientX - dragStateRef.current.startX,
        e.clientY - dragStateRef.current.startY
      );
      if (moveDist > 9) {
        clearLongPressTimer();
      } else {
        // Hold chart steady while waiting for long-press on a trade arrow
        return;
      }
    }

    if (dragStateRef.current.mode === 'scale') {
      const dy = e.clientY - dragStateRef.current.startY;
      const factor = 1 - dy * 0.004;
      setPriceScale(
        Math.max(0.25, Math.min(5.0, dragStateRef.current.startPriceScale * factor))
      );
      return;
    }

    if (dragStateRef.current.mode !== 'pan') return;

    const now = performance.now();
    const dt = Math.max(1, now - dragStateRef.current.lastMoveTime);
    const step = candleStepRef.current;
    const instantDx = e.clientX - dragStateRef.current.lastX;
    const instantVel = instantDx / step / dt;

    dragStateRef.current.velocityCandlesPerMs =
      dragStateRef.current.velocityCandlesPerMs * 0.35 + instantVel * 0.65;
    dragStateRef.current.lastX = e.clientX;
    dragStateRef.current.lastMoveTime = now;

    const totalDx = e.clientX - dragStateRef.current.startX;
    const deltaCandles = totalDx / step;
    const nextOffset = clampScrollOffset(dragStateRef.current.startOffset + deltaCandles);
    scrollOffsetRef.current = nextOffset;
    setScrollOffset(nextOffset);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    clearLongPressTimer();

    if (
      dragStateRef.current.mode === 'move-deal' ||
      dragStateRef.current.mode === 'move-position'
    ) {
      // If user tapped the "BUY 0.01" / "SELL 0.01" text on the left of a running trade in Move Mode without dragging, toggle BUY/SELL
      const moveDist = Math.hypot(
        e.clientX - dragStateRef.current.startX,
        e.clientY - dragStateRef.current.startY
      );
      if (
        dragStateRef.current.mode === 'move-position' &&
        moveDist < 6 &&
        dragStateRef.current.positionId &&
        onUpdatePosition
      ) {
        const rect = e.currentTarget.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const hitRendered = renderedPositionsRef.current.find(
          (r) => r.pos.id === dragStateRef.current.positionId
        );
        if (hitRendered && localX <= hitRendered.prefixEndX + 12) {
          onUpdatePosition({
            ...hitRendered.pos,
            type: hitRendered.pos.type === 'buy' ? 'sell' : 'buy',
          });
        }
      }
      lockedDealBoundsRef.current = null;
      dragStateRef.current.mode = 'none';
      return;
    }

    if (dragStateRef.current.mode === 'pan') {
      const moveDist = Math.hypot(
        e.clientX - dragStateRef.current.startX,
        e.clientY - dragStateRef.current.startY
      );
      // If user tapped empty chart space while a deal or running position was in Move Mode, exit Move Mode
      if (
        moveDist < 6 &&
        (editingDealState || editingPositionId) &&
        !dragStateRef.current.dealId &&
        !dragStateRef.current.positionId
      ) {
        setEditingDealState(null);
        setEditingPositionId(null);
      }

      const elapsedSinceMove = performance.now() - dragStateRef.current.lastMoveTime;
      let vPerFrame = dragStateRef.current.velocityCandlesPerMs * 16.67;

      if (elapsedSinceMove < 90 && Math.abs(vPerFrame) > 0.06) {
        const stepInertia = () => {
          vPerFrame *= 0.935;
          if (Math.abs(vPerFrame) < 0.015) {
            inertiaRafRef.current = null;
            return;
          }
          const next = clampScrollOffset(scrollOffsetRef.current + vPerFrame);
          scrollOffsetRef.current = next;
          setScrollOffset(next);
          inertiaRafRef.current = requestAnimationFrame(stepInertia);
        };
        inertiaRafRef.current = requestAnimationFrame(stepInertia);
      }
    }
    dragStateRef.current.mode = 'none';
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      stopInertia();
      clearLongPressTimer();
      lockedDealBoundsRef.current = null;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      dragStateRef.current.mode = 'pinch';
      dragStateRef.current.pinchStartDist = Math.hypot(dx, dy);
      dragStateRef.current.pinchStartStep = candleStepRef.current;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && dragStateRef.current.mode === 'pinch') {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (dragStateRef.current.pinchStartDist > 10) {
        const ratio = dist / dragStateRef.current.pinchStartDist;
        const nextStep = Math.max(
          2.5,
          Math.min(28, dragStateRef.current.pinchStartStep * ratio)
        );
        candleStepRef.current = nextStep;
        setCandleStep(nextStep);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    stopInertia();
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const next = clampScrollOffset(
        scrollOffsetRef.current - e.deltaX / candleStepRef.current
      );
      scrollOffsetRef.current = next;
      setScrollOffset(next);
    } else {
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const nextStep = Math.max(2.5, Math.min(28, candleStepRef.current * zoomFactor));
      candleStepRef.current = nextStep;
      setCandleStep(nextStep);
    }
  };

  // Current forming candle OHLC for the top-left header
  const latestCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const headerBid =
    currentQuote &&
    latestCandle &&
    Math.abs(currentQuote.bid - latestCandle.close) <= latestCandle.close * 0.012
      ? currentQuote.bid
      : latestCandle?.close ?? currentQuote?.bid ?? 0;
  const headerAsk = currentQuote
    ? Number((headerBid + currentQuote.defaultSpreadPts * currentQuote.point).toFixed(digits))
    : headerBid;
  const headerOpen = latestCandle ? latestCandle.open.toFixed(digits) : headerBid.toFixed(digits);
  const headerHigh = latestCandle
    ? Math.max(latestCandle.high, headerBid).toFixed(digits)
    : headerAsk.toFixed(digits);
  const headerLow = latestCandle
    ? Math.min(latestCandle.low, headerBid).toFixed(digits)
    : headerBid.toFixed(digits);
  const headerClose = headerBid.toFixed(digits);

  const sellSplit = splitMT5Price(headerBid, digits);
  const buySplit = splitMT5Price(headerAsk, digits);

  const stepLotSize = (delta: number) => {
    const cur = parseFloat(quickLots) || 0.01;
    const next = Math.max(0.01, Math.min(100, Number((cur + delta).toFixed(2))));
    setQuickLots(next.toFixed(2));
  };

  const activeEditingDeal = useMemo(() => {
    if (!editingDealState) return null;
    return closedDeals.find((d) => d.id === editingDealState.dealId) || null;
  }, [editingDealState, closedDeals]);

  const activeEditingPosition = useMemo(() => {
    if (!editingPositionId) return null;
    return positions.find((p) => p.id === editingPositionId) || null;
  }, [editingPositionId, positions]);

  return (
    <div className="flex flex-col h-full bg-white text-black relative">
      {/* Top MT5 iOS Chart Toolbar */}
      <header className="pt-safe bg-white border-b border-[#D1D1D6] shrink-0 z-20">
        <div className="h-11 px-3.5 flex items-center justify-between">
          {/* Left: Timeframe Label (M1) */}
          <button
            onClick={() => setShowTimeframeBar((p) => !p)}
            className="min-w-[44px] min-h-[38px] flex items-center justify-start text-[17px] font-bold text-[#3A3A3C] active:opacity-60"
          >
            {timeframe}
          </button>

          {/* Center 3 Icons: Crosshair (+), Indicators (f), Objects (Geometric shapes) */}
          <div className="flex items-center gap-6">
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
              className={`p-1.5 rounded transition-colors ${
                crosshairActive ? 'text-[#007AFF]' : 'text-[#3A3A3C]'
              }`}
              title="Crosshair"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2v8M12 14v8M2 12h8M14 12h8" strokeLinecap="round" />
              </svg>
            </button>

            <button
              onClick={() => setShowMA((prev) => !prev)}
              className={`p-1.5 rounded font-serif italic text-[22px] font-semibold leading-none transition-colors ${
                showMA ? 'text-[#007AFF]' : 'text-[#3A3A3C]'
              }`}
              title="Indicators (f)"
            >
              f
            </button>

            <button
              onClick={() => {
                setCandleStep((s) => (s > 12 ? 6.5 : s + 2));
                setPriceScale(1.0);
              }}
              className="p-1.5 rounded text-[#3A3A3C] active:text-[#007AFF]"
              title="Objects / Zoom"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 15V5h10v4" />
                <circle cx="15" cy="9" r="4" />
                <path d="M12 20l4.5-8 4.5 8H12z" />
              </svg>
            </button>
          </div>

          {/* Right 2 Colored Icons */}
          <div className="flex items-center gap-3.5">
            {/* Circular Red/Blue Clock Order Icon -> Opens Full New Order Modal */}
            <button
              type="button"
              onClick={() => onOpenNewOrder(symbol)}
              className="w-6 h-6 rounded-full relative flex items-center justify-center active:scale-95"
              title="New Order"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path d="M12 2 A10 10 0 0 0 12 22 Z" fill="#E54D42" />
                <path d="M12 2 A10 10 0 0 1 12 22 Z" fill="#3282F6" />
                <circle cx="12" cy="12" r="5.5" fill="#FFFFFF" />
                <path d="M12 9v3.5l2.2 1.5" stroke="#E54D42" strokeWidth="1.6" fill="none" strokeLinecap="round" />
              </svg>
            </button>

            {/* Top-Right Rectangular Split Red/Blue Quick Trade Icon -> Opens & Closes Bottom SELL / Lot / BUY Bar */}
            <button
              type="button"
              onClick={() => setShowOneClickBar((p) => !p)}
              className="w-6 h-5 rounded-[3px] overflow-hidden relative flex items-center justify-center active:scale-95"
              title="Toggle SELL / BUY Quick Trade Bar"
            >
              <div className="w-1/2 h-full bg-[#E54D42]" />
              <div className="w-1/2 h-full bg-[#3282F6]" />
              <div className="w-2.5 h-2.5 bg-white rounded-[1px] absolute" />
            </button>
          </div>
        </div>

        {/* Collapsible Timeframe Selector Bar (M1, M5, M15, M30, H1, H4, D1, W1, MN) */}
        {showTimeframeBar && (
          <div className="px-2 py-1.5 bg-[#F9F9F9] border-t border-[#E5E5EA] grid grid-cols-9 gap-1">
            {TIMEFRAMES.map((tf) => {
              const active = tf === timeframe;
              return (
                <button
                  key={tf}
                  onClick={() => {
                    stopInertia();
                    onChangeTimeframe(tf);
                    setShowTimeframeBar(false);
                    scrollOffsetRef.current = 0;
                    setScrollOffset(0);
                  }}
                  className={`h-7 rounded text-[12px] font-semibold transition-colors ${
                    active
                      ? 'bg-[#007AFF] text-white'
                      : 'text-[#3A3A3C] active:bg-[#E5E5EA]'
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>
        )}
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
        onWheel={handleWheel}
        onDoubleClick={() => {
          stopInertia();
          setPriceScale(1.0);
          scrollOffsetRef.current = 0;
          setScrollOffset(0);
        }}
        className="flex-1 relative overflow-hidden touch-none select-none bg-white cursor-grab active:cursor-grabbing"
      >
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* Top-Left MT5 Overlay: BTCUSD ▾ M1 (Exact Match to Screenshots) */}
        <div
          className="absolute top-1.5 left-2 z-10 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowSymbolDropdown((prev) => !prev)}
              className={`flex items-center gap-0.5 text-[13.5px] font-semibold active:opacity-70 ${
                showSymbolDropdown ? 'text-[#3A3A3C]' : 'text-[#0070E0]'
              }`}
            >
              <span>{symbol}</span>
              <span
                className={`text-[9px] ml-0.5 ${
                  showSymbolDropdown ? 'text-[#3A3A3C]' : 'text-[#0070E0]'
                }`}
              >
                ▼
              </span>
            </button>
            <span className="text-[13px] text-[#3A3A3C] font-normal tabular-nums">
              {showSymbolDropdown
                ? timeframe
                : `${timeframe}, ${headerOpen} ${headerHigh} ${headerLow} ${headerClose}`}
            </span>
          </div>

          <div className="text-[12.5px] text-[#3A3A3C] leading-tight pointer-events-none">
            {currentQuote?.description || 'Gold vs US Dollar'}
          </div>
          {!isMarketOpen && !showSymbolDropdown && (
            <div className="text-[12.5px] text-[#48484A] leading-tight pointer-events-none">
              Market closed
            </div>
          )}
        </div>

        {/* Floating Running Trade Move & BUY/SELL Switcher HUD Bar (Shown when a Running Trade Open is Long-Pressed) */}
        {activeEditingPosition && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-2 left-2 right-[66px] z-20 bg-white/95 backdrop-blur-sm border border-[#0070E0] rounded-[6px] shadow-[0_2px_10px_rgba(0,0,0,0.12)] px-2.5 py-1.5 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                {/* Explicit BUY / SELL Switcher Segmented Buttons */}
                <div className="inline-flex rounded overflow-hidden border border-[#D1D1D6]">
                  <button
                    type="button"
                    onClick={() => {
                      if (!onUpdatePosition) return;
                      onUpdatePosition({
                        ...activeEditingPosition,
                        type: 'buy',
                      });
                    }}
                    className={`px-2 py-0.5 text-[11px] font-bold uppercase transition-colors ${
                      activeEditingPosition.type === 'buy'
                        ? 'bg-[#0070E0] text-white'
                        : 'bg-white text-[#3A3A3C] active:bg-[#F2F2F7]'
                    }`}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!onUpdatePosition) return;
                      onUpdatePosition({
                        ...activeEditingPosition,
                        type: 'sell',
                      });
                    }}
                    className={`px-2 py-0.5 text-[11px] font-bold uppercase transition-colors ${
                      activeEditingPosition.type === 'sell'
                        ? 'bg-[#E53935] text-white'
                        : 'bg-white text-[#3A3A3C] active:bg-[#F2F2F7]'
                    }`}
                  >
                    SELL
                  </button>
                </div>

                <span className="px-1.5 py-0.5 rounded bg-[#0070E0]/10 border border-[#0070E0] text-[#0070E0] text-[11px] font-semibold tabular-nums">
                  Open: {activeEditingPosition.openPrice.toFixed(digits)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setEditingPositionId(null)}
                className="px-2 py-0.5 rounded bg-[#F2F2F7] text-[11px] font-semibold text-[#0070E0] active:opacity-70"
              >
                Done
              </button>
            </div>

            {(() => {
              const livePl = calculatePositionPL(activeEditingPosition, currentQuote);
              return (
                <div className="flex items-center justify-between text-[11px] tabular-nums text-[#3A3A3C]">
                  <span>
                    Lot:{' '}
                    <strong className="font-semibold text-black">
                      {activeEditingPosition.lots.toFixed(2)}
                    </strong>
                  </span>
                  <span
                    className={`font-bold ${
                      livePl >= 0 ? 'text-[#0070E0]' : 'text-[#E53935]'
                    }`}
                  >
                    {livePl >= 0 ? '+' : ''}
                    {livePl.toFixed(2)} USD
                  </span>
                </div>
              );
            })()}
          </div>
        )}

        {/* Floating History Trade Move & Auto-Recalculate HUD Bar (Shown when a History Trade is Long-Pressed) */}
        {activeEditingDeal && editingDealState && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-2 left-2 right-[66px] z-20 bg-white/95 backdrop-blur-sm border border-[#0070E0] rounded-[6px] shadow-[0_2px_10px_rgba(0,0,0,0.12)] px-2.5 py-1.5 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!onUpdateHistoryDeal) return;
                    const nextType: 'buy' | 'sell' =
                      activeEditingDeal.type === 'buy' ? 'sell' : 'buy';
                    const nextProfit = calculateClosedDealProfit(
                      activeEditingDeal.symbol,
                      nextType,
                      activeEditingDeal.lots,
                      activeEditingDeal.openPrice,
                      activeEditingDeal.closePrice
                    );
                    const isProfitable =
                      nextType === 'buy'
                        ? activeEditingDeal.closePrice >= activeEditingDeal.openPrice
                        : activeEditingDeal.closePrice <= activeEditingDeal.openPrice;
                    const nextTp =
                      isProfitable || activeEditingDeal.tp !== null
                        ? activeEditingDeal.closePrice
                        : null;
                    onUpdateHistoryDeal({
                      ...activeEditingDeal,
                      type: nextType,
                      profit: nextProfit,
                      tp: nextTp,
                      closeReason: isProfitable ? 'tp' : activeEditingDeal.closeReason,
                    });
                  }}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-bold uppercase text-white ${
                    activeEditingDeal.type === 'buy' ? 'bg-[#0070E0]' : 'bg-[#E53935]'
                  }`}
                >
                  {activeEditingDeal.type} {activeEditingDeal.lots.toFixed(2)}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setEditingDealState({
                      dealId: activeEditingDeal.id,
                      activeHandle: 'open',
                    })
                  }
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                    editingDealState.activeHandle === 'open'
                      ? 'bg-[#0070E0]/10 border-[#0070E0] text-[#0070E0]'
                      : 'border-[#D1D1D6] text-[#3A3A3C]'
                  }`}
                >
                  Open: {activeEditingDeal.openPrice.toFixed(digits)}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setEditingDealState({
                      dealId: activeEditingDeal.id,
                      activeHandle: 'close',
                    })
                  }
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                    editingDealState.activeHandle === 'close'
                      ? 'bg-[#E53935]/10 border-[#E53935] text-[#E53935]'
                      : 'border-[#D1D1D6] text-[#3A3A3C]'
                  }`}
                >
                  Close: {activeEditingDeal.closePrice.toFixed(digits)}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setEditingDealState(null)}
                className="px-2 py-0.5 rounded bg-[#F2F2F7] text-[11px] font-semibold text-[#0070E0] active:opacity-70"
              >
                Done
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] tabular-nums text-[#3A3A3C]">
              <span>
                TP:{' '}
                <strong className="font-semibold text-black">
                  {(activeEditingDeal.tp ?? activeEditingDeal.closePrice).toFixed(digits)}
                </strong>
              </span>
              <span
                className={`font-bold ${
                  activeEditingDeal.profit >= 0 ? 'text-[#0070E0]' : 'text-[#E53935]'
                }`}
              >
                {activeEditingDeal.profit >= 0 ? '+' : ''}
                {activeEditingDeal.profit.toFixed(2)} USD
              </span>
            </div>
          </div>
        )}

        {/* Exact MT5 iOS Symbol Switcher Dropdown Menu (Matches WhatsApp_Image_2026-11-08_at_11.23.58_PM) */}
        {showSymbolDropdown && (
          <div
            className="absolute top-[22px] left-[3px] z-30 w-[108px] bg-white border border-[#EBEBEB] rounded-[2px] shadow-[0_2px_8px_rgba(0,0,0,0.06)] py-1 max-h-[calc(100%-26px)] overflow-y-auto no-scrollbar"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {dropdownSymbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => {
                  stopInertia();
                  onChangeSymbol(sym);
                  setShowSymbolDropdown(false);
                  scrollOffsetRef.current = 0;
                  setScrollOffset(0);
                }}
                className="w-full h-[43px] flex items-center justify-center text-center active:bg-[#F2F2F7] transition-colors"
              >
                <span className="text-[16px] font-bold text-[#0D62C6] mt5-symbol-font tracking-tight leading-none">
                  {sym}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bottom MT5 iOS One-Click Trading Bar: SELL | v 0.01 ^ | BUY (Matches Screenshots) */}
      {showOneClickBar && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="h-[50px] bg-white border-t border-[#D1D1D6] grid grid-cols-12 shrink-0 z-20 select-none"
        >
          {/* Left: SELL Button (#0070E0 Blue with large last 2 digits) */}
          <button
            type="button"
            onClick={() =>
              onQuickExecuteOrder(
                symbol,
                'sell',
                Math.max(0.01, parseFloat(quickLots) || 0.01)
              )
            }
            className="col-span-4 bg-[#0070E0] text-white px-2.5 py-1 flex flex-col justify-between active:opacity-85"
          >
            <span className="text-[11px] font-medium leading-none tracking-tight self-start">
              SELL
            </span>
            <div className="self-center flex items-baseline leading-none tabular-nums pb-0.5">
              <span className="text-[15.5px] font-medium">{sellSplit.prefix}</span>
              <span className="text-[23px] font-semibold tracking-tight">
                {sellSplit.big}
              </span>
              {sellSplit.sup && (
                <span className="text-[12px] font-medium self-start -mt-0.5 ml-0.5">
                  {sellSplit.sup}
                </span>
              )}
            </div>
          </button>

          {/* Center: Lot Stepper (v 0.01 ^) */}
          <div className="col-span-4 bg-white flex items-center justify-between px-3 border-x border-[#D1D1D6]">
            <button
              type="button"
              onClick={() => stepLotSize(-0.01)}
              className="p-1.5 text-black active:opacity-50"
              title="Decrease Lot"
            >
              <ChevronDown className="w-5 h-5 stroke-[2.2]" />
            </button>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={quickLots}
              onChange={(e) => setQuickLots(e.target.value)}
              className="w-16 text-center text-[16px] font-medium text-black tabular-nums focus:outline-none"
            />
            <button
              type="button"
              onClick={() => stepLotSize(0.01)}
              className="p-1.5 text-black active:opacity-50"
              title="Increase Lot"
            >
              <ChevronUp className="w-5 h-5 stroke-[2.2]" />
            </button>
          </div>

          {/* Right: BUY Button (#0070E0 Blue with large last 2 digits) */}
          <button
            type="button"
            onClick={() =>
              onQuickExecuteOrder(
                symbol,
                'buy',
                Math.max(0.01, parseFloat(quickLots) || 0.01)
              )
            }
            className="col-span-4 bg-[#0070E0] text-white px-2.5 py-1 flex flex-col justify-between active:opacity-85"
          >
            <span className="text-[11px] font-medium leading-none tracking-tight self-start">
              BUY
            </span>
            <div className="self-center flex items-baseline leading-none tabular-nums pb-0.5">
              <span className="text-[15.5px] font-medium">{buySplit.prefix}</span>
              <span className="text-[23px] font-semibold tracking-tight">
                {buySplit.big}
              </span>
              {buySplit.sup && (
                <span className="text-[12px] font-medium self-start -mt-0.5 ml-0.5">
                  {buySplit.sup}
                </span>
              )}
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
