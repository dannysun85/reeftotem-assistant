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
// Live2DCubismCore 类型已在 Core/live2dcubismcore.d.ts 中声明
declare global {
  var LAppDelegate: any; // 添加全局类型声明
}
// 从正确的位置导入ResourceModel
import { ResourceModel } from '../types';

// 重新导出ResourceModel
export type { ResourceModel };

export let s_instance: LAppDelegate = null;

// 全局单例存储，确保跨模块一致性
declare global {
  var LAppDelegateGlobalInstance: LAppDelegate | null;
}

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
    // 优先使用全局实例，确保跨模块一致性
    if (typeof window !== 'undefined' && (window as any).LAppDelegateGlobalInstance) {
      return (window as any).LAppDelegateGlobalInstance;
    }

    if (s_instance == null) {
      s_instance = new LAppDelegate();

      // 将实例同时设置到模块变量和全局变量，确保跨模块访问
      if (typeof window !== 'undefined') {
        (window as any).LAppDelegateGlobalInstance = s_instance;
        (window as any).LAppDelegate = LAppDelegate;
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

    // 清理全局实例存储
    if (typeof window !== 'undefined') {
      (window as any).LAppDelegateGlobalInstance = null;
      (window as any).LAppDelegate = null;
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
    this._initialized = false;
  }

  /**
   * イベントリスナーを解除する。
   */
  private releaseEventListener(): void {
    document.removeEventListener('pointerdown', onPointerBegan);
    document.removeEventListener('pointermove', onPointerMoved);
    document.removeEventListener('pointerup', onPointerEnded);
    document.removeEventListener('pointercancel', onPointerCancel);
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
    if (this._initialized) {
      return true;
    }

    // Cubism SDKの初期化
    this.initializeCubism();

    this.initializeSubdelegates();
    this.initializeEventListener();

    this._initialized = true;
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
      const canvas = document.getElementById('live2dCanvas') as HTMLCanvasElement | null;
      const fallbackCanvas = document.querySelector('canvas.live2d-canvas') as HTMLCanvasElement | null;
      const targetCanvas = canvas ?? fallbackCanvas;
      if (!targetCanvas) {
        throw new Error('Live2D canvas not found. Ensure the React component has rendered the canvas.');
      }
      if (!canvas && fallbackCanvas) {
        console.warn('live2dCanvas id not found, falling back to .live2d-canvas');
      }
      this._canvases.pushBack(targetCanvas);
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

  public setExpression(expressionName: string): void {
    const model = this.getPrimaryModel();
    if (!model) {
      console.warn('LAppDelegate.setExpression: 当前没有可用模型');
      return;
    }

    const expressionMap = (model as any)._expressions;
    let targetExpression = expressionName;

    if (expressionMap && typeof expressionMap.getSize === 'function') {
      const lowerName = expressionName.toLowerCase();
      let matched: string | null = null;

      for (let i = 0; i < expressionMap.getSize(); i++) {
        const entry = expressionMap._keyValues?.[i];
        if (!entry?.first) continue;
        const key = String(entry.first);
        if (key.toLowerCase() === lowerName) {
          matched = key;
          break;
        }
        if (!matched && key.toLowerCase().includes(lowerName)) {
          matched = key;
        }
      }

      if (matched) {
        targetExpression = matched;
      }
    }

    if (typeof model.setExpression === 'function') {
      model.setExpression(targetExpression);
    } else {
      console.warn('LAppDelegate.setExpression: 模型不支持表情切换');
    }
  }

  public startMotion(motionName: string, motionIndex?: number): void {
    const model = this.getPrimaryModel();
    if (!model) {
      console.warn('LAppDelegate.startMotion: 当前没有可用模型');
      return;
    }

    const modelSetting = (model as any)._modelSetting;
    if (!modelSetting || typeof modelSetting.getMotionCount !== 'function') {
      console.warn('LAppDelegate.startMotion: 模型动作配置不可用');
      return;
    }
    const lowerName = motionName.toLowerCase();
    let targetGroup: string | null = null;

    if (typeof modelSetting.getMotionGroupCount === 'function' &&
        typeof modelSetting.getMotionGroupName === 'function') {
      const groupCount = modelSetting.getMotionGroupCount();
      for (let i = 0; i < groupCount; i++) {
        const groupName = modelSetting.getMotionGroupName(i);
        if (typeof groupName !== 'string') continue;
        if (groupName.toLowerCase() === lowerName) {
          targetGroup = groupName;
          break;
        }
        if (!targetGroup && groupName.toLowerCase().includes(lowerName)) {
          targetGroup = groupName;
        }
      }
    }

    if (!targetGroup && modelSetting.getMotionCount(motionName) > 0) {
      targetGroup = motionName;
    }

    if (!targetGroup && modelSetting.getMotionCount(LAppDefine.MotionGroupTapBody) > 0) {
      targetGroup = LAppDefine.MotionGroupTapBody;
    }
    if (!targetGroup && modelSetting.getMotionCount(LAppDefine.MotionGroupIdle) > 0) {
      targetGroup = LAppDefine.MotionGroupIdle;
    }

    if (!targetGroup) {
      console.warn('LAppDelegate.startMotion: 未找到可用动作组', motionName);
      return;
    }

    // 如果指定了 motionIndex 且在有效范围内，播放指定动作；否则随机播放
    if (motionIndex != null && typeof model.startMotion === 'function') {
      const count = modelSetting.getMotionCount(targetGroup);
      if (motionIndex >= 0 && motionIndex < count) {
        model.startMotion(targetGroup, motionIndex, LAppDefine.PriorityNormal);
        return;
      }
    }

    if (typeof model.startRandomMotion === 'function') {
      model.startRandomMotion(targetGroup, LAppDefine.PriorityNormal);
    }
  }

  public setEyeTracking(x: number, y: number): void {
    const model = this.getPrimaryModel();
    if (!model) {
      return;
    }

    const normalizedX = Math.max(0, Math.min(1, x));
    const normalizedY = Math.max(0, Math.min(1, y));
    const offsetX = (normalizedX - 0.5) * 2;
    const offsetY = (0.5 - normalizedY) * 2;

    const modelAny = model as any;
    if (modelAny._dragManager && typeof modelAny._dragManager.set === 'function') {
      modelAny._dragManager.set(offsetX, offsetY);
    }
  }

  public setLipSync(value: number): void {
    const model = this.getPrimaryModel();
    if (!model || !model.getModel()) {
      return;
    }

    const coreModel = model.getModel();
    const normalized = Math.max(0, Math.min(1, value));
    const lipSyncIds = (model as any)._lipSyncIds;

    if (!lipSyncIds || typeof lipSyncIds.getSize !== 'function') {
      return;
    }

    for (let i = 0; i < lipSyncIds.getSize(); i++) {
      try {
        coreModel.addParameterValueById(lipSyncIds.at(i), normalized, 0.8);
      } catch (error) {
        console.warn('LAppDelegate.setLipSync: 设置口型失败', error);
      }
    }
  }

  public getSubdelegate(): csmVector<LAppSubdelegate> {
    return this._subdelegates;
  }

  private getPrimaryModel(): any | null {
    const subdelegate = this._subdelegates.getSize() > 0 ? this._subdelegates.at(0) : null;
    if (!subdelegate) {
      return null;
    }

    const live2dManager = subdelegate.getLive2DManager?.();
    if (!live2dManager || !live2dManager._models || live2dManager._models.getSize() === 0) {
      return null;
    }

    const model = live2dManager._models.at(0);
    if (!model || !model.getModel?.()) {
      return null;
    }

    return model;
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
  private _initialized: boolean = false;
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
