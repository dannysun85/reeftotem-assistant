import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';

export class WindowManager {
  private static live2dWindow: WebviewWindow | null = null;

  /**
   * 获取Live2D窗口实例
   */
  public static async getLive2DWindow(): Promise<WebviewWindow> {
    if (!this.live2dWindow) {
      // 计算右下角位置
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const windowWidth = 300;
      const windowHeight = 400;
      const x = screenWidth - windowWidth - 50; // 距离右边缘50px
      const y = screenHeight - windowHeight - 50; // 距离底部边缘50px

      this.live2dWindow = new WebviewWindow('live2d', {
        url: '/live2d-window.html',
        width: windowWidth,
        height: windowHeight,
        x: x,
        y: y,
        decorations: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        center: false, // 不居中，使用指定位置
        visible: true  // 窗口创建时默认可见
      });
    }

    return this.live2dWindow;
  }

  /**
   * 显示Live2D窗口
   */
  public static async showWindow(): Promise<void> {
    const window = await this.getLive2DWindow();
    // 窗口创建时已经可见，只需要设置焦点
    try {
      await window.setFocus();
    } catch (error) {
      console.log('SetFocus not available, but window should be visible');
    }
  }

  /**
   * 隐藏Live2D窗口
   */
  public static async hideWindow(): Promise<void> {
    // 关闭窗口而不是隐藏，避免权限问题
    await this.closeWindow();
  }

  /**
   * 切换窗口可见性
   */
  public static async toggleWindow(): Promise<void> {
    const exists = await this.windowExists();
    if (exists) {
      await this.hideWindow();
    } else {
      await this.showWindow();
    }
  }

  /**
   * 设置窗口位置
   */
  public static async setPosition(x: number, y: number): Promise<void> {
    try {
      const window = await this.getLive2DWindow();
      await window.setPosition(new PhysicalPosition(x, y));
    } catch (error) {
      console.log('SetPosition not available:', error);
    }
  }

  /**
   * 获取窗口位置
   */
  public static async getPosition(): Promise<{ x: number; y: number }> {
    try {
      const window = await this.getLive2DWindow();
      const position = await window.outerPosition();
      return { x: position.x, y: position.y };
    } catch (error) {
      console.log('GetPosition not available, returning default:', error);
      return { x: 100, y: 100 }; // 返回默认位置
    }
  }

  /**
   * 设置窗口大小
   */
  public static async setSize(width: number, height: number): Promise<void> {
    try {
      const window = await this.getLive2DWindow();
      await window.setSize(new PhysicalSize(width, height));
    } catch (error) {
      console.log('SetSize not available:', error);
    }
  }

  /**
   * 切换置顶状态
   */
  public static async toggleAlwaysOnTop(): Promise<boolean> {
    try {
      const window = await this.getLive2DWindow();
      const currentAlwaysOnTop = await window.isAlwaysOnTop();
      await window.setAlwaysOnTop(!currentAlwaysOnTop);
      return !currentAlwaysOnTop;
    } catch (error) {
      console.log('ToggleAlwaysOnTop not available:', error);
      return true; // 默认返回置顶状态
    }
  }

  /**
   * 关闭窗口
   */
  public static async closeWindow(): Promise<void> {
    if (this.live2dWindow) {
      await this.live2dWindow.close();
      this.live2dWindow = null;
    }
  }

  /**
   * 检查窗口是否存在
   */
  public static async windowExists(): Promise<boolean> {
    return this.live2dWindow !== null;
  }
}