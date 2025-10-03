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
// 导入ResourceModel从lappdelegate
import { ResourceModel } from './lappdelegate';
// 注意：移除了path模块导入，因为在浏览器环境中不可用

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

    // const model: LAppModel = this._models.at(0);
    // if (!model) return;
    // if (model.hitTest(LAppDefine.HitAreaNameHead, x, y)) {
    //   if (LAppDefine.DebugLogEnable) {
    //     LAppPal.printMessage(`[APP]hit area: [${LAppDefine.HitAreaNameHead}]`);
    //   }
    //   model.setRandomExpression();
    // } else if (model.hitTest(LAppDefine.HitAreaNameBody, x, y)) {
    //   if (LAppDefine.DebugLogEnable) {
    //     LAppPal.printMessage(`[APP]hit area: [${LAppDefine.HitAreaNameBody}]`);
    //   }
    //   model.startRandomMotion(
    //     LAppDefine.MotionGroupTapBody,
    //     LAppDefine.PriorityNormal,
    //     this.finishedMotion,
    //     this.beganMotion
    //   );
    // }
  }

  /**
   * 画面を更新するときの処理
   * モデルの更新処理及び描画処理を行う
   */
  public onUpdate(): void {
    const { width, height } = this._subdelegate.getCanvas();
    console.log('LAppLive2DManager.onUpdate: Canvas尺寸:', width, 'x', height);
    console.log('LAppLive2DManager.onUpdate: 模型数量:', this._models.getSize());

    const projection: CubismMatrix44 = new CubismMatrix44();
    const model: LAppModel = this._models.at(0);
    if (!model) {
      console.warn('LAppLive2DManager.onUpdate: 没有可用的模型');
      return;
    }
    if (model.getModel()) {
      console.log('LAppLive2DManager.onUpdate: 模型已加载，开始设置投影矩阵');
      if (model.getModel().getCanvasWidth() > 1.0 && width < height) {
        // 横に長いモデルを縦長ウィンドウに表示する際モデルの横サイズでscaleを算出する
        model.getModelMatrix().setWidth(2.0);
        projection.scale(1.0, width / height);
        console.log('LAppLive2DManager.onUpdate: 使用横向投影矩阵');
      } else {
        projection.scale(height / width, 1.0);
        console.log('LAppLive2DManager.onUpdate: 使用纵向投影矩阵');
      }

      // 必要があればここで乗算
      if (this._viewMatrix != null) {
        projection.multiplyByMatrix(this._viewMatrix);
        console.log('LAppLive2DManager.onUpdate: 应用视图矩阵');
      }
    } else {
      console.warn('LAppLive2DManager.onUpdate: 模型未加载');
    }

    try {
      console.log('LAppLive2DManager.onUpdate: 开始更新模型');
      model.update();
      console.log('LAppLive2DManager.onUpdate: 开始绘制模型');
      model.draw(projection); // 参照渡しなのでprojectionは変質する。
      console.log('LAppLive2DManager.onUpdate: 模型绘制完成');
    } catch (error) {
      console.error('LAppLive2DManager.onUpdate: 模型更新或绘制失败:', error);
    }
  }

  /**
   * 次のシーンに切りかえる
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   */
  // public nextScene(): void {
  //   const no: number = (this._sceneIndex + 1) % LAppDefine.ModelDirSize;
  //   this.changeScene(no);
  // }

  /**
   * シーンを切り替える
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   * @param index
   */
  // private changeScene(index: number): void {
  //   this._sceneIndex = index;

  //   if (LAppDefine.DebugLogEnable) {
  //     LAppPal.printMessage(`[APP]model index: ${this._sceneIndex}`);
  //   }

  //   // ModelDir[]に保持したディレクトリ名から
  //   // model3.jsonのパスを決定する。
  //   // ディレクトリ名とmodel3.jsonの名前を一致させておくこと。
  //   const model: string = LAppDefine.ModelDir[index];
  //   const modelPath: string = LAppDefine.ResourcesPath + model + '/';
  //   let modelJsonName: string = LAppDefine.ModelDir[index];
  //   modelJsonName += '.model3.json';

  //   this.releaseAllModel();
  //   const instance = new LAppModel();
  //   instance.setSubdelegate(this._subdelegate);
  //   instance.loadAssets(modelPath, modelJsonName);
  //   this._models.pushBack(instance);
  // }

  public setViewMatrix(m: CubismMatrix44) {
    for (let i = 0; i < 16; i++) {
      this._viewMatrix.getArray()[i] = m.getArray()[i];
    }
  }

  /**
   * モデルの追加
   */
  // public addModel(sceneIndex: number = 0): void {
  //   this._sceneIndex = sceneIndex;
  //   this.changeScene(this._sceneIndex);
  // }

  /**
   * コンストラクタ
   */
  public constructor() {
    this._subdelegate = null;
    this._viewMatrix = new CubismMatrix44();
    this._models = new csmVector<LAppModel>();
    this._character = null;
    // this._sceneIndex = 0;
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
    this.changeCharacter(this._character);
  }

  public changeCharacter(character: ResourceModel | null) {
    console.log('LAppLive2DManager.changeCharacter: 开始切换角色', character);
    if (character == null) {
      console.log('LAppLive2DManager.changeCharacter: 角色为null，释放所有模型');
      this.releaseAllModel();
      return;
    }

    // 使用浏览器兼容的路径处理方式
    const characterLink = character.link;
    console.log('LAppLive2DManager.changeCharacter: 角色链接:', characterLink);

    // 提取目录路径 - 使用字符串操作代替path.dirname
    const lastSlashIndex = characterLink.lastIndexOf('/');
    let dir: string;
    if (lastSlashIndex !== -1) {
      dir = characterLink.substring(0, lastSlashIndex + 1);
    } else {
      dir = './'; // 如果没有路径分隔符，使用当前目录
    }

    let modelJsonName: string = `${character.name}.model3.json`;
    console.log(`LAppLive2DManager.changeCharacter: 目录=${dir}, 文件=${modelJsonName}`);

    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(`[APP]model json: ${modelJsonName}`);
    }

    this.releaseAllModel();
    console.log('LAppLive2DManager.changeCharacter: 创建新的LAppModel实例');
    const instance = new LAppModel();
    console.log('LAppLive2DManager.changeCharacter: LAppModel实例创建完成');
    instance.setSubdelegate(this._subdelegate);
    console.log('LAppLive2DManager.changeCharacter: 开始调用loadAssets');
    instance.loadAssets(dir, modelJsonName);
    console.log('LAppLive2DManager.changeCharacter: loadAssets调用完成');
    this._models.pushBack(instance);
    this._character = character;
    console.log('LAppLive2DManager.changeCharacter: 角色切换完成');

    // 延迟获取模型边界框并调整窗口
    setTimeout(() => {
      this.adjustWindowSizeToModel();
    }, 3000);
  }

  /**
   * 根据模型边界框调整窗口尺寸
   */
  public adjustWindowSizeToModel(): void {
    const model: LAppModel = this._models.at(0);
    if (!model || !model.getModel()) {
      return;
    }

    try {
      // 获取模型的Canvas宽高信息
      const modelCanvasWidth = model.getModel().getCanvasWidth();
      const modelCanvasHeight = model.getModel().getCanvasHeight();

      // 基础尺寸 - 超紧凑设置
      let modelWidth = 140;
      let modelHeight = 220;

      // 根据Canvas比例调整
      if (modelCanvasWidth > 0 && modelCanvasHeight > 0) {
        const aspectRatio = modelCanvasWidth / modelCanvasHeight;
        if (aspectRatio > 1) {
          // 横向较宽的模型 - 更严格控制宽度
          modelWidth = Math.min(180, 140 * aspectRatio);
          modelHeight = modelWidth / aspectRatio;
        } else {
          // 纵向较长的模型 - 严格控制高度
          modelHeight = Math.min(260, 220 / aspectRatio);
          modelWidth = modelHeight * aspectRatio;
        }
      }

      // 超小边距 - 几乎无留白
      modelWidth += 5;
      modelHeight += 5;

      // 确保最小尺寸 - 超紧凑最小尺寸
      modelWidth = Math.max(modelWidth, 100);
      modelHeight = Math.max(modelHeight, 160);

      console.log(`LAppLive2DManager.adjustWindowSizeToModel: 调整窗口尺寸到 ${modelWidth}x${modelHeight}`);

      // 调用Tauri命令调整窗口
      if (window.__TAURI__?.invoke) {
        window.__TAURI__.invoke('resize_live2d_window', {
          width: Math.round(modelWidth),
          height: Math.round(modelHeight)
        });
      }
    } catch (error) {
      console.error('调整窗口尺寸失败:', error);
    }
  }

  /**
   * 自身が所属するSubdelegate
   */
  private _subdelegate: LAppSubdelegate;

  _viewMatrix: CubismMatrix44; // モデル描画に用いるview行列
  _models: csmVector<LAppModel>; // モデルインスタンスのコンテナ
  // private _sceneIndex: number; // 表示するシーンのインデックス値
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
