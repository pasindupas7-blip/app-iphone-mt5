import React, { useState } from 'react';
import { Plus, ArrowUpDown, TrendingUp, BarChart2, Pencil, CheckCircle2, X } from 'lucide-react';
import { Position, QuoteData, TradingAccount } from '../types/mt5';
import {
  calculatePositionMargin,
  calculatePositionPL,
  formatMT5Money,
} from '../utils/mt5Formatters';

interface TradeTabProps {
  account: TradingAccount;
  positions: Position[];
  quotes: Record<string, QuoteData>;
  activeSymbol: string;
  onOpenNewOrder: (symbol: string) => void;
  onClosePosition: (positionId: string) => void;
  onModifyPosition: (positionId: string, sl: number | null, tp: number | null) => void;
  onCloseAllPositions: (filter?: 'all' | 'profit' | 'loss') => void;
  onOpenChart: (symbol: string) => void;
}

export const TradeTab: React.FC<TradeTabProps> = ({
  account,
  positions,
  quotes,
  activeSymbol,
  onOpenNewOrder,
  onClosePosition,
  onModifyPosition,
  onCloseAllPositions,
  onOpenChart,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionPos, setActionPos] = useState<Position | null>(null);
  const [modifyPos, setModifyPos] = useState<Position | null>(null);
  const [modSl, setModSl] = useState('');
  const [modTp, setModTp] = useState('');
  const [showBulkMenu, setShowBulkMenu] = useState(false);

  // Calculate live account metrics
  let totalFloatingPL = 0;
  let totalMargin = 0;

  for (const pos of positions) {
    const q = quotes[pos.symbol];
    totalFloatingPL += calculatePositionPL(pos, q);
    totalMargin += calculatePositionMargin(pos, q, account.leverage);
  }

  totalFloatingPL = Number(totalFloatingPL.toFixed(2));
  totalMargin = Number(totalMargin.toFixed(2));
  const equity = Number((account.balance + totalFloatingPL).toFixed(2));
  const freeMargin = Number((equity - totalMargin).toFixed(2));
  const marginLevel =
    totalMargin > 0 ? Number(((equity / totalMargin) * 100).toFixed(2)) : 0;

  const hasPositions = positions.length > 0;
  const headerPlColor =
    !hasPositions
      ? 'text-[#E6EDF3]'
      : totalFloatingPL >= 0
      ? 'text-[#2962FF]'
      : 'text-[#F23645]';

  const openModifyDialog = (pos: Position) => {
    setModifyPos(pos);
    setModSl(pos.sl !== null ? String(pos.sl) : '');
    setModTp(pos.tp !== null ? String(pos.tp) : '');
    setActionPos(null);
  };

  const handleSaveModify = () => {
    if (!modifyPos) return;
    const slVal = modSl.trim() !== '' && parseFloat(modSl) > 0 ? parseFloat(modSl) : null;
    const tpVal = modTp.trim() !== '' && parseFloat(modTp) > 0 ? parseFloat(modTp) : null;
    onModifyPosition(modifyPos.id, slVal, tpVal);
    setModifyPos(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0D1117] text-[#E6EDF3]">
      {/* Top Header with Total Floating P/L */}
      <header className="pt-safe bg-[#161B22]/95 backdrop-blur-md border-b border-[#21262D] shrink-0 z-20">
        <div className="h-11 px-3.5 flex items-center justify-between">
          <button
            onClick={() => hasPositions && setShowBulkMenu(true)}
            className={`min-w-[44px] min-h-[44px] flex items-center justify-start ${
              hasPositions ? 'text-[#2962FF] active:opacity-70' : 'text-[#8B949E]/40'
            }`}
            title="Bulk Position Operations"
          >
            <ArrowUpDown className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center">
            <span className={`text-[18px] font-bold tracking-tight ${headerPlColor}`}>
              {hasPositions
                ? `${formatMT5Money(totalFloatingPL, true)} ${account.currency}`
                : account.currency}
            </span>
          </div>

          <button
            onClick={() => onOpenNewOrder(activeSymbol)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-end text-[#2962FF] active:opacity-70"
            aria-label="New Order"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        {/* Live Account Summary Header */}
        <div className="px-4 py-3 bg-[#0D1117] border-b border-[#21262D] space-y-1 text-[14px]">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#8B949E]">Balance:</span>
            <span className="font-bold text-[#E6EDF3] font-mono">
              {formatMT5Money(account.balance)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#8B949E]">Equity:</span>
            <span className="font-bold text-[#E6EDF3] font-mono">
              {formatMT5Money(equity)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#8B949E]">Margin:</span>
            <span className="font-bold text-[#E6EDF3] font-mono">
              {formatMT5Money(totalMargin)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#8B949E]">Free Margin:</span>
            <span className="font-bold text-[#E6EDF3] font-mono">
              {formatMT5Money(freeMargin)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#8B949E]">Margin Level (%):</span>
            <span className="font-bold text-[#E6EDF3] font-mono">
              {totalMargin > 0 ? `${formatMT5Money(marginLevel)}%` : '—'}
            </span>
          </div>
        </div>

        {hasPositions ? (
          <div className="flex-1">
            {/* Positions Section Header */}
            <div className="px-4 py-1.5 bg-[#161B22] border-b border-[#21262D] flex items-center justify-between">
              <span className="text-[12px] font-semibold text-[#8B949E] uppercase tracking-wider">
                Positions ({positions.length})
              </span>
              <button
                onClick={() => setShowBulkMenu(true)}
                className="text-[#8B949E] hover:text-[#E6EDF3] px-1 text-[16px] leading-none font-bold"
              >
                •••
              </button>
            </div>

            {/* Open Positions List */}
            <div className="divide-y divide-[#21262D]">
              {positions.map((pos) => {
                const q = quotes[pos.symbol];
                const digits = q?.digits ?? 2;
                const currentPrice = q
                  ? pos.type === 'buy'
                    ? q.bid
                    : q.ask
                  : pos.openPrice;
                const pl = calculatePositionPL(pos, q);
                const isExpanded = expandedId === pos.id;

                return (
                  <div
                    key={pos.id}
                    className="bg-[#0D1117] hover:bg-[#161B22]/60 transition-colors"
                  >
                    <div
                      onClick={() =>
                        setExpandedId(isExpanded ? null : pos.id)
                      }
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActionPos(pos);
                      }}
                      className="px-4 py-2.5 flex items-center justify-between cursor-pointer active:bg-[#161B22]"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[15px] font-bold text-[#E6EDF3]">
                            {pos.symbol},
                          </span>
                          <span
                            className={`text-[14px] font-semibold ${
                              pos.type === 'buy' ? 'text-[#2962FF]' : 'text-[#F23645]'
                            }`}
                          >
                            {pos.type} {pos.lots}
                          </span>
                        </div>
                        <div className="text-[13px] text-[#8B949E] font-mono">
                          {pos.openPrice.toFixed(digits)} → {currentPrice.toFixed(digits)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end">
                        <span
                          className={`text-[16px] font-bold font-mono ${
                            pl >= 0 ? 'text-[#2962FF]' : 'text-[#F23645]'
                          }`}
                        >
                          {pl.toFixed(2)}
                        </span>
                        <span className="text-[11px] text-[#8B949E]">
                          Tap to manage
                        </span>
                      </div>
                    </div>

                    {/* Expanded Position Details + Instant Actions (Close / Modify SL-TP / Chart) */}
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 bg-[#161B22]/70 border-t border-[#21262D]/60 space-y-2.5">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-[#8B949E] font-mono">
                          <div className="flex justify-between">
                            <span>S/L:</span>
                            <span className="text-[#E6EDF3]">
                              {pos.sl !== null ? pos.sl.toFixed(digits) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Swap:</span>
                            <span className="text-[#E6EDF3]">
                              {pos.swap.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>T/P:</span>
                            <span className="text-[#E6EDF3]">
                              {pos.tp !== null ? pos.tp.toFixed(digits) : '—'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>ID:</span>
                            <span className="text-[#E6EDF3]">#{pos.id}</span>
                          </div>
                          <div className="col-span-2 flex justify-between pt-0.5">
                            <span>Open Time:</span>
                            <span className="text-[#E6EDF3]">{pos.openTime}</span>
                          </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <button
                            onClick={() => onClosePosition(pos.id)}
                            className="py-2 px-2 rounded-lg bg-[#F23645] text-white text-[12px] font-bold flex items-center justify-center gap-1 active:opacity-85"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              Close ({pl >= 0 ? `+${pl.toFixed(2)}` : pl.toFixed(2)})
                            </span>
                          </button>

                          <button
                            onClick={() => openModifyDialog(pos)}
                            className="py-2 px-2 rounded-lg bg-[#21262D] text-[#2962FF] text-[12px] font-semibold flex items-center justify-center gap-1 active:bg-[#21262D]/70"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Modify SL/TP</span>
                          </button>

                          <button
                            onClick={() => onOpenChart(pos.symbol)}
                            className="py-2 px-2 rounded-lg bg-[#21262D] text-[#E6EDF3] text-[12px] font-semibold flex items-center justify-center gap-1 active:bg-[#21262D]/70"
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span>Chart</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Authentic MT5 Empty Positions Watermark Graphic (Screenshot 3) */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <svg
              viewBox="0 0 120 120"
              className="w-28 h-28 text-[#21262D] mb-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 86 L50 58 L64 72 L98 38" />
              <path d="M74 38 H98 V62" />
              <path d="M38 98 L62 74" />
              <path d="M58 98 L74 82" />
            </svg>
            <p className="text-[14px] text-[#8B949E] mb-4">No open positions</p>
            <button
              onClick={() => onOpenNewOrder(activeSymbol)}
              className="px-5 py-2.5 rounded-xl bg-[#2962FF] text-white text-[14px] font-semibold flex items-center gap-2 active:scale-95 transition-transform"
            >
              <TrendingUp className="w-4 h-4" />
              <span>New Order ({activeSymbol})</span>
            </button>
          </div>
        )}
      </div>

      {/* Modify SL / TP Modal */}
      {modifyPos && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModifyPos(null)}
        >
          <div
            className="w-full max-w-sm bg-[#161B22] border border-[#21262D] rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#21262D] flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-[#E6EDF3]">
                  Modify Position #{modifyPos.id}
                </h3>
                <p className="text-[12px] text-[#8B949E]">
                  {modifyPos.symbol}{' '}
                  <span
                    className={
                      modifyPos.type === 'buy' ? 'text-[#2962FF]' : 'text-[#F23645]'
                    }
                  >
                    {modifyPos.type} {modifyPos.lots}
                  </span>{' '}
                  at {modifyPos.openPrice}
                </p>
              </div>
              <button
                onClick={() => setModifyPos(null)}
                className="text-[#8B949E] hover:text-[#E6EDF3]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-[#F23645] mb-1">
                  Stop Loss (SL)
                </label>
                <input
                  type="number"
                  step="any"
                  value={modSl}
                  onChange={(e) => setModSl(e.target.value)}
                  placeholder="Not set"
                  className="w-full px-3 py-2 bg-[#0D1117] border border-[#21262D] rounded-xl text-[14px] font-mono text-[#E6EDF3] focus:outline-none focus:border-[#2962FF]"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-[#089981] mb-1">
                  Take Profit (TP)
                </label>
                <input
                  type="number"
                  step="any"
                  value={modTp}
                  onChange={(e) => setTpStrOrModTp(e.target.value, setModTp)}
                  placeholder="Not set"
                  className="w-full px-3 py-2 bg-[#0D1117] border border-[#21262D] rounded-xl text-[14px] font-mono text-[#E6EDF3] focus:outline-none focus:border-[#2962FF]"
                />
              </div>

              <button
                onClick={handleSaveModify}
                className="w-full h-11 rounded-xl bg-[#2962FF] text-white text-[15px] font-bold active:opacity-90"
              >
                Modify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Close Positions Action Sheet */}
      {showBulkMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end p-3 pb-safe"
          onClick={() => setShowBulkMenu(false)}
        >
          <div
            className="w-full max-w-md mx-auto space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#161B22] border border-[#21262D] rounded-2xl overflow-hidden divide-y divide-[#21262D]">
              <div className="py-2.5 text-center text-[12px] font-semibold text-[#8B949E]">
                Bulk Operations
              </div>
              <button
                onClick={() => {
                  onCloseAllPositions('all');
                  setShowBulkMenu(false);
                }}
                className="w-full py-3.5 text-[16px] font-medium text-[#F23645] active:bg-[#21262D]"
              >
                Close All Positions ({formatMT5Money(totalFloatingPL, true)} USD)
              </button>
              <button
                onClick={() => {
                  onCloseAllPositions('profit');
                  setShowBulkMenu(false);
                }}
                className="w-full py-3.5 text-[16px] font-medium text-[#2962FF] active:bg-[#21262D]"
              >
                Close Profitable Positions
              </button>
              <button
                onClick={() => {
                  onCloseAllPositions('loss');
                  setShowBulkMenu(false);
                }}
                className="w-full py-3.5 text-[16px] font-medium text-[#2962FF] active:bg-[#21262D]"
              >
                Close Losing Positions
              </button>
            </div>
            <button
              onClick={() => setShowBulkMenu(false)}
              className="w-full py-3.5 bg-[#161B22] border border-[#21262D] rounded-2xl text-[16px] font-semibold text-[#2962FF]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Context Action Sheet if long-pressed */}
      {actionPos && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end p-3 pb-safe"
          onClick={() => setActionPos(null)}
        >
          <div
            className="w-full max-w-md mx-auto space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#161B22] border border-[#21262D] rounded-2xl overflow-hidden divide-y divide-[#21262D]">
              <button
                onClick={() => {
                  onClosePosition(actionPos.id);
                  setActionPos(null);
                }}
                className="w-full py-3.5 text-[16px] font-semibold text-[#F23645]"
              >
                Close Position #{actionPos.id}
              </button>
              <button
                onClick={() => openModifyDialog(actionPos)}
                className="w-full py-3.5 text-[16px] font-medium text-[#2962FF]"
              >
                Modify Position
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function setTpStrOrModTp(val: string, setter: (v: string) => void) {
  setter(val);
}
