import React from "react";
import { Trash2, ShieldCheck, RefreshCw } from "lucide-react";

interface TopBarProps {
  messageCount: number;
  onClearHistory: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  messageCount,
  onClearHistory,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-6">
        {/* Zone 1: Single element brand wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
            <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Mutual Fund FAQ Assistant
            </span>
            <span className="hidden sm:inline-block ml-2 text-xs font-medium text-slate-400">
              · AMFI & SEBI Grounded
            </span>
          </div>
        </div>

        {/* Zone 2: Quiet Center context */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
          <span>Official AMC & Regulatory Intelligence</span>
        </div>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-2 shrink-0">
          {messageCount > 0 && (
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 bg-slate-100/80 hover:bg-rose-50 border border-slate-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Clear current conversation history"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear chat</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
