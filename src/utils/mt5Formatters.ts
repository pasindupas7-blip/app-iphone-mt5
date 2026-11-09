import { Candle, Position, QuoteData, SymbolConfig, Timeframe, TradingAccount, ClosedDeal } from '../types/mt5';

export const DEFAULT_WATCHLIST_SYMBOLS = [
  'AUDCAD',
  'AUDCHF',
  'AUDJPY',
  'AUDNZD',
  'AUDUSD',
  'CADCHF',
  'CADJPY',
  'CHFJPY',
  'EURAUD',
  'XAUUSD',
  'NAS100',
  'EURUSD',
  'GBPUSD',
  'USDJPY',
  'USDCHF',
  'USDCAD',
  'NZDUSD',
  'USDSEK',
  'USDCNH',
  'BTCUSD',
];

export const ALL_SYMBOL_CONFIGS: SymbolConfig[] = [
  {
    symbol: 'AUDCAD',
    description: 'Australian Dollar vs Canadian Dollar',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 0.97000,
    defaultSpreadPts: 59,
    volatility: 0.00008,
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
    volatility: 0.00007,
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
    volatility: 0.012,
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
    volatility: 0.00008,
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
    defaultSpreadPts: 19,
    volatility: 0.00008,
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
    volatility: 0.00007,
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
    volatility: 0.011,
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
    volatility: 0.014,
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
    volatility: 0.00011,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'EUR/AUD',
  },
  {
    symbol: 'EURCAD',
    description: 'Euro vs Canadian Dollar',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 1.49825,
    defaultSpreadPts: 35,
    volatility: 0.00010,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'EUR/CAD',
  },
  {
    symbol: 'XAUUSD',
    description: 'Gold vs US Dollar',
    digits: 2,
    point: 0.01,
    contractSize: 100,
    baseBid: 4070.19,
    defaultSpreadPts: 16,
    volatility: 0.35,
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
    defaultSpreadPts: 80,
    volatility: 3.2,
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
    defaultSpreadPts: 14,
    volatility: 0.00010,
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
    defaultSpreadPts: 19,
    volatility: 0.00012,
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
    defaultSpreadPts: 20,
    volatility: 0.015,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'USD/JPY',
  },
  {
    symbol: 'USDCHF',
    description: 'US Dollar vs Swiss Franc',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 0.87542,
    defaultSpreadPts: 16,
    volatility: 0.00009,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'USD/CHF',
  },
  {
    symbol: 'USDCAD',
    description: 'US Dollar vs Canadian Dollar',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 1.38945,
    defaultSpreadPts: 24,
    volatility: 0.00010,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'USD/CAD',
  },
  {
    symbol: 'NZDUSD',
    description: 'New Zealand Dollar vs US Dollar',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 0.59724,
    defaultSpreadPts: 20,
    volatility: 0.00008,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'NZD/USD',
  },
  {
    symbol: 'USDSEK',
    description: 'US Dollar vs Swedish Krona',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 10.68450,
    defaultSpreadPts: 41,
    volatility: 0.00085,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'USD/SEK',
  },
  {
    symbol: 'USDCNH',
    description: 'US Dollar vs Chinese Yuan Offshore',
    digits: 5,
    point: 0.00001,
    contractSize: 100000,
    baseBid: 7.18420,
    defaultSpreadPts: 18,
    volatility: 0.00045,
    marginRate: 0.01,
    category: 'Forex',
    twelveDataSymbol: 'USD/CNH',
  },
  {
    symbol: 'BTCUSD',
    description: 'Bitcoin vs US Dollar',
    digits: 2,
    point: 0.01,
    contractSize: 1,
    baseBid: 89420.50,
    defaultSpreadPts: 1850,
    volatility: 22.0,
    marginRate: 0.02,
    category: 'Crypto',
    twelveDataSymbol: 'BTC/USD',
  },
];

// Exact 7 accounts in exact order from Screenshot 3
export const INITIAL_ACCOUNTS: TradingAccount[] = [
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

// Exact closed deals matching Screenshot 4 so Deposit=674.08, Profit=-655.80, Swap=0.00, Commission=-16.86, Balance=1.42
export const INITIAL_CLOSED_DEALS: ClosedDeal[] = [
  {
    id: '89201400',
    orderId: '89201400',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4352.15,
    closePrice: 4341.22,
    openTime: '2026.08.07 22:55:10',
    closeTime: '2026.08.07 23:13:38',
    profit: -109.33,
    swap: 0.00,
    commission: -11.86,
    sl: null,
    tp: null,
    closeReason: 'manual',
  },
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
    commission: -0.50,
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
    commission: -0.50,
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
    commission: -0.50,
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
    commission: -0.50,
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
    openPrice: 4341.86,
    closePrice: 4341.22,
    openTime: '2026.08.07 23:12:15',
    closeTime: '2026.08.07 23:13:38',
    profit: -6.40,
    swap: 0.00,
    commission: -0.50,
    sl: null,
    tp: null,
    closeReason: 'manual',
  },
  {
    id: '89201406',
    orderId: '89201406',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4367.13,
    closePrice: 4351.51,
    openTime: '2026.09.10 20:15:40',
    closeTime: '2026.09.10 20:58:01',
    profit: -156.20,
    swap: 0.00,
    commission: -0.50,
    sl: 4351.51,
    tp: 4390.00,
    closeReason: 'sl',
  },
  {
    id: '89201407',
    orderId: '89201407',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4367.02,
    closePrice: 4350.67,
    openTime: '2026.09.10 20:18:22',
    closeTime: '2026.09.10 21:02:00',
    profit: -163.50,
    swap: 0.00,
    commission: -0.50,
    sl: 4350.67,
    tp: 4390.00,
    closeReason: 'sl',
  },
  {
    id: '89201408',
    orderId: '89201408',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.1,
    openPrice: 4367.00,
    closePrice: 4348.91,
    openTime: '2026.09.10 20:21:11',
    closeTime: '2026.09.10 21:04:01',
    profit: -180.90,
    swap: 0.00,
    commission: -0.50,
    sl: 4348.91,
    tp: null,
    closeReason: 'sl',
  },
  {
    id: '89201409',
    orderId: '89201409',
    symbol: 'XAUUSD',
    type: 'buy',
    lots: 0.01,
    openPrice: 3895.55,
    closePrice: 3899.35,
    openTime: '2026.11.02 10:12:05',
    closeTime: '2026.11.02 10:40:48',
    profit: 3.80,
    swap: 0.00,
    commission: -0.50,
    sl: 3890.00,
    tp: 3899.35,
    closeReason: 'tp',
  },
  {
    id: '89201410',
    orderId: '89201410',
    symbol: 'XAUUSD',
    type: 'sell',
    lots: 0.01,
    openPrice: 3899.77,
    closePrice: 3918.94,
    openTime: '2026.11.02 14:20:10',
    closeTime: '2026.11.02 15:37:55',
    profit: -19.17,
    swap: 0.00,
    commission: -0.50,
    sl: 3918.94,
    tp: 3880.00,
    closeReason: 'sl',
  },
];

export function splitMT5Price(price: number, digits: number): {
  prefix: string;
  big: string;
  sup: string;
} {
  const formatted = price.toFixed(digits);
  if (digits === 5 || digits === 3) {
    const len = formatted.length;
    return {
      prefix: formatted.slice(0, len - 3),
      big: formatted.slice(len - 3, len - 1),
      sup: formatted.slice(len - 1),
    };
  }
  if (digits === 2) {
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
 * Parses an MT5 date string ("YYYY.MM.DD HH:MM:SS" or "YYYY-MM-DD HH:MM:SS") into epoch ms.
 */
export function parseMT5DateTimeMs(dateStr: string): number {
  if (!dateStr) return 0;
  const cleaned = dateStr.trim().replace(/\./g, '-');
  const [datePart, timePart = '00:00:00'] = cleaned.split(/\s+/);
  if (!datePart) return 0;
  const [y, m, d] = datePart.split('-').map((n) => parseInt(n, 10));
  const [hh = 0, mm = 0, ss = 0] = timePart.split(':').map((n) => parseInt(n, 10));
  if (isNaN(y) || isNaN(m) || isNaN(d)) return 0;
  return new Date(y, m - 1, d, hh || 0, mm || 0, ss || 0).getTime();
}

/**
 * Strictly sorts ClosedDeal items in chronological order (oldest -> newest) by closeTime, then openTime, then id.
 */
export function sortDealsChronologically(deals: ClosedDeal[]): ClosedDeal[] {
  return [...deals].sort((a, b) => {
    const tA = parseMT5DateTimeMs(a.closeTime || a.openTime);
    const tB = parseMT5DateTimeMs(b.closeTime || b.openTime);
    if (tA !== tB) return tA - tB;
    const oA = parseMT5DateTimeMs(a.openTime || a.closeTime);
    const oB = parseMT5DateTimeMs(b.openTime || b.closeTime);
    if (oA !== oB) return oA - oB;
    return a.id.localeCompare(b.id);
  });
}

export function calculateClosedDealProfit(
  symbol: string,
  type: 'buy' | 'sell',
  lots: number,
  openPrice: number,
  closePrice: number
): number {
  const diff = type === 'buy' ? closePrice - openPrice : openPrice - closePrice;
  if (symbol === 'XAUUSD') {
    return Number((diff * 100 * lots).toFixed(2));
  }
  if (symbol === 'NAS100' || symbol === 'BTCUSD') {
    const mult = symbol === 'NAS100' ? 10 : 1;
    return Number((diff * mult * lots).toFixed(2));
  }
  if (symbol.endsWith('JPY')) {
    const denom = closePrice > 0 ? closePrice : 150;
    return Number(((diff * 100000 * lots) / denom).toFixed(2));
  }
  return Number((diff * 100000 * lots).toFixed(2));
}

export function formatMT5Money(val: number, showPlus = false): string {
  const sign = val < 0 ? '-' : showPlus && val > 0 ? '+' : '';
  const abs = Math.abs(val).toFixed(2);
  const [intPart, decPart] = abs.split('.');
  const spacedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${sign}${spacedInt}.${decPart}`;
}

export function calculatePositionPL(pos: Position, quote: QuoteData | undefined): number {
  if (!quote) return 0;
  const closePrice = pos.type === 'buy' ? quote.bid : quote.ask;
  return calculateClosedDealProfit(pos.symbol, pos.type, pos.lots, pos.openPrice, closePrice);
}

export function calculatePositionMargin(
  pos: Position,
  quote: QuoteData | undefined,
  leverage: number = 100
): number {
  const price = quote ? quote.bid : pos.openPrice;
  const contractSize = quote ? quote.contractSize : pos.symbol === 'XAUUSD' ? 100 : 100000;
  const notional = pos.symbol.endsWith('JPY')
    ? pos.lots * contractSize
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
    case 'W1':
      return 604800;
    case 'MN':
      return 2592000;
  }
}

export function generateHistoricalCandles(
  config: SymbolConfig,
  tf: Timeframe,
  currentBid: number,
  count: number = 1200
): Candle[] {
  const stepSec = getTimeframeSeconds(tf);
  const nowSec = Math.floor(Date.now() / 1000);
  const currentBucket = Math.floor(nowSec / stepSec) * stepSec;

  const candles: Candle[] = [];
  let cursorClose = currentBid;
  const tfMultiplier = Math.sqrt(stepSec / 60);
  const vol = config.volatility * tfMultiplier;

  let seed =
    config.symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 31, 0) + stepSec;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const time = currentBucket - i * stepSec;
    // Create the exact sharp rally shape on the right side like Screenshot 6
    const waveBias =
      i < 16
        ? vol * 0.65
        : i < 32
        ? -vol * 0.25
        : Math.sin((count - i) * 0.14) * vol * 0.4;
    const delta = (rand() - 0.48) * vol * 2.1 + waveBias;
    const open = Number(Math.max(config.point * 10, cursorClose - delta).toFixed(config.digits));
    const close = Number(cursorClose.toFixed(config.digits));
    const wickUp = rand() * vol * 1.4;
    const wickDown = rand() * vol * 1.4;
    const high = Number((Math.max(open, close) + wickUp).toFixed(config.digits));
    const low = Number(
      Math.max(config.point * 5, Math.min(open, close) - wickDown).toFixed(config.digits)
    );
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

  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = Number(currentBid.toFixed(config.digits));
    last.high = Math.max(last.high, last.close);
    last.low = Math.min(last.low, last.close);
  }

  return candles;
}

/**
 * Seamlessly prepends older historical candles before existingCandles[0]
 * so scrolling backwards in the chart never runs out of candles.
 */
export function prependOlderCandles(
  existingCandles: Candle[],
  config: SymbolConfig,
  tf: Timeframe,
  countToPrepend: number = 600
): Candle[] {
  if (existingCandles.length === 0) {
    return generateHistoricalCandles(config, tf, config.baseBid, countToPrepend);
  }

  const oldest = existingCandles[0];
  const stepSec = getTimeframeSeconds(tf);
  const tfMultiplier = Math.sqrt(stepSec / 60);
  const vol = config.volatility * tfMultiplier;

  let seed =
    (oldest.time ^
      config.symbol.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 37, 0)) >>>
    0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const prepended: Candle[] = [];
  let cursorClose = oldest.open;

  for (let i = 1; i <= countToPrepend; i++) {
    const time = oldest.time - i * stepSec;
    const wave = Math.sin(i * 0.11) * vol * 0.35;
    const delta = (rand() - 0.495) * vol * 2.0 + wave;
    const open = Number(Math.max(config.point * 10, cursorClose - delta).toFixed(config.digits));
    const close = Number(cursorClose.toFixed(config.digits));
    const wickUp = rand() * vol * 1.35;
    const wickDown = rand() * vol * 1.35;
    const high = Number((Math.max(open, close) + wickUp).toFixed(config.digits));
    const low = Number(
      Math.max(config.point * 5, Math.min(open, close) - wickDown).toFixed(config.digits)
    );
    const volume = Math.floor(50 + rand() * 320);

    prepended.unshift({
      time,
      open,
      high,
      low,
      close,
      volume,
    });

    cursorClose = open;
  }

  return [...prepended, ...existingCandles];
}

