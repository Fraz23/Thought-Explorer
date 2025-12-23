
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ThoughtNode, Edge } from './types';
import { getRelatedTopics, getTopicInfo } from './services/geminiService';
import { NodeItem } from './components/NodeItem';
import { ConnectionLine } from './components/ConnectionLine';
import { Minimap } from './components/Minimap';

const CANVAS_SIZE = 10000; 

const SURPRISE_TOPICS = [
  "Quantum Entanglement",
  "The Library of Alexandria",
  "Bioluminescence",
  "Cybernetic Organisms",
  "Stoic Philosophy",
  "Deep Sea Trenches",
  "Artificial General Intelligence",
  "Renaissance Architecture",
  "The Heat Death of the Universe",
  "Neuroplasticity",
  "Gothic Horror Literature",
  "Sustainable Urbanism"
];

const App: React.FC = () => {
  const [nodes, setNodes] = useState<ThoughtNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [initialInput, setInitialInput] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [branchCount] = useState(3);
  const [isStarted, setIsStarted] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeDirection, setSelectedNodeDirection] = useState<'above' | 'below'>('below');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isOptionsMenuOpen, setIsOptionsMenuOpen] = useState(false);
  const [isMinimapOpen, setIsMinimapOpen] = useState(false);
  
  const [activeLevel, setActiveLevel] = useState(0);
  const [isLevelSelectorExpanded, setIsLevelSelectorExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [zoom, setZoom] = useState(window.innerWidth < 768 ? 0.8 : 1);
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);

  const spacingY = isMobile ? -80 : -100; 
  const spreadX = isMobile ? 110 : 150;
  const overlapGap = isMobile ? 130 : 170; 
  
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const getDescendantIds = useCallback((allNodes: ThoughtNode[], rootId: string): Set<string> => {
    const ids = new Set<string>();
    const stack = [rootId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      allNodes.forEach(n => {
        if (n.parentId === id && !ids.has(n.id)) {
          ids.add(n.id);
          stack.push(n.id);
        }
      });
    }
    return ids;
  }, []);

  const resolveOverlapsRecursive = useCallback((allNodes: ThoughtNode[], minGap: number) => {
    let newNodes = [...allNodes];
    let hasChanged = true;
    let iterations = 0;
    const MAX_ITERATIONS = 60;

    while (hasChanged && iterations < MAX_ITERATIONS) {
      hasChanged = false;
      iterations++;
      
      const maxL = Math.max(...newNodes.map(n => n.level), 0);
      for (let l = 0; l <= maxL; l++) {
        const levelNodes = newNodes
          .filter(n => n.level === l)
          .sort((a, b) => a.position.x - b.position.x);

        for (let i = 0; i < levelNodes.length - 1; i++) {
          const left = levelNodes[i];
          const right = levelNodes[i + 1];
          const dist = right.position.x - left.position.x;
          
          if (dist < minGap) {
            const shift = (minGap - dist) / 2 + 1;
            hasChanged = true;
            
            const leftDescendants = getDescendantIds(newNodes, left.id);
            newNodes = newNodes.map(n => {
              if (n.id === left.id || leftDescendants.has(n.id)) {
                return { ...n, position: { ...n.position, x: n.position.x - shift } };
              }
              return n;
            });

            const rightDescendants = getDescendantIds(newNodes, right.id);
            newNodes = newNodes.map(n => {
              if (n.id === right.id || rightDescendants.has(n.id)) {
                return { ...n, position: { ...n.position, x: n.position.x + shift } };
              }
              return n;
            });
            
            left.position.x -= shift;
            right.position.x += shift;
          }
        }
      }
    }
    return newNodes;
  }, [getDescendantIds]);

  const updateZoom = useCallback((newZoom: number, mouseX?: number, mouseY?: number) => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const rect = el.getBoundingClientRect();
    const rx = mouseX !== undefined ? mouseX - rect.left : el.clientWidth / 2;
    const ry = mouseY !== undefined ? mouseY - rect.top : el.clientHeight / 2;
    const worldPivotX = (el.scrollLeft + rx) / zoom;
    const worldPivotY = (el.scrollTop + ry) / zoom;
    const clampedZoom = Math.min(Math.max(newZoom, 0.05), 3);
    setZoom(clampedZoom);
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      containerRef.current.scrollLeft = worldPivotX * clampedZoom - rx;
      containerRef.current.scrollTop = worldPivotY * clampedZoom - ry;
    });
  }, [zoom]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); 
      const factor = Math.pow(1.1, -e.deltaY / 150);
      updateZoom(zoom * factor, e.clientX, e.clientY);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [zoom, updateZoom]);

  useEffect(() => {
    if (!isStarted) return;
    const updateViewport = () => {
      if (!containerRef.current) return;
      const { scrollLeft, scrollTop, clientWidth, clientHeight } = containerRef.current;
      setViewport({ x: scrollLeft, y: scrollTop, width: clientWidth, height: clientHeight });
    };
    const el = containerRef.current;
    if (el) {
      el.addEventListener('scroll', updateViewport);
      updateViewport();
      return () => el.removeEventListener('scroll', updateViewport);
    }
  }, [isStarted, zoom]);

  const isNodeEffectivelyVisible = useCallback((node: ThoughtNode) => {
    const isNodeCollapsedByAncestor = (n: ThoughtNode) => {
      let currentParentId = n.parentId;
      while (currentParentId) {
        const parent = nodes.find(p => p.id === currentParentId);
        if (parent?.isCollapsed) return true;
        currentParentId = parent?.parentId || null;
      }
      return false;
    };
    const isNodeHiddenByAncestor = (n: ThoughtNode) => {
      let currentParentId = n.parentId;
      while (currentParentId) {
        const parent = nodes.find(p => p.id === currentParentId);
        if (parent?.isHidden) return true;
        currentParentId = parent?.parentId || null;
      }
      return false;
    };
    if (isNodeCollapsedByAncestor(node)) return false;
    if (!isEditMode && (node.isHidden || isNodeHiddenByAncestor(node))) return false;
    return true;
  }, [nodes, isEditMode]);

  const centerOn = useCallback((x: number, y: number, behavior: ScrollBehavior = 'smooth') => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const targetLeft = (x * zoom) - clientWidth / 2;
    const targetTop = (y * zoom) - clientHeight / 2;
    containerRef.current.scrollTo({ left: targetLeft, top: targetTop, behavior });
  }, [zoom]);

  const jumpToNode = useCallback((node: ThoughtNode) => {
    setSelectedNodeId(node.id);
    setActiveLevel(node.level); 
    if (containerRef.current) {
      const { scrollTop, clientHeight } = containerRef.current;
      const nodeScreenY = (node.position.y * zoom) - scrollTop;
      const direction = nodeScreenY > clientHeight / 2 ? 'above' : 'below';
      setSelectedNodeDirection(direction);
      const offsetVal = isMobile ? 50 : 70;
      const finalOffsetY = direction === 'above' ? -offsetVal : offsetVal;
      centerOn(node.position.x, node.position.y + finalOffsetY);
    }
  }, [centerOn, isMobile, zoom]);

  const jumpToLevel = useCallback((level: number) => {
    const levelNodes = nodes.filter(n => n.level === level && isNodeEffectivelyVisible(n));
    if (levelNodes.length > 0) {
      const avgX = levelNodes.reduce((acc, n) => acc + n.position.x, 0) / levelNodes.length;
      const avgY = levelNodes.reduce((acc, n) => acc + n.position.y, 0) / levelNodes.length;
      setActiveLevel(level);
      centerOn(avgX, avgY);
    }
    setIsLevelSelectorExpanded(false);
  }, [nodes, isNodeEffectivelyVisible, centerOn]);

  const startJourney = async (input: string) => {
    const startX = CANVAS_SIZE / 2;
    const startY = CANVAS_SIZE / 2;
    const rootId = 'root-' + Date.now();
    const rootNode: ThoughtNode = {
      id: rootId, label: input, description: "Gathering initial insights...", parentId: null, level: 0, position: { x: startX, y: startY }, isExpanded: false, isLoading: true, path: [input]
    };
    setNodes([rootNode]);
    setIsStarted(true);
    setActiveLevel(0);
    setInitialInput("");
    setTimeout(() => centerOn(startX, startY, 'auto'), 50);
    
    try {
      const exclude = [input];
      const [topicInfo, relatedTopics] = await Promise.all([
        getTopicInfo(input), 
        getRelatedTopics(input, branchCount, [input], exclude)
      ]);
      
      const nextLevel = 1;
      const targetY = startY + spacingY;
      const totalBlockWidth = (branchCount - 1) * spreadX;
      const startXChildren = startX - totalBlockWidth / 2;
      
      const children: ThoughtNode[] = relatedTopics.topics.map((item, index) => ({
        id: `node-initial-${Date.now()}-${index}`, label: item.topic, description: item.description, parentId: rootId, level: nextLevel, position: { x: startXChildren + (index * spreadX), y: targetY }, isExpanded: false, isLoading: false, isNew: true, sources: [], path: [input, item.topic]
      }));
      
      const newEdges: Edge[] = children.map(node => ({ id: `edge-${rootId}-${node.id}`, from: rootId, to: node.id }));
      const finalNodes = [{ ...rootNode, description: topicInfo.description, sources: topicInfo.sources, isLoading: false, isExpanded: true }, ...children];
      
      setNodes(resolveOverlapsRecursive(finalNodes, overlapGap));
      setEdges(newEdges);
      setActiveLevel(nextLevel);
      setTimeout(() => centerOn(startX, targetY), 100);
      
      setTimeout(() => {
        setNodes(prev => prev.map(n => n.parentId === rootId ? { ...n, isNew: false } : n));
      }, 4000);
    } catch (err) {
      console.error("Start Journey Error:", err);
      // Fallback: stop loading so user isn't stuck
      setNodes(prev => prev.map(n => n.id === rootId ? { ...n, isLoading: false, description: "Failed to gather insights. Please check your API key and connection." } : n));
    }
  };

  const expandNode = useCallback(async (parentId: string, label: string, position: { x: number; y: number }, level: number, currentPath: string[]) => {
    const nodeToExpand = nodes.find(n => n.id === parentId);
    if (!nodeToExpand || nodeToExpand.isLoading) return;
    
    const updatedNodes = nodes.map(n => {
      if (n.parentId === nodeToExpand.parentId && n.id !== nodeToExpand.id && n.level === nodeToExpand.level) {
        return n.isExpanded ? { ...n, isCollapsed: true } : n;
      }
      if (n.id === nodeToExpand.id) {
        return { ...n, isLoading: true, isCollapsed: false, isHidden: false };
      }
      return n;
    });

    setSelectedNodeId(null);
    setNodes(updatedNodes);
    
    try {
      const allExistingTopics = nodes.map(n => n.label);
      const { topics } = await getRelatedTopics(label, branchCount, currentPath, allExistingTopics);
      const nextLevel = level + 1;
      const targetY = position.y + spacingY;
      
      setNodes(prev => {
        const totalNew = topics.length;
        const totalBlockWidth = (totalNew - 1) * spreadX;
        const startX = position.x - totalBlockWidth / 2;
        const newNodes: ThoughtNode[] = topics.map((item, index) => ({
          id: `node-${Date.now()}-${index}`, label: item.topic, description: item.description, parentId, level: nextLevel, position: { x: startX + (index * spreadX), y: targetY }, isExpanded: false, isLoading: false, isNew: true, sources: [], path: [...currentPath, item.topic]
        }));
        const newEdges: Edge[] = newNodes.map(node => ({ id: `edge-${parentId}-${node.id}`, from: parentId, to: node.id }));
        setEdges(prevEdges => [...prevEdges, ...newEdges]);
        
        const updatedPrev = prev.map(n => n.id === parentId ? { ...n, isExpanded: true, isLoading: false } : n);
        const combined = [...updatedPrev, ...newNodes];
        const resolved = resolveOverlapsRecursive(combined, overlapGap);
        
        const newNodesInResolved = resolved.filter(n => n.parentId === parentId);
        const avgNewX = newNodesInResolved.reduce((acc, n) => acc + n.position.x, 0) / newNodesInResolved.length;
        
        setActiveLevel(nextLevel);
        setTimeout(() => centerOn(avgNewX, targetY), 150);
        
        setTimeout(() => {
          setNodes(pNodes => pNodes.map(n => n.parentId === parentId ? { ...n, isNew: false } : n));
        }, 4000);
        
        return resolved;
      });
    } catch (err) {
      console.error("Expand Node Error:", err);
      setNodes(prev => prev.map(n => n.id === parentId ? { ...n, isLoading: false } : n));
    }
  }, [branchCount, spacingY, spreadX, overlapGap, centerOn, resolveOverlapsRecursive, nodes]);

  const reAlignMap = useCallback(() => {
    const visibleNodes = nodes.filter(isNodeEffectivelyVisible);
    if (visibleNodes.length === 0) return;
    const avgX = visibleNodes.reduce((acc, n) => acc + n.position.x, 0) / visibleNodes.length;
    const avgY = visibleNodes.reduce((acc, n) => acc + n.position.y, 0) / visibleNodes.length;
    centerOn(avgX, avgY);
    setIsOptionsMenuOpen(false);
  }, [nodes, isNodeEffectivelyVisible, centerOn]);

  const closeAllOverlays = useCallback(() => {
    setSelectedNodeId(null);
    setIsOptionsMenuOpen(false);
    setIsSearchExpanded(false);
    setIsLevelSelectorExpanded(false);
  }, []);

  const onDragStart = (x: number, y: number) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setDragStart({ x, y, scrollLeft: containerRef.current.scrollLeft, scrollTop: containerRef.current.scrollTop });
  };

  const onDragMove = (e: React.MouseEvent | React.TouchEvent, x: number, y: number) => {
    if (!isDragging || !containerRef.current) return;
    if ('cancelable' in e && e.cancelable) e.preventDefault();
    containerRef.current.scrollLeft = dragStart.scrollLeft - (x - dragStart.x);
    containerRef.current.scrollTop = dragStart.scrollTop - (y - dragStart.y);
  };

  const isFocusMode = selectedNodeId !== null && !isEditMode;
  const maxLevel = nodes.length > 0 ? Math.max(...nodes.map(n => n.level)) : 0;
  const levels = Array.from({ length: maxLevel + 1 }, (_, i) => i);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#e0f2fe] dark:bg-[#030712] text-slate-900 dark:text-white transition-colors duration-500">
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: theme === 'dark' ? 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)' : 'radial-gradient(circle, rgba(59,130,246,0.08) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      
      <div 
        className={`fixed inset-0 z-[100] bg-slate-950/60 dark:bg-black/80 transition-opacity duration-700 ${isFocusMode ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
        onClick={(e) => { e.stopPropagation(); closeAllOverlays(); }}
      />

      {!isStarted ? (
        <div className="relative z-[3000] h-full flex flex-col items-center justify-center p-6 text-center overflow-hidden">
          <div className="max-w-2xl animate-fade-in-up">
            <div className="inline-block mb-6 px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] border border-blue-200/50">AI Powered Concept Mapping</div>
            <h1 className="text-5xl md:text-8xl font-display font-bold mb-6 tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">Thought Explorer</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8 md:mb-12 font-medium text-base md:text-lg max-w-lg mx-auto leading-relaxed">Visualize the architecture of your curiosity. Branch out from a single seed into a forest of knowledge.</p>
            <form onSubmit={(e) => { e.preventDefault(); if (initialInput.trim()) startJourney(initialInput.trim()); }} className="space-y-6 max-w-md mx-auto">
              <div className={`relative flex items-center bg-white dark:bg-slate-900 border-2 rounded-[2rem] md:rounded-[2.5rem] p-1 md:p-2 pr-2 md:pr-3 shadow-2xl transition-all ${isInputFocused ? 'border-blue-500/50 scale-[1.02]' : 'border-transparent'}`}>
                <input type="text" autoFocus placeholder="Enter your root thought..." className="flex-grow bg-transparent border-none py-3 md:py-4 px-4 md:px-6 text-base md:text-lg font-semibold focus:ring-0 outline-none text-slate-900 dark:text-white" value={initialInput} onChange={e => setInitialInput(e.target.value)} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)} />
                <button type="submit" className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-blue-600 rounded-full text-white shadow-lg hover:bg-blue-500 transition-colors"><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7-7 7" /></svg></button>
              </div>
              <button type="button" onClick={() => startJourney(SURPRISE_TOPICS[Math.floor(Math.random() * SURPRISE_TOPICS.length)])} className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 transition-colors">Spark Curiosity</button>
            </form>
          </div>
        </div>
      ) : (
        <>
          <div className="fixed top-4 md:top-6 left-4 right-4 md:left-6 md:right-6 flex flex-row items-start justify-between z-[3000] pointer-events-none gap-3">
            <div className="flex items-center bg-white dark:bg-gray-950/90 backdrop-blur-2xl rounded-2xl border border-slate-200 dark:border-gray-800 shadow-xl pointer-events-auto p-1 max-w-[calc(100%-60px)] transition-all duration-300">
               <button 
                 onClick={(e) => { e.stopPropagation(); setIsLevelSelectorExpanded(!isLevelSelectorExpanded); }}
                 className="px-3 md:px-4 py-2 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center space-x-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex-shrink-0"
               >
                 <svg className={`w-3.5 h-3.5 transition-transform ${isLevelSelectorExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                 <span>Gen {activeLevel}</span>
               </button>
               
               {isLevelSelectorExpanded && (
                 <div className="flex items-center overflow-x-auto hide-scrollbar space-x-1 px-1 border-l border-slate-100 dark:border-gray-800 ml-1 animate-level-expand">
                   {levels.map(l => (
                     <button 
                       key={l} 
                       onClick={() => jumpToLevel(l)}
                       className={`w-9 h-9 flex items-center justify-center rounded-xl text-[11px] font-black transition-all flex-shrink-0 ${activeLevel === l ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                     >
                       {l}
                     </button>
                   ))}
                 </div>
               )}
            </div>

            <div className={`relative flex items-center pointer-events-auto transition-all duration-500 ease-out ${isSearchExpanded ? 'flex-grow md:max-w-sm' : 'w-12 md:w-14'}`}>
              <div className={`flex items-center bg-white dark:bg-gray-900 border-2 rounded-2xl shadow-xl overflow-hidden h-12 md:h-14 w-full transition-all duration-500 ${isSearchExpanded ? 'border-blue-500' : 'border-slate-200 dark:border-gray-800'}`}>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsSearchExpanded(!isSearchExpanded); }}
                  className="px-4 text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
                {isSearchExpanded && (
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="Search details..." 
                    className="w-full bg-transparent border-none text-[13px] font-bold focus:ring-0 outline-none text-slate-900 dark:text-white pr-4 animate-fade-in" 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                  />
                )}
              </div>
            </div>
          </div>

          <div 
            ref={containerRef} 
            onMouseDown={(e) => onDragStart(e.pageX, e.pageY)} 
            onMouseMove={(e) => onDragMove(e, e.pageX, e.pageY)} 
            onMouseUp={() => setIsDragging(false)} 
            onClick={() => closeAllOverlays()}
            onTouchStart={(e) => onDragStart(e.touches[0].pageX, e.touches[0].pageY)} 
            onTouchMove={(e) => onDragMove(e, e.touches[0].pageX, e.touches[0].pageY)} 
            className={`w-full h-full overflow-auto hide-scrollbar relative touch-none cursor-grab active:cursor-grabbing transition-[z-index] ${isFocusMode ? 'z-[500]' : 'z-0'}`}
          >
            <div className="relative origin-top-left" style={{ width: `${CANVAS_SIZE * zoom}px`, height: `${CANVAS_SIZE * zoom}px`, transform: `scale(${zoom})` }}>
              {edges.map(edge => {
                const from = nodes.find(n => n.id === edge.from); 
                const to = nodes.find(n => n.id === edge.to);
                if (!from || !to || !isNodeEffectivelyVisible(from) || !isNodeEffectivelyVisible(to)) return null;
                return <ConnectionLine key={edge.id} id={edge.id} from={from.position} to={to.position} isNew={to.isNew} isActive={selectedNodeId === from.id || selectedNodeId === to.id} theme={theme} />;
              })}
              {nodes.map(node => {
                if (!isNodeEffectivelyVisible(node)) return null;
                const isOtherNodeSelected = selectedNodeId !== null && selectedNodeId !== node.id;
                return (
                  <div key={node.id} className="transition-opacity duration-500" style={{ opacity: isOtherNodeSelected ? 0.2 : 1 }}>
                    <NodeItem 
                      node={node} 
                      allNodes={nodes} 
                      isActiveFocus={node.level === activeLevel} 
                      isSelected={selectedNodeId === node.id} 
                      panelDirection={selectedNodeDirection} 
                      isEditMode={isEditMode} 
                      zoom={zoom} 
                      isMobile={isMobile} 
                      onClick={() => jumpToNode(node)} 
                      onBranch={() => expandNode(node.id, node.label, node.position, node.level, node.path)} 
                      onExploreFurther={() => expandNode(node.id, node.label, node.position, node.level, node.path)} 
                      onPrune={(id) => setNodes(prev => prev.filter(n => n.id !== id))}
                      onToggleHide={(id) => setNodes(prev => prev.map(n => n.id === id ? { ...n, isHidden: !n.isHidden } : n))}
                      onToggleCollapse={(id) => setNodes(prev => prev.map(n => n.id === id ? { ...n, isCollapsed: !n.isCollapsed } : n))}
                      onHover={() => {}}
                      onDrag={(id, x, y) => setNodes(prev => prev.map(n => n.id === id ? { ...n, position: { x, y } } : n))} 
                      theme={theme} 
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="fixed bottom-6 md:bottom-8 left-6 md:left-8 z-[3000] flex flex-col items-start space-y-3 pointer-events-auto">
            {isOptionsMenuOpen && !isEditMode && (
              <div className="bg-white dark:bg-gray-950 rounded-[2rem] border border-slate-200 dark:border-gray-800 p-2 shadow-3xl w-48 animate-menu-pop flex flex-col space-y-1" onClick={e => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); setIsEditMode(true); setIsOptionsMenuOpen(false); }} className="flex items-center space-x-3 px-4 py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                  <span className="text-[12px] font-bold">Enter Edit Mode</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); setTheme(theme === 'dark' ? 'light' : 'dark'); }} className="flex items-center space-x-3 px-4 py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-gray-300">
                  <span className="text-[12px] font-bold">Change Theme</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); setIsStarted(false); setNodes([]); setEdges([]); }} className="flex items-center space-x-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all">
                  <span className="text-[12px] font-bold">Reset Map</span>
                </button>
              </div>
            )}
            
            <div className="flex flex-col space-y-3">
              <button 
                onClick={(e) => { e.stopPropagation(); reAlignMap(); }} 
                className="w-14 h-14 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 shadow-2xl border border-slate-200 dark:border-gray-800 text-slate-600 dark:text-slate-300 hover:text-blue-500 hover:scale-110 active:scale-95 transition-all"
                title="Center View"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="3" strokeWidth="3" />
                  <path strokeLinecap="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" />
                </svg>
              </button>

              {isEditMode ? (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsEditMode(false); }} 
                  className="flex items-center space-x-3 px-6 py-3 rounded-full bg-emerald-500 text-white border border-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.4)] hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all animate-pill-pop"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">Done Editing</span>
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </button>
              ) : (
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsOptionsMenuOpen(!isOptionsMenuOpen); }} 
                  className={`w-14 h-14 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 shadow-2xl border transition-all ${isOptionsMenuOpen ? 'border-blue-500 text-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200 dark:border-gray-800 text-slate-400 hover:text-blue-500 hover:scale-110'}`}
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="2.5" />
                    <circle cx="12" cy="5" r="2.5" />
                    <circle cx="12" cy="19" r="2.5" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="fixed bottom-6 md:bottom-8 right-6 md:right-8 z-[3000] flex flex-col items-end space-y-3 pointer-events-auto">
            <div className="flex flex-col space-y-2 bg-white dark:bg-gray-950 p-2 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-2xl">
              <button onClick={(e) => { e.stopPropagation(); updateZoom(zoom * 1.25); }} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-gray-300"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></button>
              <button onClick={(e) => { e.stopPropagation(); updateZoom(zoom / 1.25); }} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-gray-300"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 12H6" /></svg></button>
            </div>
            
            <Minimap nodes={nodes.filter(isNodeEffectivelyVisible)} canvasSize={CANVAS_SIZE} viewport={viewport} isOpen={isMinimapOpen} onToggle={() => setIsMinimapOpen(!isMinimapOpen)} isMobile={isMobile} />
            <button onClick={(e) => { e.stopPropagation(); setIsMinimapOpen(!isMinimapOpen); }} className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all shadow-2xl border ${isMinimapOpen ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-800 text-slate-500 hover:scale-105'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          </div>

          <style>{`
            @keyframes pill-pop {
              0% { transform: scale(0.8); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            .animate-pill-pop {
              animation: pill-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            @keyframes menu-pop {
              0% { transform: scale(0.95); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            .animate-menu-pop {
              animation: menu-pop 0.2s cubic-bezier(0, 0, 0.2, 1);
            }
            @keyframes level-expand {
              0% { width: 0; opacity: 0; transform: translateX(-10px); }
              100% { width: auto; opacity: 1; transform: translateX(0); }
            }
            .animate-level-expand {
              animation: level-expand 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            @keyframes fade-in {
              from { opacity: 0; transform: translateX(-5px); }
              to { opacity: 1; transform: translateX(0); }
            }
            .animate-fade-in {
              animation: fade-in 0.3s ease-out forwards;
            }
          `}</style>
        </>
      )}
    </div>
  );
};

export default App;
