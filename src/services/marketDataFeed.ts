import { Candle, Timeframe } from '../types/mt5';
import {
  ALL_SYMBOL_CONFIGS,
  generateHistoricalCandles,
  getTimeframeSeconds,
  prependOlderCandles,
} from '../utils/mt5Formatters';

const FASTFOREX_BASE_URL = 'https://api.fastforex.io';
const DEFAULT_FASTFOREX_KEY = '3806d9f7ce-718310d047-tmwxxx';
const YAHOO_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

const SRI_LANKA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // UTC+05:30
export const CHART_TIME_OFFSET_MS = 10 * 60 * 1000; // 10 minutes behind wall clock

const MONDAY_OPEN_MINUTE_OF_DAY = 3 * 60 + 30; // 03:30 AM (210)
const SATURDAY_CLOSE_MINUTE_OF_DAY = 2 * 60 + 29; // 02:29 AM inclusive (149)

/**
 * SriLankaMarketHours — Direct port of SriLankaMarketHours.kt
 * Enforces Asia/Colombo (UTC+05:30) market schedule:
 * - Opens Monday 03:30 AM SLT
 * - Closes Saturday 02:29 AM SLT
 * - Chart time runs 10 minutes behind wall clock (now - 10 minutes)
 */
export const SriLankaMarketHours = {
  chartNowMillis(wallClockNowMs: number = Date.now()): number {
    return wallClockNowMs - CHART_TIME_OFFSET_MS;
  },

  getSriLankaDateParts(timestampMs: number) {
    const sltDate = new Date(timestampMs + SRI_LANKA_OFFSET_MS);
    return {
      year: sltDate.getUTCFullYear(),
      month: sltDate.getUTCMonth(),
      day: sltDate.getUTCDate(),
      dayOfWeek: sltDate.getUTCDay(), // 0 = Sun, 1 = Mon, ..., 6 = Sat
      hour: sltDate.getUTCHours(),
      minute: sltDate.getUTCMinutes(),
      second: sltDate.getUTCSeconds(),
    };
  },

  isMarketOpen(timestampMs: number = SriLankaMarketHours.chartNowMillis()): boolean {
    const p = SriLankaMarketHours.getSriLankaDateParts(timestampMs);
    const minuteOfDay = p.hour * 60 + p.minute;

    if (p.dayOfWeek === 0) return false; // Sunday
    if (p.dayOfWeek === 1) return minuteOfDay >= MONDAY_OPEN_MINUTE_OF_DAY; // Monday 03:30 AM+
    if (p.dayOfWeek === 6) return minuteOfDay <= SATURDAY_CLOSE_MINUTE_OF_DAY; // Saturday until 02:29 AM
    return true; // Tue - Fri
  },

  clampToLastOpenMarketTimestamp(
    timestampMs: number = SriLankaMarketHours.chartNowMillis()
  ): number {
    if (SriLankaMarketHours.isMarketOpen(timestampMs)) return timestampMs;

    const sltMs = timestampMs + SRI_LANKA_OFFSET_MS;
    const d = new Date(sltMs);
    const dow = d.getUTCDay();

    if (dow === 6) {
      d.setUTCHours(2, 29, 0, 0);
    } else if (dow === 0) {
      d.setUTCDate(d.getUTCDate() - 1);
      d.setUTCHours(2, 29, 0, 0);
    } else if (dow === 1) {
      d.setUTCDate(d.getUTCDate() - 2);
      d.setUTCHours(2, 29, 0, 0);
    }
    return d.getTime() - SRI_LANKA_OFFSET_MS;
  },

  formatTimeHMS(timestampMs: number = SriLankaMarketHours.chartNowMillis()): string {
    const clamped = SriLankaMarketHours.clampToLastOpenMarketTimestamp(timestampMs);
    const p = SriLankaMarketHours.getSriLankaDateParts(clamped);
    const h = String(p.hour).padStart(2, '0');
    const m = String(p.minute).padStart(2, '0');
    const s = String(p.second).padStart(2, '0');
    return `${h}:${m}:${s}`;
  },

  formatMt5DateTime(timestampMs: number = SriLankaMarketHours.chartNowMillis()): string {
    const clamped = SriLankaMarketHours.clampToLastOpenMarketTimestamp(timestampMs);
    const p = SriLankaMarketHours.getSriLankaDateParts(clamped);
    const y = p.year;
    const mo = String(p.month + 1).padStart(2, '0');
    const d = String(p.day).padStart(2, '0');
    return `${y}.${mo}.${d} ${SriLankaMarketHours.formatTimeHMS(clamped)}`;
  },
};

/**
 * Yahoo Finance v8 Chart API Ticker Mapping
 */
export function getYahooCandidateTickers(symbol: string): string[] {
  switch (symbol.toUpperCase()) {
    case 'XAUUSD':
      return ['GC=F', 'XAUUSD=X'];
    case 'NAS100':
    case 'NDX100':
      return ['^NDX', 'NQ=F'];
    case 'EURUSD':
      return ['EURUSD=X'];
    case 'GBPUSD':
      return ['GBPUSD=X'];
    case 'USDJPY':
      return ['JPY=X', 'USDJPY=X'];
    case 'USDCHF':
      return ['CHF=X', 'USDCHF=X'];
    case 'AUDUSD':
      return ['AUDUSD=X'];
    case 'USDCAD':
      return ['CAD=X', 'USDCAD=X'];
    case 'NZDUSD':
      return ['NZDUSD=X'];
    case 'USDSEK':
      return ['SEK=X', 'USDSEK=X'];
    case 'USDCNH':
      return ['CNH=X', 'USDCNH=X'];
    case 'BTCUSD':
      return ['BTC-USD'];
    default:
      if (symbol.length === 6) {
        return [`${symbol.toUpperCase()}=X`];
      }
      return [`${symbol.toUpperCase()}=X`];
  }
}

/**
 * Yahoo Finance Timeframe Mapping (interval & range + fallback range)
 */
export function getYahooQueryPlans(timeframe: Timeframe): { interval: string; range: string }[] {
  switch (timeframe) {
    case 'M1':
      return [
        { interval: '1m', range: '7d' },
        { interval: '1m', range: '5d' },
      ];
    case 'M5':
      return [
        { interval: '5m', range: '60d' },
        { interval: '5m', range: '1mo' },
      ];
    case 'M15':
      return [
        { interval: '15m', range: '60d' },
        { interval: '15m', range: '1mo' },
      ];
    case 'M30':
      return [
        { interval: '30m', range: '60d' },
        { interval: '30m', range: '1mo' },
      ];
    case 'H1':
      return [
        { interval: '1h', range: '3mo' },
        { interval: '1h', range: '1mo' },
      ];
    case 'H4':
      return [
        { interval: '1h', range: '6mo' },
        { interval: '1h', range: '3mo' },
      ];
    case 'D1':
      return [{ interval: '1d', range: '6mo' }];
    case 'W1':
      return [{ interval: '1wk', range: '2y' }];
    case 'MN':
      return [{ interval: '1mo', range: '5y' }];
  }
}

/**
 * CandleAggregator — Direct port of CandleAggregator.kt
 * Manages OHLC series per symbol+timeframe and performs sub-second real-time forming candle updates.
 */
export class CandleAggregator {
  private candleHistory: Map<string, Candle[]> = new Map();

  private key(symbol: string, timeframe: Timeframe): string {
    return `${symbol}_${timeframe}`;
  }

  public hasSeries(symbol: string, timeframe: Timeframe): boolean {
    const arr = this.candleHistory.get(this.key(symbol, timeframe));
    return Array.isArray(arr) && arr.length > 0;
  }

  public getCandles(symbol: string, timeframe: Timeframe, fallbackPrice: number): Candle[] {
    const k = this.key(symbol, timeframe);
    let list = this.candleHistory.get(k);
    if (!list || list.length === 0) {
      const cfg =
        ALL_SYMBOL_CONFIGS.find((c) => c.symbol === symbol) || ALL_SYMBOL_CONFIGS[0];
      list = generateHistoricalCandles(cfg, timeframe, fallbackPrice, 1200);
      this.candleHistory.set(k, list);
    }
    return list;
  }

  public extendOlderHistory(
    symbol: string,
    timeframe: Timeframe,
    countToPrepend: number = 600
  ): Candle[] {
    const k = this.key(symbol, timeframe);
    const cfg =
      ALL_SYMBOL_CONFIGS.find((c) => c.symbol === symbol) || ALL_SYMBOL_CONFIGS[0];
    const current = this.getCandles(symbol, timeframe, cfg.baseBid);
    const extended = prependOlderCandles(current, cfg, timeframe, countToPrepend);
    this.candleHistory.set(k, extended);
    return extended;
  }

  public seedFromServerHistory(
    symbol: string,
    timeframe: Timeframe,
    candles: Candle[],
    currentSpotPrice?: number
  ): Candle[] {
    if (candles.length === 0) {
      return this.getCandles(symbol, timeframe, currentSpotPrice || 1.0);
    }

    let sorted = [...candles].sort((a, b) => a.time - b.time);
    const cfg =
      ALL_SYMBOL_CONFIGS.find((c) => c.symbol === symbol) || ALL_SYMBOL_CONFIGS[0];
    const digits = cfg.digits ?? 2;

    const last = sorted[sorted.length - 1];
    // Only apply currentSpotPrice if it belongs to the same price regime (within 1.2% of last.close)
    if (
      typeof currentSpotPrice === 'number' &&
      currentSpotPrice > 0 &&
      Math.abs(currentSpotPrice - last.close) <= last.close * 0.012
    ) {
      const spot = Number(currentSpotPrice.toFixed(digits));
      sorted[sorted.length - 1] = {
        ...last,
        close: spot,
        high: Math.max(last.high, spot),
        low: Math.min(last.low, spot),
      };
    }

    // If the server returned fewer than 1200 candles, seamlessly prepend older candles
    // so the user never sees an empty void when scrolling backwards
    if (sorted.length < 1200) {
      sorted = prependOlderCandles(sorted, cfg, timeframe, 1200 - sorted.length);
    }

    const trimmed = sorted.slice(-5000);
    this.candleHistory.set(this.key(symbol, timeframe), trimmed);
    return trimmed;
  }

  public onTick(
    symbol: string,
    bidPrice: number,
    timestampMillis: number = SriLankaMarketHours.chartNowMillis()
  ): Record<string, Candle[]> {
    const updatedSeries: Record<string, Candle[]> = {};
    if (!SriLankaMarketHours.isMarketOpen(timestampMillis)) {
      return updatedSeries;
    }
    const clampedMs = SriLankaMarketHours.clampToLastOpenMarketTimestamp(timestampMillis);
    const timestampSec = Math.floor(clampedMs / 1000);
    const cfg = ALL_SYMBOL_CONFIGS.find((c) => c.symbol === symbol);
    const digits = cfg?.digits ?? 2;
    const cleanBid = Number(bidPrice.toFixed(digits));

    const timeframes: Timeframe[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'];
    for (const tf of timeframes) {
      const k = this.key(symbol, tf);
      let list = this.candleHistory.get(k);
      if (!list || list.length === 0) continue;

      const lastCandle = list[list.length - 1];

      // If the new live API price is in a different regime (>1.2% away from placeholder baseBid),
      // shift the existing series smoothly so the forming candle never creates an artificial spike
      if (Math.abs(cleanBid - lastCandle.close) > lastCandle.close * 0.012) {
        const shift = cleanBid - lastCandle.close;
        list = list.map((c) => ({
          ...c,
          open: Number((c.open + shift).toFixed(digits)),
          high: Number((c.high + shift).toFixed(digits)),
          low: Number((c.low + shift).toFixed(digits)),
          close: Number((c.close + shift).toFixed(digits)),
        }));
        this.candleHistory.set(k, list);
        updatedSeries[k] = list;
        continue;
      }

      const periodSec = getTimeframeSeconds(tf);
      const bucketStart = Math.floor(timestampSec / periodSec) * periodSec;
      const currentLast = list[list.length - 1];

      if (bucketStart > currentLast.time && SriLankaMarketHours.isMarketOpen(timestampMillis)) {
        const openPrice = currentLast.close;
        const newCandle: Candle = {
          time: bucketStart,
          open: openPrice,
          high: Math.max(openPrice, cleanBid),
          low: Math.min(openPrice, cleanBid),
          close: cleanBid,
          volume: 1,
        };
        const nextList = [...list.slice(-7999), newCandle];
        this.candleHistory.set(k, nextList);
        updatedSeries[k] = nextList;
      } else {
        const updatedCandle: Candle = {
          ...currentLast,
          high: Math.max(currentLast.high, cleanBid),
          low: Math.min(currentLast.low, cleanBid),
          close: cleanBid,
          volume: currentLast.volume + 1,
        };
        const nextList = [...list.slice(0, -1), updatedCandle];
        this.candleHistory.set(k, nextList);
        updatedSeries[k] = nextList;
      }
    }

    return updatedSeries;
  }
}

/**
 * FastForexMarketService — Complete port of FastForexService.kt
 * Integrates:
 * 1. API 1: Yahoo Finance v8 Chart API (query1 & query2) for OHLC Candlesticks & Live Spot Price
 * 2. API 2: FastForex REST API (/fetch-multi, /fetch-one, /time-series) with key 3806d9f7ce-718310d047-tmwxxx
 * 3. API 3: Binance Global Market Data API (data-api.binance.vision & api.binance.com) for bookTicker & klines
 */
export class FastForexMarketService {
  private serverRates: Map<string, number> = new Map();
  private apiKey: string = DEFAULT_FASTFOREX_KEY;
  public readonly candleAggregator = new CandleAggregator();

  constructor(customKey?: string) {
    if (customKey && customKey.trim()) {
      this.apiKey = customKey.trim();
    }
    for (const cfg of ALL_SYMBOL_CONFIGS) {
      this.serverRates.set(cfg.symbol, cfg.baseBid);
    }
  }

  public getServerRate(symbol: string): number | undefined {
    return this.serverRates.get(symbol);
  }

  public setServerRate(symbol: string, rate: number): void {
    const cfg = ALL_SYMBOL_CONFIGS.find((c) => c.symbol === symbol);
    const clean = cfg ? Number(rate.toFixed(cfg.digits)) : rate;
    this.serverRates.set(symbol, clean);
  }

  /**
   * Fetch JSON from Yahoo Finance v8 Chart API using proxy in browser dev or direct/fallback in Capacitor iOS
   */
  private async fetchYahooChartJson(
    ticker: string,
    interval: string,
    range: string
  ): Promise<Record<string, unknown> | null> {
    const encodedTicker = encodeURIComponent(ticker);
    const pathAndQuery = `/v8/finance/chart/${encodedTicker}?interval=${interval}&range=${range}&includePrePost=true`;

    const candidateUrls = [
      `/yahoo-q1${pathAndQuery}`,
      `/yahoo-q2${pathAndQuery}`,
      `https://query1.finance.yahoo.com${pathAndQuery}`,
      `https://query2.finance.yahoo.com${pathAndQuery}`,
      `https://corsproxy.io/?${encodeURIComponent(`https://query1.finance.yahoo.com${pathAndQuery}`)}`,
    ];

    for (const url of candidateUrls) {
      try {
        const isDirectYahoo = url.startsWith('https://query');
        const res = await fetch(
          url,
          isDirectYahoo
            ? {
                headers: {
                  'User-Agent': YAHOO_USER_AGENT,
                  Accept: 'application/json',
                },
              }
            : {
                headers: {
                  Accept: 'application/json',
                },
              }
        );
        if (!res.ok) continue;
        const text = await res.text();
        if (!text.trim().startsWith('{')) continue;
        const json = JSON.parse(text);
        if (json?.chart?.result?.[0]) {
          return json;
        }
      } catch {
        // Try next candidate URL
      }
    }
    return null;
  }

  /**
   * API 1: Fetch real-time spot price from Yahoo Finance v8 Chart API
   * Reads chart.result[0].meta.regularMarketPrice
   */
  public async fetchYahooSpotPrice(symbol: string): Promise<number | null> {
    const tickers = getYahooCandidateTickers(symbol);
    for (const ticker of tickers) {
      const json = await this.fetchYahooChartJson(ticker, '1m', '1d');
      if (!json) continue;
      const chart = json.chart as { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
      const metaPrice = Number(chart?.result?.[0]?.meta?.regularMarketPrice);
      if (!isNaN(metaPrice) && metaPrice > 0) {
        this.setServerRate(symbol, metaPrice);
        return metaPrice;
      }
    }
    return null;
  }

  /**
   * API 1: Fetch Historical & Real-Time OHLC Candlesticks from Yahoo Finance v8 Chart API
   */
  public async fetchYahooFinanceCandles(
    symbol: string,
    timeframe: Timeframe
  ): Promise<Candle[] | null> {
    const tickers = getYahooCandidateTickers(symbol);
    const plans = getYahooQueryPlans(timeframe);
    const cfg = ALL_SYMBOL_CONFIGS.find((c) => c.symbol === symbol);
    const digits = cfg?.digits ?? 2;
    const cutoffEpochSec = Math.floor(SriLankaMarketHours.chartNowMillis() / 1000);

    for (const ticker of tickers) {
      for (const plan of plans) {
        const json = await this.fetchYahooChartJson(ticker, plan.interval, plan.range);
        if (!json) continue;

        const chart = json.chart as {
          result?: Array<{
            meta?: { regularMarketPrice?: number };
            timestamp?: number[];
            indicators?: {
              quote?: Array<{
                open?: Array<number | null>;
                high?: Array<number | null>;
                low?: Array<number | null>;
                close?: Array<number | null>;
                volume?: Array<number | null>;
              }>;
            };
          }>;
        };

        const resultObj = chart?.result?.[0];
        if (!resultObj) continue;

        const metaPrice = Number(resultObj.meta?.regularMarketPrice);
        if (!isNaN(metaPrice) && metaPrice > 0) {
          this.setServerRate(symbol, metaPrice);
        }

        const timestamps = resultObj.timestamp;
        const quoteObj = resultObj.indicators?.quote?.[0];
        if (!Array.isArray(timestamps) || !quoteObj) continue;

        const opens = quoteObj.open || [];
        const highs = quoteObj.high || [];
        const lows = quoteObj.low || [];
        const closes = quoteObj.close || [];
        const volumes = quoteObj.volume || [];

        const rawCandles: Candle[] = [];
        const isIntraday = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4'].includes(timeframe);

        for (let i = 0; i < timestamps.length; i++) {
          const ts = Number(timestamps[i]);
          if (!ts || ts > cutoffEpochSec) continue;
          if (isIntraday && !SriLankaMarketHours.isMarketOpen(ts * 1000)) {
            continue;
          }

          const o = opens[i];
          const h = highs[i];
          const l = lows[i];
          const c = closes[i];
          if (
            o === null ||
            o === undefined ||
            h === null ||
            h === undefined ||
            l === null ||
            l === undefined ||
            c === null ||
            c === undefined ||
            o <= 0 ||
            h <= 0 ||
            l <= 0 ||
            c <= 0
          ) {
            continue;
          }

          rawCandles.push({
            time: ts,
            open: Number(o.toFixed(digits)),
            high: Number(Math.max(o, h, l, c).toFixed(digits)),
            low: Number(Math.min(o, h, l, c).toFixed(digits)),
            close: Number(c.toFixed(digits)),
            volume: Number(volumes[i] || 100),
          });
        }

        if (rawCandles.length >= 10) {
          // If H4, aggregate 1h candles into 4-hour (14,400s) buckets as specified
          const processed =
            timeframe === 'H4'
              ? this.aggregateCandlesByBucket(rawCandles, 14400)
              : rawCandles;
          if (processed.length >= 8) {
            return processed.slice(-1000);
          }
        }
      }
    }

    return null;
  }

  /**
   * Aggregate 1h candles into 4-hour (14,400s) buckets for H4 timeframe
   */
  private aggregateCandlesByBucket(candles: Candle[], bucketSec: number): Candle[] {
    if (candles.length === 0) return [];
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    const map = new Map<number, Candle>();

    for (const c of sorted) {
      const bucket = Math.floor(c.time / bucketSec) * bucketSec;
      const existing = map.get(bucket);
      if (!existing) {
        map.set(bucket, { ...c, time: bucket });
      } else {
        existing.high = Math.max(existing.high, c.high);
        existing.low = Math.min(existing.low, c.low);
        existing.close = c.close;
        existing.volume += c.volume;
      }
    }

    return Array.from(map.values());
  }

  /**
   * API 2: FastForex Single Pair Live Fetch (/fetch-one)
   */
  public async fetchFastForexSinglePair(from: string, to: string): Promise<number | null> {
    try {
      const url = `${FASTFOREX_BASE_URL}/fetch-one?from=${from}&to=${to}&api_key=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const val = Number(json?.result?.[to]);
      return !isNaN(val) && val > 0 ? val : null;
    } catch {
      return null;
    }
  }

  /**
   * API 2: FastForex 14-Day Historical Time-Series (/time-series)
   */
  public async fetchFastForexTimeSeries(
    symbol: string,
    timeframe: Timeframe
  ): Promise<Candle[] | null> {
    if (symbol.length !== 6) return null;
    const from = symbol.slice(0, 3);
    const to = symbol.slice(3, 6);
    const cfg = ALL_SYMBOL_CONFIGS.find((c) => c.symbol === symbol);
    if (!cfg) return null;

    const endMs = SriLankaMarketHours.chartNowMillis();
    const startMs = endMs - 14 * 86400 * 1000;
    const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

    try {
      const url = `${FASTFOREX_BASE_URL}/time-series?from=${from}&to=${to}&start=${fmtDate(
        startMs
      )}&end=${fmtDate(endMs)}&interval=P1D&api_key=${this.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const seriesObj = json?.results?.[to];
      if (!seriesObj || typeof seriesObj !== 'object') return null;

      const entries = Object.entries(seriesObj)
        .map(([dateStr, val]) => ({
          dateStr,
          rate: Number(val),
        }))
        .filter((e) => !isNaN(e.rate) && e.rate > 0)
        .sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      if (entries.length < 2) return null;

      const dailyCandles: Candle[] = [];
      for (let i = 0; i < entries.length; i++) {
        const close = Number(entries[i].rate.toFixed(cfg.digits));
        const open = i > 0 ? Number(entries[i - 1].rate.toFixed(cfg.digits)) : close;
        const bodyDiff = Math.abs(close - open);
        const wick = Math.max(bodyDiff * 0.35, cfg.point * 12);
        const high = Number((Math.max(open, close) + wick).toFixed(cfg.digits));
        const low = Number((Math.min(open, close) - wick).toFixed(cfg.digits));
        const ts = Math.floor(new Date(`${entries[i].dateStr}T00:00:00Z`).getTime() / 1000);
        dailyCandles.push({
          time: ts,
          open,
          high,
          low,
          close,
          volume: 200,
        });
      }

      if (timeframe === 'D1') {
        return dailyCandles;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * API 3: Binance Live Bid/Ask BookTicker (/api/v3/bookTicker) with primary + backup endpoint
   */
  public async fetchBinancePrice(binanceSym: string): Promise<number | null> {
    const endpoints = [
      `https://data-api.binance.vision/api/v3/bookTicker?symbol=${binanceSym}`,
      `https://api.binance.com/api/v3/bookTicker?symbol=${binanceSym}`,
    ];
    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const json = await res.json();
        const bid = parseFloat(json?.bidPrice);
        if (!isNaN(bid) && bid > 0) {
          return bid;
        }
      } catch {
        // Try backup endpoint
      }
    }
    return null;
  }

  /**
   * API 3: Binance Historical Candlesticks / Klines (/api/v3/klines) with limit=1000
   */
  public async fetchBinanceCandles(
    symbol: 'BTCUSD' | 'XAUUSD',
    timeframe: Timeframe
  ): Promise<Candle[] | null> {
    const binanceSymbol = symbol === 'BTCUSD' ? 'BTCUSDT' : 'PAXGUSDT';
    const intervalMap: Record<Timeframe, string> = {
      M1: '1m',
      M5: '5m',
      M15: '15m',
      M30: '30m',
      H1: '1h',
      H4: '4h',
      D1: '1d',
      W1: '1w',
      MN: '1M',
    };

    const interval = intervalMap[timeframe] || '1m';
    const endpoints = [
      `https://data-api.binance.vision/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=1000`,
      `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=1000`,
    ];

    const cutoffEpochSec = Math.floor(SriLankaMarketHours.chartNowMillis() / 1000);
    const isIntraday = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4'].includes(timeframe);
    const cfg = ALL_SYMBOL_CONFIGS.find((c) => c.symbol === symbol);
    const digits = cfg?.digits ?? 2;

    for (const url of endpoints) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const rows = await res.json();
        if (!Array.isArray(rows) || rows.length < 15) continue;

        const candles: Candle[] = [];
        for (const r of rows) {
          if (!Array.isArray(r) || r.length < 5) continue;
          const openTimeSec = Math.floor(Number(r[0]) / 1000);
          if (openTimeSec > cutoffEpochSec) continue;
          if (isIntraday && !SriLankaMarketHours.isMarketOpen(openTimeSec * 1000)) {
            continue;
          }

          const o = parseFloat(String(r[1]));
          const h = parseFloat(String(r[2]));
          const l = parseFloat(String(r[3]));
          const c = parseFloat(String(r[4]));
          const v = parseFloat(String(r[5])) || 100;

          if (isNaN(o) || isNaN(h) || isNaN(l) || isNaN(c) || o <= 0) continue;

          candles.push({
            time: openTimeSec,
            open: Number(o.toFixed(digits)),
            high: Number(h.toFixed(digits)),
            low: Number(l.toFixed(digits)),
            close: Number(c.toFixed(digits)),
            volume: v,
          });
        }

        if (candles.length >= 15) {
          const latestClose = candles[candles.length - 1].close;
          this.setServerRate(symbol, latestClose);
          return candles;
        }
      } catch {
        // Try backup endpoint
      }
    }

    return null;
  }

  /**
   * Master Chart Loader:
   * 1. Primary: Yahoo Finance v8 Chart API (GC=F / XAUUSD=X, ^NDX / NQ=F, EURUSD=X, JPY=X, etc.)
   * 2. Secondary: Binance Klines API for BTCUSD (BTCUSDT) & XAUUSD (PAXGUSDT)
   * 3. Tertiary: FastForex 14-day Time-Series API for Forex pairs
   * 4. Fallback: Realistic anchored historical series
   */
  public async loadChartCandles(
    symbol: string,
    timeframe: Timeframe,
    fallbackPrice?: number
  ): Promise<Candle[]> {
    // 1. Primary: Yahoo Finance v8 Chart API
    const yahooCandles = await this.fetchYahooFinanceCandles(symbol, timeframe);
    if (yahooCandles && yahooCandles.length >= 8) {
      const spot = this.getServerRate(symbol) ?? fallbackPrice;
      return this.candleAggregator.seedFromServerHistory(symbol, timeframe, yahooCandles, spot);
    }

    // 2. Secondary: Binance Global Market Data API for BTCUSD & XAUUSD
    if (symbol === 'BTCUSD' || symbol === 'XAUUSD') {
      const binanceCandles = await this.fetchBinanceCandles(symbol, timeframe);
      if (binanceCandles && binanceCandles.length >= 10) {
        const spot = this.getServerRate(symbol) ?? fallbackPrice;
        return this.candleAggregator.seedFromServerHistory(
          symbol,
          timeframe,
          binanceCandles,
          spot
        );
      }
    }

    // 3. Tertiary: FastForex 14-Day Time Series
    const ffCandles = await this.fetchFastForexTimeSeries(symbol, timeframe);
    if (ffCandles && ffCandles.length >= 5) {
      const spot = this.getServerRate(symbol) ?? fallbackPrice;
      return this.candleAggregator.seedFromServerHistory(symbol, timeframe, ffCandles, spot);
    }

    // 4. Fallback anchored to server rate
    const anchor = this.getServerRate(symbol) ?? fallbackPrice ?? 1.0;
    return this.candleAggregator.getCandles(symbol, timeframe, anchor);
  }

  /**
   * Refresh Live Market Rates across all 3 APIs (FastForex /fetch-multi, Yahoo Spot, Binance bookTicker)
   */
  public async refreshLiveMarketRates(symbols: string[]): Promise<Record<string, number>> {
    const updated: Record<string, number> = {};

    // 1. Binance bookTicker for BTCUSD & XAUUSD + Yahoo Spot for XAUUSD & NAS100
    await Promise.allSettled([
      this.fetchBinancePrice('BTCUSDT').then((price) => {
        if (price && price > 1000) {
          this.setServerRate('BTCUSD', price);
          updated['BTCUSD'] = price;
        }
      }),
      this.fetchYahooSpotPrice('XAUUSD').then(async (yahooGold) => {
        if (yahooGold && yahooGold > 500) {
          this.setServerRate('XAUUSD', yahooGold);
          updated['XAUUSD'] = yahooGold;
        } else {
          const paxg = await this.fetchBinancePrice('PAXGUSDT');
          if (paxg && paxg > 500) {
            this.setServerRate('XAUUSD', paxg);
            updated['XAUUSD'] = paxg;
          }
        }
      }),
      this.fetchYahooSpotPrice('NAS100').then((nasPrice) => {
        if (nasPrice && nasPrice > 1000) {
          this.setServerRate('NAS100', nasPrice);
          updated['NAS100'] = nasPrice;
        }
      }),
    ]);

    // 2. FastForex Multi-Currency Live Fetch (/fetch-multi)
    // GET https://api.fastforex.io/fetch-multi?from=USD&to=EUR,GBP,JPY,CHF,CAD,AUD,NZD,SEK,CNH&api_key=3806d9f7ce-718310d047-tmwxxx
    try {
      const currencies = ['EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'SEK', 'CNH'];
      const url = `${FASTFOREX_BASE_URL}/fetch-multi?from=USD&to=${currencies.join(
        ','
      )}&api_key=${this.apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const r = json?.results;
        if (r) {
          for (const sym of symbols) {
            if (sym === 'XAUUSD' || sym === 'BTCUSD' || sym === 'NAS100') continue;
            const from = sym.slice(0, 3);
            const to = sym.slice(3, 6);
            let rate: number | null = null;

            if (from === 'USD' && typeof r[to] === 'number' && r[to] > 0) {
              // USDxxx pairs (USDJPY, USDCHF, USDCAD, USDSEK, USDCNH) -> direct rate
              rate = r[to];
            } else if (to === 'USD' && typeof r[from] === 'number' && r[from] > 0) {
              // xxxUSD pairs (EURUSD, GBPUSD, AUDUSD, NZDUSD) -> 1.0 / rate
              rate = 1.0 / r[from];
            } else if (
              typeof r[from] === 'number' &&
              r[from] > 0 &&
              typeof r[to] === 'number' &&
              r[to] > 0
            ) {
              // Crosses (AUDCAD, AUDCHF, AUDJPY, AUDNZD, CADCHF, CADJPY, CHFJPY, EURAUD)
              rate = r[to] / r[from];
            }

            if (rate !== null && rate > 0) {
              const cfg = ALL_SYMBOL_CONFIGS.find((c) => c.symbol === sym);
              const clean = cfg ? Number(rate.toFixed(cfg.digits)) : rate;
              this.setServerRate(sym, clean);
              updated[sym] = clean;
            }
          }
        }
      }
    } catch {
      // Fallback to Yahoo Finance spot price if FastForex is unreachable
    }

    return updated;
  }
}
