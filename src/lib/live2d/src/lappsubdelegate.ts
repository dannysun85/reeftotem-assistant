/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import * as LAppDefine from './lappdefine';
import { LAppGlManager } from './lappglmanager';
import { LAppLive2DManager } from './lapplive2dmanager';
import { LAppPal } from './lapppal';
import { LAppTextureManager } from './lapptexturemanager';
import { LAppView } from './lappview';
// 导入ResourceModel从lappdelegate
import { ResourceModel } from './lappdelegate';

/**
 * Canvasに関連する操作を取りまとめるクラス
 */
export class LAppSubdelegate {
  /**
   * コンストラクタ
   */
  public constructor() {
    this._canvas = null;
    this._glManager = new LAppGlManager();
    this._textureManager = new LAppTextureManager();
    this._live2dManager = new LAppLive2DManager();
    this._view = new LAppView();
    this._frameBuffer = null;
    this._captured = false;
  }

  /**
   * デストラクタ相当の処理
   */
  public release(): void {
    this._resizeObserver.unobserve(this._canvas);
    this._resizeObserver.disconnect();
    this._resizeObserver = null;

    this._live2dManager.release();
    this._live2dManager = null;

    this._view.release();
    this._view = null;

    this._textureManager.release();
    this._textureManager = null;

    this._glManager.release();
    this._glManager = null;
  }

  /**
   * APPに必要な物を初期化する。
   */
  public initialize(canvas: HTMLCanvasElement): boolean {
    if (!this._glManager.initialize(canvas)) {
      console.error('LAppSubdelegate: WebGL管理器初始化失败');
      return false;
    }

    this._canvas = canvas;

    if (LAppDefine.CanvasSize === 'auto') {
      this.resizeCanvas();
    } else {
      canvas.width = LAppDefine.CanvasSize.width;
      canvas.height = LAppDefine.CanvasSize.height;
    }

    this._textureManager.setGlManager(this._glManager);

    const gl = this._glManager.getGl();

    if (!this._frameBuffer) {
      this._frameBuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    }

    // 透過設定
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // AppViewの初期化
    this._view.initialize(this);
    this._view.initializeSprite();

    this._live2dManager.initialize(this);

    // 设置尺寸观察器
    this._resizeObserver = new ResizeObserver(
      (entries: ResizeObserverEntry[], observer: ResizeObserver) =>
        this.resizeObserverCallback.call(this, entries, observer)
    );
    this._resizeObserver.observe(this._canvas);

    if (LAppDefine.DebugLogEnable) {
      console.log('LAppSubdelegate: 初始化完成');
    }
    return true;
  }

  /**
   * Resize canvas and re-initialize view.
   */
  public onResize(): void {
    this.resizeCanvas();
    this._view.initialize(this);
    this._view.initializeSprite();
  }

  private resizeObserverCallback(
    entries: ResizeObserverEntry[],
    observer: ResizeObserver
  ): void {
    if (LAppDefine.CanvasSize === 'auto') {
      this._needResize = true;
    }
  }

  /**
   * ループ処理
   */
  public update(): void {
    const gl = this._glManager.getGl();
    if (!gl) {
      console.error('LAppSubdelegate.update: WebGL上下文不存在');
      return;
    }

    if (gl.isContextLost()) {
      console.error('LAppSubdelegate.update: WebGL上下文丢失');
      return;
    }

    // キャンバスのサイズが変わっている場合はリサイズに必要な処理をする。
    if (this._needResize) {
      this.onResize();
      this._needResize = false;
    }

    // 画面的初始化.默认就是白色(rgb: 1.0, 1.0, 1.0)且不透明(alpha: 1.0)
    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    // 启用深度测试
    gl.enable(gl.DEPTH_TEST);

    // 附近的物体会掩盖远处的物体(也就是说如果近的点已经被渲染了,一个新的像素更远就不用渲染了)
    gl.depthFunc(gl.LEQUAL);

    // 清除颜色缓冲区和深度缓冲区,每次渲染的时候都做清除处理
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // 设置深度缓冲区的初始值1.0, 也就是大家都是最远的初始化值
    gl.clearDepth(1.0);

    // 透明设置
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 描画更新
    try {
      this._view.render();
    } catch (error) {
      console.error('LAppSubdelegate.update: 渲染失败:', error);
    }
  }

  /**
   * シェーダーを登録する。
   */
  public createShader(): WebGLProgram | null {
    const gl = this._glManager.getGl();
    if (!gl) {
      console.error('LAppSubdelegate.createShader: WebGL上下文不可用');
      return null;
    }

    // バーテックスシェーダーのコンパイル
    const vertexShaderId = gl.createShader(gl.VERTEX_SHADER);

    if (vertexShaderId == null) {
      console.error('LAppSubdelegate.createShader: 顶点着色器创建失败');
      return null;
    }

    const vertexShader: string =
      'precision mediump float;' +
      'attribute vec3 position;' +
      'attribute vec2 uv;' +
      'varying vec2 vuv;' +
      'void main(void)' +
      '{' +
      '   gl_Position = vec4(position, 1.0);' +
      '   vuv = uv;' +
      '}';

    gl.shaderSource(vertexShaderId, vertexShader);
    gl.compileShader(vertexShaderId);

    // 检查顶点着色器编译状态
    if (!gl.getShaderParameter(vertexShaderId, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(vertexShaderId);
      console.error('LAppSubdelegate.createShader: 顶点着色器编译失败:', info);
      gl.deleteShader(vertexShaderId);
      return null;
    }

    // フラグメントシェーダのコンパイル
    const fragmentShaderId = gl.createShader(gl.FRAGMENT_SHADER);

    if (fragmentShaderId == null) {
      console.error('LAppSubdelegate.createShader: 片段着色器创建失败');
      gl.deleteShader(vertexShaderId);
      return null;
    }

    const fragmentShader: string =
      'precision mediump float;' +
      'varying vec2 vuv;' +
      'uniform sampler2D texture;' +
      'void main(void)' +
      '{' +
      '   gl_FragColor = texture2D(texture, vuv);' +
      '}';

    gl.shaderSource(fragmentShaderId, fragmentShader);
    gl.compileShader(fragmentShaderId);

    // 检查片段着色器编译状态
    if (!gl.getShaderParameter(fragmentShaderId, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(fragmentShaderId);
      console.error('LAppSubdelegate.createShader: 片段着色器编译失败:', info);
      gl.deleteShader(vertexShaderId);
      gl.deleteShader(fragmentShaderId);
      return null;
    }

    // プログラムオブジェクトの作成
    const programId = gl.createProgram();
    if (!programId) {
      console.error('LAppSubdelegate.createShader: 着色器程序创建失败');
      gl.deleteShader(vertexShaderId);
      gl.deleteShader(fragmentShaderId);
      return null;
    }

    gl.attachShader(programId, vertexShaderId);
    gl.attachShader(programId, fragmentShaderId);

    gl.deleteShader(vertexShaderId);
    gl.deleteShader(fragmentShaderId);

    // リンク
    gl.linkProgram(programId);

    // 检查链接状态
    if (!gl.getProgramParameter(programId, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(programId);
      console.error('LAppSubdelegate.createShader: 着色器程序链接失败:', info);
      gl.deleteProgram(programId);
      return null;
    }

    try {
      gl.useProgram(programId);
    } catch (error) {
      console.error('LAppSubdelegate.createShader: 使用着色器程序失败:', error);
      gl.deleteProgram(programId);
      return null;
    }

    return programId;
  }

  public getTextureManager(): LAppTextureManager {
    return this._textureManager;
  }

  public getFrameBuffer(): WebGLFramebuffer {
    return this._frameBuffer;
  }

  public getCanvas(): HTMLCanvasElement {
    return this._canvas;
  }

  public getGlManager(): LAppGlManager {
    return this._glManager;
  }

  public getLive2DManager(): LAppLive2DManager {
    return this._live2dManager;
  }

  /**
   * Resize the canvas to fill the screen.
   */
  private resizeCanvas(): void {
    this._canvas.width = this._canvas.clientWidth * window.devicePixelRatio;
    this._canvas.height = this._canvas.clientHeight * window.devicePixelRatio;

    const gl = this._glManager.getGl();

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  }

  /**
   * マウスダウン、タッチダウンしたときに呼ばれる。
   */
  public onPointBegan(pageX: number, pageY: number): void {
    if (!this._view) {
      LAppPal.printMessage('view notfound');
      return;
    }
    this._captured = true;

    const localX: number = pageX - this._canvas.offsetLeft;
    const localY: number = pageY - this._canvas.offsetTop;

    this._view.onTouchesBegan(localX, localY);
  }

  /**
   * マウスポインタが動いたら呼ばれる。
   */
  public onPointMoved(pageX: number, pageY: number): void {
    if (!this._captured) {
      return;
    }

    const localX: number = pageX - this._canvas.offsetLeft;
    const localY: number = pageY - this._canvas.offsetTop;

    this._view.onTouchesMoved(localX, localY);
  }

  /**
   * クリックが終了したら呼ばれる。
   */
  public onPointEnded(pageX: number, pageY: number): void {
    this._captured = false;

    if (!this._view) {
      LAppPal.printMessage('view notfound');
      return;
    }

    const localX: number = pageX - this._canvas.offsetLeft;
    const localY: number = pageY - this._canvas.offsetTop;

    this._view.onTouchesEnded(localX, localY);
  }

  /**
   * タッチがキャンセルされると呼ばれる。
   */
  public onTouchCancel(pageX: number, pageY: number): void {
    this._captured = false;

    if (!this._view) {
      LAppPal.printMessage('view notfound');
      return;
    }

    const localX: number = pageX - this._canvas.offsetLeft;
    const localY: number = pageY - this._canvas.offsetTop;

    this._view.onTouchesEnded(localX, localY);
  }

  public isContextLost(): boolean {
    return this._glManager.getGl().isContextLost();
  }

  public changeCharacter(character: ResourceModel | null) {
    // _subdelegates中只有一个画布, 所以设置第一个即可
    this._live2dManager.changeCharacter(character);
  }

  private _canvas: HTMLCanvasElement;

  /**
   * View情報
   */
  private _view: LAppView;

  /**
   * テクスチャマネージャー
   */
  private _textureManager: LAppTextureManager;
  private _frameBuffer: WebGLFramebuffer;
  private _glManager: LAppGlManager;
  private _live2dManager: LAppLive2DManager;

  /**
   * ResizeObserver
   */
  private _resizeObserver: ResizeObserver;

  /**
   * クリックしているか
   */
  private _captured: boolean;

  private _needResize: boolean;
}
