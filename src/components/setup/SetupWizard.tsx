import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Bot, Key, Mic, Settings, Sparkles, ArrowRight, ExternalLink } from 'lucide-react';
import { connectionTester, ConnectionTestType } from '@/utils/ConnectionTester';

// 向导步骤枚举
enum WizardStep {
  WELCOME = 'welcome',
  PERMISSIONS = 'permissions',
  TENCENT_CONFIG = 'tencent_config',
  LIVE2D_CHECK = 'live2d_check',
  AUDIO_SETUP = 'audio_setup',
  COMPLETION = 'completion'
}

// 向导状态接口
interface WizardState {
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  testResults: Map<string, any>;
  isConfiguring: boolean;
}

// 步骤配置接口
interface StepConfig {
  id: WizardStep;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  isRequired: boolean;
  canSkip: boolean;
}

/**
 * 首次启动向导组件
 * 引导用户完成应用的初始配置和设置
 */
export const SetupWizard: React.FC = () => {
  const [wizardState, setWizardState] = useState<WizardState>({
    currentStep: WizardStep.WELCOME,
    completedSteps: new Set(),
    testResults: new Map(),
    isConfiguring: false
  });

  const [showSkipDialog, setShowSkipDialog] = useState(false);

  // 步骤配置
  const steps: StepConfig[] = [
    {
      id: WizardStep.WELCOME,
      title: '欢迎使用 Reeftotem Assistant',
      description: '让我们快速设置您的AI数字助手',
      icon: Sparkles,
      isRequired: true,
      canSkip: false
    },
    {
      id: WizardStep.PERMISSIONS,
      title: '系统权限',
      description: '申请必要的系统权限以确保功能正常运行',
      icon: Settings,
      isRequired: true,
      canSkip: false
    },
    {
      id: WizardStep.TENCENT_CONFIG,
      title: '腾讯云语音服务配置',
      description: '配置语音识别和语音合成服务',
      icon: Key,
      isRequired: true,
      canSkip: false
    },
    {
      id: WizardStep.LIVE2D_CHECK,
      title: 'Live2D模型检查',
      description: '验证Live2D虚拟角色资源完整性',
      icon: Bot,
      isRequired: true,
      canSkip: false
    },
    {
      id: WizardStep.AUDIO_SETUP,
      title: '音频设备设置',
      description: '配置麦克风和音频输出设备',
      icon: Mic,
      isRequired: true,
      canSkip: true
    },
    {
      id: WizardStep.COMPLETION,
      title: '配置完成',
      description: '所有设置已完成，开始使用您的AI助手',
      icon: CheckCircle2,
      isRequired: true,
      canSkip: false
    }
  ];

  // 获取当前步骤索引
  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === wizardState.currentStep);
  };

  // 获取总进度
  const getOverallProgress = () => {
    const currentIndex = getCurrentStepIndex();
    return ((currentIndex + 1) / steps.length) * 100;
  };

  // 检查步骤是否完成
  const isStepCompleted = (stepId: WizardStep) => {
    return wizardState.completedSteps.has(stepId);
  };

  // 标记步骤为完成
  const markStepCompleted = (stepId: WizardStep) => {
    setWizardState(prev => ({
      ...prev,
      completedSteps: new Set([...prev.completedSteps, stepId])
    }));
  };

  // 移动到下一步
  const moveToNextStep = async () => {
    const currentIndex = getCurrentStepIndex();
    const nextIndex = currentIndex + 1;

    if (nextIndex < steps.length) {
      markStepCompleted(wizardState.currentStep);
      setWizardState(prev => ({
        ...prev,
        currentStep: steps[nextIndex].id
      }));
    }
  };

  // 移动到上一步
  const moveToPreviousStep = () => {
    const currentIndex = getCurrentStepIndex();
    const prevIndex = currentIndex - 1;

    if (prevIndex >= 0) {
      setWizardState(prev => ({
        ...prev,
        currentStep: steps[prevIndex].id
      }));
    }
  };

  // 跳过当前步骤
  const skipCurrentStep = () => {
    const currentIndex = getCurrentStepIndex();
    const nextIndex = currentIndex + 1;

    if (nextIndex < steps.length) {
      setWizardState(prev => ({
        ...prev,
        currentStep: steps[nextIndex].id
      }));
    }
  };

  // 完成向导
  const completeWizard = () => {
    // 保存完成状态到localStorage
    localStorage.setItem('setupWizardCompleted', 'true');
    localStorage.setItem('setupWizardCompletionDate', new Date().toISOString());

    // 触发应用重启或重定向
    window.location.reload();
  };

  // 申请权限
  const requestPermissions = async () => {
    setWizardState(prev => ({ ...prev, isConfiguring: true }));

    try {
      // 申请麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());

      // 申请通知权限
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      markStepCompleted(WizardStep.PERMISSIONS);
      await moveToNextStep();
    } catch (error) {
      console.error('权限申请失败:', error);
      alert('权限申请失败，请手动在系统设置中允许相关权限');
    } finally {
      setWizardState(prev => ({ ...prev, isConfiguring: false }));
    }
  };

  // 配置腾讯云服务
  const configureTencentCloud = async () => {
    setWizardState(prev => ({ ...prev, isConfiguring: true }));

    try {
      // 测试腾讯云连接
      const result = await connectionTester.testTencentCloud();
      wizardState.testResults.set('tencent_cloud', result);

      if (result.success) {
        markStepCompleted(WizardStep.TENCENT_CONFIG);
        await moveToNextStep();
      } else {
        // 显示配置指导
        if (confirm('腾讯云服务配置有问题，是否打开配置页面进行设置？')) {
          window.open('https://console.cloud.tencent.com/cam/capi', '_blank');
        }
      }
    } catch (error) {
      console.error('腾讯云配置失败:', error);
      alert('配置失败，请检查网络连接');
    } finally {
      setWizardState(prev => ({ ...prev, isConfiguring: false }));
    }
  };

  // 检查Live2D模型
  const checkLive2DModels = async () => {
    setWizardState(prev => ({ ...prev, isConfiguring: true }));

    try {
      // 测试Live2D核心和模型
      const coreResult = await connectionTester.testLive2DCore();
      const modelResult = await connectionTester.testLive2DModels();

      wizardState.testResults.set('live2d_core', coreResult);
      wizardState.testResults.set('live2d_models', modelResult);

      if (coreResult.success && modelResult.success) {
        markStepCompleted(WizardStep.LIVE2D_CHECK);
        await moveToNextStep();
      } else {
        alert('Live2D资源检查失败，请重新安装应用');
      }
    } catch (error) {
      console.error('Live2D检查失败:', error);
      alert('Live2D检查失败，请重新安装应用');
    } finally {
      setWizardState(prev => ({ ...prev, isConfiguring: false }));
    }
  };

  // 配置音频设备
  const configureAudioDevices = async () => {
    setWizardState(prev => ({ ...prev, isConfiguring: true }));

    try {
      // 测试音频权限和设备
      const permissionResult = await connectionTester.testAudioPermissions();
      const deviceResult = await connectionTester.testAudioDevices();

      wizardState.testResults.set('audio_permissions', permissionResult);
      wizardState.testResults.set('audio_devices', deviceResult);

      markStepCompleted(WizardStep.AUDIO_SETUP);
      await moveToNextStep();
    } catch (error) {
      console.error('音频配置失败:', error);
      alert('音频配置失败，请检查音频设备');
    } finally {
      setWizardState(prev => ({ ...prev, isConfiguring: false }));
    }
  };

  // 渲染当前步骤内容
  const renderStepContent = () => {
    const currentStepConfig = steps.find(step => step.id === wizardState.currentStep);
    if (!currentStepConfig) return null;

    const Icon = currentStepConfig.icon;

    switch (wizardState.currentStep) {
      case WizardStep.WELCOME:
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
              <Icon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">{currentStepConfig.title}</h2>
              <p className="text-gray-600 mb-6">{currentStepConfig.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <Card className="p-4">
                <div className="flex items-center space-x-3">
                  <Bot className="w-8 h-8 text-blue-500" />
                  <div className="text-left">
                    <h3 className="font-semibold">Live2D虚拟助手</h3>
                    <p className="text-sm text-gray-600">可爱的AI数字角色</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center space-x-3">
                  <Mic className="w-8 h-8 text-green-500" />
                  <div className="text-left">
                    <h3 className="font-semibold">智能语音交互</h3>
                    <p className="text-sm text-gray-600">自然的对话体验</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center space-x-3">
                  <Settings className="w-8 h-8 text-purple-500" />
                  <div className="text-left">
                    <h3 className="font-semibold">个性化配置</h3>
                    <p className="text-sm text-gray-600">定制您的专属助手</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center space-x-3">
                  <Key className="w-8 h-8 text-orange-500" />
                  <div className="text-left">
                    <h3 className="font-semibold">安全可靠</h3>
                    <p className="text-sm text-gray-600">企业级安全保障</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        );

      case WizardStep.PERMISSIONS:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">{currentStepConfig.title}</h2>
              <p className="text-gray-600">{currentStepConfig.description}</p>
            </div>

            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-2">需要的权限：</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <Mic className="w-4 h-4" />
                    <span>麦克风访问 - 用于语音识别</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-gray-300 rounded-full" />
                    <span>通知权限 - 用于消息提醒</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-gray-300 rounded-full" />
                    <span>文件访问 - 用于读取配置文件</span>
                  </li>
                </ul>
              </Card>

              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <p className="text-sm text-gray-600">
                这些权限对于应用的正常运行是必需的。我们承诺保护您的隐私，不会收集不必要的个人信息。
              </p>
            </div>
          </div>
        );

      case WizardStep.TENCENT_CONFIG:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-orange-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">{currentStepConfig.title}</h2>
              <p className="text-gray-600">{currentStepConfig.description}</p>
            </div>

            <Card className="p-4">
              <h3 className="font-semibold mb-3">配置步骤：</h3>
              <ol className="space-y-2 text-sm">
                <li>1. 访问腾讯云控制台</li>
                <li>2. 创建访问管理 &gt; API密钥</li>
                <li>3. 开通语音识别和语音合成服务</li>
                <li>4. 配置环境变量或使用内置配置</li>
              </ol>
            </Card>

            {wizardState.testResults.has('tencent_cloud') && (
              <Card className={`p-4 ${
                wizardState.testResults.get('tencent_cloud')?.success
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center space-x-2">
                  {wizardState.testResults.get('tencent_cloud')?.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {wizardState.testResults.get('tencent_cloud')?.message}
                  </span>
                </div>
              </Card>
            )}

            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => window.open('https://console.cloud.tencent.com/cam/capi', '_blank')}
                className="mr-2"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                打开腾讯云控制台
              </Button>
            </div>
          </div>
        );

      case WizardStep.LIVE2D_CHECK:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">{currentStepConfig.title}</h2>
              <p className="text-gray-600">{currentStepConfig.description}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-2">Live2D核心库</h3>
                {wizardState.testResults.has('live2d_core') ? (
                  <div className={`flex items-center space-x-2 ${
                    wizardState.testResults.get('live2d_core')?.success
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {wizardState.testResults.get('live2d_core')?.success ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    <span className="text-sm">
                      {wizardState.testResults.get('live2d_core')?.message}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">等待检查...</p>
                )}
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-2">模型文件</h3>
                {wizardState.testResults.has('live2d_models') ? (
                  <div className={`flex items-center space-x-2 ${
                    wizardState.testResults.get('live2d_models')?.success
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {wizardState.testResults.get('live2d_models')?.success ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <AlertCircle className="w-4 h-4" />
                    )}
                    <span className="text-sm">
                      {wizardState.testResults.get('live2d_models')?.message}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">等待检查...</p>
                )}
              </Card>
            </div>
          </div>
        );

      case WizardStep.AUDIO_SETUP:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Icon className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">{currentStepConfig.title}</h2>
              <p className="text-gray-600">{currentStepConfig.description}</p>
            </div>

            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-2">音频设备检查</h3>
                <div className="space-y-2">
                  {wizardState.testResults.has('audio_permissions') && (
                    <div className={`flex items-center justify-between p-2 rounded ${
                      wizardState.testResults.get('audio_permissions')?.success
                        ? 'bg-green-50'
                        : 'bg-red-50'
                    }`}>
                      <span className="text-sm">麦克风权限</span>
                      <Badge variant={wizardState.testResults.get('audio_permissions')?.success ? "default" : "destructive"}>
                        {wizardState.testResults.get('audio_permissions')?.success ? '已授权' : '未授权'}
                      </Badge>
                    </div>
                  )}
                  {wizardState.testResults.has('audio_devices') && (
                    <div className={`flex items-center justify-between p-2 rounded ${
                      wizardState.testResults.get('audio_devices')?.success
                        ? 'bg-green-50'
                        : 'bg-yellow-50'
                    }`}>
                      <span className="text-sm">音频设备</span>
                      <Badge variant={wizardState.testResults.get('audio_devices')?.success ? "default" : "secondary"}>
                        {wizardState.testResults.get('audio_devices')?.success ? '正常' : '需要检查'}
                      </Badge>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        );

      case WizardStep.COMPLETION:
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
              <Icon className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">{currentStepConfig.title}</h2>
              <p className="text-gray-600 mb-6">{currentStepConfig.description}</p>
            </div>

            <Card className="p-6 max-w-md mx-auto">
              <h3 className="font-semibold mb-4">配置摘要</h3>
              <div className="space-y-2 text-left">
                {steps.slice(0, -1).map(step => (
                  <div key={step.id} className="flex items-center justify-between">
                    <span className="text-sm">{step.title}</span>
                    {isStepCompleted(step.id) ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                🎉 恭喜！您已完成所有必要配置，现在可以开始使用Reeftotem Assistant了！
              </p>
              <Button onClick={completeWizard} size="lg" className="px-8">
                开始使用
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // 获取当前步骤的操作按钮
  const getStepActions = () => {
    const currentIndex = getCurrentStepIndex();
    const isFirstStep = currentIndex === 0;
    const isLastStep = currentIndex === steps.length - 1;
    const currentStepConfig = steps[currentIndex];

    const actions = [];

    // 上一步按钮
    if (!isFirstStep) {
      actions.push(
        <Button
          key="previous"
          variant="outline"
          onClick={moveToPreviousStep}
          disabled={wizardState.isConfiguring}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          上一步
        </Button>
      );
    }

    // 步骤特定按钮
    switch (wizardState.currentStep) {
      case WizardStep.WELCOME:
        actions.push(
          <Button
            key="next"
            onClick={moveToNextStep}
            disabled={wizardState.isConfiguring}
          >
            开始设置
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        );
        break;

      case WizardStep.PERMISSIONS:
        actions.push(
          <Button
            key="configure"
            onClick={requestPermissions}
            disabled={wizardState.isConfiguring}
          >
            {wizardState.isConfiguring ? '申请中...' : '申请权限'}
          </Button>
        );
        break;

      case WizardStep.TENCENT_CONFIG:
        actions.push(
          <Button
            key="configure"
            onClick={configureTencentCloud}
            disabled={wizardState.isConfiguring}
          >
            {wizardState.isConfiguring ? '测试中...' : '测试配置'}
          </Button>
        );
        break;

      case WizardStep.LIVE2D_CHECK:
        actions.push(
          <Button
            key="check"
            onClick={checkLive2DModels}
            disabled={wizardState.isConfiguring}
          >
            {wizardState.isConfiguring ? '检查中...' : '开始检查'}
          </Button>
        );
        break;

      case WizardStep.AUDIO_SETUP:
        actions.push(
          <Button
            key="configure"
            onClick={configureAudioDevices}
            disabled={wizardState.isConfiguring}
          >
            {wizardState.isConfiguring ? '配置中...' : '检查音频设备'}
          </Button>
        );
        // 音频设置可以跳过
        if (currentStepConfig.canSkip) {
          actions.push(
            <Button
              key="skip"
              variant="outline"
              onClick={skipCurrentStep}
              disabled={wizardState.isConfiguring}
            >
              跳过此步骤
            </Button>
          );
        }
        break;

      case WizardStep.COMPLETION:
        actions.push(
          <Button
            key="complete"
            onClick={completeWizard}
            size="lg"
            className="px-8"
          >
            开始使用
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        );
        break;

      default:
        actions.push(
          <Button
            key="next"
            onClick={moveToNextStep}
            disabled={wizardState.isConfiguring}
          >
            下一步
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        );
    }

    return actions;
  };

  return (
    <div className="setup-wizard min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="pb-4">
          {/* 进度指示器 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                步骤 {getCurrentStepIndex() + 1} / {steps.length}
              </span>
              <Badge variant="outline">
                {Math.round(getOverallProgress())}% 完成
              </Badge>
            </div>

            <Progress value={getOverallProgress()} className="h-2" />

            {/* 步骤指示器 */}
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isCompleted = isStepCompleted(step.id);
                const isCurrent = step.id === wizardState.currentStep;

                return (
                  <div key={step.id} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-400'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${
                        isCompleted ? 'bg-green-300' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="min-h-[400px]">
            {renderStepContent()}
          </div>

          <Separator className="my-6" />

          {/* 操作按钮 */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {wizardState.isConfiguring && '配置进行中，请稍候...'}
            </div>
            <div className="flex items-center space-x-2">
              {getStepActions()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupWizard;