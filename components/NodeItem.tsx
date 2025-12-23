
import React, { useState, useEffect, useRef } from 'react';
import { ThoughtNode } from '../types';

interface NodeItemProps {
  node: ThoughtNode;
  allNodes: ThoughtNode[];
  isActiveFocus: boolean;
  isSelected: boolean;
  panelDirection?: 'above' | 'below';
  isEditMode: boolean;
  zoom: number;
  theme: 'dark' | 'light';
  isMobile: boolean;
  onClick: (id: string) => void;
  onBranch: () => void;
  onExploreFurther?: () => void;
  onRegenerate?: () => void;
  onToggleCollapse?: (id: string) => void;
  onToggleHide?: (id: string) => void;
  onPrune: (id: string) => void;
  onHover: (id: string | null) => void;
  onCenter?: () => void;
  onDrag?: (id: string, x: number, y: number) => void;
}

export const NodeItem: React.FC<NodeItemProps> = ({ 
  node, 
  isActiveFocus, 
  isSelected, 
  panelDirection = 'below',
  isEditMode,
  zoom,
  onClick, 
  onBranch, 
  onExploreFurther,
  onPrune,
  onToggleCollapse,
  onDrag
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [isLocalDragging, setIsLocalDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, nodeX: 0, nodeY: 0 });

  useEffect(() => {
    if (isSelected) {
      setShowInfo(true);
    } else {
      setShowInfo(false);
      setSourcesExpanded(false); 
    }
  }, [isSelected]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isEditMode) return;
    // Only drag if we're not clicking a button in the edit menu
    if ((e.target as HTMLElement).closest('button')) return;
    
    e.stopPropagation();
    setIsLocalDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y
    };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - dragRef.current.startX) / zoom;
      const dy = (moveEvent.clientY - dragRef.current.startY) / zoom;
      onDrag?.(node.id, dragRef.current.nodeX + dx, dragRef.current.nodeY + dy);
    };

    const handleMouseUp = () => {
      setIsLocalDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const openSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    const query = encodeURIComponent(node.path.join(' '));
    window.open(`https://www.google.com/search?q=${query}`, '_blank', 'noopener,noreferrer');
  };

  const infoPanelVisible = showInfo && isSelected && !isLocalDragging && !isEditMode;
  const hasSources = node.sources && node.sources.length > 0;

  return (
    <div
      style={{
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        transform: `translate(-50%, -50%) scale(${isSelected ? 1.05 : isActiveFocus ? 1 : 0.85})`,
        zIndex: isSelected ? 1000 : isActiveFocus ? 150 : 20,
        transition: 'transform 0.3s cubic-bezier(0.23, 1, 0.32, 1), opacity 0.3s ease',
        opacity: node.isHidden && isEditMode ? 0.4 : 1,
        willChange: 'transform, left, top'
      }}
      onMouseDown={handleMouseDown}
      className={`absolute group ${node.isNew ? 'animate-node-pop' : ''} ${isEditMode ? 'cursor-move' : ''}`}
    >
      {isEditMode && (
        <div 
          className={`absolute -top-12 left-1/2 -translate-x-1/2 flex items-center space-x-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 shadow-xl z-[2000] transition-all duration-300 transform
            ${isSelected ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto' : 'opacity-0 translate-y-2 scale-90 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-hover:pointer-events-auto'}
          `}
        >
          {/* Bridge to maintain hover state while moving cursor from node to panel */}
          <div className="absolute -bottom-4 left-0 right-0 h-4 bg-transparent pointer-events-auto" />
          
          {/* Folding Toggle (Using Eye Icon as requested) */}
          {node.isExpanded && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(node.id); }}
                className={`p-1.5 rounded-full transition-colors relative z-10 ${node.isCollapsed ? 'bg-amber-100 text-amber-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-blue-500'}`}
                title={node.isCollapsed ? "Unfold Tree" : "Fold Tree"}
              >
                {node.isCollapsed ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                )}
              </button>
              <div className="w-px h-3 bg-slate-200 dark:bg-slate-800 relative z-10" />
            </>
          )}

          <button 
            onClick={(e) => { e.stopPropagation(); onPrune(node.id); }}
            className="p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors relative z-10"
            title="Prune (Delete)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      )}

      <div className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-[1100] transition-all duration-300 ${panelDirection === 'above' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'}`}>
        {infoPanelVisible && (
          <div className={`relative w-[calc(100vw-48px)] max-w-[340px] md:max-w-md bg-white dark:bg-[#0f172a] border-2 border-slate-200 dark:border-slate-700 p-4 rounded-[1.4rem] shadow-[0_25px_60px_rgba(0,0,0,0.5)] dark:shadow-[0_25px_60px_rgba(0,0,0,0.8)] animate-panel-in pointer-events-auto ${panelDirection === 'above' ? 'origin-bottom' : 'origin-top'}`}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                Fact Insight
              </span>
              <div className="flex items-center space-x-1.5">
                {node.isExpanded && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleCollapse?.(node.id); }} 
                    className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${node.isCollapsed ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600'}`}
                  >
                    {node.isCollapsed ? 'Unfold' : 'Fold'}
                  </button>
                )}
                
                {!node.isExpanded ? (
                  <button onClick={(e) => { e.stopPropagation(); onBranch(); }} className="px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 transition-colors">Branch</button>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); onExploreFurther?.(); }} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all text-xs font-bold" title="Deep Reasoning Explore">+</button>
                )}
                <button onClick={openSearch} className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-blue-600 transition-colors"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></button>
              </div>
            </div>
            <div className="text-xs text-slate-800 dark:text-slate-100 font-medium leading-relaxed mb-3">
              {node.description}
              {hasSources && (
                <sup className="ml-0.5 text-[8px] font-bold text-blue-500 cursor-help" onClick={(e) => { e.stopPropagation(); setSourcesExpanded(true); }}>
                  [{node.sources?.length}]
                </sup>
              )}
            </div>
            {hasSources && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                <button onClick={(e) => { e.stopPropagation(); setSourcesExpanded(!sourcesExpanded); }} className="flex items-center justify-between w-full text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                  <span>Grounding Sources ({node.sources?.length})</span>
                  <svg className={`w-2.5 h-2.5 transition-transform ${sourcesExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path d="M19 9l-7 7-7-7" /></svg>
                </button>
                {sourcesExpanded && (
                  <div className="mt-1.5 space-y-1 max-h-24 overflow-y-auto pr-1">
                    {node.sources?.map((s, i) => (<a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className="block text-[9px] text-blue-600 dark:text-blue-400 font-bold hover:underline py-0.5 truncate flex items-center space-x-2">
                      <span className="opacity-50">[{i+1}]</span>
                      <span>{s.title}</span>
                    </a>))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
        className={`relative flex flex-col items-center justify-center min-w-[85px] md:min-w-[115px] max-w-[180px] px-2.5 md:px-4 py-2 md:py-3.5 rounded-[1rem] transition-all duration-300 cursor-pointer border-2 backdrop-blur-md ${isSelected ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-500 shadow-2xl scale-105' : 'bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 shadow-lg'} ${isEditMode ? 'border-dashed border-emerald-500 ring-2 ring-emerald-500/20' : ''}`}
      >
        <span className={`text-[9.5px] md:text-xs font-display font-bold text-center leading-tight tracking-tight transition-colors ${isSelected ? 'text-blue-700 dark:text-white' : 'text-slate-800 dark:text-white'}`}>
          {node.label}
        </span>
        {node.isLoading && (
          <div className="mt-1.5 flex flex-col items-center">
             <div className="flex space-x-0.5">
               <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
               <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
               <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
             </div>
             {isSelected && <span className="text-[7px] font-black uppercase tracking-widest text-blue-400 mt-1 animate-pulse">Deep Reasoning...</span>}
          </div>
        )}
        {node.isExpanded && node.isCollapsed && !isSelected && (
          <div className="absolute -bottom-2 px-1.5 py-0.5 bg-amber-500 rounded-full text-[6px] font-black text-white uppercase tracking-tighter shadow-md">Folded</div>
        )}
      </div>
    </div>
  );
};
