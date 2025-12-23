
import React from 'react';

interface ConnectionLineProps {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  isActive?: boolean;
  isHidden?: boolean;
  isNew?: boolean;
  theme: 'dark' | 'light';
}

export const ConnectionLine: React.FC<ConnectionLineProps> = ({ id, from, to, isActive, isHidden, isNew, theme }) => {
  const verticalDist = Math.abs(from.y - to.y);
  const cp1y = from.y - verticalDist * 0.4;
  const cp2y = to.y + verticalDist * 0.4;
  
  const pathData = `M ${from.x} ${from.y} C ${from.x} ${cp1y}, ${to.x} ${cp2y}, ${to.x} ${to.y}`;
  const gradientId = `grad-${id}`;

  const startColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(37, 99, 235, 0.45)';
  const endColor = theme === 'dark' ? 'rgba(147, 51, 234, 0.8)' : 'rgba(126, 34, 206, 0.6)';

  const opacity = isHidden ? 0.05 : isActive ? 1 : (theme === 'dark' ? 0.3 : 0.4);

  return (
    <svg 
      className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible transition-opacity duration-700"
      style={{ zIndex: 0, opacity }}
    >
      <defs>
        <linearGradient 
          id={gradientId} 
          x1={from.x} 
          y1={from.y} 
          x2={to.x} 
          y2={to.y}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={startColor} />
          <stop offset="100%" stopColor={endColor} />
        </linearGradient>
      </defs>
      
      {/* Glow path for active lines */}
      {isActive && !isHidden && (
        <path
          d={pathData}
          fill="transparent"
          stroke={theme === 'dark' ? "rgba(59, 130, 246, 0.3)" : "rgba(37, 99, 235, 0.2)"}
          strokeWidth="8"
          strokeLinecap="round"
          className="transition-opacity duration-500"
        />
      )}

      {/* Main Connection */}
      <path
        d={pathData}
        fill="transparent"
        stroke={`url(#${gradientId})`}
        strokeWidth={isActive ? "2.5" : "1.2"}
        strokeDasharray={isHidden ? "5,5" : "none"}
        className="transition-all duration-1000 ease-out"
      />

      {/* Energy Pulse Path - Fast for initial pop, extremely slow for subtle glowing forest effect */}
      {!isHidden && (
        <path
          d={pathData}
          fill="transparent"
          stroke={theme === 'dark' ? "rgba(255, 255, 255, 0.7)" : "rgba(37, 99, 235, 0.6)"}
          strokeWidth="2.5"
          strokeLinecap="round"
          className={`pulse-path ${isNew ? 'animate-pulse-flow-fast' : 'animate-pulse-flow-slow'}`}
        />
      )}

      <style>{`
        .pulse-path {
          stroke-dasharray: 60 1200;
          stroke-dashoffset: 1260;
        }
        .animate-pulse-flow-fast {
          animation: energy-pulse 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .animate-pulse-flow-slow {
          animation: energy-pulse 80s linear infinite; /* Extremely slow 80s cycle for a subtle glow */
        }
        @keyframes energy-pulse {
          0% { stroke-dashoffset: 1260; opacity: 0; }
          10% { opacity: 0.15; }
          90% { opacity: 0.15; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
      `}</style>
    </svg>
  );
};
