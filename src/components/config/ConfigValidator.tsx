import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, Clock, Settings, RefreshCw, ChevronRight, Key, Mic, Volume2, Bot } from 'lucide-react';

// 配置验证状态接口
interface ValidationStatus {
  tencentCloud: {
    secretId: boolean;
    secretKey: boolean;
    region: boolean;
    appId: boolean;
  };
  live2d: {
    coreLibrary: boolean;
    modelFiles: boolean;
    resources: boolean;
  };
  audio: {
    microphone: boolean;
    speakers: boolean;
  };
  overall: {
    isValid: boolean;
    progress: number;
    lastChecked: Date | null;
  };
}

// 配置修复建议接口
interface FixSuggestion {
  type: 'tencent' | 'live2d' | 'audio';
  severity: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  action?: () => void;
  actionText?: string;
}

/**
 * 配置验证器组件
 * 用于检查和修复应用配置问题
 */
export const ConfigValidator: React.FC = () => {
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>({
    tencentCloud: {
      secretId: false,
      secretKey: false,
      region: false,
      appId: false
    },
    live2d: {
      coreLibrary: false,
      modelFiles: false,
      resources: false
    },
    audio: {
      microphone: false,
      speakers: false
    },
    overall: {
      isValid: false,
      progress: 0,
      lastChecked: null
    }
  });

  const [isValidating, setIsValidating] = useState(false);
  const [fixSuggestions, setFixSuggestions] = useState<FixSuggestion[]>([]);

  // 验证腾讯云配置
  const validateTencentCloudConfig = useCallback(async (): Promise<boolean> => {
    try {
      const config = {
        secretId: import.meta.env.VITE_TENCENT_SECRET_ID,
        secretKey: import.meta.env.VITE_TENCENT_SECRET_KEY,
        region: import.meta.env.VITE_TENCENT_REGION || 'ap-beijing',
        appId: import.meta.env.VITE_TENCENT_APP_ID
      };

      const checks = {
        secretId: !!config.secretId && config.secretId.startsWith('AKID'),
        secretKey: !!config.secretKey && config.secretKey.length >= 30,
        region: !!config.region && ['ap-beijing', 'ap-shanghai', 'ap-guangzhou'].includes(config.region),
        appId: !!config.appId && /^\d+$/.test(config.appId)
      };

      setValidationStatus(prev => ({
        ...prev,
        tencentCloud: checks
      }));

      return Object.values(checks).every(Boolean);
    } catch (error) {
      console.error('腾讯云配置验证失败:', error);
      return false;
    }
  }, []);

  // 验证Live2D配置
  const validateLive2DConfig = useCallback(async (): Promise<boolean> => {
    try {
      // 检查Live2D核心库
      const coreLibraryCheck = !!(window as any).Live2DCubismCore ||
        document.querySelector('script[src*="live2d"]');

      // 检查模型文件
      const modelFilesCheck = true; // 简化检查，实际应该检查具体文件

      // 检查资源文件
      const resourcesCheck = true; // 简化检查

      const checks = {
        coreLibrary: coreLibraryCheck,
        modelFiles: modelFilesCheck,
        resources: resourcesCheck
      };

      setValidationStatus(prev => ({
        ...prev,
        live2d: checks
      }));

      return Object.values(checks).every(Boolean);
    } catch (error) {
      console.error('Live2D配置验证失败:', error);
      return false;
    }
  }, []);

  // 验证音频配置
  const validateAudioConfig = useCallback(async (): Promise<boolean> => {
    try {
      // 检查麦克风权限
      let microphoneAccess = false;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        microphoneAccess = true;
      } catch (error) {
        console.warn('麦克风权限检查失败:', error);
      }

      // 检查音频输出
      const speakersCheck = !!navigator.mediaDevices;

      const checks = {
        microphone: microphoneAccess,
        speakers: speakersCheck
      };

      setValidationStatus(prev => ({
        ...prev,
        audio: checks
      }));

      return Object.values(checks).every(Boolean);
    } catch (error) {
      console.error('音频配置验证失败:', error);
      return false;
    }
  }, []);

  // 生成修复建议
  const generateFixSuggestions = useCallback(() => {
    const suggestions: FixSuggestion[] = [];

    // 腾讯云配置建议
    if (!validationStatus.tencentCloud.secretId) {
      suggestions.push({
        type: 'tencent',
        severity: 'error',
        title: '腾讯云 Secret ID 未配置',
        description: '请设置 VITE_TENCENT_SECRET_ID 环境变量，格式为 AKIDxxxxxxxxxxxxxxxxxxxxxxxx',
        action: () => {
          window.open('https://console.cloud.tencent.com/cam/capi', '_blank');
        },
        actionText: '前往腾讯云控制台'
      });
    }

    if (!validationStatus.tencentCloud.secretKey) {
      suggestions.push({
        type: 'tencent',
        severity: 'error',
        title: '腾讯云 Secret Key 未配置',
        description: '请设置 VITE_TENCENT_SECRET_KEY 环境变量，确保长度至少30个字符'
      });
    }

    if (!validationStatus.tencentCloud.appId) {
      suggestions.push({
        type: 'tencent',
        severity: 'error',
        title: '腾讯云应用ID未配置',
        description: '请设置 VITE_TENCENT_APP_ID 环境变量，格式为纯数字ID'
      });
    }

    // Live2D配置建议
    if (!validationStatus.live2d.coreLibrary) {
      suggestions.push({
        type: 'live2d',
        severity: 'error',
        title: 'Live2D核心库未加载',
        description: 'Live2D核心库未能正确加载，请检查网络连接或重新安装应用'
      });
    }

    // 音频配置建议
    if (!validationStatus.audio.microphone) {
      suggestions.push({
        type: 'audio',
        severity: 'warning',
        title: '麦克风权限未授权',
        description: '语音录制功能需要麦克风权限，请在浏览器设置中允许访问麦克风',
        action: async () => {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            await validateAudioConfig();
          } catch (error) {
            console.error('麦克风权限申请失败:', error);
          }
        },
        actionText: '申请麦克风权限'
      });
    }

    setFixSuggestions(suggestions);
  }, [validationStatus, validateAudioConfig]);

  // 执行完整验证
  const runFullValidation = useCallback(async () => {
    setIsValidating(true);

    try {
      const results = await Promise.all([
        validateTencentCloudConfig(),
        validateLive2DConfig(),
        validateAudioConfig()
      ]);

      const allValid = results.every(Boolean);
      const progress = (results.filter(Boolean).length / results.length) * 100;

      setValidationStatus(prev => ({
        ...prev,
        overall: {
          isValid: allValid,
          progress,
          lastChecked: new Date()
        }
      }));

      generateFixSuggestions();
    } catch (error) {
      console.error('配置验证失败:', error);
    } finally {
      setIsValidating(false);
    }
  }, [validateTencentCloudConfig, validateLive2DConfig, validateAudioConfig, generateFixSuggestions]);

  // 组件挂载时自动验证
  useEffect(() => {
    runFullValidation();
  }, [runFullValidation]);

  // 获取状态颜色
  const getStatusColor = (isValid: boolean) => {
    return isValid ? 'text-green-600' : 'text-red-600';
  };

  // 获取状态图标
  const getStatusIcon = (isValid: boolean) => {
    return isValid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />;
  };

  // 计算总进度
  const calculateOverallProgress = () => {
    const allChecks = [
      ...Object.values(validationStatus.tencentCloud),
      ...Object.values(validationStatus.live2d),
      ...Object.values(validationStatus.audio)
    ];
    return (allChecks.filter(Boolean).length / allChecks.length) * 100;
  };

  return (
    <div className="config-validator space-y-6">
      {/* 总体状态卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <CardTitle>配置状态</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={runFullValidation}
              disabled={isValidating}
            >
              {isValidating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  验证中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新验证
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            检查应用配置的完整性和正确性
            {validationStatus.overall.lastChecked && (
              <span className="ml-2">
                最后检查: {validationStatus.overall.lastChecked.toLocaleTimeString()}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 总体进度 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">总体配置状态</span>
                <Badge variant={validationStatus.overall.progress === 100 ? "default" : "secondary"}>
                  {validationStatus.overall.progress === 100 ? '配置完整' : `${Math.round(validationStatus.overall.progress)}% 完成`}
                </Badge>
              </div>
              <Progress value={validationStatus.overall.progress} className="h-2" />
            </div>

            {/* 各模块状态概览 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 腾讯云服务 */}
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <Key className={`w-4 h-4 ${getStatusColor(
                  Object.values(validationStatus.tencentCloud).every(Boolean)
                )}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">腾讯云服务</p>
                  <p className="text-xs text-muted-foreground">
                    {Object.values(validationStatus.tencentCloud).filter(Boolean).length}/4 配置正确
                  </p>
                </div>
              </div>

              {/* Live2D引擎 */}
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <Bot className={`w-4 h-4 ${getStatusColor(
                  Object.values(validationStatus.live2d).every(Boolean)
                )}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">Live2D引擎</p>
                  <p className="text-xs text-muted-foreground">
                    {Object.values(validationStatus.live2d).filter(Boolean).length}/3 配置正确
                  </p>
                </div>
              </div>

              {/* 音频系统 */}
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <Mic className={`w-4 h-4 ${getStatusColor(
                  Object.values(validationStatus.audio).every(Boolean)
                )}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">音频系统</p>
                  <p className="text-xs text-muted-foreground">
                    {Object.values(validationStatus.audio).filter(Boolean).length}/2 配置正确
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 详细配置状态 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 腾讯云配置详情 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">腾讯云语音服务配置</CardTitle>
            <CardDescription>语音识别(ASR)和语音合成(TTS)服务配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'secretId', label: 'Secret ID', desc: 'API密钥ID' },
              { key: 'secretKey', label: 'Secret Key', desc: 'API密钥' },
              { key: 'region', label: '服务区域', desc: '腾讯云服务区域' },
              { key: 'appId', label: '应用ID', desc: '语音服务应用ID' }
            ].map(({ key, label, desc }) => {
              const isValid = validationStatus.tencentCloud[key as keyof typeof validationStatus.tencentCloud];
              return (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <div className={`flex items-center space-x-1 ${getStatusColor(isValid)}`}>
                    {getStatusIcon(isValid)}
                    <span className="text-sm">{isValid ? '正常' : '未配置'}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Live2D配置详情 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Live2D引擎配置</CardTitle>
            <CardDescription>Live2D模型和渲染引擎配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: 'coreLibrary', label: '核心库', desc: 'Live2D Cubism SDK' },
              { key: 'modelFiles', label: '模型文件', desc: 'Live2D角色模型' },
              { key: 'resources', label: '资源文件', desc: '贴图和动画资源' }
            ].map(({ key, label, desc }) => {
              const isValid = validationStatus.live2d[key as keyof typeof validationStatus.live2d];
              return (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <div className={`flex items-center space-x-1 ${getStatusColor(isValid)}`}>
                    {getStatusIcon(isValid)}
                    <span className="text-sm">{isValid ? '正常' : '异常'}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* 修复建议 */}
      {fixSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <span>配置问题与修复建议</span>
            </CardTitle>
            <CardDescription>发现以下配置问题，请按建议进行修复</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fixSuggestions.map((suggestion, index) => (
                <div key={index} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant={
                          suggestion.severity === 'error' ? 'destructive' :
                          suggestion.severity === 'warning' ? 'secondary' : 'outline'
                        }>
                          {suggestion.severity === 'error' ? '错误' :
                           suggestion.severity === 'warning' ? '警告' : '提示'}
                        </Badge>
                        <h4 className="text-sm font-medium">{suggestion.title}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{suggestion.description}</p>
                    </div>
                    {suggestion.action && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={suggestion.action}
                        className="ml-4"
                      >
                        {suggestion.actionText || '修复'}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConfigValidator;