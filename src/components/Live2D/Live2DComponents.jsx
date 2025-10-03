/* @refresh skip */

export const Live2DCanvas = ({ canvasRef }) => (
  <canvas
    ref={canvasRef}
    id="live2dCanvas"
    style={{
      width: '100%',
      height: '100%',
      display: 'block',
      backgroundColor: 'transparent'
    }}
    width={400}
    height={500}
  />
);

export const DebugInfo = ({ status, error }) => (
  <div
    style={{
      position: 'absolute',
      top: '10px',
      left: '10px',
      right: '10px',
      background: 'rgba(0,0,0,0.8)',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      zIndex: 1000,
      fontFamily: 'monospace',
      maxWidth: 'calc(100% - 20px)',
      wordBreak: 'break-word',
      textAlign: 'center'
    }}
  >
    <div>状态: {status}</div>
    {error && (
      <div style={{ color: '#ff6b6b', marginTop: '4px' }}>
        错误: {error}
      </div>
    )}
  </div>
);

export const LoadingIndicator = ({ status, isLoaded }) => !isLoaded ? (
  <div
    style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      color: 'white',
      fontSize: '16px',
      textAlign: 'center',
      background: 'rgba(0,0,0,0.7)',
      padding: '20px',
      borderRadius: '10px'
    }}
  >
    <div>{status}</div>
    <div
      style={{
        marginTop: '10px',
        fontSize: '12px',
        opacity: 0.8
      }}
    >
      正在加载Live2D模型...
    </div>
  </div>
) : null;
