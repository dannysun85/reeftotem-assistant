/* @refresh skip */
import { useEffect, useRef, useState } from 'react';
import { useLive2DCore } from './Live2D/useLive2DCore';
import { useLive2DInit } from './Live2D/useLive2DInit';
import { Live2DCanvas, DebugInfo, LoadingIndicator } from './Live2D/Live2DComponents';

const RealLive2DComponentSimple = (props) => {
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('正在初始化...');
  const [error, setError] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const { loadLive2DCore } = useLive2DCore();
  const { initializeLive2D } = useLive2DInit(loadLive2DCore);

  useEffect(() => {
    const timer = setTimeout(() => {
      initializeLive2D(canvasRef, setStatus, setError, setIsLoaded, props.initialPersona);
    }, 100);

    return () => clearTimeout(timer);
  }, [initializeLive2D, props.initialPersona]);

  return (
    <div
      className={props.className}
      style={{
        ...props.style,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
      }}
    >
      <DebugInfo status={status} error={error} />
      <Live2DCanvas canvasRef={canvasRef} />
      <LoadingIndicator status={status} isLoaded={isLoaded} />
    </div>
  );
};

export default RealLive2DComponentSimple;
