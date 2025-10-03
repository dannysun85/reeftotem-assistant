import '../../styles/ContextMenu.css';

const ContextMenu = ({
  visible,
  x,
  y,
  onClose,
  menuItems
}) => {
  const menuRef = React.useRef(null);

  // 点击外部关闭菜单
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
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
    if (!menuRef.current) return { x, y };

    const menuRect = menuRef.current.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // 防止菜单超出右边界
    if (x + menuRect.width > screenWidth) {
      adjustedX = screenWidth - menuRect.width - 10;
    }

    // 防止菜单超出底部边界
    if (y + menuRect.height > screenHeight) {
      adjustedY = screenHeight - menuRect.height - 10;
    }

    // 防止菜单超出左边界和顶部边界
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);

    return { x: adjustedX, y: adjustedY };
  };

  const { x: adjustedX, y: adjustedY } = adjustPosition();

  const handleMenuItemClick = (item) => {
    if (item.type === 'slider') return;
    console.log('菜单项被点击:', item.label);
    item.action();
    onClose();
  };

  const handleSliderChange = (item, value) => {
    if (item.onChange) {
      item.onChange(value);
    }
  };

  if (!visible) return null;

  return React.createElement(
    'div',
    {
      ref: menuRef,
      className: 'context-menu',
      style: {
        left: adjustedX,
        top: adjustedY,
      },
    },
    menuItems.map((item, index) => {
      if (item.type === 'separator') {
        return React.createElement('div', {
          key: index,
          className: 'context-menu-separator'
        });
      }

      if (item.type === 'slider') {
        return React.createElement(
          'div',
          {
            key: index,
            className: 'context-menu-slider-item',
          },
          React.createElement(
            'div',
            {
              className: 'slider-label',
            },
            `${item.label}: ${item.value}%`
          ),
          React.createElement('input', {
            type: 'range',
            min: item.min || 0,
            max: item.max || 100,
            value: item.value || 50,
            onChange: (e) => {
              console.log('滑块onChange事件触发:', parseInt(e.target.value));
              handleSliderChange(item, parseInt(e.target.value));
            },
            onInput: (e) => {
              console.log('滑块onInput事件触发:', parseInt(e.target.value));
              handleSliderChange(item, parseInt(e.target.value));
            },
            className: 'context-menu-slider',
            onClick: (e) => e.stopPropagation(),
            onMouseDown: (e) => e.stopPropagation(),
          })
        );
      }

      return React.createElement(
        'div',
        {
          key: index,
          className: 'context-menu-item',
          onClick: () => handleMenuItemClick(item),
        },
        item.label
      );
    })
  );
};

export default ContextMenu;