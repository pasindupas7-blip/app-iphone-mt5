import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Candle,
  ClosedDeal,
  MainTab,
  Position,
  QuoteData,
  Timeframe,
  TradingAccount,
} from './types/mt5';
import {
  ALL_SYMBOL_CONFIGS,
  calculatePositionPL,
  DEFAULT_WATCHLIST_SYMBOLS,
  generateHistoricalCandles,
  INITIAL_ACCOUNTS,
  INITIAL_CLOSED_DEALS,
  sortDealsChronologically,
} from './utils/mt5Formatters';
import { QuotesTab } from './components/QuotesTab';
import { ChartTab } from './components/ChartTab';
import { TradeTab } from './components/TradeTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsTab } from './components/SettingsTab';
import { NewOrderModal } from './components/NewOrderModal';
import {
  FastForexMarketService,
  SriLankaMarketHours,
} from './services/marketDataFeed';
import {
  subscribeAuthState,
  signInWithGoogle,
  signOutFirebase,
  observeOpenPositions,
  observeHistoryTrades,
  observeAllAccounts,
  upsertPositionToCloud,
  deletePositionFromCloud,
  addHistoryDealToCloud,
  deleteHistoryDealFromCloud,
  saveAccountInfoToCloud,
} from './services/firebaseRepository';

// Exact initial daily change values from Screenshot 7
const SCREENSHOT_CHANGE_OVERRIDES: Record<
  string,
  { pts: number; pct: number; low: number; high: number; time: string }
> = {
  AUDCAD: { pts: -128, pct: -0.13, low: 0.96457, high: 0.97298, time: '23:58:59' },
  AUDCHF: { pts: -259, pct: -0.46, low: 0.56053, high: 0.56679, time: '23:58:59' },
  AUDJPY: { pts: -478, pct: -0.44, low: 108.239, high: 109.538, time: '23:58:59' },
  AUDNZD: { pts: -81, pct: -0.07, low: 1.23546, high: 1.24278, time: '23:58:59' },
  AUDUSD: { pts: -636, pct: -0.92, low: 0.68544, high: 0.69424, time: '23:58:59' },
  CADCHF: { pts: -190, pct: -0.33, low: 0.57984, high: 0.58328, time: '23:58:58' },
  CADJPY: { pts: -349, pct: -0.31, low: 111.941, high: 112.692, time: '23:58:58' },
  CHFJPY: { pts: 4, pct: 0.0, low: 192.542, high: 193.559, time: '23:58:59' },
  EURAUD: { pts: 287, pct: 0.18, low: 1.6174, high: 1.6285, time: '23:58:59' },
};

const STORAGE_KEY_ACCOUNTS = 'mt5_ios_accounts_v2';
const STORAGE_KEY_DEALS = 'mt5_ios_closed_deals_v2';

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('quotes');
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST_SYMBOLS);
  const [quotesViewMode, setQuotesViewMode] = useState<'advanced' | 'simple'>('advanced');

  const [chartSymbol, setChartSymbol] = useState<string>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('M1');

  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderModalSymbol, setOrderModalSymbol] = useState('XAUUSD');

  // Default active account is DEMO_010 (Balance: 1.42 USD, matching Screenshots 1, 3, 4, 5)
  const [accounts, setAccounts] = useState<TradingAccount[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_ACCOUNTS;
  });
  const [activeAccountId, setActiveAccountId] = useState<string>(INITIAL_ACCOUNTS[0].id);

  const activeAccount =
    accounts.find((a) => a.id === activeAccountId) || accounts[0];

  // Empty positions initially so Trade tab matches Screenshot 1 (Balance: 1.42, Equity: 1.42, Free Margin: 1.42)
  const [positions, setPositions] = useState<Position[]>([]);
  const [closedDeals, setClosedDeals] = useState<ClosedDeal[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DEALS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return sortDealsChronologically(parsed);
      }
    } catch {
      // ignore storage errors
    }
    return sortDealsChronologically(INITIAL_CLOSED_DEALS);
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
    } catch {
      // ignore
    }
  }, [accounts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_DEALS, JSON.stringify(closedDeals));
    } catch {
      // ignore
    }
  }, [closedDeals]);

  const [cloudUserId, setCloudUserId] = useState<string | null>(null);
  const [cloudUserEmail, setCloudUserEmail] = useState<string | null>(null);

  const [twelveDataKey, setTwelveDataKey] = useState<string>('');
  const [wsStatus, setWsStatus] = useState<
    'simulator' | 'connecting' | 'connected' | 'error'
  >('simulator');

  const fastForexRef = useRef<FastForexMarketService>(new FastForexMarketService());
  const loadedChartKeysRef = useRef<Set<string>>(new Set());

  const [journalLogs, setJournalLogs] = useState<string[]>([
    `${SriLankaMarketHours.formatMt5DateTime()} [Terminal] MetaTrader 5 iOS Terminal initialized`,
    `${SriLankaMarketHours.formatMt5DateTime()} [MarketData] Yahoo Finance v8 Chart + FastForex + Binance feeds active`,
  ]);

  const appendLog = useCallback((msg: string) => {
    setJournalLogs((prev) => [
      `${SriLankaMarketHours.formatMt5DateTime()} ${msg}`,
      ...prev.slice(0, 99),
    ]);
  }, []);

  // Subscribe to Firebase Auth & Firestore subcollections (/users/{userId}/positions, /history, /accounts)
  useEffect(() => {
    const unsubAuth = subscribeAuthState((user) => {
      if (user) {
        setCloudUserId(user.uid);
        setCloudUserEmail(user.email || user.uid);
        appendLog(`[Firestore] Authenticated as ${user.email || user.uid}`);
      } else {
        setCloudUserId(null);
        setCloudUserEmail(null);
      }
    });
    return () => unsubAuth();
  }, [appendLog]);

  useEffect(() => {
    if (!cloudUserId) return;
    const accountDocId =
      activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;

    const unsubPos = observeOpenPositions(cloudUserId, accountDocId, (cloudPositions) => {
      setPositions(cloudPositions);
    });
    const unsubHist = observeHistoryTrades(cloudUserId, accountDocId, (cloudDeals) => {
      if (cloudDeals.length > 0) {
        setClosedDeals(sortDealsChronologically(cloudDeals));
      }
    });
    const unsubAcc = observeAllAccounts(cloudUserId, (cloudAccs) => {
      if (cloudAccs.length > 0) {
        setAccounts((prev) => {
          const merged = [...prev];
          for (const ca of cloudAccs) {
            const idx = merged.findIndex(
              (m) => m.id === ca.id || (ca.id === 'main' && m.id === INITIAL_ACCOUNTS[0].id)
            );
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...ca, id: merged[idx].id };
            } else {
              merged.push(ca);
            }
          }
          return merged;
        });
      }
    });

    return () => {
      unsubPos();
      unsubHist();
      unsubAcc();
    };
  }, [cloudUserId, activeAccountId]);

  // Initialize Quotes Map matching Screenshot 7 exact numbers and exact Spreads
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>(() => {
    const initial: Record<string, QuoteData> = {};
    const marketOpenNow = SriLankaMarketHours.isMarketOpen();
    const nowStr = SriLankaMarketHours.formatTimeHMS();
    for (const cfg of ALL_SYMBOL_CONFIGS) {
      const ov = SCREENSHOT_CHANGE_OVERRIDES[cfg.symbol];
      const spreadVal = cfg.defaultSpreadPts * cfg.point;
      const bid = cfg.baseBid;
      const ask = Number((bid + spreadVal).toFixed(cfg.digits));
      const open24h = ov
        ? Number((bid - ov.pts * cfg.point).toFixed(cfg.digits))
        : Number((bid - cfg.volatility * 6.5).toFixed(cfg.digits));
      const changePts = ov ? ov.pts : Math.round((bid - open24h) / cfg.point);
      const changePct = ov
        ? ov.pct
        : Number((((bid - open24h) / open24h) * 100).toFixed(2));
      initial[cfg.symbol] = {
        ...cfg,
        bid,
        ask,
        prevBid: bid,
        prevAsk: ask,
        low: ov ? ov.low : Number((bid - cfg.volatility * 14).toFixed(cfg.digits)),
        high: ov ? ov.high : Number((ask + cfg.volatility * 12).toFixed(cfg.digits)),
        open24h,
        spread: cfg.defaultSpreadPts,
        changePts,
        changePct,
        timestamp: marketOpenNow ? nowStr : ov ? ov.time : nowStr,
        flash: marketOpenNow ? (changePts >= 0 ? 'up' : 'down') : 'none',
        lastTickMs: Date.now(),
      };
    }
    return initial;
  });

  const [candlesMap, setCandlesMap] = useState<Record<string, Candle[]>>(() => {
    const map: Record<string, Candle[]> = {};
    const xauCfg =
      ALL_SYMBOL_CONFIGS.find((c) => c.symbol === 'XAUUSD') ||
      ALL_SYMBOL_CONFIGS[0];
    const initialXau = generateHistoricalCandles(xauCfg, 'M1', xauCfg.baseBid, 1200);
    map['XAUUSD_M1'] = initialXau;
    return map;
  });

  /**
   * 1. Historical & Real-Time Candlesticks (OHLC Chart Data):
   * Whenever chartSymbol or timeframe changes, fetch real OHLC candlesticks from:
   * - API 1: Yahoo Finance v8 Chart API (GC=F / XAUUSD=X, ^NDX / NQ=F, EURUSD=X, JPY=X, etc.)
   * - API 3: Binance Market Data API (/api/v3/klines)
   * - API 2: FastForex Time-Series API (/time-series)
   */
  useEffect(() => {
    const key = `${chartSymbol}_${timeframe}`;
    const cfg =
      ALL_SYMBOL_CONFIGS.find((c) => c.symbol === chartSymbol) ||
      ALL_SYMBOL_CONFIGS[0];
    const currentBid =
      fastForexRef.current.getServerRate(chartSymbol) ??
      quotes[chartSymbol]?.bid ??
      cfg.baseBid;

    // Ensure immediate non-empty series while server candles load
    setCandlesMap((prev) => {
      if (prev[key]) return prev;
      return {
        ...prev,
        [key]: fastForexRef.current.candleAggregator.getCandles(
          chartSymbol,
          timeframe,
          currentBid
        ),
      };
    });

    if (!loadedChartKeysRef.current.has(key)) {
      loadedChartKeysRef.current.add(key);
      fastForexRef.current
        .loadChartCandles(chartSymbol, timeframe, currentBid)
        .then((serverCandles) => {
          if (serverCandles && serverCandles.length > 0) {
            const latestClose = serverCandles[serverCandles.length - 1].close;
            fastForexRef.current.setServerRate(chartSymbol, latestClose);
            setCandlesMap((prev) => ({
              ...prev,
              [key]: serverCandles,
            }));
            setQuotes((prevQuotes) => {
              const cur = prevQuotes[chartSymbol];
              if (!cur) return prevQuotes;
              const newBid = Number(latestClose.toFixed(cur.digits));
              const newAsk = Number(
                (newBid + cur.defaultSpreadPts * cur.point).toFixed(cur.digits)
              );
              const direction: 'up' | 'down' =
                newBid > cur.bid
                  ? 'up'
                  : newBid < cur.bid
                    ? 'down'
                    : cur.flash === 'down'
                      ? 'down'
                      : 'up';
              return {
                ...prevQuotes,
                [chartSymbol]: {
                  ...cur,
                  prevBid: cur.bid,
                  prevAsk: cur.ask,
                  bid: newBid,
                  ask: newAsk,
                  low: Math.min(cur.low, newBid),
                  high: Math.max(cur.high, newAsk),
                  flash: SriLankaMarketHours.isMarketOpen() ? direction : 'none',
                },
              };
            });
          }
        });
    }
  }, [chartSymbol, timeframe, quotes]);

  /**
   * Apply a new Bid price tick:
   * - Computes Ask = Bid + spreadPts * pointSize
   * - Updates QuoteData (Bid, Ask, Low, High, ChangePts, ChangePct, Flash: 'up' -> Blue, 'down' -> Red)
   * - Feeds tick into CandleAggregator to update the forming candlestick's High, Low, Close in real time
   */
  const applyPriceTick = useCallback(
    (sym: string, rawNewBid: number, dynamicSpreadPts?: number) => {
      const marketOpenNow = SriLankaMarketHours.isMarketOpen();
      setQuotes((prevQuotes) => {
        const current = prevQuotes[sym];
        if (!current) return prevQuotes;

        const newBid = Number(rawNewBid.toFixed(current.digits));
        const spreadPts =
          dynamicSpreadPts !== undefined ? dynamicSpreadPts : current.defaultSpreadPts;
        const newAsk = Number(
          (newBid + spreadPts * current.point).toFixed(current.digits)
        );

        let direction: 'up' | 'down' | 'none';
        if (!marketOpenNow) {
          direction = 'none';
        } else if (newBid > current.bid) {
          direction = 'up';
        } else if (newBid < current.bid) {
          direction = 'down';
        } else {
          direction = current.flash === 'down' ? 'down' : 'up';
        }

        const changePts = Math.round((newBid - current.open24h) / current.point);
        const changePct = Number(
          (((newBid - current.open24h) / current.open24h) * 100).toFixed(2)
        );

        const updatedQuote: QuoteData = {
          ...current,
          prevBid: current.bid,
          prevAsk: current.ask,
          bid: newBid,
          ask: newAsk,
          low: Math.min(current.low, newBid),
          high: Math.max(current.high, newAsk),
          spread: spreadPts,
          changePts,
          changePct,
          timestamp: SriLankaMarketHours.formatTimeHMS(),
          flash: direction,
          lastTickMs: Date.now(),
        };

        return {
          ...prevQuotes,
          [sym]: updatedQuote,
        };
      });

      // Update forming candlesticks across all active timeframes via CandleAggregator
      const updatedSeries = fastForexRef.current.candleAggregator.onTick(
        sym,
        rawNewBid,
        SriLankaMarketHours.chartNowMillis()
      );
      if (Object.keys(updatedSeries).length > 0) {
        setCandlesMap((prev) => ({
          ...prev,
          ...updatedSeries,
        }));
      }
    },
    []
  );

  /**
   * 2. Live Spot Price Polling (Every 1.8 seconds, within the 0.5s - 2.2s window):
   * Polls FastForex API (/fetch-multi), Yahoo Finance Spot API, and Binance BookTicker API
   */
  useEffect(() => {
    let active = true;

    const pollServerSpotPrices = async () => {
      if (!SriLankaMarketHours.isMarketOpen()) return;
      const liveRates = await fastForexRef.current.refreshLiveMarketRates(watchlist);
      if (!active) return;
      Object.entries(liveRates).forEach(([sym, price]) => {
        applyPriceTick(sym, price);
      });
    };

    pollServerSpotPrices();
    const spotTimer = setInterval(pollServerSpotPrices, 1800);
    return () => {
      active = false;
      clearInterval(spotTimer);
    };
  }, [watchlist, applyPriceTick]);

  /**
   * 3. Sub-Second Tick Streaming & CandleAggregator (Every 500ms):
   * Direct port of FastForexService.streamQuotes & createTickQuote (500ms interval):
   * During Sri Lanka Market Open Hours (Mon 03:30 AM - Sat 02:29 AM SLT), streams live
   * Bid/Ask updates across all active watchlist symbols, flipping Bid/Ask color to Blue
   * when price increases and Red when price decreases.
   */
  useEffect(() => {
    let ws: WebSocket | null = null;

    if (twelveDataKey.trim() !== '') {
      setWsStatus('connecting');
      try {
        ws = new WebSocket(
          `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(
            twelveDataKey.trim()
          )}`
        );

        ws.onopen = () => {
          setWsStatus('connected');
          const tdSymbols = ALL_SYMBOL_CONFIGS.slice(0, 8)
            .map((c) => c.twelveDataSymbol)
            .join(',');
          ws?.send(
            JSON.stringify({
              action: 'subscribe',
              params: { symbols: tdSymbols },
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'price' && msg.symbol && typeof msg.price === 'number') {
              const cfg = ALL_SYMBOL_CONFIGS.find(
                (c) => c.twelveDataSymbol === msg.symbol || c.symbol === msg.symbol
              );
              if (cfg) {
                fastForexRef.current.setServerRate(cfg.symbol, Number(msg.price));
                applyPriceTick(cfg.symbol, Number(msg.price));
              }
            }
          } catch {
            // Ignore malformed messages
          }
        };

        ws.onerror = () => setWsStatus('error');
        ws.onclose = () => {
          if (twelveDataKey.trim() !== '') setWsStatus('simulator');
        };
      } catch {
        setWsStatus('error');
      }
    } else {
      setWsStatus('simulator');
    }

    // Sub-second 500ms tick streamer across all watchlist symbols + chartSymbol
    const tickInterval = setInterval(() => {
      if (!SriLankaMarketHours.isMarketOpen()) {
        // Ensure all quotes show closed state ('none' -> black) when market is closed
        setQuotes((prev) => {
          let changed = false;
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (next[k].flash !== 'none') {
              next[k] = { ...next[k], flash: 'none' };
              changed = true;
            }
          }
          return changed ? next : prev;
        });
        return;
      }

      const activeSymbols = Array.from(new Set<string>([chartSymbol, ...watchlist]));
      const nowTimeStr = SriLankaMarketHours.formatTimeHMS();
      const nowMs = Date.now();
      let chartSymbolNextBid: number | null = null;

      setQuotes((prev) => {
        const nextQuotes: Record<string, QuoteData> = { ...prev };

        for (const sym of activeSymbols) {
          const cur = prev[sym];
          const cfg = ALL_SYMBOL_CONFIGS.find((c) => c.symbol === sym);
          if (!cur || !cfg) continue;

          const serverAnchor = fastForexRef.current.getServerRate(sym) ?? cur.bid;
          const driftToServer = (serverAnchor - cur.bid) * 0.55;

          // Exact microTickStep & maxDeviationFromServer from FastForexService.kt
          const sign = Math.random() >= 0.5 ? 1 : -1;
          let microTickStep: number;
          let maxDeviationFromServer: number;

          if (sym === 'XAUUSD') {
            microTickStep = sign * (0.02 + Math.random() * 0.16);
            maxDeviationFromServer = 0.45;
          } else if (sym === 'NAS100' || sym === 'NDX100') {
            microTickStep = sign * (0.15 + Math.random() * 1.25);
            maxDeviationFromServer = 3.5;
          } else if (sym === 'BTCUSD') {
            microTickStep = sign * (0.8 + Math.random() * 5.7);
            maxDeviationFromServer = 18.0;
          } else {
            const ptSteps = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3 points
            microTickStep = sign * ptSteps * cfg.point;
            maxDeviationFromServer = cfg.point * 12.0;
          }

          const unclampedBid = cur.bid + driftToServer + microTickStep;
          const minAllowed = Math.max(cfg.point, serverAnchor - maxDeviationFromServer);
          const maxAllowed = serverAnchor + maxDeviationFromServer;
          const clampedRawBid = Math.max(minAllowed, Math.min(maxAllowed, unclampedBid));
          let newBid = Number(clampedRawBid.toFixed(cfg.digits));

          // Guarantee a at least 1-point step so every 500ms tick produces a live direction update
          if (newBid === cur.bid) {
            newBid = Number((cur.bid + sign * cfg.point).toFixed(cfg.digits));
          }

          const spreadDelta = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
          const spreadDynamic = Math.max(1, cfg.defaultSpreadPts + spreadDelta);
          const newAsk = Number((newBid + spreadDynamic * cfg.point).toFixed(cfg.digits));

          const direction: 'up' | 'down' = newBid >= cur.bid ? 'up' : 'down';
          const changePts = Math.round((newBid - cur.open24h) / cfg.point);
          const changePct = Number(
            (((newBid - cur.open24h) / cur.open24h) * 100).toFixed(2)
          );

          nextQuotes[sym] = {
            ...cur,
            prevBid: cur.bid,
            prevAsk: cur.ask,
            bid: newBid,
            ask: newAsk,
            low: Math.min(cur.low, newBid),
            high: Math.max(cur.high, newAsk),
            spread: spreadDynamic,
            changePts,
            changePct,
            timestamp: nowTimeStr,
            flash: direction,
            lastTickMs: nowMs,
          };

          if (sym === chartSymbol) {
            chartSymbolNextBid = newBid;
          }
        }

        return nextQuotes;
      });

      if (chartSymbolNextBid !== null) {
        const updatedSeries = fastForexRef.current.candleAggregator.onTick(
          chartSymbol,
          chartSymbolNextBid,
          SriLankaMarketHours.chartNowMillis()
        );
        if (Object.keys(updatedSeries).length > 0) {
          setCandlesMap((prev) => ({
            ...prev,
            ...updatedSeries,
          }));
        }
      }
    }, 500);

    return () => {
      clearInterval(tickInterval);
      if (ws) ws.close();
    };
  }, [twelveDataKey, watchlist, chartSymbol, applyPriceTick]);

  // Automatic SL / TP execution check
  useEffect(() => {
    if (positions.length === 0) return;

    for (const pos of positions) {
      const q = quotes[pos.symbol];
      if (!q) continue;

      const evalPrice = pos.type === 'buy' ? q.bid : q.ask;
      let triggeredReason: 'sl' | 'tp' | null = null;

      if (pos.type === 'buy') {
        if (pos.sl !== null && evalPrice <= pos.sl) triggeredReason = 'sl';
        else if (pos.tp !== null && evalPrice >= pos.tp) triggeredReason = 'tp';
      } else {
        if (pos.sl !== null && evalPrice >= pos.sl) triggeredReason = 'sl';
        else if (pos.tp !== null && evalPrice <= pos.tp) triggeredReason = 'tp';
      }

      if (triggeredReason) {
        const profit = calculatePositionPL(pos, q);
        const closeTime = SriLankaMarketHours.formatMt5DateTime();
        const deal: ClosedDeal = {
          id: String(Math.floor(89300000 + Math.random() * 699999)),
          orderId: pos.id,
          symbol: pos.symbol,
          type: pos.type,
          lots: pos.lots,
          openPrice: pos.openPrice,
          closePrice: evalPrice,
          openTime: pos.openTime,
          closeTime,
          profit,
          swap: pos.swap,
          commission: pos.commission,
          sl: pos.sl,
          tp: pos.tp,
          closeReason: triggeredReason,
        };

        setPositions((prev) => prev.filter((p) => p.id !== pos.id));
        setClosedDeals((prev) => sortDealsChronologically([...prev, deal]));

        const nextBalance = Number(
          (activeAccount.balance + profit + pos.swap + pos.commission).toFixed(2)
        );
        const updatedAcc = { ...activeAccount, balance: nextBalance };

        setAccounts((prev) =>
          prev.map((a) => (a.id === activeAccountId ? updatedAcc : a))
        );

        if (cloudUserId) {
          const accountDocId =
            activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;
          deletePositionFromCloud(cloudUserId, pos.id, accountDocId);
          addHistoryDealToCloud(cloudUserId, deal, accountDocId);
          saveAccountInfoToCloud(
            cloudUserId,
            updatedAcc,
            profit,
            pos.swap,
            pos.commission,
            accountDocId
          );
        }

        appendLog(
          `[Trade] Position #${pos.id} closed by ${triggeredReason.toUpperCase()} at ${evalPrice}`
        );
        break;
      }
    }
  }, [quotes, positions, activeAccount, activeAccountId, cloudUserId, appendLog]);

  const handleExecuteOrder = (
    symbol: string,
    type: 'buy' | 'sell',
    lots: number,
    sl: number | null,
    tp: number | null,
    stayOnCurrentTab: boolean = false
  ) => {
    const q = quotes[symbol];
    if (!q) return;

    const fillPrice = type === 'buy' ? q.ask : q.bid;
    const ticketId = String(Math.floor(58920000 + Math.random() * 900000));
    const commission = Number((-7.0 * lots).toFixed(2));

    const newPos: Position = {
      id: ticketId,
      symbol,
      type,
      lots,
      openPrice: fillPrice,
      openTime: SriLankaMarketHours.formatMt5DateTime(),
      sl,
      tp,
      swap: 0.0,
      commission,
    };

    setPositions((prev) => [newPos, ...prev]);

    if (cloudUserId) {
      const accountDocId =
        activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;
      upsertPositionToCloud(cloudUserId, newPos, fillPrice, 0, accountDocId);
    }

    appendLog(
      `[Order] Market ${type.toUpperCase()} ${lots} ${symbol} filled at ${fillPrice.toFixed(
        q.digits
      )}`
    );
    if (!stayOnCurrentTab) {
      setActiveTab('trade');
    }
  };

  const handleClosePosition = (positionId: string) => {
    const pos = positions.find((p) => p.id === positionId);
    if (!pos) return;
    const q = quotes[pos.symbol];
    const closePrice = q ? (pos.type === 'buy' ? q.bid : q.ask) : pos.openPrice;
    const profit = calculatePositionPL(pos, q);

    const deal: ClosedDeal = {
      id: String(Math.floor(89400000 + Math.random() * 500000)),
      orderId: pos.id,
      symbol: pos.symbol,
      type: pos.type,
      lots: pos.lots,
      openPrice: pos.openPrice,
      closePrice,
      openTime: pos.openTime,
      closeTime: SriLankaMarketHours.formatMt5DateTime(),
      profit,
      swap: pos.swap,
      commission: pos.commission,
      sl: pos.sl,
      tp: pos.tp,
      closeReason: 'manual',
    };

    setPositions((prev) => prev.filter((p) => p.id !== positionId));
    setClosedDeals((prev) => sortDealsChronologically([...prev, deal]));

    const nextBalance = Number(
      (activeAccount.balance + profit + pos.swap + pos.commission).toFixed(2)
    );
    const updatedAcc = { ...activeAccount, balance: nextBalance };

    setAccounts((prev) =>
      prev.map((a) => (a.id === activeAccountId ? updatedAcc : a))
    );

    if (cloudUserId) {
      const accountDocId =
        activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;
      deletePositionFromCloud(cloudUserId, positionId, accountDocId);
      addHistoryDealToCloud(cloudUserId, deal, accountDocId);
      saveAccountInfoToCloud(
        cloudUserId,
        updatedAcc,
        profit,
        pos.swap,
        pos.commission,
        accountDocId
      );
    }
  };

  const handleModifyPosition = (
    positionId: string,
    sl: number | null,
    tp: number | null
  ) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id !== positionId) return p;
        const updated = { ...p, sl, tp };
        if (cloudUserId) {
          const accountDocId =
            activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;
          const q = quotes[p.symbol];
          const curPrice = q ? (p.type === 'buy' ? q.bid : q.ask) : p.openPrice;
          const pl = calculatePositionPL(updated, q);
          upsertPositionToCloud(cloudUserId, updated, curPrice, pl, accountDocId);
        }
        return updated;
      })
    );
  };

  const handleUpdatePosition = useCallback(
    (updatedPos: Position) => {
      setPositions((prev) =>
        prev.map((p) => (p.id === updatedPos.id ? updatedPos : p))
      );
      if (cloudUserId) {
        const accountDocId =
          activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;
        const q = quotes[updatedPos.symbol];
        const curPrice = q
          ? updatedPos.type === 'buy'
            ? q.bid
            : q.ask
          : updatedPos.openPrice;
        const pl = calculatePositionPL(updatedPos, q);
        upsertPositionToCloud(
          cloudUserId,
          updatedPos,
          curPrice,
          pl,
          accountDocId
        );
      }
    },
    [cloudUserId, activeAccountId, quotes]
  );

  const handleCloseAllPositions = (filter: 'all' | 'profit' | 'loss' = 'all') => {
    const toClose = positions.filter((pos) => {
      const pl = calculatePositionPL(pos, quotes[pos.symbol]);
      if (filter === 'profit') return pl >= 0;
      if (filter === 'loss') return pl < 0;
      return true;
    });

    if (toClose.length === 0) return;

    let netDelta = 0;
    const newDeals: ClosedDeal[] = [];
    const nowStr = SriLankaMarketHours.formatMt5DateTime();
    const accountDocId =
      activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;

    for (const pos of toClose) {
      const q = quotes[pos.symbol];
      const closePrice = q ? (pos.type === 'buy' ? q.bid : q.ask) : pos.openPrice;
      const profit = calculatePositionPL(pos, q);
      netDelta += profit + pos.swap + pos.commission;

      const deal: ClosedDeal = {
        id: String(Math.floor(89400000 + Math.random() * 500000)),
        orderId: pos.id,
        symbol: pos.symbol,
        type: pos.type,
        lots: pos.lots,
        openPrice: pos.openPrice,
        closePrice,
        openTime: pos.openTime,
        closeTime: nowStr,
        profit,
        swap: pos.swap,
        commission: pos.commission,
        sl: pos.sl,
        tp: pos.tp,
        closeReason: 'manual',
      };
      newDeals.push(deal);

      if (cloudUserId) {
        deletePositionFromCloud(cloudUserId, pos.id, accountDocId);
        addHistoryDealToCloud(cloudUserId, deal, accountDocId);
      }
    }

    const closedIds = new Set(toClose.map((p) => p.id));
    setPositions((prev) => prev.filter((p) => !closedIds.has(p.id)));
    setClosedDeals((prev) => sortDealsChronologically([...prev, ...newDeals]));

    const nextBalance = Number((activeAccount.balance + netDelta).toFixed(2));
    const updatedAcc = { ...activeAccount, balance: nextBalance };

    setAccounts((prev) =>
      prev.map((a) => (a.id === activeAccountId ? updatedAcc : a))
    );

    if (cloudUserId) {
      saveAccountInfoToCloud(cloudUserId, updatedAcc, netDelta, 0, 0, accountDocId);
    }
  };

  /**
   * Recalculates account balance & totals from initialDeposit + all deals,
   * updates local state, and auto-saves to Cloud Trade Server (Firestore).
   */
  const syncAccountTotalsWithDeals = useCallback(
    (nextDeals: ClosedDeal[], accOverride?: Partial<TradingAccount>) => {
      const baseAcc = { ...activeAccount, ...accOverride };
      const tradeDeals = nextDeals.filter((d) => d.type !== 'balance');
      const balanceDeals = nextDeals.filter((d) => d.type === 'balance');

      const realizedProfit = Number(
        tradeDeals.reduce((sum, d) => sum + d.profit, 0).toFixed(2)
      );
      const totalSwap = Number(
        tradeDeals.reduce((sum, d) => sum + d.swap, 0).toFixed(2)
      );
      const totalCommission = Number(
        tradeDeals.reduce((sum, d) => sum + d.commission, 0).toFixed(2)
      );
      const balanceOpsNet = Number(
        balanceDeals.reduce((sum, d) => sum + d.profit, 0).toFixed(2)
      );

      const nextBalance = Number(
        (
          baseAcc.initialDeposit +
          balanceOpsNet +
          realizedProfit +
          totalSwap +
          totalCommission
        ).toFixed(2)
      );

      const updatedAcc: TradingAccount = {
        ...baseAcc,
        balance: nextBalance,
      };

      setAccounts((prev) =>
        prev.map((a) => (a.id === activeAccountId ? updatedAcc : a))
      );

      if (cloudUserId) {
        const accountDocId =
          activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;
        saveAccountInfoToCloud(
          cloudUserId,
          updatedAcc,
          realizedProfit,
          totalSwap,
          totalCommission,
          accountDocId
        );
      }
    },
    [activeAccount, activeAccountId, cloudUserId]
  );

  const handleUpsertHistoryDeal = useCallback(
    (deal: ClosedDeal) => {
      const accountDocId =
        activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;

      setClosedDeals((prev) => {
        const exists = prev.some((d) => d.id === deal.id);
        const updatedList = exists
          ? prev.map((d) => (d.id === deal.id ? deal : d))
          : [...prev, deal];
        const sorted = sortDealsChronologically(updatedList);
        syncAccountTotalsWithDeals(sorted);
        return sorted;
      });

      if (cloudUserId) {
        addHistoryDealToCloud(cloudUserId, deal, accountDocId);
      }

      appendLog(
        `[History] ${deal.type === 'balance' ? 'Balance entry' : `Trade ${deal.symbol}`} #${
          deal.orderId || deal.id
        } saved (${deal.profit >= 0 ? '+' : ''}${deal.profit.toFixed(2)} USD)`
      );
    },
    [activeAccountId, cloudUserId, syncAccountTotalsWithDeals, appendLog]
  );

  const handleDeleteHistoryDeal = useCallback(
    (dealId: string) => {
      const accountDocId =
        activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;

      setClosedDeals((prev) => {
        const filtered = prev.filter((d) => d.id !== dealId);
        const sorted = sortDealsChronologically(filtered);
        syncAccountTotalsWithDeals(sorted);
        return sorted;
      });

      if (cloudUserId) {
        deleteHistoryDealFromCloud(cloudUserId, dealId, accountDocId);
      }

      appendLog(`[History] Deleted record #${dealId} from History & Cloud`);
    },
    [activeAccountId, cloudUserId, syncAccountTotalsWithDeals, appendLog]
  );

  const handleForceSyncCloud = useCallback(() => {
    if (!cloudUserId) return;
    const accountDocId =
      activeAccountId === INITIAL_ACCOUNTS[0].id ? 'main' : activeAccountId;
    for (const deal of closedDeals) {
      addHistoryDealToCloud(cloudUserId, deal, accountDocId);
    }
    syncAccountTotalsWithDeals(closedDeals);
    appendLog(
      `[Firestore] Synced ${closedDeals.length} history records to Cloud Server`
    );
  }, [cloudUserId, activeAccountId, closedDeals, syncAccountTotalsWithDeals, appendLog]);

  const currentCandles = candlesMap[`${chartSymbol}_${timeframe}`] || [];

  return (
    <div className="w-full h-dvh flex flex-col bg-white text-black overflow-hidden select-none">
      {/* Active Tab Viewport */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        {activeTab === 'quotes' && (
          <QuotesTab
            quotes={quotes}
            watchlist={watchlist}
            viewMode={quotesViewMode}
            onToggleViewMode={() =>
              setQuotesViewMode((m) => (m === 'advanced' ? 'simple' : 'advanced'))
            }
            onSelectSymbolForChart={(sym) => {
              setChartSymbol(sym);
              setActiveTab('chart');
            }}
            onOpenNewOrder={(sym) => {
              setOrderModalSymbol(sym);
              setOrderModalOpen(true);
            }}
            onAddSymbol={(sym) => {
              if (!watchlist.includes(sym)) {
                setWatchlist((prev) => [...prev, sym]);
              }
            }}
            onRemoveSymbol={(sym) => {
              setWatchlist((prev) => prev.filter((s) => s !== sym));
            }}
          />
        )}

        {activeTab === 'chart' && (
          <ChartTab
            symbol={chartSymbol}
            quotes={quotes}
            watchlist={watchlist}
            timeframe={timeframe}
            candles={currentCandles}
            positions={positions}
            closedDeals={closedDeals}
            onChangeSymbol={(sym) => setChartSymbol(sym)}
            onChangeTimeframe={(tf) => setTimeframe(tf)}
            onOpenNewOrder={(sym) => {
              setOrderModalSymbol(sym);
              setOrderModalOpen(true);
            }}
            onQuickExecuteOrder={(sym, type, lots) =>
              handleExecuteOrder(sym, type, lots, null, null, true)
            }
            onUpdatePosition={handleUpdatePosition}
            onUpdateHistoryDeal={handleUpsertHistoryDeal}
            onExtendHistory={(sym, tf) => {
              const extended = fastForexRef.current.candleAggregator.extendOlderHistory(
                sym,
                tf,
                600
              );
              setCandlesMap((prev) => ({
                ...prev,
                [`${sym}_${tf}`]: extended,
              }));
            }}
          />
        )}

        {activeTab === 'trade' && (
          <TradeTab
            account={activeAccount}
            positions={positions}
            quotes={quotes}
            activeSymbol={chartSymbol}
            onOpenNewOrder={(sym) => {
              setOrderModalSymbol(sym);
              setOrderModalOpen(true);
            }}
            onClosePosition={handleClosePosition}
            onModifyPosition={handleModifyPosition}
            onCloseAllPositions={handleCloseAllPositions}
            onOpenChart={(sym) => {
              setChartSymbol(sym);
              setActiveTab('chart');
            }}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab account={activeAccount} deals={closedDeals} />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            accounts={accounts}
            activeAccount={activeAccount}
            deals={closedDeals}
            quotes={quotes}
            get1mCandles={(sym) => {
              const key = `${sym}_M1`;
              if (candlesMap[key] && candlesMap[key].length > 0) {
                return candlesMap[key];
              }
              const cfg =
                ALL_SYMBOL_CONFIGS.find((c) => c.symbol === sym) ||
                ALL_SYMBOL_CONFIGS[0];
              const curBid = quotes[sym]?.bid ?? cfg.baseBid;
              return fastForexRef.current.candleAggregator.getCandles(
                sym,
                'M1',
                curBid
              );
            }}
            onSelectAccount={(id) => setActiveAccountId(id)}
            onUpdateAccount={(updates) => {
              syncAccountTotalsWithDeals(closedDeals, updates);
            }}
            onTopUpBalance={(amount) => {
              syncAccountTotalsWithDeals(closedDeals, {
                initialDeposit: Number(
                  (activeAccount.initialDeposit + amount).toFixed(2)
                ),
              });
            }}
            onUpsertHistoryDeal={handleUpsertHistoryDeal}
            onDeleteHistoryDeal={handleDeleteHistoryDeal}
            onAddRunningPosition={(newPos) => {
              setPositions((prev) => [newPos, ...prev]);
              if (cloudUserId) {
                const accountDocId =
                  activeAccountId === INITIAL_ACCOUNTS[0].id
                    ? 'main'
                    : activeAccountId;
                const q = quotes[newPos.symbol];
                const curPrice = q
                  ? newPos.type === 'buy'
                    ? q.bid
                    : q.ask
                  : newPos.openPrice;
                const pl = calculatePositionPL(newPos, q);
                upsertPositionToCloud(
                  cloudUserId,
                  newPos,
                  curPrice,
                  pl,
                  accountDocId
                );
              }
              appendLog(
                `[Position] Running trade #${newPos.id} (${newPos.symbol} ${newPos.type} ${newPos.lots}) added & synced`
              );
            }}
            onForceSyncCloud={handleForceSyncCloud}
            onCreateAccount={(newAcc) => {
              const id = `acc_${Date.now()}`;
              const created: TradingAccount = { ...newAcc, id };
              setAccounts((prev) => [created, ...prev]);
              setActiveAccountId(id);
              if (cloudUserId) {
                saveAccountInfoToCloud(cloudUserId, created, 0, 0, 0, id);
              }
            }}
            twelveDataApiKey={twelveDataKey}
            onSaveTwelveDataKey={(key) => setTwelveDataKey(key)}
            wsStatus={wsStatus}
            journalLogs={journalLogs}
            cloudUserEmail={cloudUserEmail}
            onSignInGoogle={() => {
              signInWithGoogle().catch((err) => {
                appendLog(`[Auth] Google sign-in cancelled or failed: ${String(err)}`);
              });
            }}
            onSignOutCloud={() => {
              signOutFirebase();
            }}
          />
        )}
      </main>

      {/* Authentic MT5 iOS Bottom Tab Bar matching Screenshots 1-7 */}
      <nav className="pb-safe bg-[#F9F9F9] border-t border-[#D1D1D6] shrink-0 z-30">
        <div className="grid grid-cols-5 h-[52px] items-center">
          {/* Tab 1: Quotes (↓↑) */}
          <button
            onClick={() => setActiveTab('quotes')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'quotes' ? 'text-[#007AFF]' : 'text-[#5C5C5E]'
            }`}
          >
            <svg className="w-[24px] h-[24px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 5v14M8 19l-3.5-3.5M8 19l3.5-3.5M16 19V5M16 5l-3.5 3.5M16 5l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[10.5px] font-medium tracking-tight">Quotes</span>
          </button>

          {/* Tab 2: Chart (Two Candlesticks) */}
          <button
            onClick={() => setActiveTab('chart')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'chart' ? 'text-[#007AFF]' : 'text-[#5C5C5E]'
            }`}
          >
            <svg className="w-[24px] h-[24px]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.5 3v18M15.5 3v18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <rect x="6.5" y="7" width="4" height="9" rx="0.6" />
              <rect x="13.5" y="6" width="4" height="8" rx="0.6" />
            </svg>
            <span className="text-[10.5px] font-medium tracking-tight">Chart</span>
          </button>

          {/* Tab 3: Trade (Boxed Trend Line) */}
          <button
            onClick={() => setActiveTab('trade')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'trade' ? 'text-[#007AFF]' : 'text-[#5C5C5E]'
            }`}
          >
            <svg className="w-[24px] h-[24px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3.5" y="3.5" width="17" height="17" rx="1.8" />
              <path d="M6.5 15.5l4-4.5 3 3 4-5.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[10.5px] font-medium tracking-tight">Trade</span>
          </button>

          {/* Tab 4: History (Counter-clockwise Clock) */}
          <button
            onClick={() => setActiveTab('history')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'history' ? 'text-[#007AFF]' : 'text-[#5C5C5E]'
            }`}
          >
            <svg className="w-[24px] h-[24px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3.5 12a8.5 8.5 0 1 0 2.3-5.8L3.5 8.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3.5 4v4.5H8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 7.5v5l3.2 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[10.5px] font-medium tracking-tight">History</span>
          </button>

          {/* Tab 5: Settings (Gear with Red "1" Badge) */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 ${
              activeTab === 'settings' ? 'text-[#007AFF]' : 'text-[#5C5C5E]'
            }`}
          >
            <div className="relative">
              <svg className="w-[24px] h-[24px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                <circle cx="12" cy="12" r="3.2" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="absolute -top-1.5 -right-3 w-[18px] h-[18px] rounded-full bg-[#EB4E3D] text-white text-[11px] font-bold flex items-center justify-center shadow-2xs">
                1
              </span>
            </div>
            <span className="text-[10.5px] font-medium tracking-tight">Settings</span>
          </button>
        </div>
      </nav>

      {/* New Order Execution Modal */}
      <NewOrderModal
        isOpen={orderModalOpen}
        initialSymbol={orderModalSymbol}
        quotes={quotes}
        watchlist={watchlist}
        onClose={() => setOrderModalOpen(false)}
        onExecuteOrder={handleExecuteOrder}
      />
    </div>
  );
}
