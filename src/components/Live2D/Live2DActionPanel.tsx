import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_META } from '../../types/model-interaction';
import type { InteractionCategory, ModelInteraction } from '../../types/model-interaction';

interface Live2DActionPanelProps {
  visible: boolean;
  onClose: () => void;
  // model
  currentModel: string;
  currentModelDisplayName: string;
  onSwitchPrev: () => void;
  onSwitchNext: () => void;
  // interactions
  interactions: ModelInteraction[];
  onExecuteInteraction: (item: ModelInteraction) => void;
  // settings
  eyeTrackingEnabled: boolean;
  onToggleEyeTracking: () => void;
  onHideModel: () => void;
  onExit: () => void;
}

const Live2DActionPanel: React.FC<Live2DActionPanelProps> = ({
  visible,
  onClose,
  currentModelDisplayName,
  onSwitchPrev,
  onSwitchNext,
  interactions,
  onExecuteInteraction,
  eyeTrackingEnabled,
  onToggleEyeTracking,
  onHideModel,
  onExit,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState<InteractionCategory | null>(null);

  // Extract unique categories in order they appear
  const categories = useMemo(() => {
    const seen = new Set<InteractionCategory>();
    const result: InteractionCategory[] = [];
    for (const item of interactions) {
      if (!seen.has(item.category)) {
        seen.add(item.category);
        result.push(item.category);
      }
    }
    return result;
  }, [interactions]);

  // Auto-select first category when interactions change
  useEffect(() => {
    if (categories.length > 0) {
      setActiveCategory(categories[0]);
    } else {
      setActiveCategory(null);
    }
  }, [categories]);

  // Filtered interactions for current tab
  const filteredInteractions = useMemo(() => {
    if (!activeCategory) return interactions;
    return interactions.filter(i => i.category === activeCategory);
  }, [interactions, activeCategory]);

  // Close on click outside
  useEffect(() => {
    if (!visible) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [visible, onClose]);

  const handleChipClick = useCallback((item: ModelInteraction) => {
    onExecuteInteraction(item);
  }, [onExecuteInteraction]);

  if (!visible) return null;

  return (
    <div
      ref={panelRef}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onContextMenu={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(20, 20, 20, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 12,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        color: '#fff',
        zIndex: 10000,
        minWidth: 220,
        maxWidth: 280,
        animation: 'actionPanelIn 0.15s ease-out',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Inline keyframes */}
      <style>{`
        @keyframes actionPanelIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>

      {/* Header: model switcher */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <button onClick={onSwitchPrev} style={arrowBtnStyle} title="上一个模型">&#9664;</button>
        <span style={{ fontSize: 14, fontWeight: 600, flex: 1, textAlign: 'center' }}>
          {currentModelDisplayName}
        </span>
        <button onClick={onSwitchNext} style={arrowBtnStyle} title="下一个模型">&#9654;</button>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 2,
          padding: '6px 8px',
          overflowX: 'auto',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          {categories.map(cat => {
            const meta = CATEGORY_META[cat];
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                title={meta.label}
                style={{
                  background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                  transition: 'background 0.15s',
                  flexShrink: 0,
                }}
              >
                {meta.icon}
              </button>
            );
          })}
        </div>
      )}

      {/* Interaction chips */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '8px 10px',
        maxHeight: 150,
        overflowY: 'auto',
        minHeight: 36,
      }}>
        {filteredInteractions.length > 0 ? (
          filteredInteractions.map(item => (
            <button
              key={item.id}
              onClick={() => handleChipClick(item)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 14,
                padding: '4px 10px',
                color: '#eee',
                fontSize: 12,
                cursor: 'pointer',
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            >
              {item.label}
            </button>
          ))
        ) : (
          <button
            onClick={() => onExecuteInteraction({ id: 'fallback-random', label: '随机表情', category: 'happy', motion: null, expression: null })}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 14,
              padding: '4px 10px',
              color: '#eee',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            随机表情
          </button>
        )}
      </div>

      {/* Footer toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '8px 12px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
      }}>
        <button
          onClick={onToggleEyeTracking}
          style={footerBtnStyle}
          title={eyeTrackingEnabled ? '关闭眼神跟随' : '开启眼神跟随'}
        >
          {eyeTrackingEnabled ? '👁️ 眼神' : '👁️‍🗨️ 眼神'}
        </button>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <button onClick={onHideModel} style={footerBtnStyle} title="隐藏模型">
          🙈 隐藏
        </button>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
        <button onClick={onExit} style={footerBtnStyle} title="退出应用">
          ✕
        </button>
      </div>
    </div>
  );
};

const arrowBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 14,
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 4,
  transition: 'color 0.15s',
};

const footerBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'rgba(255,255,255,0.6)',
  fontSize: 12,
  cursor: 'pointer',
  padding: '2px 4px',
  borderRadius: 4,
  transition: 'color 0.15s',
};

export default Live2DActionPanel;
