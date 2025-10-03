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
