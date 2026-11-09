import React, { useState } from 'react';
import { Search, Pencil, Check, Trash2, TrendingUp, BarChart2, Info, X, Plus } from 'lucide-react';
import { QuoteData } from '../types/mt5';
import { splitMT5Price, ALL_SYMBOL_CONFIGS } from '../utils/mt5Formatters';
import { SriLankaMarketHours } from '../services/marketDataFeed';

interface QuotesTabProps {
  quotes: Record<string, QuoteData>;
  watchlist: string[];
  onSelectSymbolForChart: (symbol: string) => void;
  onOpenNewOrder: (symbol: string) => void;
  onAddSymbol: (symbol: string) => void;
  onRemoveSymbol: (symbol: string) => void;
  viewMode: 'advanced' | 'simple';
  onToggleViewMode: () => void;
}

export const QuotesTab: React.FC<QuotesTabProps> = ({
  quotes,
  watchlist,
  onSelectSymbolForChart,
  onOpenNewOrder,
  onAddSymbol,
  onRemoveSymbol,
  viewMode,
  onToggleViewMode,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [activeActionSymbol, setActiveActionSymbol] = useState<string | null>(null);
  const [propertiesSymbol, setPropertiesSymbol] = useState<string | null>(null);

  const isMarketOpen = SriLankaMarketHours.isMarketOpen();

  const filteredWatchlist = watchlist.filter((sym) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const data = quotes[sym];
    return (
      sym.toLowerCase().includes(q) ||
      (data && data.description.toLowerCase().includes(q))
    );
  });

  const availableToAdd = ALL_SYMBOL_CONFIGS.filter(
    (cfg) =>
      !watchlist.includes(cfg.symbol) &&
      (cfg.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cfg.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Authentic MT5 iOS Light Mode Price Display:
  // - Market Open (Chart Running): Blue (#0070E0) when price ticks UP, Red (#E53935) when price ticks DOWN
  // - Market Closed: Black (text-black)
  const renderPriceColumn = (
    price: number,
    digits: number,
    flash: 'up' | 'down' | 'none',
    fallbackUp: boolean
  ) => {
    const parts = splitMT5Price(price, digits);
    let priceColorClass = 'text-black';
    if (isMarketOpen) {
      if (flash === 'up') {
        priceColorClass = 'text-[#0070E0]';
      } else if (flash === 'down') {
        priceColorClass = 'text-[#E53935]';
      } else {
        priceColorClass = fallbackUp ? 'text-[#0070E0]' : 'text-[#E53935]';
      }
    }

    return (
      <div
        className={`inline-flex items-baseline justify-end leading-none tabular-nums transition-colors duration-75 ${priceColorClass}`}
      >
        <span className="text-[18px] font-semibold tracking-tight leading-none">
          {parts.prefix}
        </span>
        <span className="text-[28px] font-bold tracking-tight leading-none">
          {parts.big}
        </span>
        {parts.sup !== '' && (
          <span className="text-[14px] font-bold leading-none self-start -mt-0.5 ml-[0.5px]">
            {parts.sup}
          </span>
        )}
      </div>
    );
  };

  const selectedPropQuote = propertiesSymbol ? quotes[propertiesSymbol] : null;

  return (
    <div className="flex flex-col h-full bg-white text-black">
      {/* iOS Top Navigation Header (Screenshot 7) */}
      <header className="pt-safe bg-white shrink-0 z-20">
        <div className="h-11 px-4 flex items-center justify-between">
          {/* Left: MT5 Simple/Advanced list icon */}
          <button
            onClick={onToggleViewMode}
            className="min-w-[40px] min-h-[40px] flex items-center justify-start text-[#6C6C70] active:opacity-60"
            title="Toggle Simple / Advanced View"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11" strokeLinecap="round" />
            </svg>
          </button>

          <h1 className="text-[17px] font-bold tracking-tight text-black">
            Quotes
          </h1>

          <button
            onClick={() => setIsEditing((prev) => !prev)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-end text-[#6C6C70] active:opacity-60"
            aria-label="Edit Watchlist"
          >
            {isEditing ? (
              <Check className="w-5 h-5 text-[#007AFF]" />
            ) : (
              <Pencil className="w-[19px] h-[19px]" />
            )}
          </button>
        </div>

        {/* MT5 iOS Search Input Bar (#EEEEF0 rounded pill) */}
        <div className="px-3.5 pb-2.5">
          <div className="relative flex items-center bg-[#EEEEF0] rounded-[10px] h-9 px-3">
            <Search className="w-4 h-4 text-[#8E8E93] mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="enter symbol for search"
              className="w-full bg-transparent text-[15px] text-black placeholder-[#8E8E93] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#8E8E93] hover:text-black p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable Quotes List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-3.5 py-1 space-y-3.5">
        {filteredWatchlist.map((sym) => {
          const q = quotes[sym];
          if (!q) return null;

          const isPositiveDay = q.changePts >= 0;

          return (
            <div
              key={sym}
              onClick={() => {
                if (!isEditing) {
                  setActiveActionSymbol(sym);
                }
              }}
              className="flex items-center justify-between active:bg-[#F2F2F7] rounded-lg py-0.5 transition-colors cursor-pointer"
            >
              {/* Left Column: Daily change, Condensed Bold Symbol Name, Timestamp & Spread */}
              <div className="flex items-center gap-2.5 min-w-0">
                {isEditing && watchlist.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSymbol(sym);
                    }}
                    className="w-6 h-6 rounded-full bg-[#FF3B30] text-white flex items-center justify-center shrink-0 active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <div className="flex flex-col">
                  {viewMode === 'advanced' && (
                    <div className="flex items-center gap-1.5 text-[13px] font-medium leading-tight tabular-nums">
                      <span className="text-[#48484A]">
                        {q.changePts > 0 ? `+${q.changePts}` : q.changePts}
                      </span>
                      <span
                        className={
                          isPositiveDay ? 'text-[#0070E0]' : 'text-[#E53935]'
                        }
                      >
                        {`${q.changePct.toFixed(2)}%`}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center">
                    <span className="text-[18px] font-extrabold text-black leading-tight mt5-symbol-font">
                      {q.symbol}
                    </span>
                  </div>

                  {viewMode === 'advanced' ? (
                    <div className="flex items-center gap-1 text-[13px] text-[#48484A] leading-tight mt-0.5 tabular-nums">
                      <span>{q.timestamp}</span>
                      {/* Authentic MT5 Spread Icon [|<->|] */}
                      <svg
                        className="w-3.5 h-3.5 text-[#AEAEB2] mx-0.5"
                        viewBox="0 0 16 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                      >
                        <path d="M2 1v12M14 1v12M4 5h8M4 9h8" />
                      </svg>
                      <span className="text-[#48484A]">{q.spread}</span>
                    </div>
                  ) : (
                    <span className="text-[12px] text-[#6C6C70] truncate max-w-[140px]">
                      {q.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Column: Bid and Ask with enlarged Pip digits + L/H */}
              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                {/* BID Column */}
                <div className="flex flex-col items-end min-w-[92px]">
                  {renderPriceColumn(q.bid, q.digits, q.flash, isPositiveDay)}
                  {viewMode === 'advanced' && (
                    <span className="text-[12.5px] text-[#48484A] mt-0.5 tabular-nums">
                      L: {q.low.toFixed(q.digits)}
                    </span>
                  )}
                </div>

                {/* ASK Column */}
                <div className="flex flex-col items-end min-w-[92px]">
                  {renderPriceColumn(q.ask, q.digits, q.flash, isPositiveDay)}
                  {viewMode === 'advanced' && (
                    <span className="text-[12.5px] text-[#48484A] mt-0.5 tabular-nums">
                      H: {q.high.toFixed(q.digits)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Symbols Section when searching or editing */}
        {(isEditing || (searchQuery.trim() !== '' && availableToAdd.length > 0)) &&
          availableToAdd.length > 0 && (
            <div className="pt-3 pb-4 border-t border-[#E5E5EA]">
              <div className="py-1 text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                Tap to Add Symbol
              </div>
              {availableToAdd.map((cfg) => (
                <div
                  key={cfg.symbol}
                  onClick={() => onAddSymbol(cfg.symbol)}
                  className="py-2 flex items-center justify-between active:bg-[#F2F2F7] border-b border-[#E5E5EA] cursor-pointer"
                >
                  <div>
                    <div className="text-[15px] font-bold text-black">
                      {cfg.symbol}
                    </div>
                    <div className="text-[12px] text-[#6C6C70]">
                      {cfg.description}
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* iOS Action Sheet when tapping a Symbol Row */}
      {activeActionSymbol && quotes[activeActionSymbol] && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end p-3 pb-safe"
          onClick={() => setActiveActionSymbol(null)}
        >
          <div
            className="w-full max-w-md mx-auto space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl overflow-hidden divide-y divide-[#E5E5EA] shadow-lg">
              <div className="px-4 py-3 text-center">
                <div className="text-[13px] font-semibold text-[#6C6C70]">
                  {activeActionSymbol} : {quotes[activeActionSymbol].description}
                </div>
              </div>

              <button
                onClick={() => {
                  const sym = activeActionSymbol;
                  setActiveActionSymbol(null);
                  onOpenNewOrder(sym);
                }}
                className="w-full py-3.5 text-[17px] font-normal text-[#007AFF] active:bg-[#F2F2F7] flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Trade</span>
              </button>

              <button
                onClick={() => {
                  const sym = activeActionSymbol;
                  setActiveActionSymbol(null);
                  onSelectSymbolForChart(sym);
                }}
                className="w-full py-3.5 text-[17px] font-normal text-[#007AFF] active:bg-[#F2F2F7] flex items-center justify-center gap-2"
              >
                <BarChart2 className="w-4 h-4" />
                <span>Chart</span>
              </button>

              <button
                onClick={() => {
                  const sym = activeActionSymbol;
                  setActiveActionSymbol(null);
                  setPropertiesSymbol(sym);
                }}
                className="w-full py-3.5 text-[17px] font-normal text-[#007AFF] active:bg-[#F2F2F7] flex items-center justify-center gap-2"
              >
                <Info className="w-4 h-4" />
                <span>Details</span>
              </button>
            </div>

            <button
              onClick={() => setActiveActionSymbol(null)}
              className="w-full py-3.5 bg-white rounded-2xl text-[17px] font-semibold text-[#007AFF] shadow-lg active:bg-[#F2F2F7]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Symbol Properties Modal */}
      {selectedPropQuote && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setPropertiesSymbol(null)}
        >
          <div
            className="w-full max-w-sm bg-white border border-[#E5E5EA] rounded-2xl overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#E5E5EA] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-black">
                  {selectedPropQuote.symbol}
                </h3>
                <p className="text-[12px] text-[#6C6C70]">
                  {selectedPropQuote.description}
                </p>
              </div>
              <button
                onClick={() => setPropertiesSymbol(null)}
                className="p-1.5 text-[#6C6C70]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#6C6C70]">Sector</span>
                <span className="text-black font-medium">
                  {selectedPropQuote.category}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6C6C70]">Digits</span>
                <span className="text-black font-medium">
                  {selectedPropQuote.digits}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6C6C70]">Contract Size</span>
                <span className="text-black font-medium">
                  {selectedPropQuote.contractSize.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6C6C70]">Spread</span>
                <span className="text-black font-medium">
                  Floating ({selectedPropQuote.spread})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
