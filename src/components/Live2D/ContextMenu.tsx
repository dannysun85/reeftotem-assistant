import React, { useRef, useState, useEffect } from 'react';
import '../../styles/ContextMenu.css';

interface MenuItem {
  id?: string;
  label?: string; // 改为可选,因为 separator 不需要 label
  icon?: string;
  action?: () => void;
  children?: MenuItem[];
  type?: 'separator' | 'slider';
  min?: number;
  max?: number;
  value?: number;
  onChange?: (value: number) => void;
}

interface ContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  menuItems?: MenuItem[];
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  visible,
  x,
  y,
  onClose,
  menuItems = []
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [submenus, setSubmenus] = useState<Record<string, boolean>>({});

  console.log('ContextMenu渲染状态:', { visible, x, y, menuItemsCount: menuItems.length });

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
        setSubmenus({});
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        setSubmenus({});
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [visible, onClose]);

  // 确保菜单不会超出屏幕边界
  const adjustPosition = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // 确保menuItems存在并是数组
    const itemsLength = Array.isArray(menuItems) ? menuItems.length : 0;

    // 预估菜单尺寸
    const estimatedMenuHeight = Math.min(itemsLength * 40, 400);
    const estimatedMenuWidth = 200;

    // 防止菜单超出右边界
    if (x + estimatedMenuWidth > screenWidth) {
      adjustedX = screenWidth - estimatedMenuWidth - 10;
    }

    // 防止菜单超出底部边界
    if (y + estimatedMenuHeight > screenHeight) {
      adjustedY = screenHeight - estimatedMenuHeight - 10;
    }

    // 防止菜单超出左边界和顶部边界
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);

    return { x: adjustedX, y: adjustedY };
  };

  const { x: adjustedX, y: adjustedY } = adjustPosition();

  const handleMenuItemClick = (item: MenuItem) => {
    console.log('📋 菜单项被点击:', item.label || item.id, item.id);
    if (item.action) {
      console.log('🚀 执行菜单项动作');
      item.action();
    }
    onClose();
    setSubmenus({});
  };

  const toggleSubmenu = (itemId: string) => {
    setSubmenus(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    // 处理分隔符
    if (item.type === 'separator') {
      return <li key={`separator_${index}`} className="context-menu-separator" />;
    }

    // 处理滑块
    if (item.type === 'slider') {
      return (
        <li key={`slider_${index}`} className="context-menu-item">
          <div className="context-menu-slider-content">
            <span className="context-menu-label">{item.label || ''}: {item.value}%</span>
            <input
              type="range"
              min={item.min}
              max={item.max}
              value={item.value}
              onChange={(e) => item.onChange?.(parseInt(e.target.value))}
              className="context-menu-slider"
            />
          </div>
        </li>
      );
    }

    const hasSubmenu = item.children && item.children.length > 0;
    const itemId = item.id || `item_${index}`;
    const isSubmenuOpen = submenus[itemId];

    return (
      <li key={itemId} className="context-menu-item">
        <div
          className="context-menu-item-content"
          onClick={() => hasSubmenu ? toggleSubmenu(itemId) : handleMenuItemClick(item)}
        >
          {item.icon && <span className="context-menu-icon">{item.icon}</span>}
          <span className="context-menu-label">{item.label || ''}</span>
          {hasSubmenu && (
            <span className={`context-menu-arrow ${isSubmenuOpen ? 'open' : ''}`}>▶</span>
          )}
        </div>
        {hasSubmenu && isSubmenuOpen && (
          <ul className="context-menu-submenu">
            {item.children?.map((subItem, subIndex) => renderMenuItem(subItem, subIndex))}
          </ul>
        )}
      </li>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
      }}
    >
      <ul className="context-menu-list">
        {menuItems && menuItems.length > 0 ? (
          menuItems.map((item, index) => renderMenuItem(item, index))
        ) : (
          <li className="context-menu-item">
            <div className="context-menu-item-content">
              <span className="context-menu-label">无可用菜单项</span>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
};

export default ContextMenu;