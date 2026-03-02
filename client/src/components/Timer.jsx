import { useState, useEffect, useRef } from 'react';

export default function Timer({ duration, onExpire, size = 'large' }) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const intervalRef = useRef(null);
  const expiredRef = useRef(false);

  useEffect(() => {
    setTimeLeft(duration);
    expiredRef.current = false;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        const next = t - 1;
        if (next <= 0) {
          clearInterval(intervalRef.current);
          if (!expiredRef.current) {
            expiredRef.current = true;
            onExpire?.();
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [duration]); // eslint-disable-line react-hooks/exhaustive-deps

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = timeLeft / duration;
  const strokeDashoffset = circumference * (1 - progress);

  const color =
    progress > 0.5 ? '#22c55e' :
    progress > 0.25 ? '#eab308' :
    '#ef4444';

  const dim = size === 'large' ? 120 : 80;
  const fontSize = size === 'large' ? 'text-3xl' : 'text-xl';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={dim} height={dim} viewBox="0 0 100 100">
        {/* Track */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#374151" strokeWidth="8" />
        {/* Progress */}
        <circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease' }}
        />
      </svg>
      <span
        className={`absolute font-black ${fontSize} tabular-nums`}
        style={{ color }}
      >
        {timeLeft}
      </span>
    </div>
  );
}
