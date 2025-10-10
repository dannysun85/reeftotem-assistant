/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { csmVector } from '../Framework/src/type/csmvector';
import { CubismFramework, Option } from '../Framework/src/live2dcubismframework';
import * as LAppDefine from './lappdefine';
import { LAppPal } from './lapppal';
import { LAppSubdelegate } from './lappsubdelegate';
import { CubismLogError } from '../Framework/src/utils/cubismdebug';
// Live2D Core 应该已在 entry 文件中加载
// 确保全局 Live2DCubismCore 可用
declare global {
  var Live2DCubismCore: any;
  var LAppDelegate: any; // 添加全局类型声明
}
// 从正确的位置导入ResourceModel
import { ResourceModel } from '../types';

// 重新导出ResourceModel
export type { ResourceModel };

export let s_instance: LAppDelegate = null;

/**
 * アプリケーションクラス。
 * Cubism SDKの管理を行う。
 */
export class LAppDelegate {
  /**
   * クラスのインスタンス（シングルトン）を返す。
   * インスタンスが生成されていない場合は内部でインスタンスを生成する。
   *
   * @return クラスのインスタンス
   */
  public static getInstance(): LAppDelegate {
    if (s_instance == null) {
      s_instance = new LAppDelegate();
      // 🚀 将实例设置到全局变量，供前端组件直接访问
      if (typeof window !== 'undefined') {
        (window as any).LAppDelegate = LAppDelegate;
        console.log('✅ LAppDelegate实例已设置到全局变量');
      }
    }

    return s_instance;
  }

  /**
   * クラスのインスタンス（シングルトン）を解放する。
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance.release();
    }

    s_instance = null;
  }

  /**
   * Resize canvas and re-initialize view.
   */
  public onResize(): void {
    for (let i = 0; i < this._subdelegates.getSize(); i++) {
      this._subdelegates.at(i).onResize();
    }
  }

  /**
   * 実行処理。
   */
  public run(): void {
    // メインループ
    const loop = (): void => {
      // インスタンスの有無の確認
      if (s_instance == null) {
        return;
      }

      const currentTime = performance.now();
      const deltaTime = currentTime - this._lastFrameTime;

      // 检查是否应该更新帧
      let shouldUpdate = true;

      if (!this._isIdle) {
        // 活动状态：检查是否进入空闲
        if (currentTime - this._idleCheckTime > this._idleTimeout) {
          this._isIdle = true;
          this._targetFPS = 30; // 空闲时降低到30FPS
          this._frameInterval = 1000 / this._targetFPS;
        }
      } else {
        // 空闲状态：检查帧率控制
        if (deltaTime < this._frameInterval) {
          shouldUpdate = false;
        }
      }

      if (shouldUpdate) {
        // 時間更新
        LAppPal.updateTime();

        for (let i = 0; i < this._subdelegates.getSize(); i++) {
          this._subdelegates.at(i).update();
        }

        this._lastFrameTime = currentTime;
      }

      // ループのために再帰呼び出し
      requestAnimationFrame(loop);
    };

    // 初始化时间戳
    this._lastFrameTime = performance.now();
    this._idleCheckTime = this._lastFrameTime;

    loop();
  }

  /**
   * 活动交互事件 - 重置空闲状态
   */
  public notifyActivity(): void {
    this._idleCheckTime = performance.now();
    if (this._isIdle) {
      this._isIdle = false;
      this._targetFPS = 60; // 恢复到60FPS
      this._frameInterval = 1000 / this._targetFPS;
    }
  }

  /**
   * 解放する。
   */
  private release(): void {
    this.releaseEventListener();
    this.releaseSubdelegates();

    // Cubism SDKの解放
    CubismFramework.dispose();

    this._cubismOption = null;
  }

  /**
   * イベントリスナーを解除する。
   */
  private releaseEventListener(): void {
    document.removeEventListener('pointerup', onPointerBegan);
    document.removeEventListener('pointermove', onPointerMoved);
    document.removeEventListener('pointerdown', onPointerEnded);
    document.removeEventListener('pointerdown', onPointerCancel);
  }

  /**
   * Subdelegate を解放する
   */
  private releaseSubdelegates(): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().release();
    }

    this._subdelegates.clear();
    this._subdelegates = null;
  }

  /**
   * APPに必要な物を初期化する。
   */
  public initialize(): boolean {
    // Cubism SDKの初期化
    this.initializeCubism();

    this.initializeSubdelegates();
    this.initializeEventListener();

    return true;
  }

  /**
   * イベントリスナーを設定する。
   */
  private initializeEventListener(): void {
    document.addEventListener('pointerdown', onPointerBegan, { passive: true });
    document.addEventListener('pointermove', onPointerMoved, { passive: true });
    document.addEventListener('pointerup', onPointerEnded, { passive: true });
    document.addEventListener('pointercancel', onPointerCancel, { passive: true });
  }

  /**
   * Cubism SDKの初期化
   */
  private initializeCubism(): void {
    LAppPal.updateTime();

    // setup cubism
    this._cubismOption.logFunction = LAppPal.printMessage;
    this._cubismOption.loggingLevel = LAppDefine.CubismLoggingLevel;

    try {
      CubismFramework.startUp(this._cubismOption);

      // initialize cubism
      CubismFramework.initialize();
    } catch (error) {
      console.error('CubismFramework初始化失败:', error);
      throw error;
    }
  }

  /**
   * Canvasを生成配置、Subdelegateを初期化する
   */
  private initializeSubdelegates(): void {
    // 只支持一个画布
    if (LAppDefine.CanvasNum > 1) {
      throw new Error('CanvasNum > 1');
    }
    let width: number = 100;
    let height: number = 100;
    if (LAppDefine.CanvasNum > 3) {
      const widthunit: number = Math.ceil(Math.sqrt(LAppDefine.CanvasNum));
      const heightUnit = Math.ceil(LAppDefine.CanvasNum / widthunit);
      width = 100.0 / widthunit;
      height = 100.0 / heightUnit;
    } else {
      width = 100.0 / LAppDefine.CanvasNum;
    }

    this._canvases.prepareCapacity(LAppDefine.CanvasNum);
    this._subdelegates.prepareCapacity(LAppDefine.CanvasNum);
    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      // const canvas = document.createElement('canvas');
      // 默认只有一个 live2dCanvas 画布
      const canvas = document.getElementById('live2dCanvas') as HTMLCanvasElement;
      if (!canvas) {
        throw new Error('Canvas element with id "live2dCanvas" not found. Make sure the React component has rendered the canvas.');
      }
            this._canvases.pushBack(canvas);
      // canvas.style.width = `${width}vw`;
      // canvas.style.height = `${height}vh`;

      // キャンバスを DOM に追加
      // document.body.appendChild(canvas);
    }

    for (let i = 0; i < this._canvases.getSize(); i++) {
      const subdelegate = new LAppSubdelegate();
      subdelegate.initialize(this._canvases.at(i));
      this._subdelegates.pushBack(subdelegate);
    }

    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      if (this._subdelegates.at(i).isContextLost()) {
        CubismLogError(
          `The context for Canvas at index ${i} was lost, possibly because the acquisition limit for WebGLRenderingContext was reached.`
        );
      }
    }
  }

  public changeCharacter(character: ResourceModel | null) {
    // _subdelegates中只有一个画布, 所以设置第一个即可
    this._subdelegates.at(0).changeCharacter(character);
  }

  public getSubdelegate(): csmVector<LAppSubdelegate> {
    return this._subdelegates;
  }

  /**
   * Privateなコンストラクタ
   */
  private constructor() {
    this._cubismOption = new Option();
    this._subdelegates = new csmVector<LAppSubdelegate>();
    this._canvases = new csmVector<HTMLCanvasElement>();
  }

  /**
   * Cubism SDK Option
   */
  private _cubismOption: Option;

  /**
   * 操作対象のcanvas要素
   */
  private _canvases: csmVector<HTMLCanvasElement>;

  /**
   * Subdelegate
   */
  private _subdelegates: csmVector<LAppSubdelegate>;

  /**
   * 帧率控制变量
   */
  private _lastFrameTime: number = 0;
  private _targetFPS: number = 60;
  private _frameInterval: number = 1000 / 60; // 毫秒
  private _isIdle: boolean = false;
  private _idleCheckTime: number = 0;
  private _idleTimeout: number = 5000; // 5秒无交互后进入空闲状态
}

function onPointerBegan(e: PointerEvent): void {
  // 通知活动状态，重置空闲检测
  LAppDelegate.getInstance().notifyActivity();

  for (
    let ite = LAppDelegate.getInstance().getSubdelegate().begin();
    ite.notEqual(LAppDelegate.getInstance().getSubdelegate().end());
    ite.preIncrement()
  ) {
    ite.ptr().onPointBegan(e.pageX, e.pageY);
  }
}

function onPointerMoved(e: PointerEvent): void {
  // 通知活动状态，重置空闲检测
  LAppDelegate.getInstance().notifyActivity();

  for (
    let ite = LAppDelegate.getInstance().getSubdelegate().begin();
    ite.notEqual(LAppDelegate.getInstance().getSubdelegate().end());
    ite.preIncrement()
  ) {
    ite.ptr().onPointMoved(e.pageX, e.pageY);
  }
}

function onPointerEnded(e: PointerEvent): void {
  // 通知活动状态，重置空闲检测
  LAppDelegate.getInstance().notifyActivity();

  for (
    let ite = LAppDelegate.getInstance().getSubdelegate().begin();
    ite.notEqual(LAppDelegate.getInstance().getSubdelegate().end());
    ite.preIncrement()
  ) {
    ite.ptr().onPointEnded(e.pageX, e.pageY);
  }
}

function onPointerCancel(e: PointerEvent): void {
  for (
    let ite = LAppDelegate.getInstance().getSubdelegate().begin();
    ite.notEqual(LAppDelegate.getInstance().getSubdelegate().end());
    ite.preIncrement()
  ) {
    ite.ptr().onTouchCancel(e.pageX, e.pageY);
  }
}