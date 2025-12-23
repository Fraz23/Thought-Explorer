
import React from 'react';
import { ThoughtNode } from '../types';

interface MinimapProps {
  nodes: ThoughtNode[];
  canvasSize: number;
  viewport: { x: number; y: number; width: number; height: number };
  isOpen: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  zoom: number; // Added zoom to correctly calculate world space
}

export const Minimap: React.FC<MinimapProps> = ({ nodes, canvasSize, viewport, isOpen, isMobile, zoom }) => {
  const mapSize = isMobile ? 120 : 180;
  const scale = mapSize / canvasSize;

  // Convert scroll positions (Screen Space) to World Space
  const worldViewportX = viewport.x / zoom;
  const worldViewportY = viewport.y / zoom;
  const worldViewportW = viewport.width / zoom;
  const worldViewportH = viewport.height / zoom;

  return (
    <div 
      className={`
        transition-all duration-500 ease-in-out overflow-hidden border border-slate-200 dark:border-gray-800 bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl rounded-[1.5rem] md:rounded-[2rem] shadow-3xl pointer-events-auto
        ${isOpen ? `w-[${mapSize}px] h-[${mapSize}px] opacity-100` : `w-[${mapSize}px] h-0 opacity-0 border-none`}
      `}
      style={{ width: isOpen ? mapSize : mapSize, height: isOpen ? mapSize : 0 }}
    >
      <div className="relative w-full h-full">
        {/* Grid Overlay */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" 
             style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
        
        {/* Viewport Indicator */}
        <div 
          className="absolute border-2 border-blue-500 bg-blue-500/10 rounded-sm transition-none z-10"
          style={{
            left: `${worldViewportX * scale}px`,
            top: `${worldViewportY * scale}px`,
            width: `${worldViewportW * scale}px`,
            height: `${worldViewportH * scale}px`,
          }}
        />

        {/* Nodes */}
        {nodes.map(node => (
          <div 
            key={node.id}
            className={`absolute rounded-full transition-all duration-300 ${node.level === 0 ? 'bg-blue-600 w-1.5 h-1.5' : 'bg-slate-400 dark:bg-gray-600 w-1 h-1'}`}
            style={{
              left: `${node.position.x * scale}px`,
              top: `${node.position.y * scale}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: node.level === 0 ? 5 : 2,
              opacity: node.isHidden ? 0.2 : 1
            }}
          />
        ))}
      </div>
    </div>
  );
};
