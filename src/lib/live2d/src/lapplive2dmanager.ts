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
// 导入模型定位诊断工具
import { modelPositionDiagnostic } from '../../../utils/modelPositionDiagnostic';
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
    const { width, height } = this._subdelegate?.getCanvas() ?? { width: 100, height: 100 };

    const projection: CubismMatrix44 = new CubismMatrix44();
    const model: LAppModel = this._models.at(0);
    if (!model) {
      console.warn('LAppLive2DManager.onUpdate: 没有可用的模型');
      return;
    }
    
    if (model.getModel()) {
      // 🔧 修复：移除每帧缩放检查，只在模型加载时应用一次
      // 缩放逻辑已移至 lappmodel.ts 的 setupFromLayout 方法中
      
      // 设置投影矩阵
      if (width < height) {
        projection.scale(1.0, width / height);
      } else {
        projection.scale(height / width, 1.0);
      }

      // 应用视图矩阵
      if (this._viewMatrix != null) {
        projection.multiplyByMatrix(this._viewMatrix);
      }

      // 🩺 模型定位诊断 - 记录绘制前的位置信息（仅在调试模式下）
      if (LAppDefine.DebugLogEnable) {
        try {
          const canvas = this._subdelegate?.getCanvas();
          if (canvas) {
            modelPositionDiagnostic.recordModelPosition(
              this._character?.name || 'Unknown',
              model,
              canvas as HTMLCanvasElement,
              Array.from(projection.getArray()),
              this._viewMatrix ? Array.from(this._viewMatrix.getArray()) : Array(16).fill(0)
            );
          }
        } catch (diagError) {
          console.warn('LAppLive2DManager.onUpdate: 诊断记录失败:', diagError);
        }
      }
    } else {
      console.warn('LAppLive2DManager.onUpdate: 模型未加载');
    }

    try {
      model.update();
      model.draw(projection);
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
    this._subdelegate = undefined;
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
    if (this._character) {
      this.changeCharacter(this._character);
    }
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

    // 检查传入的是完整路径还是目录路径
    let dir: string;
    let modelJsonName: string;

    if (characterLink.endsWith('.model3.json')) {
      // 传入的是完整的.model3.json文件路径
      const lastSlashIndex = characterLink.lastIndexOf('/');
      if (lastSlashIndex !== -1) {
        dir = characterLink.substring(0, lastSlashIndex + 1);
        modelJsonName = characterLink.substring(lastSlashIndex + 1);
      } else {
        dir = './';
        modelJsonName = characterLink;
      }
    } else {
      // 传入的是目录路径，构建文件名
      dir = characterLink.endsWith('/') ? characterLink : characterLink + '/';
      modelJsonName = `${character.name}.model3.json`;
    }

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

    // 🚀 重要修复：等待模型加载完成后再添加到模型列表
    // 保存原始的loadAssets方法
    const originalLoadAssets = instance.loadAssets.bind(instance);

    // 重写loadAssets以确保加载完成后才触发后续操作
    instance.loadAssets = (path: string, fileName: string) => {
      console.log(`LAppLive2DManager.changeCharacter: 开始加载模型 ${fileName}`);

      // 设置加载完成的回调
      const setupCompleteCallbacks = () => {
        if (instance.getModel()) {
          console.log(`✅ LAppLive2DManager.changeCharacter: 模型 ${fileName} 加载成功`);
          this._models.pushBack(instance);
          this._character = character;
          console.log('LAppLive2DManager.changeCharacter: 角色切换完成');

          // 🚀 优化：在模型实际加载完成后处理后续操作
          setTimeout(() => {
            console.log('🚀 LAppLive2DManager.changeCharacter: 模型加载完成后的处理');
            this.adjustWindowSizeToModel();

            // 强制触发重新渲染循环 - 通过通知LAppDelegate有活动
            try {
              // 检查全局LAppDelegate实例（浏览器环境）
              if (typeof window !== 'undefined' && (window as any).LAppDelegate) {
                const appDelegate = (window as any).LAppDelegate.getInstance();
                if (appDelegate && typeof appDelegate.notifyActivity === 'function') {
                  console.log('LAppLive2DManager.changeCharacter: 通知活动状态，重置空闲检测');
                  appDelegate.notifyActivity();
                }
              }
            } catch (error) {
              console.warn('LAppLive2DManager.changeCharacter: 无法通知活动状态:', error);
            }

            // 🚀 修复：模型切换后强制重新应用缩放
            // 确保新加载的模型以正确的尺寸显示
            const model = this._models.at(0);
            if (model && typeof model.reapplyStandardScale === 'function') {
              console.log('🔧 模型切换：重新应用标准缩放');
              model.reapplyStandardScale();
            } else {
              console.warn('⚠️ 无法重新应用缩放：模型不可用或方法不存在');
            }

            // 🚀 额外确保：在模型切换完成后，再次通知活动状态，确保渲染循环活跃
            setTimeout(() => {
              try {
                if (typeof window !== 'undefined' && (window as any).LAppDelegate) {
                  const appDelegate = (window as any).LAppDelegate.getInstance();
                  if (appDelegate && typeof appDelegate.notifyActivity === 'function') {
                    console.log('LAppLive2DManager.changeCharacter: 二次通知活动状态，确保渲染稳定');
                    appDelegate.notifyActivity();
                  }
                }
              } catch (error) {
                console.warn('LAppLive2DManager.changeCharacter: 二次通知活动状态失败:', error);
              }
            }, 200);
          }, 100); // 100ms后开始处理，确保模型完全就绪

        } else {
          console.error(`❌ LAppLive2DManager.changeCharacter: 模型 ${fileName} 加载失败`);
        }
      };

      // 监听模型加载完成
      const checkInterval = setInterval(() => {
        if (instance.getModel()) {
          clearInterval(checkInterval);
          setupCompleteCallbacks();
        }
      }, 100);

      // 超时检查
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!instance.getModel()) {
          console.error(`❌ LAppLive2DManager.changeCharacter: 模型 ${fileName} 加载超时`);
        }
      }, 10000); // 10秒超时

      // 调用原始的loadAssets方法
      return originalLoadAssets(path, fileName);
    };

    instance.loadAssets(dir, modelJsonName);
    console.log('LAppLive2DManager.changeCharacter: loadAssets调用完成（异步加载中）');
  }

  
  /**
   * 模型切换时的位置处理 - 不再调整窗口，直接在当前位置显示
   */
  public adjustWindowSizeToModel(): void {
    const model: LAppModel = this._models.at(0);
    if (!model || !model.getModel()) {
      console.warn('LAppLive2DManager.adjustWindowSizeToModel: 模型未加载，跳过处理');
      return;
    }

    try {
      // 🩺 详细诊断：获取模型实际尺寸信息
      const live2DModel = model.getModel();
      const modelCanvasWidth = live2DModel.getCanvasWidth();
      const modelCanvasHeight = live2DModel.getCanvasHeight();

      console.log(`🩺 LAppLive2DManager.adjustWindowSizeToModel: 模型切换诊断:`);
      console.log(`  - Live2D模型画布尺寸: ${modelCanvasWidth}x${modelCanvasHeight}`);
      console.log(`  - 当前模型名称: ${this._character?.name || 'Unknown'}`);

      // 获取当前画布尺寸
      const { width: currentWidth, height: currentHeight } = this._subdelegate?.getCanvas() ?? { width: 100, height: 100 };
      console.log(`  - 当前画布尺寸: ${currentWidth}x${currentHeight}`);

      // 🚫 不再调整窗口尺寸，使用现有窗口位置
      console.log(`📐 模型切换：保持当前窗口位置不变 (尺寸: ${currentWidth}x${currentHeight})`);

      // 简化处理：不再进行复杂的缩放计算，依赖主渲染逻辑

      // 🩺 记录模型切换后的诊断信息
      if (typeof window !== 'undefined') {
        const canvas = this._subdelegate?.getCanvas();
        if (canvas) {
          modelPositionDiagnostic.recordModelPosition(
            `${this._character?.name || 'Unknown'}_切换后`,
            model,
            canvas as HTMLCanvasElement,
            Array(16).fill(0), // 投影矩阵此时未设置
            this._viewMatrix ? Array.from(this._viewMatrix.getArray()) : Array(16).fill(0)
          );
        }
      }

      // 🚫 移除窗口调整调用，模型切换不再重新定位窗口
      console.log('✅ 模型切换完成，保持当前窗口位置');

    } catch (error) {
      console.error('❌ 模型切换处理失败:', error);
    }
  }

  /**
   * 自身が所属するSubdelegate
   */
  private _subdelegate: LAppSubdelegate | undefined;

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
