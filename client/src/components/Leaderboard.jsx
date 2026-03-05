const RANK_STYLES = [
  { bg: 'bg-amber-900/40 border border-amber-500/30', badge: 'bg-gradient-to-br from-amber-400 to-yellow-500 text-black' },
  { bg: 'bg-slate-700/40 border border-slate-400/30', badge: 'bg-gradient-to-br from-slate-300 to-gray-400 text-black' },
  { bg: 'bg-orange-900/40 border border-orange-500/30', badge: 'bg-gradient-to-br from-orange-400 to-amber-600 text-white' },
];

export default function Leaderboard({ entries = [], highlightId = null }) {
  return (
    <div className="space-y-2 animate-fade-in">
      {entries.map((entry, index) => {
        const isHighlighted = entry.id === highlightId;
        const isTop3 = index < 3;
        const rankStyle = isTop3 ? RANK_STYLES[index] : null;

        return (
          <div
            key={entry.id || entry.nickname}
            className={`flex items-center justify-between px-5 py-3 rounded-2xl transition-all duration-300
              ${isHighlighted
                ? 'ring-2 ring-yellow-400 bg-yellow-900/50'
                : rankStyle
                  ? rankStyle.bg
                  : 'bg-gray-700/60 text-white'
              }`}
          >
            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shadow-md ${
                rankStyle ? rankStyle.badge : 'bg-gray-600 text-gray-300'
              }`}>
                {entry.rank ?? index + 1}
              </span>
              <span className="font-bold text-lg truncate max-w-[140px] text-white">{entry.nickname}</span>
              {entry.streak > 1 && (
                <span className="text-xs font-semibold bg-black/20 px-2 py-0.5 rounded-full text-orange-300">
                  🔥 {entry.streak}
                </span>
              )}
            </div>
            <span className="font-black text-xl tabular-nums text-white">{entry.score.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
