import { Candle, Position, QuoteData, SymbolConfig, Timeframe, TradingAccount, ClosedDeal } from '../types/mt5';

export const DEFAULT_WATCHLIST_SYMBOLS = [
  'XAUUSD',
  'NAS100',
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'BTCUSD',
];

export const ALL_SYMBOL_CONFIGS: SymbolConfig[] = [
  {
    symbol: 'XAUUSD',
    description: 'Gold vs US Dollar',
    digits: 2,
    point: 0.01,
    contractSize: 100,
    baseBid: 4070.19,
    defaultSpreadPts: 18,
    volatility: 0.42,
    marginRate: 0.01,
    category: 'Metals',
    twelveDataSymbol: 'XAU/USD',
  },
  {
    symbol: 'NAS100',
    description: 'US Tech 100 Index',
    digits: 2,
    point: 0.01,
    contractSize: 1,
    baseBid: 21482.50,
    defaultSpreadPts: 120,
    volatility: 3.5,
    marginRate: 0.005,
    category: 'Indices',
    twelveDataSymbol: 'NDX',
  },
  {
    symbol: 'EURUSD',
    description: 'Euro vs US Dollar',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 1.08452,
    defaultSpreadPts: 6,
    volatility: 0.00012,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'EUR/USD',
  },
  {
    symbol: 'GBPUSD',
    description: 'Great Britain Pound vs US Dollar',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 1.29634,
    defaultSpreadPts: 9,
    volatility: 0.00015,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'GBP/USD',
  },
  {
    symbol: 'USDJPY',
    description: 'US Dollar vs Japanese Yen',
    digits: 3,
    point: 0.001,
    contractSize: 100000,
    baseBid: 152.643,
    defaultSpreadPts: 8,
    volatility: 0.018,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'USD/JPY',
  },
  {
    symbol: 'BTCUSD',
    description: 'Bitcoin vs US Dollar',
    digits: 2,
    point: 0.01,
    contractSize: 1,
    baseBid: 89420.50,
    defaultSpreadPts: 1850,
    volatility: 24.0,
    marginRate: 0.02,
    category: 'Crypto',
    twelveDataSymbol: 'BTC/USD',
  },
  {
    symbol: 'AUDCAD',
    description: 'Australian Dollar vs Canadian Dollar',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 0.97000,
    defaultSpreadPts: 59,
    volatility: 0.00011,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'AUD/CAD',
  },
  {
    symbol: 'AUDCHF',
    description: 'Australian Dollar vs Swiss Franc',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 0.56332,
    defaultSpreadPts: 36,
    volatility: 0.00010,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'AUD/CHF',
  },
  {
    symbol: 'AUDJPY',
    description: 'Australian Dollar vs Japanese Yen',
    digits: 3,
    point: 0.001,
    contractSize: 100000,
    baseBid: 108.796,
    defaultSpreadPts: 88,
    volatility: 0.015,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'AUD/JPY',
  },
  {
    symbol: 'AUDNZD',
    description: 'Australian Dollar vs New Zealand Dollar',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 1.23771,
    defaultSpreadPts: 146,
    volatility: 0.00011,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'AUD/NZD',
  },
  {
    symbol: 'AUDUSD',
    description: 'Australian Dollar vs US Dollar',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 0.68663,
    defaultSpreadPts: 6,
    volatility: 0.00011,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'AUD/USD',
  },
  {
    symbol: 'CADCHF',
    description: 'Canadian Dollar vs Swiss Franc',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 0.58066,
    defaultSpreadPts: 30,
    volatility: 0.00009,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'CAD/CHF',
  },
  {
    symbol: 'CADJPY',
    description: 'Canadian Dollar vs Japanese Yen',
    digits: 3,
    point: 0.001,
    contractSize: 100000,
    baseBid: 112.139,
    defaultSpreadPts: 66,
    volatility: 0.014,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'CAD/JPY',
  },
  {
    symbol: 'CHFJPY',
    description: 'Swiss Franc vs Japanese Yen',
    digits: 3,
    point: 0.001,
    contractSize: 100000,
    baseBid: 193.079,
    defaultSpreadPts: 139,
    volatility: 0.019,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'CHF/JPY',
  },
  {
    symbol: 'EURAUD',
    description: 'Euro vs Australian Dollar',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 1.62166,
    defaultSpreadPts: 99,
    volatility: 0.00016,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'EUR/AUD',
  },
];

export const INITIAL_ACCOUNTS: TradingAccount[] = [
  {
    id: 'acc-ftmo-100k',
    name: '$100k FTMO Free Trial',
    login: '1512092510',
    broker: 'FTMO-Demo',
    company: 'FTMO Evaluation Global s.r.o.',
    server: 'FTMO-Demo',
    balance: 100751.70,
    initialDeposit: 100000.00,
    leverage: 100,
    currency: 'USD',
    isDemo: true,
    logoType: 'ftmo',
  },
  {
    id: 'acc-fusion-004',
    name: 'DEMO_004',
    login: '239081',
    broker: 'FusionMarkets-Demo',
    company: 'Fusion Markets Pty Ltd',
    server: 'FusionMarkets-Demo',
    balance: 18043.14,
    initialDeposit: 20000.00,
    leverage: 500,
    currency: 'USD',
    isDemo: true,
    logoType: 'fusion',
  },
  {
    id: 'acc-ftmo-2',
    name: '$100k FTMO Free Trial',
    login: '1520851725',
    broker: 'FTMO-Demo2',
    company: 'FTMO Evaluation Global s.r.o.',
    server: 'FTMO-Demo2',
    balance: 99580.44,
    initialDeposit: 100000.00,
    leverage: 100,
    currency: 'USD',
    isDemo: true,
    logoType: 'ftmo_mt5',
  },
  {
    id: 'acc-fusion-010',
    name: 'DEMO_010',
    login: '420784',
    broker: 'FusionMarkets-Demo',
    company: 'Fusion Markets Pty Ltd',
    server: 'FusionMarkets-Demo',
    balance: 1.42,
    initialDeposit: 674.08,
    leverage: 500,
    currency: 'USD',
    isDemo: true,
    logoType: 'fusion',
  },
  {
    id: 'acc-fundingpips',
    name: '10055530',
    login: '10055530',
    broker: 'FundingPips2-SIM',
    company: 'FundingPips Corp',
    server: 'FundingPips2-SIM',
    balance: 50240.00,
    initialDeposit: 50000.00,
    leverage: 100,
    currency: 'USD',
    isDemo: true,
    logoType: 'fundingpips',
  },
  {
    id: 'acc-fusion-live',
    name: 'pasindu pelanage 004',
    login: '4030119',
    broker: 'FusionMarkets-Live',
    company: 'Fusion Markets Pty Ltd',
    server: 'FusionMarkets-Live',
    balance: 0.00,
    initialDeposit: 0.00,
    leverage: 500,
    currency: 'USD',
    isDemo: false,
    readOnly: true,
    logoType: 'fusion',
  },
  {
    id: 'acc-vt-live',
    name: 'pasindu palange',
    login: '10452041',
    broker: 'VTMarkets-Live',
    company: 'VT Markets LLC',
    server: 'VTMarkets-Live',
    balance: 0.00,
    initialDeposit: 0.00,
    leverage: 500,
    currency: 'USD',
    isDemo: false,
    logoType: 'vt',
  },
];

export const INITIAL_CLOSED_DEALS: ClosedDeal[] = [
  {
    id: '89201401',
    orderId: '89201401',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4341.75,
    closePrice: 4341.22,
    openTime: '2026.08.07 23:10:12',
    closeTime: '2026.08.07 23:13:38',
    profit: -5.30,
    swap: 0.00,
    commission: -0.70,
    sl: 4335.00,
    tp: 4355.00,
    closeReason: 'manual',
  },
  {
    id: '89201402',
    orderId: '89201402',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4341.84,
    closePrice: 4341.22,
    openTime: '2026.08.07 23:11:04',
    closeTime: '2026.08.07 23:13:38',
    profit: -6.20,
    swap: 0.00,
    commission: -0.70,
    sl: 4335.00,
    tp: 4355.00,
    closeReason: 'manual',
  },
  {
    id: '89201403',
    orderId: '89201403',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4341.84,
    closePrice: 4341.22,
    openTime: '2026.08.07 23:11:19',
    closeTime: '2026.08.07 23:13:38',
    profit: -6.20,
    swap: 0.00,
    commission: -0.70,
    sl: null,
    tp: null,
    closeReason: 'manual',
  },
  {
    id: '89201404',
    orderId: '89201404',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4341.86,
    closePrice: 4341.22,
    openTime: '2026.08.07 23:12:01',
    closeTime: '2026.08.07 23:13:38',
    profit: -6.40,
    swap: 0.00,
    commission: -0.70,
    sl: null,
    tp: null,
    closeReason: 'manual',
  },
  {
    id: '89201405',
    orderId: '89201405',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4367.13,
    closePrice: 4351.51,
    openTime: '2026.09.10 20:15:40',
    closeTime: '2026.09.10 20:58:01',
    profit: -156.20,
    swap: 0.00,
    commission: -0.70,
    sl: 4351.51,
    tp: 4390.00,
    closeReason: 'sl',
  },
  {
    id: '89201406',
    orderId: '89201406',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4367.02,
    closePrice: 4350.67,
    openTime: '2026.09.10 20:18:22',
    closeTime: '2026.09.10 21:02:00',
    profit: -163.50,
    swap: 0.00,
    commission: -0.70,
    sl: 4350.67,
    tp: 4390.00,
    closeReason: 'sl',
  },
  {
    id: '89201407',
    orderId: '89201407',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4367.00,
    closePrice: 4348.91,
    openTime: '2026.09.10 20:21:11',
    closeTime: '2026.09.10 21:04:01',
    profit: -180.90,
    swap: 0.00,
    commission: -0.70,
    sl: 4348.91,
    tp: null,
    closeReason: 'sl',
  },
  {
    id: '89201408',
    orderId: '89201408',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.01,
    openPrice: 3895.55,
    closePrice: 3899.35,
    openTime: '2026.11.02 10:12:05',
    closeTime: '2026.11.02 10:40:48',
    profit: 3.80,
    swap: 0.00,
    commission: -0.07,
    sl: 3890.00,
    tp: 3899.35,
    closeReason: 'tp',
  },
  {
    id: '89201409',
    orderId: '89201409',
    symbol: 'XAUUSD',
    type: 'sell',
    lots: 0.01,
    openPrice: 3899.77,
    closePrice: 3918.94,
    openTime: '2026.11.02 14:20:10',
    closeTime: '2026.11.02 15:37:55',
    profit: -19.17,
    swap: 0.00,
    commission: -0.07,
    sl: 3918.94,
    tp: 3880.00,
    closeReason: 'sl',
  },
  {
    id: '89201410',
    orderId: '89201410',
    symbol: 'NAS100',
    type: 'buy',
    lots: 1.5,
    openPrice: 21240.00,
    closePrice: 21495.20,
    openTime: '2026.11.05 15:30:10',
    closeTime: '2026.11.05 16:45:22',
    profit: 382.80,
    swap: 0.00,
    commission: -4.50,
    sl: 21150.00,
    tp: 21495.20,
    closeReason: 'tp',
  },
  {
    id: '89201411',
    orderId: '89201411',
    symbol: 'EURUSD',
    type: 'sell',
    lots: 1.0,
    openPrice: 1.08920,
    closePrice: 1.08415,
    openTime: '2026.11.06 09:15:00',
    closeTime: '2026.11.06 14:22:18',
    profit: 505.00,
    swap: 0.00,
    commission: -7.00,
    sl: 1.09200,
    tp: 1.08415,
    closeReason: 'tp',
  },
];

/**
 * Formats a price into the authentic MT5 3-part display:
 * - prefix: normal size leading digits (e.g., "0.97" or "4070.")
 * - big: enlarged 2 main pip digits (e.g., "00" or "19")
 * - sup: superscript point digit (e.g., "0" or "9")
 */
export function splitMT5Price(price: number, digits: number): {
  prefix: string;
  big: string;
  sup: string;
} {
  const formatted = price.toFixed(digits);
  if (digits === 5 || digits === 3) {
    // e.g. 0.97000 -> prefix "0.97", big "00", sup "0"
    // e.g. 108.796 -> prefix "108.", big "79", sup "6"
    const len = formatted.length;
    return {
      prefix: formatted.slice(0, len - 3),
      big: formatted.slice(len - 3, len - 1),
      sup: formatted.slice(len - 1),
    };
  }
  if (digits === 2) {
    // For 2-digit symbols like XAUUSD (4070.19), NAS100 (21482.50), BTCUSD (89420.50)
    // Show integer part + dot as prefix, last 2 decimal digits as big, or last digit as sup if >10000
    const len = formatted.length;
    return {
      prefix: formatted.slice(0, len - 2),
      big: formatted.slice(len - 2),
      sup: '',
    };
  }
  return {
    prefix: formatted,
    big: '',
    sup: '',
  };
}

export function formatTimeHMS(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatMT5DateTime(date: Date = new Date()): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${mo}.${d} ${formatTimeHMS(date)}`;
}

/**
 * Formats numbers with spaces for thousands like MT5 iOS ("100 751.70", "18 043.14")
 */
export function formatMT5Money(val: number, showPlus = false): string {
  const sign = val < 0 ? '-' : showPlus && val > 0 ? '+' : '';
  const abs = Math.abs(val).toFixed(2);
  const [intPart, decPart] = abs.split('.');
  const spacedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${spacedInt}.${decPart}`;
}

/**
 * Calculates floating P/L for an open position based on live Bid/Ask
 */
export function calculatePositionPL(pos: Position, quote: QuoteData | undefined): number {
  if (!quote) return 0;
  const closePrice = pos.type === 'buy' ? quote.bid : quote.ask;
  const diff = pos.type === 'buy' ? closePrice - pos.openPrice : pos.openPrice - closePrice;

  if (pos.symbol === 'XAUUSD') {
    // 1 lot = 100 oz -> $1 move = $100 per 1.0 lot
    return Number((diff * 100 * pos.lots).toFixed(2));
  }
  if (pos.symbol === 'NAS100' || pos.symbol === 'BTCUSD') {
    // 1 lot = 1 contract -> $1 move = $1 per 1.0 lot (or 10x for NAS100 CFD)
    const mult = pos.symbol === 'NAS100' ? 10 : 1;
    return Number((diff * mult * pos.lots).toFixed(2));
  }
  if (pos.symbol.endsWith('JPY')) {
    // 1 lot = 100,000 units, quote in JPY (~152)
    return Number(((diff * 100000 * pos.lots) / closePrice).toFixed(2));
  }
  // Standard FX pair (EURUSD, GBPUSD, etc.)
  return Number((diff * 100000 * pos.lots).toFixed(2));
}

/**
 * Calculates required margin for a position
 */
export function calculatePositionMargin(
  pos: Position,
  quote: QuoteData | undefined,
  leverage: number = 100
): number {
  const price = quote ? quote.bid : pos.openPrice;
  const contractSize = quote ? quote.contractSize : pos.symbol === 'XAUUSD' ? 100 : 100000;
  const notional =
    pos.symbol.endsWith('JPY')
      ? (pos.lots * contractSize)
      : pos.lots * contractSize * price;
  return Number((notional / leverage).toFixed(2));
}

export function getTimeframeSeconds(tf: Timeframe): number {
  switch (tf) {
    case 'M1':
      return 60;
    case 'M5':
      return 300;
    case 'M15':
      return 900;
    case 'M30':
      return 1800;
    case 'H1':
      return 3600;
    case 'H4':
      return 14400;
    case 'D1':
      return 86400;
  }
}

/**
 * Generates realistic historical OHLC candlestick series anchored to the current live bid price
 */
export function generateHistoricalCandles(
  config: SymbolConfig,
  tf: Timeframe,
  currentBid: number,
  count: number = 140
): Candle[] {
  const stepSec = getTimeframeSeconds(tf);
  const nowSec = Math.floor(Date.now() / 1000);
  const currentBucket = Math.floor(nowSec / stepSec) * stepSec;

  // Deterministic pseudo-random walk backwards from currentBid so chart ends right at currentBid
  const candles: Candle[] = [];
  let cursorClose = currentBid;
  const tfMultiplier = Math.sqrt(stepSec / 60);
  const vol = config.volatility * tfMultiplier;

  // Seed based on symbol + timeframe
  let seed =
    config.symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 31, 0) + stepSec;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const time = currentBucket - i * stepSec;
    // Create realistic wave structure like Screenshot 6
    const waveBias = Math.sin((count - i) * 0.14) * vol * 0.45;
    const delta = (rand() - 0.48) * vol * 2.2 + waveBias;
    const open = Number((cursorClose - delta).toFixed(config.digits));
    const close = Number(cursorClose.toFixed(config.digits));
    const wickUp = rand() * vol * 1.35;
    const wickDown = rand() * vol * 1.35;
    const high = Number((Math.max(open, close) + wickUp).toFixed(config.digits));
    const low = Number((Math.min(open, close) - wickDown).toFixed(config.digits));
    const volume = Math.floor(50 + rand() * 350);

    candles.unshift({
      time,
      open,
      high,
      low,
      close,
      volume,
    });

    cursorClose = open;
  }

  // Ensure the final candle's close matches currentBid
  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = Number(currentBid.toFixed(config.digits));
    last.high = Math.max(last.high, last.close);
    last.low = Math.min(last.low, last.close);
  }

  return candles;
}
