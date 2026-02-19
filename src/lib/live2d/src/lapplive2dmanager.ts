/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from '../Framework/src/math/cubismmatrix44';
import { ACubismMotion } from '../Framework/src/motion/acubismmotion';
import { csmVector } from '../Framework/src/type/csmvector';

import * as LAppDefine from './lappdefine';
import { LAppModel } from './lappmodel';
import { LAppPal } from './lapppal';
import { LAppSubdelegate } from './lappsubdelegate';
import { ResourceModel } from './lappdelegate';

/**
 * サンプルアプリケーションにおいてCubismModelを管理するクラス
 * モデル生成と破棄、タップイベントの処理、モデル切り替えを行う。
 */
export class LAppLive2DManager {
  /**
   * 現在のシーンで保持しているすべてのモデルを解放する
   */
  private releaseAllModel(): void {
    this._models.clear();
  }

  /**
   * 画面をドラッグした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onDrag(x: number, y: number): void {
    const model: LAppModel = this._models.at(0);
    if (model) {
      model.setDragging(x, y);
    }
  }

  /**
   * 画面をタップした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onTap(x: number, y: number): void {
    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(
        `[APP]tap point: {x: ${x.toFixed(2)} y: ${y.toFixed(2)}}`
      );
    }

  }

  /**
   * 画面を更新するときの処理
   * モデルの更新処理及び描画処理を行う
   */
  public onUpdate(): void {
    const canvas = this._subdelegate?.getCanvas();
    const { width, height } = canvas ?? { width: 100, height: 100 };

    const projection: CubismMatrix44 = new CubismMatrix44();
    const model: LAppModel = this._models.at(0);
    if (!model) {
      return;
    }

    if (model.getModel()) {
      // 投影矩阵：始终以填满高度为优先
      //
      // modelMatrix.setHeight(2.0) 后（无 setCenterPosition）:
      //   模型空间 Y 范围: [-1, 1]
      //   模型空间 X 范围: [-cw/ch, cw/ch]
      //
      // Py = MODEL_FILL 让模型填满视口高度的 85%
      // Px = MODEL_FILL * height/width 保持宽高比不变形
      // 宽画布模型（如 Rice）两侧可能被裁切，但角色居中所以效果正常
      const MODEL_FILL = 0.85;
      projection.scale(MODEL_FILL * height / width, MODEL_FILL);

      if (this._viewMatrix != null) {
        projection.multiplyByMatrix(this._viewMatrix);
      }
    }

    try {
      model.update();
      model.draw(projection);
    } catch (error) {
      console.error('LAppLive2DManager.onUpdate: 模型更新或绘制失败:', error);
    }
  }

  public setViewMatrix(m: CubismMatrix44) {
    for (let i = 0; i < 16; i++) {
      this._viewMatrix.getArray()[i] = m.getArray()[i];
    }
  }

  /**
   * コンストラクタ
   */
  public constructor() {
    this._subdelegate = undefined;
    this._viewMatrix = new CubismMatrix44();
    this._models = new csmVector<LAppModel>();
    this._character = null;
  }

  /**
   * 解放する。
   */
  public release(): void {}

  /**
   * 初期化する。
   * @param subdelegate
   */
  public initialize(subdelegate: LAppSubdelegate): void {
    this._subdelegate = subdelegate;
    if (this._character) {
      this.changeCharacter(this._character);
    }
  }

  public changeCharacter(character: ResourceModel | null) {
    if (character == null) {
      this.releaseAllModel();
      return;
    }

    const characterLink = character.link;

    // 解析模型路径
    let dir: string;
    let modelJsonName: string;

    if (characterLink.endsWith('.model3.json')) {
      const lastSlashIndex = characterLink.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        dir = characterLink.substring(0, lastSlashIndex + 1);
        modelJsonName = characterLink.substring(lastSlashIndex + 1);
      } else {
        dir = './';
        modelJsonName = characterLink;
      }
    } else {
      dir = characterLink.endsWith('/') ? characterLink : characterLink + '/';
      modelJsonName = `${character.name}.model3.json`;
    }

    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(`[APP]model json: ${dir}${modelJsonName}`);
    }

    this.releaseAllModel();
    const instance = new LAppModel();
    instance.setSubdelegate(this._subdelegate);

    // 等待模型加载完成后再添加到渲染列表
    const originalLoadAssets = instance.loadAssets.bind(instance);

    instance.loadAssets = (path: string, fileName: string) => {
      const onModelReady = () => {
        this._models.pushBack(instance);
        this._character = character;

        // 延迟处理：确保模型完全就绪
        setTimeout(() => {
          this.adjustWindowSizeToModel();

          // 重新应用标准缩放
          const model = this._models.at(0);
          if (model && typeof model.reapplyStandardScale === 'function') {
            model.reapplyStandardScale();
          }

          // 通知渲染循环活动
          this._notifyActivity();
        }, 100);
      };

      // 轮询检查模型加载完成
      const checkInterval = setInterval(() => {
        if (instance.getModel()) {
          clearInterval(checkInterval);
          onModelReady();
        }
      }, 100);

      // 10秒超时
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!instance.getModel()) {
          console.error(`模型加载超时: ${fileName}`);
        }
      }, 10000);

      return originalLoadAssets(path, fileName);
    };

    instance.loadAssets(dir, modelJsonName);
  }

  private _notifyActivity(): void {
    try {
      if (typeof window !== 'undefined' && (window as any).LAppDelegate) {
        const appDelegate = (window as any).LAppDelegate.getInstance();
        if (appDelegate && typeof appDelegate.notifyActivity === 'function') {
          appDelegate.notifyActivity();
        }
      }
    } catch {
      // 忽略
    }
  }

  
  /**
   * 模型切换时调整窗口尺寸以匹配模型比例
   *
   * 窗口宽度 = 高度 × 模型画布宽高比 / CANVAS_FILL
   * 这样投影可以让模型填满窗口高度的100%，同时留出安全边距给超出画布的部件
   */
  public adjustWindowSizeToModel(): void {
    const model: LAppModel = this._models.at(0);
    if (!model || !model.getModel()) {
      return;
    }

    try {
      const live2DModel = model.getModel();
      const modelCanvasWidth = live2DModel.getCanvasWidth();
      const modelCanvasHeight = live2DModel.getCanvasHeight();
      const modelRatio = modelCanvasWidth / modelCanvasHeight;

      // 窗口高度固定 500 逻辑像素
      const FIXED_HEIGHT = 500;
      const MIN_WIDTH = 280;
      const MAX_WIDTH = 600;

      // 窗口宽度根据模型画布宽高比自适应
      // 竖向画布: 窗口稍宽于模型 (× 1.2 留边距)
      // 横向画布: 按实际比例设定，由 MAX_WIDTH 限制上限
      let targetWidth = FIXED_HEIGHT;
      if (Number.isFinite(modelRatio) && modelRatio > 0) {
        targetWidth = Math.round(FIXED_HEIGHT * modelRatio * 1.2);
      }
      targetWidth = Math.max(MIN_WIDTH, Math.min(targetWidth, MAX_WIDTH));

      // 通过 Tauri 调整窗口
      if (typeof window !== 'undefined' &&
          (('__TAURI__' in window) || ('__TAURI_INTERNALS__' in window) || ('__TAURI_METADATA__' in window))) {
        import('@tauri-apps/api/core')
          .then(({ invoke }) => invoke('resize_live2d_window', {
            width: targetWidth,
            height: FIXED_HEIGHT
          }))
          .catch((error) => {
            console.warn('adjustWindowSizeToModel: 窗口尺寸调整失败', error);
          });
      }

    } catch (error) {
      console.error('模型窗口调整失败:', error);
    }
  }

  /**
   * 自身が所属するSubdelegate
   */
  private _subdelegate: LAppSubdelegate | undefined;

  _viewMatrix: CubismMatrix44; // モデル描画に用いるview行列
  _models: csmVector<LAppModel>; // モデルインスタンスのコンテナ
  private _character: ResourceModel | null;

  // モーション再生開始のコールバック関数
  beganMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Began');
  };
  // モーション再生終了のコールバック関数
  finishedMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Finished');
  };
}
