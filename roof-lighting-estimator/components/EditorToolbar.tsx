
import React, { useEffect } from 'react';
import { useEstimatorStore } from '../store/useEstimatorStore';

const EditorToolbar: React.FC = () => {
  const { 
    selectedTool, 
    setSelectedTool, 
    nodes, 
    removeNode, 
    selectedLineId, 
    removeLine,
    selectLine,
    isSuperZoom,
    toggleSuperZoom,
    setActiveDrawNode
  } = useEstimatorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();

      // Tool Switching
      if (key === 'd') setSelectedTool('draw');
      if (key === 's' || key === 'escape') {
         setSelectedTool('select');
         setActiveDrawNode(null); // Also finish line if pressing escape
      }
      if (key === 'z') toggleSuperZoom();
      
      // Finish Line (E)
      if (key === 'e') {
        setActiveDrawNode(null);
      }

      // Delete Actions (Only delete selected line)
      if (key === 'delete' || key === 'backspace') {
        if (selectedLineId) {
          removeLine(selectedLineId);
          selectLine(null);
        }
      }

      // Undo (W)
      if (key === 'w') {
        if (nodes.length > 0) {
          const lastNode = nodes[nodes.length - 1];
          removeNode(lastNode.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTool, nodes, removeNode, selectedLineId, removeLine, setSelectedTool, selectLine, toggleSuperZoom, setActiveDrawNode]);

  return (
    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center group">
      
      {/* The Toolbar (Slides up on hover) */}
      <div className="mb-2 translate-y-[150%] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-out">
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md border border-slate-700/50 p-1.5 rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          
          {/* Draw Tool */}
          <button
            onClick={() => setSelectedTool('draw')}
            className={`relative group/btn p-3 rounded-xl transition-all duration-200 ${
              selectedTool === 'draw' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Draw (D)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"></path>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path>
              <path d="M2 2l7.586 7.586"></path>
              <circle cx="11" cy="11" r="2"></circle>
            </svg>
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Draw (D)
            </span>
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1"></div>

          {/* Select Tool */}
          <button
            onClick={() => setSelectedTool('select')}
            className={`relative group/btn p-3 rounded-xl transition-all duration-200 ${
              selectedTool === 'select' 
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 scale-105' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Select (S)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path>
              <path d="M13 13l6 6"></path>
            </svg>
             <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Select (S)
            </span>
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1"></div>
          
           {/* Zoom Tool */}
           <button
            onClick={toggleSuperZoom}
            className={`relative group/btn p-3 rounded-xl transition-all duration-200 ${
              isSuperZoom
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25 scale-105' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Toggle Super Zoom (Z)"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
             </svg>
             <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Zoom (Z)
            </span>
          </button>

          <div className="w-px h-6 bg-slate-700 mx-1"></div>

          {/* Undo Action */}
          <button
            onClick={() => {
               if (nodes.length > 0) {
                  const lastNode = nodes[nodes.length - 1];
                  removeNode(lastNode.id);
               }
            }}
            className="relative group/btn p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
            title="Undo (W)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6"></path>
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
            </svg>
            <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Undo (W)
            </span>
          </button>
          
          {/* Finish Line (E) visual helper */}
          <button
            onClick={() => setActiveDrawNode(null)}
             className="relative group/btn p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
             title="Finish Line (E)"
          >
             <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3h5v5"></path>
                <path d="M8 3H3v5"></path>
                <path d="M12 7v10"></path>
                <path d="M9 14l3 3 3-3"></path>
             </svg>
             <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
               Finish (E)
             </span>
          </button>

        </div>
      </div>

      {/* The Hover Trigger / Handle */}
      <div className="h-6 w-32 bg-slate-900/50 backdrop-blur-sm rounded-t-xl flex items-center justify-center border-t border-x border-slate-700/50 cursor-pointer group-hover:bg-slate-800/80 transition-colors">
         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 group-hover:text-blue-400 animate-bounce">
            <path d="M18 15l-6-6-6 6"/>
         </svg>
      </div>

      {/* Invisible hover area extender to make it easier to grab */}
      <div className="h-4 w-full"></div>

    </div>
  );
};

export default EditorToolbar;
