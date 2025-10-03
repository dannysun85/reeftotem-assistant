import React, { useEffect, useRef } from 'react';

/**
 * 简单的WebGL测试组件
 */
export const WebGLTest: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    console.log('WebGLTest: 开始测试WebGL功能');
    const canvas = canvasRef.current;

    // 尝试获取WebGL上下文
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

    if (!gl) {
      console.error('WebGLTest: WebGL上下文创建失败');
      return;
    }

    console.log('WebGLTest: WebGL上下文创建成功');
    console.log('WebGLTest: WebGL版本:', (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).VERSION));
    console.log('WebGLTest: WebGL供应商:', (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).VENDOR));

    // 创建简单的着色器程序
    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      uniform vec4 u_color;
      void main() {
        gl_FragColor = u_color;
      }
    `;

    // 编译顶点着色器
    const vertexShader = (gl as WebGLRenderingContext).createShader((gl as WebGLRenderingContext).VERTEX_SHADER);
    if (!vertexShader) {
      console.error('WebGLTest: 顶点着色器创建失败');
      return;
    }

    (gl as WebGLRenderingContext).shaderSource(vertexShader, vertexShaderSource);
    (gl as WebGLRenderingContext).compileShader(vertexShader);

    if (!(gl as WebGLRenderingContext).getShaderParameter(vertexShader, (gl as WebGLRenderingContext).COMPILE_STATUS)) {
      const info = (gl as WebGLRenderingContext).getShaderInfoLog(vertexShader);
      console.error('WebGLTest: 顶点着色器编译失败:', info);
      return;
    }

    console.log('WebGLTest: 顶点着色器编译成功');

    // 编译片段着色器
    const fragmentShader = (gl as WebGLRenderingContext).createShader((gl as WebGLRenderingContext).FRAGMENT_SHADER);
    if (!fragmentShader) {
      console.error('WebGLTest: 片段着色器创建失败');
      return;
    }

    (gl as WebGLRenderingContext).shaderSource(fragmentShader, fragmentShaderSource);
    (gl as WebGLRenderingContext).compileShader(fragmentShader);

    if (!(gl as WebGLRenderingContext).getShaderParameter(fragmentShader, (gl as WebGLRenderingContext).COMPILE_STATUS)) {
      const info = (gl as WebGLRenderingContext).getShaderInfoLog(fragmentShader);
      console.error('WebGLTest: 片段着色器编译失败:', info);
      return;
    }

    console.log('WebGLTest: 片段着色器编译成功');

    // 创建着色器程序
    const program = (gl as WebGLRenderingContext).createProgram();
    if (!program) {
      console.error('WebGLTest: 着色器程序创建失败');
      return;
    }

    (gl as WebGLRenderingContext).attachShader(program, vertexShader);
    (gl as WebGLRenderingContext).attachShader(program, fragmentShader);
    (gl as WebGLRenderingContext).linkProgram(program);

    if (!(gl as WebGLRenderingContext).getProgramParameter(program, (gl as WebGLRenderingContext).LINK_STATUS)) {
      const info = (gl as WebGLRenderingContext).getProgramInfoLog(program);
      console.error('WebGLTest: 着色器程序链接失败:', info);
      return;
    }

    console.log('WebGLTest: 着色器程序链接成功');
    console.log('WebGLTest: WebGL功能测试完成');

    // 简单渲染测试
    (gl as WebGLRenderingContext).useProgram(program);
    (gl as WebGLRenderingContext).clearColor(0.0, 0.0, 1.0, 1.0);
    (gl as WebGLRenderingContext).clear((gl as WebGLRenderingContext).COLOR_BUFFER_BIT);

  }, []);

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>WebGL测试</h3>
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        style={{ border: '1px solid #000' }}
      />
      <p>查看控制台了解WebGL测试结果</p>
    </div>
  );
};