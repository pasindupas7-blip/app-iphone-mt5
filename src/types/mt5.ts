export type Timeframe = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';

export type MainTab = 'quotes' | 'chart' | 'trade' | 'history' | 'settings';

export interface SymbolConfig {
  symbol: string;
  description: string;
  digits: number;
  point: number;
  contractSize: number;
  baseBid: number;
  defaultSpreadPts: number;
  volatility: number;
  marginRate: number;
  category: 'Metals' | 'Indices' | 'Forex' | 'Crypto';
  twelveDataSymbol: string;
}

export interface QuoteData extends SymbolConfig {
  bid: number;
  ask: number;
  prevBid: number;
  prevAsk: number;
  low: number;
  high: number;
  open24h: number;
  spread: number;
  changePts: number;
  changePct: number;
  timestamp: string;
  flash: 'up' | 'down' | 'none';
  lastTickMs: number;
}

export interface Candle {
  time: number; // Unix timestamp in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  lots: number;
  openPrice: number;
  openTime: string;
  sl: number | null;
  tp: number | null;
  swap: number;
  commission: number;
}

export interface ClosedDeal {
  id: string;
  orderId: string;
  symbol: string;
  type: 'buy' | 'sell' | 'balance';
  lots: number;
  openPrice: number;
  closePrice: number;
  openTime: string;
  closeTime: string;
  profit: number;
  swap: number;
  commission: number;
  sl: number | null;
  tp: number | null;
  closeReason: 'manual' | 'sl' | 'tp' | 'deposit';
  comment?: string;
}

export interface TradingAccount {
  id: string;
  name: string;
  login: string;
  broker: string;
  company: string;
  server: string;
  balance: number;
  initialDeposit: number;
  leverage: number;
  currency: string;
  isDemo: boolean;
  readOnly?: boolean;
  logoType: 'fusion' | 'ftmo_mt5' | 'ftmo' | 'fundingpips' | 'vt';
}
