import React, { useEffect, useRef, useState } from 'react';
import { modelPositionDiagnostic } from '../utils/modelPositionDiagnostic';

const ModelDebugOverlay = ({ isVisible = false, model = null, canvas = null }) => {
  const overlayRef = useRef(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState(null);
  const [modelBounds, setModelBounds] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showCoordinates, setShowCoordinates] = useState(true);

  useEffect(() => {
    if (!isVisible) return;

    // 设置诊断日志回调
    modelPositionDiagnostic.setLogCallback((message) => {
      console.log(message);
    });

    const updateDebugInfo = () => {
      if (!model || !canvas) return;

      try {
        // 获取最新的诊断数据
        const diagnosticData = modelPositionDiagnostic.getDiagnosticData();
        if (diagnosticData.length > 0) {
          const latestData = diagnosticData[diagnosticData.length - 1];
          setDiagnosticInfo(latestData);
          setModelBounds(latestData.modelBounds);
        }
      } catch (error) {
        console.error('更新调试信息失败:', error);
      }
    };

    // 定期更新调试信息
    const interval = setInterval(updateDebugInfo, 500);

    return () => clearInterval(interval);
  }, [isVisible, model, canvas]);

  // 绘制调试网格
  const renderGrid = () => {
    if (!showGrid) return null;

    return (
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1000
        }}
      >
        {/* 中心线 */}
        <line
          x1="50%"
          y1="0"
          x2="50%"
          y2="100%"
          stroke="rgba(255, 0, 0, 0.3)"
          strokeWidth="1"
        />
        <line
          x1="0"
          y1="50%"
          x2="100%"
          y2="50%"
          stroke="rgba(255, 0, 0, 0.3)"
          strokeWidth="1"
        />

        {/* 网格线 */}
        {Array.from({ length: 10 }, (_, i) => (
          <React.Fragment key={`grid-${i}`}>
            <line
              x1={`${(i + 1) * 10}%`}
              y1="0"
              x2={`${(i + 1) * 10}%`}
              y2="100%"
              stroke="rgba(0, 255, 0, 0.1)"
              strokeWidth="0.5"
            />
            <line
              x1="0"
              y1={`${(i + 1) * 10}%`}
              x2="100%"
              y2={`${(i + 1) * 10}%`}
              stroke="rgba(0, 255, 0, 0.1)"
              strokeWidth="0.5"
            />
          </React.Fragment>
        ))}
      </svg>
    );
  };

  // 绘制模型边界框
  const renderModelBounds = () => {
    if (!modelBounds || !diagnosticInfo) return null;

    const { canvasWidth, canvasHeight } = diagnosticInfo;

    // 将模型坐标转换为屏幕坐标
    const screenX = ((modelBounds.x + canvasWidth / 2) / canvasWidth) * 100;
    const screenY = ((modelBounds.y + canvasHeight / 2) / canvasHeight) * 100;
    const screenWidth = (modelBounds.width / canvasWidth) * 100;
    const screenHeight = (modelBounds.height / canvasHeight) * 100;

    return (
      <div
        style={{
          position: 'absolute',
          left: `${screenX}%`,
          top: `${screenY}%`,
          width: `${screenWidth}%`,
          height: `${screenHeight}%`,
          border: '2px solid rgba(0, 255, 255, 0.8)',
          backgroundColor: 'rgba(0, 255, 255, 0.1)',
          pointerEvents: 'none',
          zIndex: 1001
        }}
      >
        {/* 边界框标签 */}
        <div
          style={{
            position: 'absolute',
            top: '-20px',
            left: 0,
            background: 'rgba(0, 255, 255, 0.9)',
            color: 'black',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}
        >
          模型边界框
        </div>

        {/* 坐标信息 */}
        {showCoordinates && (
          <div
            style={{
              position: 'absolute',
              bottom: '-40px',
              left: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '3px',
              fontSize: '9px',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap'
            }}
          >
            <div>位置: ({modelBounds.x.toFixed(1)}, {modelBounds.y.toFixed(1)})</div>
            <div>尺寸: {modelBounds.width.toFixed(1)}×{modelBounds.height.toFixed(1)}</div>
          </div>
        )}
      </div>
    );
  };

  // 渲染调试信息面板
  const renderDebugPanel = () => {
    if (!diagnosticInfo) return null;

    const {
      modelName,
      windowWidth,
      windowHeight,
      canvasWidth,
      canvasHeight,
      timestamp
    } = diagnosticInfo;

    return (
      <div
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'rgba(0, 0, 0, 0.9)',
          color: 'white',
          padding: '12px',
          borderRadius: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          zIndex: 1002,
          maxWidth: '300px',
          maxHeight: '400px',
          overflow: 'auto'
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#00ff00' }}>
          🩺 Live2D 模型诊断
        </div>

        <div style={{ marginBottom: '6px' }}>
          <strong>模型:</strong> {modelName}
        </div>

        <div style={{ marginBottom: '6px' }}>
          <strong>时间:</strong> {new Date(timestamp).toLocaleTimeString()}
        </div>

        <div style={{ marginBottom: '6px' }}>
          <strong>窗口:</strong> {windowWidth}×{windowHeight}
        </div>

        <div style={{ marginBottom: '6px' }}>
          <strong>画布:</strong> {canvasWidth}×{canvasHeight}
        </div>

        {modelBounds && (
          <div style={{ marginBottom: '6px' }}>
            <strong>模型边界:</strong><br/>
            <div style={{ marginLeft: '8px' }}>
              位置: ({modelBounds.x.toFixed(1)}, {modelBounds.y.toFixed(1)})<br/>
              尺寸: {modelBounds.width.toFixed(1)}×{modelBounds.height.toFixed(1)}
            </div>
          </div>
        )}

        <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #333' }}>
          <div style={{ marginBottom: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
                style={{ marginRight: '6px' }}
              />
              显示网格
            </label>
          </div>

          <div style={{ marginBottom: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showCoordinates}
                onChange={(e) => setShowCoordinates(e.target.checked)}
                style={{ marginRight: '6px' }}
              />
              显示坐标
            </label>
          </div>

          <div style={{ marginTop: '8px' }}>
            <button
              onClick={() => {
                const report = modelPositionDiagnostic.generateReport();
                console.log(report);
                alert('诊断报告已输出到控制台');
              }}
              style={{
                background: '#007acc',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '3px',
                fontSize: '10px',
                cursor: 'pointer',
                marginRight: '4px'
              }}
            >
              生成报告
            </button>

            <button
              onClick={() => {
                modelPositionDiagnostic.clearDiagnosticData();
                setDiagnosticInfo(null);
                setModelBounds(null);
              }}
              style={{
                background: '#ff4444',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '3px',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              清除数据
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <div ref={overlayRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {renderGrid()}
      {renderModelBounds()}
      {renderDebugPanel()}
    </div>
  );
};

export default ModelDebugOverlay;