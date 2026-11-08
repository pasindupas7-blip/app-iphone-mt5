import React, { useState } from 'react';
import { Search, Plus, Pencil, Check, Trash2, ArrowUpDown, TrendingUp, BarChart2, Info, X } from 'lucide-react';
import { QuoteData } from '../types/mt5';
import { splitMT5Price, ALL_SYMBOL_CONFIGS } from '../utils/mt5Formatters';

interface QuotesTabProps {
  quotes: Record<string, QuoteData>;
  watchlist: string[];
  onSelectSymbolForChart: (symbol: string) => void;
  onOpenNewOrder: (symbol: string) => void;
  onAddSymbol: (symbol: string) => void;
  onRemoveSymbol: (symbol: string) => void;
  viewMode: 'advanced' | 'simple';
  onToggleViewMode: () => void;
  isLightMode?: boolean;
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
  const [showAddCatalog, setShowAddCatalog] = useState(false);
  const [activeActionSymbol, setActiveActionSymbol] = useState<string | null>(null);
  const [propertiesSymbol, setPropertiesSymbol] = useState<string | null>(null);

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

  const renderPriceColumn = (
    price: number,
    digits: number,
    flash: 'up' | 'down' | 'none',
    prevPrice: number
  ) => {
    const parts = splitMT5Price(price, digits);
    const isUp = flash === 'up' || (flash === 'none' && price >= prevPrice);
    const isDown = flash === 'down' || (flash === 'none' && price < prevPrice);

    const textColor = isUp
      ? 'text-[#2962FF]'
      : isDown
      ? 'text-[#F23645]'
      : 'text-[#E6EDF3]';

    const flashBg =
      flash === 'up'
        ? 'bg-[#2962FF]/20'
        : flash === 'down'
        ? 'bg-[#F23645]/20'
        : 'bg-transparent';

    return (
      <div
        className={`inline-flex items-baseline justify-end px-1.5 py-0.5 rounded transition-colors duration-150 ${textColor} ${flashBg}`}
      >
        <span className="text-[16px] font-medium tracking-tight leading-none">
          {parts.prefix}
        </span>
        <span className="text-[25px] font-bold tracking-tight leading-none">
          {parts.big}
        </span>
        {parts.sup !== '' && (
          <span className="text-[13px] font-bold leading-none self-start -mt-0.5 ml-[1px]">
            {parts.sup}
          </span>
        )}
      </div>
    );
  };

  const selectedPropQuote = propertiesSymbol ? quotes[propertiesSymbol] : null;

  return (
    <div className="flex flex-col h-full bg-[#0D1117] text-[#E6EDF3]">
      {/* iOS Top Navigation Header */}
      <header className="pt-safe bg-[#161B22]/95 backdrop-blur-md border-b border-[#21262D] shrink-0 z-20">
        <div className="h-11 px-3 flex items-center justify-between">
          <button
            onClick={onToggleViewMode}
            className="min-w-[44px] min-h-[44px] flex items-center justify-start text-[#2962FF] active:opacity-60"
            title="Toggle Simple / Advanced Mode"
          >
            <ArrowUpDown className="w-5 h-5" />
          </button>

          <h1 className="text-[17px] font-semibold tracking-tight text-[#E6EDF3]">
            Quotes
          </h1>

          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => {
                setShowAddCatalog((prev) => !prev);
                setIsEditing(false);
              }}
              className={`min-w-[40px] min-h-[44px] flex items-center justify-center active:opacity-60 ${
                showAddCatalog ? 'text-[#089981]' : 'text-[#2962FF]'
              }`}
              aria-label="Add Symbol"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setIsEditing((prev) => !prev);
                setShowAddCatalog(false);
              }}
              className="min-w-[40px] min-h-[44px] flex items-center justify-end text-[#2962FF] active:opacity-60"
              aria-label="Edit Watchlist"
            >
              {isEditing ? (
                <Check className="w-5 h-5 text-[#089981]" />
              ) : (
                <Pencil className="w-[18px] h-[18px]" />
              )}
            </button>
          </div>
        </div>

        {/* MT5 iOS Search Input Bar */}
        <div className="px-3 pb-2.5">
          <div className="relative flex items-center bg-[#0D1117] border border-[#21262D] rounded-lg h-9 px-3">
            <Search className="w-4 h-4 text-[#8B949E] mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="enter symbol for search"
              className="w-full bg-transparent text-[14px] text-[#E6EDF3] placeholder-[#8B949E] focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-[#8B949E] hover:text-[#E6EDF3] p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Scrollable Quotes List */}
      <div className="flex-1 overflow-y-auto no-scrollbar divide-y divide-[#21262D]/80">
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
              className="px-3.5 py-2.5 flex items-center justify-between active:bg-[#161B22] transition-colors cursor-pointer"
            >
              {/* Left Column: Daily change, Symbol Name, Timestamp & Spread */}
              <div className="flex items-center gap-3 min-w-0">
                {isEditing && watchlist.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSymbol(sym);
                    }}
                    className="w-7 h-7 rounded-full bg-[#F23645]/20 text-[#F23645] flex items-center justify-center shrink-0 active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <div className="flex flex-col">
                  {viewMode === 'advanced' && (
                    <div className="flex items-center gap-1.5 text-[12px] font-medium leading-tight mb-0.5">
                      <span className="text-[#8B949E]">
                        {q.changePts > 0 ? `+${q.changePts}` : q.changePts}
                      </span>
                      <span
                        className={
                          isPositiveDay ? 'text-[#2962FF]' : 'text-[#F23645]'
                        }
                      >
                        {q.changePct > 0
                          ? `+${q.changePct.toFixed(2)}%`
                          : `${q.changePct.toFixed(2)}%`}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    <span className="text-[17px] font-bold tracking-tight text-[#E6EDF3] leading-snug">
                      {q.symbol}
                    </span>
                  </div>

                  {viewMode === 'advanced' ? (
                    <div className="flex items-center gap-1.5 text-[12px] text-[#8B949E] mt-0.5 leading-tight">
                      <span>{q.timestamp}</span>
                      {/* Authentic MT5 Spread Icon [|<->|] */}
                      <span
                        className="inline-flex items-center text-[10px] text-[#8B949E] font-mono px-0.5"
                        aria-hidden="true"
                      >
                        ╞═╡
                      </span>
                      <span className="text-[#8B949E] font-medium">
                        {q.spread}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#8B949E] truncate max-w-[130px]">
                      {q.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Column: Bid and Ask with enlarged Pip digits + L/H */}
              <div className="flex items-center gap-3 sm:gap-5 shrink-0">
                {/* BID Column */}
                <div className="flex flex-col items-end min-w-[88px]">
                  {renderPriceColumn(q.bid, q.digits, q.flash, q.prevBid)}
                  {viewMode === 'advanced' && (
                    <span className="text-[11px] text-[#8B949E] mt-0.5 pr-1">
                      L: {q.low.toFixed(q.digits)}
                    </span>
                  )}
                </div>

                {/* ASK Column */}
                <div className="flex flex-col items-end min-w-[88px]">
                  {renderPriceColumn(q.ask, q.digits, q.flash, q.prevAsk)}
                  {viewMode === 'advanced' && (
                    <span className="text-[11px] text-[#8B949E] mt-0.5 pr-1">
                      H: {q.high.toFixed(q.digits)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Symbols Section when searching or + button active */}
        {(showAddCatalog || (searchQuery.trim() !== '' && availableToAdd.length > 0)) && (
          <div className="bg-[#161B22]/60 pt-2 pb-4">
            <div className="px-3.5 py-1.5 text-[11px] font-semibold text-[#8B949E] uppercase tracking-wider">
              Available Symbols to Add
            </div>
            {availableToAdd.map((cfg) => (
              <div
                key={cfg.symbol}
                onClick={() => onAddSymbol(cfg.symbol)}
                className="px-3.5 py-2.5 flex items-center justify-between active:bg-[#161B22] border-b border-[#21262D]/50 cursor-pointer"
              >
                <div>
                  <div className="text-[15px] font-bold text-[#E6EDF3]">
                    {cfg.symbol}
                  </div>
                  <div className="text-[12px] text-[#8B949E]">
                    {cfg.description} · {cfg.category}
                  </div>
                </div>
                <button className="w-8 h-8 rounded-full bg-[#2962FF]/15 text-[#2962FF] flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* iOS Action Sheet when tapping a Symbol Row */}
      {activeActionSymbol && quotes[activeActionSymbol] && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex flex-col justify-end p-3 pb-safe"
          onClick={() => setActiveActionSymbol(null)}
        >
          <div
            className="w-full max-w-md mx-auto space-y-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#161B22]/95 backdrop-blur-xl rounded-2xl overflow-hidden border border-[#21262D] divide-y divide-[#21262D]">
              <div className="px-4 py-3 text-center">
                <div className="text-[13px] font-semibold text-[#E6EDF3]">
                  {activeActionSymbol} : {quotes[activeActionSymbol].description}
                </div>
                <div className="text-[11px] text-[#8B949E] mt-0.5">
                  Bid: {quotes[activeActionSymbol].bid.toFixed(quotes[activeActionSymbol].digits)} · Ask:{' '}
                  {quotes[activeActionSymbol].ask.toFixed(quotes[activeActionSymbol].digits)}
                </div>
              </div>

              <button
                onClick={() => {
                  const sym = activeActionSymbol;
                  setActiveActionSymbol(null);
                  onOpenNewOrder(sym);
                }}
                className="w-full py-3.5 text-[16px] font-medium text-[#2962FF] active:bg-[#21262D] flex items-center justify-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Trade (New Order)</span>
              </button>

              <button
                onClick={() => {
                  const sym = activeActionSymbol;
                  setActiveActionSymbol(null);
                  onSelectSymbolForChart(sym);
                }}
                className="w-full py-3.5 text-[16px] font-medium text-[#2962FF] active:bg-[#21262D] flex items-center justify-center gap-2"
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
                className="w-full py-3.5 text-[16px] font-medium text-[#2962FF] active:bg-[#21262D] flex items-center justify-center gap-2"
              >
                <Info className="w-4 h-4" />
                <span>Details / Properties</span>
              </button>
            </div>

            <button
              onClick={() => setActiveActionSymbol(null)}
              className="w-full py-3.5 bg-[#161B22] rounded-2xl text-[16px] font-semibold text-[#2962FF] border border-[#21262D] active:bg-[#21262D]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Symbol Properties Modal */}
      {selectedPropQuote && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPropertiesSymbol(null)}
        >
          <div
            className="w-full max-w-sm bg-[#161B22] border border-[#21262D] rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#21262D] flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-[#E6EDF3]">
                  {selectedPropQuote.symbol}
                </h3>
                <p className="text-[12px] text-[#8B949E]">
                  {selectedPropQuote.description}
                </p>
              </div>
              <button
                onClick={() => setPropertiesSymbol(null)}
                className="p-1.5 text-[#8B949E] hover:text-[#E6EDF3]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-2.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#8B949E]">Sector / Category</span>
                <span className="text-[#E6EDF3] font-medium">
                  {selectedPropQuote.category}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B949E]">Digits</span>
                <span className="text-[#E6EDF3] font-medium">
                  {selectedPropQuote.digits}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B949E]">Contract Size</span>
                <span className="text-[#E6EDF3] font-medium">
                  {selectedPropQuote.contractSize.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B949E]">Spread</span>
                <span className="text-[#E6EDF3] font-medium">
                  Floating ({selectedPropQuote.spread} pts)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B949E]">Calculation</span>
                <span className="text-[#E6EDF3] font-medium">CFD / Forex</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B949E]">Trade Execution</span>
                <span className="text-[#E6EDF3] font-medium">Market Execution</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
