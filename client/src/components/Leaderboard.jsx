export default function Leaderboard({ entries = [], highlightId = null }) {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="space-y-2 animate-fade-in">
      {entries.map((entry, index) => {
        const isHighlighted = entry.id === highlightId;
        const isTop3 = index < 3;

        return (
          <div
            key={entry.id || entry.nickname}
            className={`flex items-center justify-between px-5 py-3 rounded-2xl transition-all duration-300
              ${isHighlighted
                ? 'ring-2 ring-yellow-400 bg-yellow-900/50'
                : isTop3
                  ? index === 0 ? 'bg-yellow-500 text-black'
                  : index === 1 ? 'bg-slate-400 text-black'
                  : 'bg-orange-600 text-white'
                : 'bg-gray-700 text-white'
              }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl w-9 text-center">
                {medals[index] ?? <span className="text-gray-400 font-bold text-base">#{entry.rank}</span>}
              </span>
              <span className="font-bold text-lg truncate max-w-[140px]">{entry.nickname}</span>
              {entry.streak > 1 && (
                <span className="text-xs font-semibold bg-black/20 px-2 py-0.5 rounded-full">
                  🔥 {entry.streak}
                </span>
              )}
            </div>
            <span className="font-black text-xl tabular-nums">{entry.score.toLocaleString()}</span>
          </div>
        );
      })}
    </div>
  );
}
