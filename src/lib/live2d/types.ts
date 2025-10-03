/**
 * Live2D 相关类型定义
 */

export enum RESOURCE_TYPE {
    BACKGROUND = "BACKGROUND",
    CHARACTER = "CHARACTER",
    VOICE = "VOICE"
}

export enum BACKGROUND_TYPE {
    STATIC = "STATIC",
    DYNAMIC = "DYNAMIC",
    CUSTOM = "CUSTOM",
    ALL = "ALL"
}

export enum CHARACTER_TYPE {
    IP = "IP",
    FREE = "FREE",
    CUSTOM = "CUSTOM",
    ALL = "ALL"
}

export interface ResourceModel {
    resource_id: string;
    name: string;
    type: RESOURCE_TYPE;
    link: string;
}

export interface Live2DModelInfo extends ResourceModel {
    type: RESOURCE_TYPE.CHARACTER;
    characterType: CHARACTER_TYPE;
    modelPath: string;
    texturePaths: string[];
    motions?: {
        [groupName: string]: Array<{
            File: string;
            FadeInTime?: number;
            FadeOutTime?: number;
        }>;
    };
    expressions?: Array<{
        Name: string;
        File: string;
    }>;
    physics?: string;
    pose?: string;
    hitAreas?: Array<{
        Id: string;
        Name: string;
    }>;
}

export interface Live2DConfig {
    canvasId: string;
    canvasSize: { width: number; height: number } | 'auto';
    modelPath: string;
    audioContext?: AudioContext;
    lipSync?: boolean;
    lipFactorMin?: number;
    lipFactorMax?: number;
    lipFactorDefault?: number;
}

export interface Live2DState {
    ready: boolean;
    currentModel: Live2DModelInfo | null;
    isAudioPlaying: boolean;
    lipFactor: number;
}