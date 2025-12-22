
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

  const startColor = theme === 'dark' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)';
  const endColor = theme === 'dark' ? 'rgba(147, 51, 234, 0.6)' : 'rgba(147, 51, 234, 0.4)';

  const opacity = isHidden ? 0.08 : isActive ? 1 : (theme === 'dark' ? 0.15 : 0.25);

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
          stroke={theme === 'dark' ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)"}
          strokeWidth="15"
          strokeLinecap="round"
          className="transition-opacity duration-500"
        />
      )}

      {/* Main Connection */}
      <path
        d={pathData}
        fill="transparent"
        stroke={`url(#${gradientId})`}
        strokeWidth={isActive ? "3" : "1.5"}
        strokeDasharray={isHidden ? "5,5" : "none"}
        className="transition-all duration-1000 ease-out"
      />

      {/* Energy Pulse Path - Enhanced Visibility */}
      {!isHidden && (
        <path
          d={pathData}
          fill="transparent"
          stroke={theme === 'dark' ? "rgba(96, 165, 250, 1)" : "rgba(37, 99, 235, 1)"}
          strokeWidth="5"
          strokeLinecap="round"
          className={`pulse-path ${isNew ? 'animate-pulse-flow' : 'opacity-0'}`}
        />
      )}

      <style>{`
        .pulse-path {
          stroke-dasharray: 100 1100;
          stroke-dashoffset: 1200;
          filter: blur(1px);
        }
        .animate-pulse-flow {
          animation: energy-pulse 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes energy-pulse {
          0% { stroke-dashoffset: 1200; opacity: 0; }
          30% { opacity: 1; stroke-width: 6; }
          70% { opacity: 1; stroke-width: 3; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }
      `}</style>
    </svg>
  );
};
