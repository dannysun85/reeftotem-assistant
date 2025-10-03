'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Live2DManager } from '../lib/live2d/Live2DManager';
import { ResourceModel, Live2DConfig, Live2DModelInfo } from '../lib/live2d/types';
import { LIVE2D_CANVAS_ID, LIVE2D_LIPFACTOR_DEFAULT } from '../lib/live2d/constants';
import personaManager, { PersonaConfig } from '../utils/personaManager';

interface Live2DCharacterProps {
    /** Live2D配置 */
    config?: Partial<Live2DConfig>;
    /** 初始角色 */
    initialPersona?: string;
    /** 类名 */
    className?: string;
    /** 样式 */
    style?: React.CSSProperties;
    /** 加载中组件 */
    loadingComponent?: React.ReactNode;
    /** 错误处理 */
    onError?: (error: Error) => void;
    /** 就绪回调 */
    onReady?: () => void;
    /** 角色切换回调 */
    onPersonaChange?: (persona: PersonaConfig | null) => void;
}

/**
 * Live2D 角色组件
 * 提供完整的Live2D功能封装，包括模型加载、音频播放、唇形同步等
 */
export const Live2DCharacter: React.FC<Live2DCharacterProps> = ({
    config = {},
    initialPersona,
    className = '',
    style = {},
    loadingComponent,
    onError,
    onReady,
    onPersonaChange,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const managerRef = useRef<Live2DManager | null>(null);
    const [ready, setReady] = useState(false);
    const [currentPersona, setCurrentPersona] = useState<PersonaConfig | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [personas, setPersonas] = useState<Record<string, PersonaConfig>>({});

    // 合并默认配置
    const live2dConfig: Live2DConfig = {
        canvasId: LIVE2D_CANVAS_ID,
        canvasSize: { width: 300, height: 400 },
        modelPath: '',
        lipSync: true,
        lipFactorMin: 0.0,
        lipFactorMax: 10.0,
        lipFactorDefault: LIVE2D_LIPFACTOR_DEFAULT,
        ...config,
    };

    // 加载角色配置
    const loadPersonas = useCallback(async () => {
        try {
            await personaManager.loadPersonas();
            const personasData = personaManager.getPersonas();
            setPersonas(personasData);

            // 设置初始角色
            const personaId = initialPersona || personaManager.getCurrentPersonaId();
            const persona = personaManager.getPersonaById(personaId);
            if (persona) {
                setCurrentPersona(persona);
                onPersonaChange?.(persona);
            }
        } catch (err) {
            console.error('Failed to load personas:', err);
            setError(err instanceof Error ? err : new Error('Failed to load personas'));
        }
    }, [initialPersona, onPersonaChange]);

    // 初始化Live2D
    const initializeLive2D = useCallback(async () => {
        if (!canvasRef.current) return;

        try {
            const manager = Live2DManager.getInstance();
            managerRef.current = manager;

            const success = await manager.initialize({
                ...live2dConfig,
                canvasId: canvasRef.current.id || live2dConfig.canvasId,
            });

            if (!success) {
                throw new Error('Failed to initialize Live2D');
            }

            // 设置初始角色
            if (currentPersona) {
                const modelInfo: ResourceModel = {
                    resource_id: currentPersona.id,
                    name: currentPersona.name,
                    type: 'CHARACTER' as any,
                    link: currentPersona.modelPath,
                };
                manager.changeCharacter(modelInfo);
            }

            setError(null);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Unknown error');
            setError(error);
            onError?.(error);
        }
    }, [live2dConfig, currentPersona, onError]);

    // 处理角色切换
    const handlePersonaSwitch = useCallback(async (personaId: string) => {
        try {
            const success = await personaManager.switchPersona(personaId);
            if (success) {
                const persona = personaManager.getPersonaById(personaId);
                if (persona) {
                    setCurrentPersona(persona);
                    onPersonaChange?.(persona);

                    // 切换Live2D模型
                    if (managerRef.current) {
                        const modelInfo: ResourceModel = {
                            resource_id: persona.id,
                            name: persona.name,
                            type: 'CHARACTER' as any,
                            link: persona.modelPath,
                        };
                        managerRef.current.changeCharacter(modelInfo);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to switch persona:', err);
        }
    }, [onPersonaChange]);

    // 处理画布大小变化
    const handleResize = useCallback(() => {
        if (live2dConfig.canvasSize === 'auto' && managerRef.current) {
            // 处理画布大小变化
            window.dispatchEvent(new Event('resize'));
        }
    }, [live2dConfig.canvasSize]);

    // 清理资源
    const cleanup = useCallback(() => {
        if (managerRef.current) {
            managerRef.current.dispose();
            managerRef.current = null;
        }
    }, []);

    // 检查就绪状态
    const checkReadyState = useCallback(() => {
        if (managerRef.current && managerRef.current.isReady()) {
            setReady(true);
            onReady?.();
        } else if (!ready) {
            setTimeout(checkReadyState, 1000);
        }
    }, [ready, onReady]);

    // 监听事件
    useEffect(() => {
        const handleSwitchPersona = (event: any) => {
            const personaId = event.payload?.persona;
            if (personaId) {
                handlePersonaSwitch(personaId);
            }
        };

        const handleShowAnimation = () => {
            console.log('Live2D: Show animation triggered');
        };

        const handleHideAnimation = () => {
            console.log('Live2D: Hide animation triggered');
        };

        // 监听来自其他组件的事件
        const unlistenSwitchPersona = window.addEventListener('switch_persona', handleSwitchPersona);
        const unlistenShowAnimation = window.addEventListener('show_animation', handleShowAnimation);
        const unlistenHideAnimation = window.addEventListener('hide_animation', handleHideAnimation);

        return () => {
            window.removeEventListener('switch_persona', handleSwitchPersona);
            window.removeEventListener('show_animation', handleShowAnimation);
            window.removeEventListener('hide_animation', handleHideAnimation);
        };
    }, [handlePersonaSwitch]);

    // 初始化效果
    useEffect(() => {
        loadPersonas();
    }, [loadPersonas]);

    useEffect(() => {
        if (currentPersona) {
            initializeLive2D();
        }
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            cleanup();
        };
    }, [initializeLive2D, handleResize, cleanup, currentPersona]);

    // 检查就绪状态
    useEffect(() => {
        if (!ready && currentPersona) {
            checkReadyState();
        }
    }, [ready, checkReadyState, currentPersona]);

    // 公开的方法ref
    const live2dRef = useRef({
        /** 切换角色 */
        switchPersona: (personaId: string) => {
            handlePersonaSwitch(personaId);
        },
        /** 设置唇形同步参数 */
        setLipFactor: (factor: number) => {
            if (managerRef.current) {
                managerRef.current.setLipFactor(factor);
            }
        },
        /** 获取唇形同步参数 */
        getLipFactor: () => managerRef.current?.getLipFactor() || 0,
        /** 播放音频 */
        playAudio: (audioData: ArrayBuffer) => {
            if (managerRef.current) {
                managerRef.current.pushAudioQueue(audioData);
                return managerRef.current.playAudio();
            }
            return null;
        },
        /** 停止音频 */
        stopAudio: () => {
            if (managerRef.current) {
                managerRef.current.stopAudio();
            }
        },
        /** 检查音频播放状态 */
        isAudioPlaying: () => managerRef.current?.isAudioPlaying() || false,
        /** 检查就绪状态 */
        isReady: () => managerRef.current?.isReady() || false,
        /** 获取可用角色列表 */
        getAvailablePersonas: () => personas,
        /** 获取当前角色 */
        getCurrentPersona: () => currentPersona,
    });

    // 渲染加载组件
    const renderLoading = () => {
        if (loadingComponent) {
            return loadingComponent;
        }

        return (
            <div className="flex items-center justify-center w-full h-full">
                <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span className="text-gray-600">加载Live2D角色中...</span>
                </div>
            </div>
        );
    };

    // 渲染错误状态
    const renderError = () => {
        return (
            <div className="flex items-center justify-center w-full h-full">
                <div className="text-red-500 text-center">
                    <p>Live2D加载失败</p>
                    <p className="text-sm">{error?.message}</p>
                </div>
            </div>
        );
    };

    return (
        <div className={`relative ${className}`} style={style}>
            {/* 错误状态 */}
            {error && renderError()}

            {/* 加载状态 */}
            {!error && !ready && renderLoading()}

            {/* Live2D 画布 */}
            <canvas
                ref={canvasRef}
                id={live2dConfig.canvasId}
                className="w-full h-full"
                style={{
                    visibility: ready ? 'visible' : 'hidden',
                    width: '300px',
                    height: '400px',
                }}
            />

            {/* 通过ref暴露方法给父组件 */}
            {React.createElement('div', {
                ref: live2dRef as any,
                style: { display: 'none' },
            })}
        </div>
    );
};

export default Live2DCharacter;