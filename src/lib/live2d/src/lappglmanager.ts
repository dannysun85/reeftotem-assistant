/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

/**
 * Cubism SDKのサンプルで使用するWebGLを管理するクラス
 */
export class LAppGlManager {
  public constructor() {
    this._gl = null;
  }

  public initialize(canvas: HTMLCanvasElement): boolean {
    console.log('LAppGlManager: 开始初始化WebGL上下文');
    console.log('Canvas元素:', canvas);
    console.log('Canvas尺寸:', canvas.width, 'x', canvas.height);

    // glコンテキストを初期化 - 尝试多种WebGL上下文
    const contextOptions = {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false
    };

    // 首先尝试WebGL2
    this._gl = canvas.getContext('webgl2', contextOptions);

    if (this._gl) {
      console.log('LAppGlManager: 成功创建WebGL2上下文');
    } else {
      console.log('LAppGlManager: WebGL2失败，尝试WebGL1');
      this._gl = canvas.getContext('webgl', contextOptions) ||
                canvas.getContext('experimental-webgl', contextOptions);

      if (this._gl) {
        console.log('LAppGlManager: 成功创建WebGL1上下文');
      }
    }

    if (!this._gl) {
      console.error('LAppGlManager: WebGL初始化完全失败');
      console.error('浏览器信息:', navigator.userAgent);
      console.error('Canvas支持:', !!canvas.getContext);

      // 检查具体的失败原因
      const testCanvas = document.createElement('canvas');
      const testGl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
      if (!testGl) {
        console.error('浏览器不支持WebGL');
      } else {
        console.error('WebGL支持但当前Canvas无法创建上下文');
      }

      // 改用console.error而不是alert
      console.error('Cannot initialize WebGL. This browser does not support.');
      this._gl = null;
      return false;
    }

    // 输出WebGL详细信息
    const gl = this._gl as WebGLRenderingContext;
    console.log('WebGL版本:', gl.getParameter(gl.VERSION));
    console.log('WebGL供应商:', gl.getParameter(gl.VENDOR));
    console.log('WebGL渲染器:', gl.getParameter(gl.RENDERER));
    console.log('WebGL着色器语言版本:', gl.getParameter(gl.SHADING_LANGUAGE_VERSION));

    return true;
  }

  /**
   * 解放する。
   */
  public release(): void {}

  public getGl(): WebGLRenderingContext | WebGL2RenderingContext {
    return this._gl;
  }

  private _gl: WebGLRenderingContext | WebGL2RenderingContext = null;
}
