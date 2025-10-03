/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

/**
 * プラットフォーム依存機能を抽象化する Cubism Platform Abstraction Layer.
 *
 * ファイル読み込みや時刻取得等のプラットフォームに依存する関数をまとめる。
 */
export class LAppPal {
  /**
   * ファイルをバイトデータとして読みこむ
   *
   * @param filePath 読み込み対象ファイルのパス
   * @return
   * {
   *      buffer,   読み込んだバイトデータ
   *      size        ファイルサイズ
   * }
   */
  public static loadFileAsBytes(
    filePath: string,
    callback: (arrayBuffer: ArrayBuffer, size: number) => void
  ): void {
    fetch(filePath)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => callback(arrayBuffer, arrayBuffer.byteLength));
  }

  /**
   * デルタ時間（前回フレームとの差分）を取得する
   * @return デルタ時間[ms]
   */
  public static getDeltaTime(): number {
    return this.deltaTime;
  }

  public static updateTime(): void {
    this.currentFrame = Date.now();
    this.deltaTime = (this.currentFrame - this.lastFrame) / 1000;
    this.lastFrame = this.currentFrame;
  }

  /**
   * メッセージを出力する
   * @param message 文字列
   */
  public static printMessage(message: string): void {
    console.log(message);
  }

  /**
   * ファイルからByteデータを読み込む
   * @param filePath ファイルパス
   * @param callback 読み込み完了時のコールバック関数
   */
  public static moveFileData(filePath: string, callback: (arrayBuffer: ArrayBuffer) => void): void {
    console.log(`LAppPal.moveFileData: 加载文件 ${filePath}`);
    fetch(filePath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.arrayBuffer();
      })
      .then(arrayBuffer => {
        console.log(`LAppPal.moveFileData: 成功加载文件，大小: ${arrayBuffer.byteLength} bytes`);
        callback(arrayBuffer);
      })
      .catch(error => {
        console.error(`LAppPal.moveFileData: 加载文件失败 ${filePath}`, error);
      });
  }

  /**
   * ファイルパスを作成する
   * @param basePath 基本パス
   * @param fileName ファイル名
   * @return 完全なファイルパス
   */
  public static createFilePath(basePath: string, fileName: string): string {
    // スラッシュで終わっているかチェック
    if (basePath.endsWith('/')) {
      return basePath + fileName;
    } else {
      return basePath + '/' + fileName;
    }
  }

  /**
   * ファイルからArrayBufferとして読み込む
   * @param filePath ファイルパス
   * @return Promise<ArrayBuffer>
   */
  public static createFileArrayBuffer(filePath: string): Promise<ArrayBuffer> {
    console.log(`LAppPal.createFileArrayBuffer: 加载文件 ${filePath}`);
    return fetch(filePath)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.arrayBuffer();
      })
      .then(arrayBuffer => {
        console.log(`LAppPal.createFileArrayBuffer: 成功加载文件，大小: ${arrayBuffer.byteLength} bytes`);
        return arrayBuffer;
      })
      .catch(error => {
        console.error(`LAppPal.createFileArrayBuffer: 加载文件失败 ${filePath}`, error);
        throw error;
      });
  }

  static lastUpdate = Date.now();

  static currentFrame = 0.0;
  static lastFrame = 0.0;
  static deltaTime = 0.0;

  /**
   * 获取Canvas元素
   * @param canvasId Canvas元素的ID
   * @return Canvas元素
   */
  public static getCanvasElement(canvasId: string): HTMLCanvasElement | null {
    console.log(`LAppPal.getCanvasElement: 查找Canvas元素，ID: ${canvasId}`);
    const element = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!element) {
      console.error(`LAppPal.getCanvasElement: Canvas元素未找到: ${canvasId}`);
      return null;
    }
    console.log(`LAppPal.getCanvasElement: Canvas元素找到:`, element);
    return element;
  }

  /**
   * 创建目录（在浏览器环境中不适用）
   * @param path 目录路径
   * @return 是否成功（总是返回true，因为浏览器不需要创建目录）
   */
  public static createDirectory(path: string): boolean {
    console.log(`LAppPal.createDirectory: 创建目录 ${path} (浏览器环境，无需操作)`);
    return true;
  }

  /**
   * 获取当前时间戳
   * @return 当前时间戳（毫秒）
   */
  public static getCurrentTime(): number {
    return Date.now();
  }
}
