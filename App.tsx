
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ThoughtNode, Edge } from './types';
import { getRelatedTopics, getTopicInfo } from './services/geminiService';
import { NodeItem } from './components/NodeItem';
import { ConnectionLine } from './components/ConnectionLine';
import { Minimap } from './components/Minimap';

const CANVAS_SIZE = 10000; 
const VIEWPORT_BUFFER = 1000; 

// Physics Constants
const REPULSION_STRENGTH = 18000;
const ATTRACTION_STRENGTH = 0.04;
const HIERARCHY_STRENGTH = 0.15;
const DAMPING = 0.75; 
const MAX_VELOCITY = 8; 
const MIN_DIST_SQ = 1200; 
const GLOBAL_CENTERING_STRENGTH = 0.005; 

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
  const [isStarted, setIsStarted] = useState(false);
  const [initialInput, setInitialInput] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);
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
  const zoomRef = useRef(zoom); 
  const nodeVelocities = useRef<{ [key: string]: { vx: number; vy: number } }>({});
  const requestRef = useRef<number>(null);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const branchCount = 3;
  const spacingY = isMobile ? -100 : -140; 
  const spreadX = isMobile ? 120 : 180;

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  // Ensure API Key is selected for Pro models
  const checkApiKey = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
      }
    }
  };

  const animate = useCallback(() => {
    setNodes(prevNodes => {
      if (prevNodes.length === 0) return prevNodes;
      const newNodes = prevNodes.map(n => ({ ...n }));
      const vels = nodeVelocities.current;
      newNodes.forEach(node => { if (!vels[node.id]) vels[node.id] = { vx: 0, vy: 0 }; });

      for (let i = 0; i < newNodes.length; i++) {
        for (let j = i + 1; j < newNodes.length; j++) {
          const n1 = newNodes[i];
          const n2 = newNodes[j];
          if (n1.isHidden || n2.isHidden) continue;
          const dx = n1.position.x - n2.position.x;
          const dy = n1.position.y - n2.position.y;
          const d2 = dx * dx + dy * dy;
          const distSq = Math.max(d2, MIN_DIST_SQ);
          const dist = Math.sqrt(distSq);
          const levelMultiplier = n1.level === n2.level ? 1.4 : 1.0;
          const force = (REPULSION_STRENGTH * levelMultiplier) / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          vels[n1.id].vx += fx; vels[n1.id].vy += fy;
          vels[n2.id].vx -= fx; vels[n2.id].vy -= fy;
        }
      }

      edges.forEach(edge => {
        const from = newNodes.find(n => n.id === edge.from);
        const to = newNodes.find(n => n.id === edge.to);
        if (!from || !to || from.isHidden || to.isHidden) return;
        const dx = to.position.x - from.position.x;
        const dy = to.position.y - from.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const idealDist = Math.abs(spacingY);
        const force = (dist - idealDist) * ATTRACTION_STRENGTH;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        vels[to.id].vx -= fx; vels[to.id].vy -= fy;
        vels[from.id].vx += fx; vels[from.id].vy += fy;
      });

      newNodes.forEach(node => {
        if (node.parentId) {
          const parent = newNodes.find(p => p.id === node.parentId);
          if (parent) {
            const idealY = parent.position.y + spacingY;
            const dy = idealY - node.position.y;
            vels[node.id].vy += dy * HIERARCHY_STRENGTH;
          }
        }
        const dxCenter = (CANVAS_SIZE / 2) - node.position.x;
        const dyCenter = (CANVAS_SIZE / 2) - node.position.y;
        vels[node.id].vx += dxCenter * GLOBAL_CENTERING_STRENGTH;
        vels[node.id].vy += dyCenter * GLOBAL_CENTERING_STRENGTH;
      });

      return newNodes.map(node => {
        const isAnchored = node.level === 0 || node.id === selectedNodeId;
        if (isAnchored) {
          vels[node.id].vx = 0; vels[node.id].vy = 0;
          return node;
        }
        let { vx, vy } = vels[node.id];
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > MAX_VELOCITY) { vx = (vx / speed) * MAX_VELOCITY; vy = (vy / speed) * MAX_VELOCITY; }
        node.position.x += vx; node.position.y += vy;
        vels[node.id].vx = vx * DAMPING; vels[node.id].vy = vy * DAMPING;
        return node;
      });
    });
    requestRef.current = requestAnimationFrame(animate);
  }, [edges, selectedNodeId, spacingY]);

  useEffect(() => {
    if (isStarted) requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isStarted, animate]);

  const isNodeEffectivelyVisible = useCallback((node: ThoughtNode, currentNodes: ThoughtNode[]) => {
    const isNodeCollapsedByAncestor = (n: ThoughtNode) => {
      let currentParentId = n.parentId;
      while (currentParentId) {
        const parent = currentNodes.find(p => p.id === currentParentId);
        if (parent?.isCollapsed) return true;
        currentParentId = parent?.parentId || null;
      }
      return false;
    };
    if (isNodeCollapsedByAncestor(node)) return false;
    if (!isEditMode && node.isHidden) return false;
    return true;
  }, [isEditMode]);

  const updateZoom = useCallback((newZoom: number, mouseX?: number, mouseY?: number) => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const currentZoom = zoomRef.current;
    const clampedZoom = Math.min(Math.max(newZoom, 0.05), 3);
    const rect = el.getBoundingClientRect();
    const rx = mouseX !== undefined ? mouseX - rect.left : el.clientWidth / 2;
    const ry = mouseY !== undefined ? mouseY - rect.top : el.clientHeight / 2;
    const worldPivotX = (el.scrollLeft + rx) / currentZoom;
    const worldPivotY = (el.scrollTop + ry) / currentZoom;
    setZoom(clampedZoom);
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      containerRef.current.scrollLeft = worldPivotX * clampedZoom - rx;
      containerRef.current.scrollTop = worldPivotY * clampedZoom - ry;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); 
      const factor = Math.pow(1.1, -e.deltaY / 150);
      updateZoom(zoomRef.current * factor, e.clientX, e.clientY);
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [updateZoom]);

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
  }, [isStarted]);

  const centerOn = useCallback((x: number, y: number, behavior: ScrollBehavior = 'smooth') => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const currentZoom = zoomRef.current;
    containerRef.current.scrollTo({ left: (x * currentZoom) - clientWidth / 2, top: (y * currentZoom) - clientHeight / 2, behavior });
  }, []);

  const jumpToNode = useCallback((node: ThoughtNode, adjustZoom = false) => {
    const targetZoom = adjustZoom ? 1.1 : zoomRef.current;
    if (adjustZoom) setZoom(targetZoom);
    setSelectedNodeId(node.id);
    setActiveLevel(node.level); 
    setTimeout(() => {
      if (containerRef.current) {
        const { scrollTop, clientHeight, clientWidth, clientHeight: cHeight } = containerRef.current;
        const nodeScreenY = (node.position.y * targetZoom) - scrollTop;
        const direction = nodeScreenY > clientHeight / 2 ? 'above' : 'below';
        setSelectedNodeDirection(direction);
        const offsetVal = isMobile ? 50 : 70;
        const finalOffsetY = direction === 'above' ? -offsetVal : offsetVal;
        containerRef.current.scrollTo({
          left: (node.position.x * targetZoom) - clientWidth / 2,
          top: ((node.position.y + finalOffsetY) * targetZoom) - cHeight / 2,
          behavior: 'smooth'
        });
      }
    }, adjustZoom ? 50 : 0);
  }, [isMobile]);

  const jumpToLevel = useCallback((level: number) => {
    const levelNodes = nodes.filter(n => n.level === level && isNodeEffectivelyVisible(n, nodes));
    if (levelNodes.length > 0) {
      const avgX = levelNodes.reduce((acc, n) => acc + n.position.x, 0) / levelNodes.length;
      const avgY = levelNodes.reduce((acc, n) => acc + n.position.y, 0) / levelNodes.length;
      setActiveLevel(level);
      centerOn(avgX, avgY);
    }
    setIsLevelSelectorExpanded(false);
  }, [nodes, isNodeEffectivelyVisible, centerOn]);

  const startJourney = async (input: string) => {
    await checkApiKey();
    const startX = CANVAS_SIZE / 2;
    const startY = CANVAS_SIZE / 2;
    const rootId = 'root-' + Date.now();
    nodeVelocities.current = {};

    const rootNode: ThoughtNode = {
      id: rootId, label: input, description: "Searching...", parentId: null, level: 0, position: { x: startX, y: startY }, isExpanded: false, isLoading: true, path: [input]
    };
    
    setNodes([rootNode]);
    setIsStarted(true);
    setActiveLevel(0);
    setInitialInput("");
    setTimeout(() => centerOn(startX, startY, 'auto'), 0);
    
    try {
      const exclude = [input];
      const [topicInfo, relatedTopics] = await Promise.all([
        getTopicInfo(input), 
        getRelatedTopics(input, branchCount, [input], exclude)
      ]);
      
      const nextLevel = 1;
      const children: ThoughtNode[] = relatedTopics.topics.map((item, index) => {
        const offset = (index - (branchCount-1)/2) * spreadX;
        return {
          id: `node-initial-${Date.now()}-${index}`, label: item.topic, description: item.description, parentId: rootId, level: nextLevel, position: { x: startX + offset, y: startY + spacingY }, isExpanded: false, isLoading: false, isNew: true, sources: relatedTopics.sources, path: [input, item.topic]
        };
      });
      
      const newEdges: Edge[] = children.map(node => ({ id: `edge-${rootId}-${node.id}`, from: rootId, to: node.id }));
      setNodes([{ ...rootNode, description: topicInfo.description, sources: topicInfo.sources, isLoading: false, isExpanded: true }, ...children]);
      setEdges(newEdges);
      setActiveLevel(nextLevel);
      setTimeout(() => centerOn(startX, startY + spacingY), 100);
      setTimeout(() => setNodes(prev => prev.map(n => n.parentId === rootId ? { ...n, isNew: false } : n)), 4000);
    } catch (err: any) {
      setNodes(prev => prev.map(n => n.id === rootId ? { ...n, isLoading: false, description: err.message || "Connection failed. Please select an API Key." } : n));
    }
  };

  const expandNode = useCallback(async (parentId: string, label: string, position: { x: number; y: number }, level: number, currentPath: string[], useDeepReasoning: boolean = false) => {
    await checkApiKey();
    const nodeToExpand = nodes.find(n => n.id === parentId);
    if (!nodeToExpand || nodeToExpand.isLoading) return;
    
    setNodes(prev => prev.map(n => {
      if (n.parentId === nodeToExpand.parentId && n.id !== nodeToExpand.id && n.level === nodeToExpand.level) {
        return n.isExpanded ? { ...n, isCollapsed: true } : n;
      }
      if (n.id === nodeToExpand.id) return { ...n, isLoading: true, isCollapsed: false, isHidden: false };
      return n;
    }));
    setSelectedNodeId(null);
    
    try {
      const allExistingTopics = nodes.map(n => n.label);
      const { topics, sources } = await getRelatedTopics(label, branchCount, currentPath, allExistingTopics, useDeepReasoning);
      const nextLevel = level + 1;
      
      setNodes(prev => {
        const newNodes: ThoughtNode[] = topics.map((item, index) => {
          const offset = (index - (topics.length-1)/2) * spreadX;
          return {
            id: `node-${Date.now()}-${index}`, label: item.topic, description: item.description, parentId, level: nextLevel, position: { x: position.x + offset, y: position.y + spacingY }, isExpanded: false, isLoading: false, isNew: true, sources: sources, path: [...currentPath, item.topic]
          };
        });
        const newEdges: Edge[] = newNodes.map(node => ({ id: `edge-${parentId}-${node.id}`, from: parentId, to: node.id }));
        setEdges(prevEdges => [...prevEdges, ...newEdges]);
        const updatedPrev = prev.map(n => n.id === parentId ? { ...n, isExpanded: true, isLoading: false } : n);
        setActiveLevel(nextLevel);
        setTimeout(() => centerOn(position.x, position.y + spacingY), 150);
        setTimeout(() => setNodes(pNodes => pNodes.map(n => n.parentId === parentId ? { ...n, isNew: false } : n)), 4000);
        return [...updatedPrev, ...newNodes];
      });
    } catch (err: any) {
      setNodes(prev => prev.map(n => n.id === parentId ? { ...n, isLoading: false, description: `Error: ${err.message || 'Check API Key'}` } : n));
    }
  }, [branchCount, spacingY, spreadX, centerOn, nodes]);

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

  const visibleNodesAndEdges = useMemo(() => {
    const currentZoom = zoomRef.current;
    const vX = viewport.x / currentZoom - VIEWPORT_BUFFER;
    const vY = viewport.y / currentZoom - VIEWPORT_BUFFER;
    const vW = viewport.width / currentZoom + VIEWPORT_BUFFER * 2;
    const vH = viewport.height / currentZoom + VIEWPORT_BUFFER * 2;
    const vNodes = nodes.filter(n => isNodeEffectivelyVisible(n, nodes) && n.position.x > vX && n.position.x < vX + vW && n.position.y > vY && n.position.y < vY + vH);
    const vEdges = edges.filter(e => {
      const from = nodes.find(n => n.id === e.from);
      const to = nodes.find(n => n.id === e.to);
      if (!from || !to || !isNodeEffectivelyVisible(from, nodes) || !isNodeEffectivelyVisible(to, nodes)) return false;
      return (from.position.x > vX && from.position.x < vX + vW && from.position.y > vY && from.position.y < vY + vH) || (to.position.x > vX && to.position.x < vX + vW && to.position.y > vY && to.position.y < vY + vH);
    });
    return { visibleNodes: vNodes, visibleEdges: vEdges };
  }, [nodes, edges, viewport, isNodeEffectivelyVisible]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return nodes.filter(n => n.label.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6);
  }, [nodes, searchQuery]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#e0f2fe] dark:bg-[#030712] text-slate-900 dark:text-white transition-colors duration-500">
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ backgroundImage: theme === 'dark' ? 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)' : 'radial-gradient(circle, rgba(59,130,246,0.08) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
      <div className={`fixed inset-0 z-[100] bg-slate-950/60 dark:bg-black/80 transition-opacity duration-700 ${isFocusMode ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => closeAllOverlays()} />

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
               <button onClick={(e) => { e.stopPropagation(); setIsLevelSelectorExpanded(!isLevelSelectorExpanded); }} className="px-3 md:px-4 py-2 text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center space-x-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex-shrink-0">
                 <svg className={`w-3.5 h-3.5 transition-transform ${isLevelSelectorExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                 <span>Gen {activeLevel}</span>
               </button>
               {isLevelSelectorExpanded && (
                 <div className="flex items-center overflow-x-auto hide-scrollbar space-x-1 px-1 border-l border-slate-100 dark:border-gray-800 ml-1 animate-level-expand">
                   {levels.map(l => (
                     <button key={l} onClick={() => jumpToLevel(l)} className={`w-9 h-9 flex items-center justify-center rounded-xl text-[11px] font-black transition-all flex-shrink-0 ${activeLevel === l ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>{l}</button>
                   ))}
                 </div>
               )}
            </div>

            <div className={`relative flex flex-col items-end pointer-events-auto transition-all duration-500 ease-out ${isSearchExpanded ? 'flex-grow md:max-w-[400px]' : 'w-12 md:w-14'}`}>
              <div className={`flex items-center bg-white dark:bg-gray-950 border-2 rounded-2xl shadow-xl overflow-hidden h-12 md:h-14 w-full transition-all duration-500 ${isSearchExpanded ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200 dark:border-gray-800'}`}>
                <button onClick={(e) => { e.stopPropagation(); setIsSearchExpanded(!isSearchExpanded); }} className="px-4 text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors flex-shrink-0">
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </button>
                {isSearchExpanded && <input type="text" autoFocus placeholder="Search thoughts..." className="w-full bg-transparent border-none text-[13px] font-bold focus:ring-0 outline-none text-slate-900 dark:text-white pr-4" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />}
              </div>
              {isSearchExpanded && searchQuery.trim() !== "" && (
                <div className="mt-2 w-full bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl animate-menu-pop flex flex-col z-[4000]">
                  {searchResults.length > 0 ? searchResults.map(result => (
                    <button key={result.id} onClick={(e) => { e.stopPropagation(); jumpToNode(result, true); setSearchQuery(""); setIsSearchExpanded(false); }} className="w-full px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between border-b border-slate-100 dark:border-gray-900 last:border-none group">
                      <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 group-hover:text-blue-500 truncate">{result.label}</span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-md">Gen {result.level}</span>
                    </button>
                  )) : <div className="px-5 py-6 text-center text-slate-400 text-[11px] font-bold uppercase tracking-widest">No matching thoughts</div>}
                </div>
              )}
            </div>
          </div>

          <div ref={containerRef} onMouseDown={(e) => onDragStart(e.pageX, e.pageY)} onMouseMove={(e) => onDragMove(e, e.pageX, e.pageY)} onMouseUp={() => setIsDragging(false)} onClick={() => closeAllOverlays()} onTouchStart={(e) => onDragStart(e.touches[0].pageX, e.touches[0].pageY)} onTouchMove={(e) => onDragMove(e, e.touches[0].pageX, e.touches[0].pageY)} className={`w-full h-full overflow-auto hide-scrollbar relative touch-none cursor-grab active:cursor-grabbing transition-[z-index] ${isFocusMode ? 'z-[500]' : 'z-0'}`}>
            <div className="relative origin-top-left" style={{ width: `${CANVAS_SIZE * zoom}px`, height: `${CANVAS_SIZE * zoom}px`, transform: `scale(${zoom})` }}>
              {visibleNodesAndEdges.visibleEdges.map(edge => {
                const from = nodes.find(n => n.id === edge.from); const to = nodes.find(n => n.id === edge.to);
                if (!from || !to) return null;
                return <ConnectionLine key={edge.id} id={edge.id} from={from.position} to={to.position} isNew={to.isNew} isActive={selectedNodeId === from.id || selectedNodeId === to.id} theme={theme} />;
              })}
              {visibleNodesAndEdges.visibleNodes.map(node => (
                <div key={node.id} className="transition-opacity duration-500" style={{ opacity: selectedNodeId !== null && selectedNodeId !== node.id ? 0.2 : 1 }}>
                  <NodeItem node={node} allNodes={nodes} isActiveFocus={node.level === activeLevel} isSelected={selectedNodeId === node.id} panelDirection={selectedNodeDirection} isEditMode={isEditMode} zoom={zoom} isMobile={isMobile} onClick={() => jumpToNode(node)} onBranch={() => expandNode(node.id, node.label, node.position, node.level, node.path, false)} onExploreFurther={() => expandNode(node.id, node.label, node.position, node.level, node.path, true)} onPrune={(id) => setNodes(prev => prev.filter(n => n.id !== id))} onToggleCollapse={(id) => setNodes(prev => prev.map(n => n.id === id ? { ...n, isCollapsed: !n.isCollapsed } : n))} onHover={() => {}} onDrag={(id, x, y) => setNodes(prev => {
                    const next = prev.map(n => n.id === id ? { ...n, position: { x, y } } : n);
                    if (nodeVelocities.current[id]) { nodeVelocities.current[id].vx = 0; nodeVelocities.current[id].vy = 0; }
                    return next;
                  })} theme={theme} />
                </div>
              ))}
            </div>
          </div>

          <div className="fixed bottom-6 md:bottom-8 left-6 md:left-8 z-[3000] flex flex-col items-start space-y-3 pointer-events-auto">
            {isOptionsMenuOpen && !isEditMode && (
              <div className="bg-white dark:bg-gray-950 rounded-[2rem] border border-slate-200 dark:border-gray-800 p-2 shadow-3xl w-48 animate-menu-pop flex flex-col space-y-1" onClick={e => e.stopPropagation()}>
                <button onClick={(e) => { e.stopPropagation(); setIsEditMode(true); setIsOptionsMenuOpen(false); }} className="flex items-center space-x-3 px-4 py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all"><span className="text-[12px] font-bold">Enter Edit Mode</span></button>
                <button onClick={(e) => { e.stopPropagation(); checkApiKey(); setIsOptionsMenuOpen(false); }} className="flex items-center space-x-3 px-4 py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-blue-500"><span className="text-[12px] font-bold">Set API Key</span></button>
                <button onClick={(e) => { e.stopPropagation(); setTheme(theme === 'dark' ? 'light' : 'dark'); }} className="flex items-center space-x-3 px-4 py-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-gray-300"><span className="text-[12px] font-bold">Change Theme</span></button>
                <button onClick={(e) => { e.stopPropagation(); setIsStarted(false); setNodes([]); setEdges([]); nodeVelocities.current = {}; }} className="flex items-center space-x-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all"><span className="text-[12px] font-bold">Reset Map</span></button>
              </div>
            )}
            <div className="flex flex-col space-y-3">
              <button onClick={(e) => { e.stopPropagation(); if (nodes.length > 0) centerOn(nodes[0].position.x, nodes[0].position.y); setIsOptionsMenuOpen(false); }} className="w-14 h-14 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 shadow-2xl border border-slate-200 dark:border-gray-800 text-slate-600 dark:text-slate-300 hover:text-blue-500 hover:scale-110 active:scale-95 transition-all"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3" strokeWidth="3" /><path strokeLinecap="round" d="M12 3v3m0 12v3M3 12h3m12 0h3" /></svg></button>
              {isEditMode ? <button onClick={(e) => { e.stopPropagation(); setIsEditMode(false); }} className="flex items-center space-x-3 px-6 py-3 rounded-full bg-emerald-500 text-white border border-emerald-400 shadow-[0_10px_30px_rgba(16,185,129,0.4)] hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all animate-pill-pop"><span className="text-[10px] font-black uppercase tracking-widest">Done Editing</span><div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div></button> : <button onClick={(e) => { e.stopPropagation(); setIsOptionsMenuOpen(!isOptionsMenuOpen); }} className={`w-14 h-14 flex items-center justify-center rounded-full bg-white dark:bg-gray-900 shadow-2xl border transition-all ${isOptionsMenuOpen ? 'border-blue-500 text-blue-500 ring-4 ring-blue-500/10' : 'border-slate-200 dark:border-gray-800 text-slate-400 hover:text-blue-500 hover:scale-110'}`}><svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2.5" /><circle cx="12" cy="5" r="2.5" /><circle cx="12" cy="19" r="2.5" /></svg></button>}
            </div>
          </div>

          <div className="fixed bottom-6 md:bottom-8 right-6 md:right-8 z-[3000] flex flex-col items-end space-y-3 pointer-events-auto">
            <div className="flex flex-col space-y-2 bg-white dark:bg-gray-950 p-2 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-2xl">
              <button onClick={(e) => { e.stopPropagation(); updateZoom(zoomRef.current * 1.25); }} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-gray-300"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg></button>
              <button onClick={(e) => { e.stopPropagation(); updateZoom(zoomRef.current / 1.25); }} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-gray-300"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 12H6" /></svg></button>
            </div>
            <Minimap nodes={nodes.filter(n => isNodeEffectivelyVisible(n, nodes))} canvasSize={CANVAS_SIZE} viewport={viewport} isOpen={isMinimapOpen} onToggle={() => setIsMinimapOpen(!isMinimapOpen)} isMobile={isMobile} zoom={zoom} />
            <button onClick={(e) => { e.stopPropagation(); setIsMinimapOpen(!isMinimapOpen); }} className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all shadow-2xl border ${isMinimapOpen ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white dark:bg-gray-950 border-slate-200 dark:border-gray-800 text-slate-500 hover:scale-105'}`}><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
          </div>
          <style>{`
            @keyframes pill-pop { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            .animate-pill-pop { animation: pill-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
            @keyframes menu-pop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
            .animate-menu-pop { animation: menu-pop 0.2s cubic-bezier(0, 0, 0.2, 1); }
            @keyframes level-expand { 0% { width: 0; opacity: 0; transform: translateX(-10px); } 100% { width: auto; opacity: 1; transform: translateX(0); } }
            .animate-level-expand { animation: level-expand 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
          `}</style>
        </>
      )}
    </div>
  );
};

export default App;
