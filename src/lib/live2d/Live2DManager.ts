/**
 * Live2D 管理器 - 完整版本，基于live2d-migration
 * 负责Live2D模型的生命周期管理、音频播放、唇形同步等功能
 */
import { LAppDelegate } from './src/lappdelegate';
import type { ResourceModel } from './src/lappdelegate';
import { Live2DConfig } from './types';
import * as LAppDefine from './src/lappdefine';

export interface ILive2DManager {
    initialize(config: Live2DConfig): Promise<boolean>;
    changeCharacter(character: ResourceModel | null): void;
    setLipFactor(weight: number): void;
    getLipFactor(): number;
    setExternalLipSync(value: number): void;
    getExternalLipSyncValue(): number;
    pushAudioQueue(audioData: ArrayBuffer): void;
    popAudioQueue(): ArrayBuffer | null;
    clearAudioQueue(): void;
    playAudio(): ArrayBuffer | null;
    stopAudio(): void;
    isAudioPlaying(): boolean;
    isReady(): boolean;
    setReady(ready: boolean): void;
    dispose(): void;
}

export class Live2DManager implements ILive2DManager {
    private static _instance: Live2DManager | null = null;
    private _ttsQueue: ArrayBuffer[] = [];
    private _audioContext: AudioContext;
    private _audioIsPlaying: boolean;
    private _audioSource: AudioBufferSourceNode | null;
    private _lipFactor: number;
    private _externalLipSyncValue: number;
    private _ready: boolean;
    private _config: Live2DConfig | null = null;
    private _lAppDelegate: LAppDelegate | null = null;

    private constructor() {
        this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        this._audioIsPlaying = false;
        this._audioSource = null;
        this._lipFactor = 1.0;
        this._externalLipSyncValue = 0;
        this._ready = false;
    }

    /**
     * 获取单例实例
     */
    public static getInstance(): Live2DManager {
        if (!this._instance) {
            this._instance = new Live2DManager();
        }
        return this._instance;
    }

    /**
     * 初始化Live2D系统
     */
    public async initialize(config: Live2DConfig): Promise<boolean> {
        this._config = config;

        try {
            if (LAppDefine.DebugLogEnable) {
                console.log('Initializing Live2D with config:', config);
            }

            // 初始化音频上下文
            if (this._audioContext.state === 'suspended') {
                await this._audioContext.resume();
            }

            // 初始化Live2D框架
            // 等待Live2D依赖加载完成
            await this.waitForLive2DDependencies();

            this._lAppDelegate = LAppDelegate.getInstance();
            const success = this._lAppDelegate.initialize();

            if (success) {
                // 异步启动渲染循环，避免阻塞initialize方法
                setTimeout(() => {
                    this._lAppDelegate!.run();
                }, 0);
            } else {
                console.error('Live2DManager: LAppDelegate初始化失败');
            }

            return success;
        } catch (error) {
            console.error('Live2D initialization failed:', error);
            return false;
        }
    }

    /**
     * 等待Live2D依赖加载完成
     */
    private async waitForLive2DDependencies(): Promise<void> {
        const maxWaitTime = 10000; // 最多等待10秒
        const checkInterval = 100; // 每100ms检查一次
        let waitTime = 0;

        while (waitTime < maxWaitTime) {
            // 检查Live2D Core
            if (!(window as any).Live2DCubismCore) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                waitTime += checkInterval;
                continue;
            }

            // 检查PIXI.js
            if (!(window as any).PIXI) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                waitTime += checkInterval;
                continue;
            }

            // 检查LAppDelegate是否可用（通过全局变量或类检查）
            const hasLAppDelegate = !!(window as any).LAppDelegate || typeof LAppDelegate !== 'undefined';
            if (!hasLAppDelegate) {
                await new Promise(resolve => setTimeout(resolve, checkInterval));
                waitTime += checkInterval;
                continue;
            }

            return;
        }

        // 如果等待超时，抛出错误
        throw new Error(`Live2D依赖加载超时 (${maxWaitTime}ms)`);
    }

    /**
     * 设置就绪状态
     */
    public setReady(ready: boolean): void {
        this._ready = ready;
    }

    /**
     * 检查是否就绪
     */
    public isReady(): boolean {
        return this._ready;
    }

    /**
     * 切换角色
     */
    public changeCharacter(character: ResourceModel | null): void {
        this._ready = false;

        if (character && this._lAppDelegate) {
            this._lAppDelegate.changeCharacter(character);
            if (LAppDefine.DebugLogEnable) {
                console.log('Changed character to:', character.name);
            }
        }

        // 检查就绪状态
        this.checkReadyState();
    }

    /**
     * 设置唇形同步参数
     */
    public setLipFactor(weight: number): void {
        this._lipFactor = Math.max(0.0, Math.min(10.0, weight));
    }

    /**
     * 获取当前唇形同步参数
     */
    public getLipFactor(): number {
        return this._lipFactor;
    }

    /**
     * 设置外部口型同步值 (0.0 ~ 1.0)
     * 用于从其他窗口（如主窗口的 TTS）驱动口型
     */
    public setExternalLipSync(value: number): void {
        const prev = this._externalLipSyncValue;
        this._externalLipSyncValue = Math.max(0, Math.min(1, value));
        // 状态变化时打印日志（开始/结束）
        if (prev === 0 && value > 0) {
            console.log('[LipSync] 外部口型同步开始, value:', value.toFixed(2));
        } else if (prev > 0 && value === 0) {
            console.log('[LipSync] 外部口型同步结束');
        }
    }

    /**
     * 获取外部口型同步值
     */
    public getExternalLipSyncValue(): number {
        return this._externalLipSyncValue;
    }

    /**
     * 添加音频到播放队列
     */
    public pushAudioQueue(audioData: ArrayBuffer): void {
        this._ttsQueue.push(audioData);
    }

    /**
     * 从队列中取出音频数据
     */
    public popAudioQueue(): ArrayBuffer | null {
        if (this._ttsQueue.length > 0) {
            const audioData = this._ttsQueue.shift();
            return audioData || null;
        }
        return null;
    }

    /**
     * 清空音频队列
     */
    public clearAudioQueue(): void {
        this._ttsQueue = [];
    }

    /**
     * 播放队列中的音频
     */
    public playAudio(): ArrayBuffer | null {
        if (this._audioIsPlaying) return null;

        const audioData = this.popAudioQueue();
        if (audioData == null) return null;

        this._audioIsPlaying = true;

        const playAudioBuffer = (buffer: AudioBuffer) => {
            const source = this._audioContext.createBufferSource();
            source.buffer = buffer;

            source.connect(this._audioContext.destination);

            source.onended = () => {
                this._audioIsPlaying = false;
                this._audioSource = null;
            };

            source.start();
            this._audioSource = source;
        };

        // 创建新的ArrayBuffer以避免原始数据被释放
        const newAudioData = audioData.slice(0);
        this._audioContext.decodeAudioData(newAudioData).then(
            buffer => {
                playAudioBuffer(buffer);
            }
        ).catch(error => {
            console.error('Audio decode failed:', error);
            this._audioIsPlaying = false;
        });

        return audioData;
    }

    /**
     * 停止播放音频
     */
    public stopAudio(): void {
        this.clearAudioQueue();
        if (this._audioSource) {
            try {
                this._audioSource.stop();
            } catch {
                // AudioBufferSourceNode 可能已停止，忽略 InvalidStateError
            }
            this._audioSource = null;
        }
        this._audioIsPlaying = false;
    }

    /**
     * 检查是否正在播放音频
     */
    public isAudioPlaying(): boolean {
        return this._audioIsPlaying;
    }

    /**
     * 检查就绪状态
     */
    private checkReadyState(): void {
        const checkReady = () => {
            if (this._lAppDelegate && this._lAppDelegate.getSubdelegate().getSize() > 0) {
                const subdelegate = this._lAppDelegate.getSubdelegate().at(0);
                if (subdelegate && subdelegate.getLive2DManager()._models.getSize() > 0) {
                    this._ready = true;
                    if (LAppDefine.DebugLogEnable) {
                        console.log('Live2D is ready');
                    }
                    return;
                }
            }

            if (!this._ready) {
                setTimeout(checkReady, 1000);
            }
        };

        checkReady();
    }

    /**
     * 释放资源
     */
    public dispose(): void {
        this.stopAudio();
        this._ready = false;

        // 关闭 AudioContext 释放系统音频资源
        if (this._audioContext && this._audioContext.state !== 'closed') {
            this._audioContext.close().catch((e) => {
                console.warn('AudioContext close failed:', e);
            });
        }

        if (this._lAppDelegate) {
            LAppDelegate.releaseInstance();
            this._lAppDelegate = null;
        }

        // 重置单例
        Live2DManager._instance = null;
    }

    /**
     * 获取当前配置
     */
    public getConfig(): Live2DConfig | null {
        return this._config;
    }

    /**
     * 获取音频上下文
     */
    public getAudioContext(): AudioContext {
        return this._audioContext;
    }
}

// 导出单例获取函数
export const getLive2DManager = (): Live2DManager => {
    return Live2DManager.getInstance();
};