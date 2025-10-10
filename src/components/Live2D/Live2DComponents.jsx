/* @refresh skip */

export const Live2DCanvas = ({ canvasRef }) => (
  <canvas
    ref={canvasRef}
    id="live2dCanvas"
    style={{
      width: '800px',
      height: '1000px',
      display: 'block',
      backgroundColor: 'transparent'
    }}
    width={800}
    height={1000}
  />
);
