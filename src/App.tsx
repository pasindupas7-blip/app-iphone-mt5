import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowDownUp,
  CandlestickChart,
  TrendingUp,
  History,
  Settings,
} from 'lucide-react';
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
  formatMT5DateTime,
  formatTimeHMS,
  generateHistoricalCandles,
  getTimeframeSeconds,
  INITIAL_ACCOUNTS,
  INITIAL_CLOSED_DEALS,
} from './utils/mt5Formatters';
import { QuotesTab } from './components/QuotesTab';
import { ChartTab } from './components/ChartTab';
import { TradeTab } from './components/TradeTab';
import { HistoryTab } from './components/HistoryTab';
import { SettingsTab } from './components/SettingsTab';
import { NewOrderModal } from './components/NewOrderModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('quotes');
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST_SYMBOLS);
  const [quotesViewMode, setQuotesViewMode] = useState<'advanced' | 'simple'>('advanced');

  // Active Chart state
  const [chartSymbol, setChartSymbol] = useState<string>('XAUUSD');
  const [timeframe, setTimeframe] = useState<Timeframe>('M1');

  // New Order Modal state
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [orderModalSymbol, setOrderModalSymbol] = useState('XAUUSD');

  // Accounts & Active Account state
  const [accounts, setAccounts] = useState<TradingAccount[]>(INITIAL_ACCOUNTS);
  const [activeAccountId, setActiveAccountId] = useState<string>(INITIAL_ACCOUNTS[0].id);

  const activeAccount =
    accounts.find((a) => a.id === activeAccountId) || accounts[0];

  // Open Positions state (pre-populated with 2 active positions for instant live P/L demo)
  const [positions, setPositions] = useState<Position[]>([
    {
      id: '58910421',
      symbol: 'XAUUSD',
      type: 'buy',
      lots: 0.1,
      openPrice: 4068.45,
      openTime: '2026.11.08 01:42:15',
      sl: 4058.0,
      tp: 4085.0,
      swap: 0.0,
      commission: -0.7,
    },
    {
      id: '58910488',
      symbol: 'EURUSD',
      type: 'buy',
      lots: 0.5,
      openPrice: 1.08385,
      openTime: '2026.11.08 02:10:04',
      sl: 1.081,
      tp: 1.0895,
      swap: 0.0,
      commission: -3.5,
    },
  ]);

  // Closed Deals History state
  const [closedDeals, setClosedDeals] = useState<ClosedDeal[]>(INITIAL_CLOSED_DEALS);

  // Twelve Data WebSocket API key & connection state
  const [twelveDataKey, setTwelveDataKey] = useState<string>('');
  const [wsStatus, setWsStatus] = useState<
    'simulator' | 'connecting' | 'connected' | 'error'
  >('simulator');

  // Terminal Execution Journal
  const [journalLogs, setJournalLogs] = useState<string[]>([
    `${formatMT5DateTime()} [Terminal] MetaTrader 5 iOS Terminal initialized`,
    `${formatMT5DateTime()} [Network] Connected to ${INITIAL_ACCOUNTS[0].server} (Access Server)`,
    `${formatMT5DateTime()} [Feed] Realistic Live Tick Simulator started (6 symbols)`,
  ]);

  const appendLog = useCallback((msg: string) => {
    setJournalLogs((prev) => [`${formatMT5DateTime()} ${msg}`, ...prev.slice(0, 99)]);
  }, []);

  // Initialize Quotes Map for all symbols
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>(() => {
    const initial: Record<string, QuoteData> = {};
    const nowStr = formatTimeHMS();
    for (const cfg of ALL_SYMBOL_CONFIGS) {
      const spreadVal = cfg.defaultSpreadPts * cfg.point;
      const bid = cfg.baseBid;
      const ask = Number((bid + spreadVal).toFixed(cfg.digits));
      const open24h = Number((bid - cfg.volatility * 6.5).toFixed(cfg.digits));
      const changePts = Math.round((bid - open24h) / cfg.point);
      const changePct = Number((((bid - open24h) / open24h) * 100).toFixed(2));
      initial[cfg.symbol] = {
        ...cfg,
        bid,
        ask,
        prevBid: bid,
        prevAsk: ask,
        low: Number((bid - cfg.volatility * 14).toFixed(cfg.digits)),
        high: Number((ask + cfg.volatility * 12).toFixed(cfg.digits)),
        open24h,
        spread: cfg.defaultSpreadPts,
        changePts,
        changePct,
        timestamp: nowStr,
        flash: 'up',
        lastTickMs: Date.now(),
      };
    }
    return initial;
  });

  // Historical + Live Candles store keyed by `${symbol}_${timeframe}`
  const [candlesMap, setCandlesMap] = useState<Record<string, Candle[]>>(() => {
    const map: Record<string, Candle[]> = {};
    const xauCfg = ALL_SYMBOL_CONFIGS[0];
    map['XAUUSD_M1'] = generateHistoricalCandles(xauCfg, 'M1', xauCfg.baseBid, 140);
    return map;
  });

  // Ensure candles exist whenever chartSymbol or timeframe changes
  useEffect(() => {
    const key = `${chartSymbol}_${timeframe}`;
    setCandlesMap((prev) => {
      if (prev[key]) return prev;
      const cfg =
        ALL_SYMBOL_CONFIGS.find((c) => c.symbol === chartSymbol) ||
        ALL_SYMBOL_CONFIGS[0];
      const currentBid = quotes[chartSymbol]?.bid ?? cfg.baseBid;
      return {
        ...prev,
        [key]: generateHistoricalCandles(cfg, timeframe, currentBid, 140),
      };
    });
  }, [chartSymbol, timeframe, quotes]);

  // Ref for positions to check SL/TP hits inside tick handler
  const positionsRef = useRef(positions);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  // Apply a price tick to state, update active candles, and trigger SL/TP if crossed
  const applyPriceTick = useCallback(
    (sym: string, rawNewBid: number) => {
      setQuotes((prevQuotes) => {
        const current = prevQuotes[sym];
        if (!current) return prevQuotes;

        const newBid = Number(rawNewBid.toFixed(current.digits));
        if (newBid === current.bid) return prevQuotes;

        // Slight dynamic spread jitter (+/- 1 point)
        const spreadDelta = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
        const nextSpreadPts = Math.max(
          1,
          Math.min(
            current.defaultSpreadPts + 4,
            Math.max(current.defaultSpreadPts - 2, current.spread + spreadDelta)
          )
        );
        const newAsk = Number(
          (newBid + nextSpreadPts * current.point).toFixed(current.digits)
        );
        const direction: 'up' | 'down' = newBid >= current.bid ? 'up' : 'down';
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
          spread: nextSpreadPts,
          changePts,
          changePct,
          timestamp: formatTimeHMS(),
          flash: direction,
          lastTickMs: Date.now(),
        };

        return {
          ...prevQuotes,
          [sym]: updatedQuote,
        };
      });

      // Update any loaded timeframe candles for this symbol
      setCandlesMap((prevMap) => {
        let changed = false;
        const nextMap = { ...prevMap };
        const nowSec = Math.floor(Date.now() / 1000);

        for (const key of Object.keys(nextMap)) {
          if (!key.startsWith(`${sym}_`)) continue;
          const tf = key.split('_')[1] as Timeframe;
          const stepSec = getTimeframeSeconds(tf);
          const bucketTime = Math.floor(nowSec / stepSec) * stepSec;
          const series = nextMap[key];
          if (!series || series.length === 0) continue;

          const last = series[series.length - 1];
          if (last.time === bucketTime) {
            const updatedLast: Candle = {
              ...last,
              close: rawNewBid,
              high: Math.max(last.high, rawNewBid),
              low: Math.min(last.low, rawNewBid),
              volume: last.volume + 1,
            };
            nextMap[key] = [...series.slice(0, -1), updatedLast];
            changed = true;
          } else if (bucketTime > last.time) {
            const newCandle: Candle = {
              time: bucketTime,
              open: last.close,
              high: Math.max(last.close, rawNewBid),
              low: Math.min(last.close, rawNewBid),
              close: rawNewBid,
              volume: 1,
            };
            nextMap[key] = [...series.slice(1), newCandle];
            changed = true;
          }
        }

        return changed ? nextMap : prevMap;
      });
    },
    []
  );

  // Automatic SL / TP execution check whenever quotes update
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
        const closeTime = formatMT5DateTime();
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
        setClosedDeals((prev) => [deal, ...prev]);
        setAccounts((prev) =>
          prev.map((a) =>
            a.id === activeAccountId
              ? {
                  ...a,
                  balance: Number(
                    (a.balance + profit + pos.swap + pos.commission).toFixed(2)
                  ),
                }
              : a
          )
        );
        appendLog(
          `[Trade] Position #${pos.id} (${pos.symbol} ${pos.type} ${pos.lots}) closed by ${triggeredReason.toUpperCase()} at ${evalPrice} (P/L: ${profit.toFixed(2)} USD)`
        );
        break;
      }
    }
  }, [quotes, positions, activeAccountId, appendLog]);

  // Twelve Data WebSocket connection + Realistic Live Tick Simulator fallback
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
          appendLog('[WebSocket] Connected to Twelve Data real-time price stream');
          const tdSymbols = ALL_SYMBOL_CONFIGS.slice(0, 6)
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
                applyPriceTick(cfg.symbol, Number(msg.price));
              }
            }
          } catch {
            // Ignore malformed messages
          }
        };

        ws.onerror = () => {
          setWsStatus('error');
          appendLog('[WebSocket] Twelve Data connection error; simulator active');
        };

        ws.onclose = () => {
          if (twelveDataKey.trim() !== '') {
            setWsStatus('simulator');
          }
        };
      } catch {
        setWsStatus('error');
      }
    } else {
      setWsStatus('simulator');
    }

    // Realistic Live Tick Simulator (runs continuously so ticks are always lively)
    const timer = setInterval(() => {
      // Pick 2 to 4 symbols per 450ms interval for authentic asynchronous MT5 ticks
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * watchlist.length);
        const sym = watchlist[idx];
        const cfg = ALL_SYMBOL_CONFIGS.find((c) => c.symbol === sym);
        if (!cfg) continue;

        setQuotes((prev) => {
          const cur = prev[sym];
          if (!cur) return prev;
          const step = (Math.random() - 0.492) * cfg.volatility;
          const nextBid = Number(
            Math.max(cfg.point * 10, cur.bid + step).toFixed(cfg.digits)
          );
          // Schedule tick update
          setTimeout(() => applyPriceTick(sym, nextBid), 0);
          return prev;
        });
      }
    }, 450);

    return () => {
      clearInterval(timer);
      if (ws) {
        ws.close();
      }
    };
  }, [twelveDataKey, watchlist, applyPriceTick, appendLog]);

  // Execute a Market Order
  const handleExecuteOrder = (
    symbol: string,
    type: 'buy' | 'sell',
    lots: number,
    sl: number | null,
    tp: number | null
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
      openTime: formatMT5DateTime(),
      sl,
      tp,
      swap: 0.0,
      commission,
    };

    setPositions((prev) => [newPos, ...prev]);
    appendLog(
      `[Order] Market ${type.toUpperCase()} ${lots} ${symbol} filled at ${fillPrice.toFixed(
        q.digits
      )} (#${ticketId})`
    );
    setActiveTab('trade');
  };

  // Close a single Open Position
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
      closeTime: formatMT5DateTime(),
      profit,
      swap: pos.swap,
      commission: pos.commission,
      sl: pos.sl,
      tp: pos.tp,
      closeReason: 'manual',
    };

    setPositions((prev) => prev.filter((p) => p.id !== positionId));
    setClosedDeals((prev) => [deal, ...prev]);
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === activeAccountId
          ? {
              ...a,
              balance: Number(
                (a.balance + profit + pos.swap + pos.commission).toFixed(2)
              ),
            }
          : a
      )
    );

    appendLog(
      `[Trade] Closed #${pos.id} ${pos.symbol} ${pos.type} ${pos.lots} at ${closePrice} (Profit: ${profit.toFixed(
        2
      )} USD)`
    );
  };

  // Modify SL/TP on an Open Position
  const handleModifyPosition = (
    positionId: string,
    sl: number | null,
    tp: number | null
  ) => {
    setPositions((prev) =>
      prev.map((p) => (p.id === positionId ? { ...p, sl, tp } : p))
    );
    appendLog(
      `[Trade] Modified #${positionId} S/L: ${sl ?? 'None'}, T/P: ${tp ?? 'None'}`
    );
  };

  // Bulk Close Positions
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
    const nowStr = formatMT5DateTime();

    for (const pos of toClose) {
      const q = quotes[pos.symbol];
      const closePrice = q ? (pos.type === 'buy' ? q.bid : q.ask) : pos.openPrice;
      const profit = calculatePositionPL(pos, q);
      netDelta += profit + pos.swap + pos.commission;

      newDeals.push({
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
      });
    }

    const closedIds = new Set(toClose.map((p) => p.id));
    setPositions((prev) => prev.filter((p) => !closedIds.has(p.id)));
    setClosedDeals((prev) => [...newDeals, ...prev]);
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === activeAccountId
          ? { ...a, balance: Number((a.balance + netDelta).toFixed(2)) }
          : a
      )
    );
    appendLog(`[Trade] Bulk closed ${toClose.length} position(s)`);
  };

  const currentCandles = candlesMap[`${chartSymbol}_${timeframe}`] || [];

  return (
    <div className="w-full h-dvh flex flex-col bg-[#0D1117] text-[#E6EDF3] overflow-hidden select-none">
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
            onChangeSymbol={(sym) => setChartSymbol(sym)}
            onChangeTimeframe={(tf) => setTimeframe(tf)}
            onOpenNewOrder={(sym) => {
              setOrderModalSymbol(sym);
              setOrderModalOpen(true);
            }}
            onQuickExecuteOrder={(sym, type, lots) =>
              handleExecuteOrder(sym, type, lots, null, null)
            }
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
            onSelectAccount={(id) => {
              setActiveAccountId(id);
              const found = accounts.find((a) => a.id === id);
              if (found) {
                appendLog(`[Account] Switched active account to ${found.login} (${found.server})`);
              }
            }}
            onUpdateAccount={(updates) => {
              setAccounts((prev) =>
                prev.map((a) =>
                  a.id === activeAccountId ? { ...a, ...updates } : a
                )
              );
              appendLog('[Account] Updated account profile configuration');
            }}
            onTopUpBalance={(amount) => {
              setAccounts((prev) =>
                prev.map((a) =>
                  a.id === activeAccountId
                    ? {
                        ...a,
                        balance: Number((a.balance + amount).toFixed(2)),
                        initialDeposit: Number(
                          (a.initialDeposit + amount).toFixed(2)
                        ),
                      }
                    : a
                )
              );
              appendLog(`[Account] Balance Top-Up +${amount.toFixed(2)} USD credited`);
            }}
            onCreateAccount={(newAcc) => {
              const id = `acc-${Date.now()}`;
              const created: TradingAccount = { ...newAcc, id };
              setAccounts((prev) => [created, ...prev]);
              setActiveAccountId(id);
              appendLog(`[Account] Created new account #${created.login}`);
            }}
            twelveDataApiKey={twelveDataKey}
            onSaveTwelveDataKey={(key) => setTwelveDataKey(key)}
            wsStatus={wsStatus}
            journalLogs={journalLogs}
          />
        )}
      </main>

      {/* Authentic MT5 iOS Bottom Tab Bar with Safe Area Inset Bottom */}
      <nav className="pb-safe bg-[#161B22]/95 backdrop-blur-md border-t border-[#21262D] shrink-0 z-30">
        <div className="grid grid-cols-5 h-[52px] items-center">
          <button
            onClick={() => setActiveTab('quotes')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'quotes' ? 'text-[#2962FF]' : 'text-[#8B949E]'
            }`}
          >
            <ArrowDownUp className="w-[21px] h-[21px]" strokeWidth={2.1} />
            <span className="text-[10px] font-medium tracking-tight">Quotes</span>
          </button>

          <button
            onClick={() => setActiveTab('chart')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'chart' ? 'text-[#2962FF]' : 'text-[#8B949E]'
            }`}
          >
            <CandlestickChart className="w-[21px] h-[21px]" strokeWidth={2.1} />
            <span className="text-[10px] font-medium tracking-tight">Chart</span>
          </button>

          <button
            onClick={() => setActiveTab('trade')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
              activeTab === 'trade' ? 'text-[#2962FF]' : 'text-[#8B949E]'
            }`}
          >
            <div className="relative">
              <TrendingUp className="w-[21px] h-[21px]" strokeWidth={2.1} />
              {positions.length > 0 && (
                <span className="absolute -top-1 -right-2.5 min-w-[14px] h-[14px] px-1 rounded-full bg-[#2962FF] text-white text-[9px] font-bold flex items-center justify-center">
                  {positions.length}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium tracking-tight">Trade</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'history' ? 'text-[#2962FF]' : 'text-[#8B949E]'
            }`}
          >
            <History className="w-[21px] h-[21px]" strokeWidth={2.1} />
            <span className="text-[10px] font-medium tracking-tight">History</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === 'settings' ? 'text-[#2962FF]' : 'text-[#8B949E]'
            }`}
          >
            <div className="relative">
              <Settings className="w-[21px] h-[21px]" strokeWidth={2.1} />
              <span className="absolute -top-1 -right-2 w-3.5 h-3.5 rounded-full bg-[#F23645] text-white text-[9px] font-bold flex items-center justify-center">
                1
              </span>
            </div>
            <span className="text-[10px] font-medium tracking-tight">Settings</span>
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
