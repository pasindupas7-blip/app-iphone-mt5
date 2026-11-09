import React, { useState, useMemo } from 'react';
import { Clock, Calendar, Check, X } from 'lucide-react';
import { ClosedDeal, TradingAccount } from '../types/mt5';
import {
  formatMT5Money,
  parseMT5DateTimeMs,
  sortDealsChronologically,
} from '../utils/mt5Formatters';

export type HistoryTimePeriod =
  | 'all'
  | 'today'
  | 'week'
  | 'month'
  | '3months'
  | 'custom';

interface HistoryTabProps {
  account: TradingAccount;
  deals: ClosedDeal[];
}

const PERIOD_LABELS: Record<HistoryTimePeriod, string> = {
  all: 'All History',
  today: 'Today',
  week: 'Last Week',
  month: 'Last Month',
  '3months': 'Last 3 Months',
  custom: 'Custom Period',
};

export const HistoryTab: React.FC<HistoryTabProps> = ({ account, deals }) => {
  const [subTab, setSubTab] = useState<'positions' | 'orders' | 'deals'>('positions');
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [symbolFilter, setSymbolFilter] = useState<string>('ALL');

  const [timePeriod, setTimePeriod] = useState<HistoryTimePeriod>('all');
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('2026-08-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-12-31');

  // 1. Always sort all deals strictly in chronological order by date
  const chronologicallySortedDeals = useMemo(
    () => sortDealsChronologically(deals),
    [deals]
  );

  const uniqueSymbols = useMemo(() => {
    const syms = chronologicallySortedDeals
      .filter((d) => d.type !== 'balance' && d.symbol !== 'BALANCE')
      .map((d) => d.symbol);
    return ['ALL', ...Array.from(new Set(syms))];
  }, [chronologicallySortedDeals]);

  // Reference anchor timestamp (latest deal date or current date) so relative periods work accurately
  const anchorMs = useMemo(() => {
    let maxMs = Date.now();
    for (const d of chronologicallySortedDeals) {
      const ms = parseMT5DateTimeMs(d.closeTime || d.openTime);
      if (ms > maxMs) maxMs = ms;
    }
    return maxMs;
  }, [chronologicallySortedDeals]);

  // 2. Filter by selected Symbol and selected Time Period while preserving chronological order
  const filteredDeals = useMemo(() => {
    return chronologicallySortedDeals.filter((d) => {
      if (symbolFilter !== 'ALL') {
        if (d.type === 'balance') return false;
        if (d.symbol !== symbolFilter) return false;
      }

      if (timePeriod === 'all') return true;

      const dealMs = parseMT5DateTimeMs(d.closeTime || d.openTime);
      if (!dealMs) return true;

      const anchorDate = new Date(anchorMs);
      const dayStartMs = new Date(
        anchorDate.getFullYear(),
        anchorDate.getMonth(),
        anchorDate.getDate(),
        0,
        0,
        0
      ).getTime();

      if (timePeriod === 'today') {
        return dealMs >= dayStartMs;
      }
      if (timePeriod === 'week') {
        return dealMs >= anchorMs - 7 * 86400 * 1000;
      }
      if (timePeriod === 'month') {
        return dealMs >= anchorMs - 30 * 86400 * 1000;
      }
      if (timePeriod === '3months') {
        return dealMs >= anchorMs - 90 * 86400 * 1000;
      }
      if (timePeriod === 'custom') {
        const startMs = customStartDate
          ? new Date(`${customStartDate}T00:00:00`).getTime()
          : 0;
        const endMs = customEndDate
          ? new Date(`${customEndDate}T23:59:59`).getTime()
          : Number.MAX_SAFE_INTEGER;
        return dealMs >= startMs && dealMs <= endMs;
      }
      return true;
    });
  }, [
    chronologicallySortedDeals,
    symbolFilter,
    timePeriod,
    anchorMs,
    customStartDate,
    customEndDate,
  ]);

  // Calculate financial summary for the filtered view
  const tradeDeals = filteredDeals.filter((d) => d.type !== 'balance');
  const balanceDeals = filteredDeals.filter((d) => d.type === 'balance');

  const extraDeposits = balanceDeals
    .filter((d) => d.profit > 0)
    .reduce((acc, d) => acc + d.profit, 0);
  const totalWithdrawals = balanceDeals
    .filter((d) => d.profit < 0)
    .reduce((acc, d) => acc + d.profit, 0); // negative number

  const totalProfit = Number(
    tradeDeals.reduce((acc, d) => acc + d.profit, 0).toFixed(2)
  );
  const totalSwap = Number(
    tradeDeals.reduce((acc, d) => acc + d.swap, 0).toFixed(2)
  );
  const totalCommission = Number(
    tradeDeals.reduce((acc, d) => acc + d.commission, 0).toFixed(2)
  );

  // Base initial deposit is included when viewing 'all' (or if no separate deposit deals replace it)
  const baseDeposit = timePeriod === 'all' ? account.initialDeposit : 0;
  const depositAmount = Number((baseDeposit + extraDeposits).toFixed(2));
  const computedBalance = Number(
    (
      depositAmount +
      totalWithdrawals +
      totalProfit +
      totalSwap +
      totalCommission
    ).toFixed(2)
  );

  const getDigits = (sym: string) => {
    if (sym === 'XAUUSD' || sym === 'NAS100' || sym === 'BTCUSD') return 2;
    if (sym.endsWith('JPY')) return 3;
    return 5;
  };

  return (
    <div className="flex flex-col h-full bg-white text-black relative">
      {/* Top MT5 iOS History Header (Screenshot 4) */}
      <header className="pt-safe bg-white border-b border-[#E5E5EA] shrink-0 z-20">
        <div className="h-11 px-3.5 flex items-center justify-between gap-2">
          {/* Left: Sort / Filter Symbol Icon */}
          <button
            onClick={() => {
              const idx = uniqueSymbols.indexOf(symbolFilter);
              setSymbolFilter(uniqueSymbols[(idx + 1) % uniqueSymbols.length]);
            }}
            className="min-w-[40px] min-h-[38px] flex items-center justify-start text-[#48484A] active:opacity-60 relative"
            title="Filter Symbol"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke={symbolFilter !== 'ALL' ? '#007AFF' : 'currentColor'}
              strokeWidth="1.9"
            >
              <path
                d="M6 4v16M6 4L3 7M6 4l3 3M6 20l-3-3M6 20l3-3M12 6h8M12 12h8M12 18h8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {symbolFilter !== 'ALL' && (
              <span className="ml-1 text-[10px] font-bold text-[#007AFF]">
                {symbolFilter}
              </span>
            )}
          </button>

          {/* Center: Authentic iOS Segmented Control (Positions | Orders | Deals) */}
          <div className="flex-1 max-w-[270px] bg-[#EEEEF0] p-[2px] rounded-[9px] grid grid-cols-3">
            {(['positions', 'orders', 'deals'] as const).map((tab) => {
              const active = subTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setSubTab(tab)}
                  className={`py-1 text-[13px] rounded-[7px] capitalize transition-all ${
                    active
                      ? 'bg-white text-black font-semibold shadow-xs'
                      : 'text-black font-medium'
                  }`}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {/* Right: Clock Icon (Opens Time Period Filter) */}
          <button
            onClick={() => setPeriodModalOpen(true)}
            className={`min-w-[40px] min-h-[38px] flex items-center justify-end active:opacity-60 ${
              timePeriod !== 'all' ? 'text-[#007AFF]' : 'text-[#48484A]'
            }`}
            title="Select Time Period"
          >
            <Clock className="w-5 h-5 stroke-[1.9]" />
          </button>
        </div>

        {/* Active Period / Symbol Filter Pill Bar (Only visible when filtered) */}
        {(timePeriod !== 'all' || symbolFilter !== 'ALL') && (
          <div className="px-4 py-1.5 bg-[#F2F2F7] border-t border-[#E5E5EA] flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2 text-[#3A3A3C] font-medium">
              <Calendar className="w-3.5 h-3.5 text-[#007AFF]" />
              <span>
                Period: <strong className="text-black">{PERIOD_LABELS[timePeriod]}</strong>
                {timePeriod === 'custom' && ` (${customStartDate} → ${customEndDate})`}
              </span>
              {symbolFilter !== 'ALL' && (
                <span className="px-1.5 py-0.5 rounded bg-[#007AFF]/10 text-[#007AFF] font-semibold">
                  {symbolFilter}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                setTimePeriod('all');
                setSymbolFilter('ALL');
              }}
              className="text-[#007AFF] font-semibold active:opacity-60"
            >
              Reset
            </button>
          </div>
        )}
      </header>

      {/* Main Scrollable Chronological History List + Bottom Summary */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-between bg-white">
        <div className="py-1 divide-y divide-[#F2F2F7]">
          {filteredDeals.length === 0 ? (
            <div className="py-16 text-center text-[14px] text-[#8E8E93]">
              No history records found for {PERIOD_LABELS[timePeriod]}.
            </div>
          ) : (
            filteredDeals.map((deal) => {
              const isExpanded = selectedDealId === deal.id;
              const isPositive = deal.profit >= 0;

              // Render Balance Operation Row (Deposit / Withdrawal)
              if (deal.type === 'balance') {
                const label =
                  deal.comment?.trim() ||
                  (deal.profit >= 0 ? 'Deposit' : 'Withdrawal');
                return (
                  <div
                    key={deal.id}
                    onClick={() => setSelectedDealId(isExpanded ? null : deal.id)}
                    className="px-4 py-2 bg-white active:bg-[#F2F2F7] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[16px] font-extrabold text-black mt5-symbol-font">
                            Balance
                          </span>
                        </div>
                        <div className="text-[13.5px] text-[#3A3A3C]">
                          {label}
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <div
                          className={`text-[15.5px] font-bold ${
                            isPositive ? 'text-[#007AFF]' : 'text-[#D92B2B]'
                          }`}
                        >
                          {deal.profit.toFixed(2)}
                        </div>
                        <div className="text-[13.5px] text-[#48484A]">
                          {deal.closeTime || deal.openTime}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-[#E5E5EA] flex items-center justify-between text-[12px] text-[#6C6C70]">
                        <span>Deal Ticket: #{deal.orderId || deal.id}</span>
                        <span>Comment: {label}</span>
                      </div>
                    )}
                  </div>
                );
              }

              // Render Trade Deal Row (Buy / Sell)
              const digits = getDigits(deal.symbol);
              return (
                <div
                  key={deal.id}
                  onClick={() => setSelectedDealId(isExpanded ? null : deal.id)}
                  className="px-4 py-2 bg-white active:bg-[#F2F2F7] transition-colors cursor-pointer relative"
                >
                  {/* Left subtle SL/TP hit indicator bar */}
                  {deal.closeReason === 'sl' && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#D92B2B] rounded-r" />
                  )}
                  {deal.closeReason === 'tp' && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-[#269E86] rounded-r" />
                  )}

                  <div className="flex items-center justify-between">
                    {/* Left: Symbol + buy/sell lots + Open -> Close prices */}
                    <div className="space-y-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[16px] font-extrabold text-black mt5-symbol-font">
                          {deal.symbol}
                        </span>
                        <span
                          className={`text-[15px] font-bold ${
                            deal.type === 'buy'
                              ? 'text-[#007AFF]'
                              : 'text-[#D92B2B]'
                          }`}
                        >
                          {deal.type}{' '}
                          {subTab === 'orders'
                            ? `${deal.lots} / ${deal.lots}`
                            : deal.lots}
                        </span>
                      </div>

                      <div className="text-[14px] text-[#3A3A3C]">
                        {subTab === 'orders'
                          ? `${deal.openPrice.toFixed(digits)} → market`
                          : `${deal.openPrice.toFixed(digits)} → ${deal.closePrice.toFixed(digits)}`}
                      </div>
                    </div>

                    {/* Right: Profit/Loss + Timestamp (Screenshot 4) */}
                    <div className="text-right space-y-0.5">
                      <div
                        className={`text-[15.5px] font-bold ${
                          subTab === 'orders'
                            ? 'text-[#3A3A3C]'
                            : isPositive
                            ? 'text-[#007AFF]'
                            : 'text-[#D92B2B]'
                        }`}
                      >
                        {subTab === 'orders' ? 'filled' : deal.profit.toFixed(2)}
                      </div>
                      <div className="text-[13.5px] text-[#48484A]">
                        {deal.closeTime}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Ticket Details */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-[#E5E5EA] grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-[#6C6C70]">
                      <div className="flex justify-between">
                        <span>Ticket:</span>
                        <span className="text-black font-medium">
                          #{deal.orderId || deal.id}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Open:</span>
                        <span className="text-black font-medium">
                          {deal.openTime}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>S/L:</span>
                        <span className="text-[#D92B2B] font-medium">
                          {deal.sl !== null ? deal.sl.toFixed(digits) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>T/P:</span>
                        <span className="text-[#269E86] font-medium">
                          {deal.tp !== null ? deal.tp.toFixed(digits) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Swap:</span>
                        <span className="text-black font-medium">
                          {deal.swap.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Commission:</span>
                        <span className="text-black font-medium">
                          {deal.commission.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Authentic MT5 Bottom Financial Summary Block (Screenshot 4) */}
        <div className="px-4 py-3 bg-white border-t border-[#F2F2F7] space-y-1.5 text-[15.5px] shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-black">Deposit</span>
            <span className="font-bold text-black">
              {formatMT5Money(depositAmount)}
            </span>
          </div>
          {totalWithdrawals < 0 && (
            <div className="flex items-center justify-between">
              <span className="font-semibold text-black">Withdrawal</span>
              <span className="font-bold text-black">
                {formatMT5Money(totalWithdrawals)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-black">Profit</span>
            <span className="font-bold text-black">
              {formatMT5Money(totalProfit)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-black">Swap</span>
            <span className="font-bold text-black">
              {formatMT5Money(totalSwap)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-black">Commission</span>
            <span className="font-bold text-black">
              {formatMT5Money(totalCommission)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-black">Balance</span>
            <span className="font-bold text-black">
              {formatMT5Money(computedBalance)}
            </span>
          </div>
        </div>
      </div>

      {/* Time Period Filter Sheet Modal */}
      {periodModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={() => setPeriodModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-[#F2F2F7] rounded-t-2xl overflow-hidden shadow-xl pb-safe animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white px-4 py-3 border-b border-[#E5E5EA] flex items-center justify-between">
              <span className="text-[16px] font-bold text-black">
                History Time Period
              </span>
              <button
                onClick={() => setPeriodModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#F2F2F7] flex items-center justify-center text-[#6C6C70]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 space-y-2.5">
              <div className="bg-white rounded-xl divide-y divide-[#E5E5EA] overflow-hidden border border-[#E5E5EA]">
                {(
                  ['all', 'today', 'week', 'month', '3months', 'custom'] as const
                ).map((period) => {
                  const isSelected = timePeriod === period;
                  return (
                    <button
                      key={period}
                      onClick={() => {
                        setTimePeriod(period);
                        if (period !== 'custom') {
                          setPeriodModalOpen(false);
                        }
                      }}
                      className="w-full px-4 py-3 flex items-center justify-between text-left active:bg-[#F2F2F7]"
                    >
                      <span
                        className={`text-[15px] ${
                          isSelected
                            ? 'font-bold text-[#007AFF]'
                            : 'font-medium text-black'
                        }`}
                      >
                        {PERIOD_LABELS[period]}
                      </span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-[#007AFF] stroke-[2.5]" />
                      )}
                    </button>
                  );
                })}
              </div>

              {timePeriod === 'custom' && (
                <div className="bg-white rounded-xl p-3.5 border border-[#E5E5EA] space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6C6C70] mb-1">
                        From Date
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#F2F2F7] rounded-lg text-[13px] text-black"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#6C6C70] mb-1">
                        To Date
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#F2F2F7] rounded-lg text-[13px] text-black"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => setPeriodModalOpen(false)}
                    className="w-full py-2.5 rounded-xl bg-[#007AFF] text-white text-[14px] font-semibold active:opacity-90"
                  >
                    Apply Custom Period
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
