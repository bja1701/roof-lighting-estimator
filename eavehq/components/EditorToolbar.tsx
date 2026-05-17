import React, { useEffect } from 'react';
import { Pencil, MousePointer, ZoomIn, Undo2, Redo2, CheckCheck } from 'lucide-react';
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
    setActiveDrawNode,
    undo,
    redo,
    canUndo,
    canRedo,
    pushUndo,
  } = useEstimatorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const key = e.key.toLowerCase();
      if (key === 'd') setSelectedTool('draw');
      if (key === 's' || key === 'escape') {
        setSelectedTool('select');
        setActiveDrawNode(null);
      }
      if (key === 'z') toggleSuperZoom();
      if (key === 'e') setActiveDrawNode(null);
      if (key === 'delete' || key === 'backspace') {
        if (selectedLineId) {
          pushUndo();
          removeLine(selectedLineId);
          selectLine(null);
        }
      }
      if (key === 'w') {
        if (nodes.length > 0) {
          pushUndo();
          const lastNode = nodes[nodes.length - 1];
          removeNode(lastNode.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTool, nodes, removeNode, selectedLineId, removeLine, setSelectedTool, selectLine, toggleSuperZoom, setActiveDrawNode, pushUndo]);

  const tools = [
    {
      id: 'draw',
      Icon: Pencil,
      label: 'Draw',
      shortcut: 'D',
      onClick: () => setSelectedTool('draw'),
      active: selectedTool === 'draw',
      activeColor: 'var(--color-accent)',
    },
    {
      id: 'select',
      Icon: MousePointer,
      label: 'Select',
      shortcut: 'S',
      onClick: () => setSelectedTool('select'),
      active: selectedTool === 'select',
      activeColor: 'var(--color-primary)',
    },
    {
      id: 'zoom',
      Icon: ZoomIn,
      label: 'Zoom',
      shortcut: 'Z',
      onClick: toggleSuperZoom,
      active: isSuperZoom,
      activeColor: '#7c3aed',
    },
  ] as const;

  const actions = [
    {
      id: 'undo',
      Icon: Undo2,
      label: 'Undo',
      shortcut: '⌘Z',
      onClick: undo,
      disabled: !canUndo,
    },
    {
      id: 'redo',
      Icon: Redo2,
      label: 'Redo',
      shortcut: '⌘⇧Z',
      onClick: redo,
      disabled: !canRedo,
    },
    {
      id: 'finish',
      Icon: CheckCheck,
      label: 'Finish',
      shortcut: 'E',
      onClick: () => setActiveDrawNode(null),
      disabled: false,
    },
  ];

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-0 max-w-[calc(100vw-1rem)] overflow-x-auto">
      <div
        className="flex items-center gap-1 p-1.5 rounded-2xl"
        style={{
          background: 'rgba(15,25,40,0.94)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {tools.map(({ id, Icon, label, shortcut, onClick, active, activeColor }) => (
          <button
            key={id}
            onClick={onClick}
            title={`${label} (${shortcut})`}
            className="relative group/btn p-2 sm:p-3 rounded-xl transition-all duration-150 active:scale-95"
            style={
              active
                ? { background: activeColor, color: '#fff', boxShadow: `0 4px 12px ${activeColor}55` }
                : { color: 'rgba(255,255,255,0.45)' }
            }
            onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            <Icon size={16} />
            <span
              className="absolute -top-9 left-1/2 -translate-x-1/2 text-[10px] px-2 py-1 rounded-md whitespace-nowrap pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity"
              style={{ background: 'rgba(15,25,40,0.96)', color: '#f7f3ea' }}
            >
              {label} ({shortcut})
            </span>
          </button>
        ))}

        <div className="w-px h-6 mx-1" style={{ background: 'rgba(255,255,255,0.15)' }} />

        {actions.map(({ id, Icon, label, shortcut, onClick, disabled }) => (
          <button
            key={id}
            onClick={onClick}
            disabled={disabled}
            title={`${label} (${shortcut})`}
            className="relative group/btn p-2 sm:p-3 rounded-xl transition-all duration-150 active:scale-95 disabled:cursor-not-allowed"
            style={{ color: disabled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.45)' }}
            onMouseEnter={e => { if (!disabled) e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { if (!disabled) e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            <Icon size={16} />
            <span
              className="absolute -top-9 left-1/2 -translate-x-1/2 text-[10px] px-2 py-1 rounded-md whitespace-nowrap pointer-events-none opacity-0 group-hover/btn:opacity-100 transition-opacity"
              style={{ background: 'rgba(15,25,40,0.96)', color: '#f7f3ea' }}
            >
              {label} ({shortcut})
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default EditorToolbar;
