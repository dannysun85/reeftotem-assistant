import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, Settings, RefreshCw, Download, Upload, Save, Trash2, ExternalLink, HelpCircle, Bot, Mic, Key, Monitor } from 'lucide-react';

// 导入我们的新组件
import ConfigValidator from './config/ConfigValidator';
import { useConnectionTester } from '@/utils/ConnectionTester';
import { SystemHealth } from './ui/StatusIndicator';

// 设置分类
enum SettingsCategory {
  GENERAL = 'general',
  LIVE2D = 'live2d',
  AUDIO = 'audio',
  TENCENT = 'tencent',
  ADVANCED = 'advanced'
}

// 设置项接口
interface SettingItem {
  id: string;
  label: string;
  description: string;
  type: 'toggle' | 'select' | 'input' | 'button';
  value?: any;
  options?: Array<{ label: string; value: any }>;
  action?: () => void;
  required?: boolean;
}

/**
 * 优化的设置面板组件
 * 集成配置验证、连接测试和状态监控功能
 */
export const SettingsPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsCategory>(SettingsCategory.GENERAL);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // 连接测试Hook
  const {
    isTesting,
    testResults,
    lastTestTime,
    runFullDiagnosis,
    getSystemDiagnosis,
    clearCache
  } = useConnectionTester();

  const [systemHealth, setSystemHealth] = useState<any>(null);

  // 设置项配置
  const settingsConfig: Record<SettingsCategory, SettingItem[]> = {
    [SettingsCategory.GENERAL]: [
      {
        id: 'autoStart',
        label: '开机自启',
        description: '系统启动时自动运行应用',
        type: 'toggle',
        value: false
      },
      {
        id: 'minimizeToTray',
        label: '最小化到托盘',
        description: '关闭窗口时最小化到系统托盘',
        type: 'toggle',
        value: true
      },
      {
        id: 'theme',
        label: '主题',
        description: '选择应用主题',
        type: 'select',
        value: 'light',
        options: [
          { label: '浅色主题', value: 'light' },
          { label: '深色主题', value: 'dark' },
          { label: '跟随系统', value: 'auto' }
        ]
      },
      {
        id: 'language',
        label: '语言',
        description: '选择界面语言',
        type: 'select',
        value: 'zh-CN',
        options: [
          { label: '简体中文', value: 'zh-CN' },
          { label: 'English', value: 'en-US' }
        ]
      }
    ],
    [SettingsCategory.LIVE2D]: [
      {
        id: 'currentModel',
        label: '当前模型',
        description: '选择Live2D角色模型',
        type: 'select',
        value: 'HaruGreeter',
        options: [
          { label: 'Haru Greeter 👋', value: 'HaruGreeter' },
          { label: 'Haru 🌸', value: 'Haru' },
          { label: 'Kei 💼', value: 'Kei' },
          { label: 'Chitose 🌸', value: 'Chitose' },
          { label: 'Epsilon 🚀', value: 'Epsilon' },
          { label: 'Hibiki 🎸', value: 'Hibiki' },
          { label: 'Hiyori 🌺', value: 'Hiyori' },
          { label: 'Izumi 💎', value: 'Izumi' },
          { label: 'Mao 🔥', value: 'Mao' },
          { label: 'Rice 🍚', value: 'Rice' },
          { label: 'Shizuku 🍃', value: 'Shizuku' },
          { label: 'Tsumiki 🎀', value: 'Tsumiki' }
        ]
      },
      {
        id: 'eyeTracking',
        label: '眼神跟随',
        description: '启用鼠标眼神追踪功能',
        type: 'toggle',
        value: true
      },
      {
        id: 'physicsEngine',
        label: '物理引擎',
        description: '启用头发和衣物物理效果',
        type: 'toggle',
        value: false
      },
      {
        id: 'breathingEffect',
        label: '呼吸效果',
        description: '启用自然的呼吸动画',
        type: 'toggle',
        value: true
      },
      {
        id: 'lipSync',
        label: '唇形同步',
        description: '语音播放时的口型同步',
        type: 'toggle',
        value: true
      },
      {
        id: 'resetLive2D',
        label: '重置Live2D设置',
        description: '将Live2D相关设置恢复为默认值',
        type: 'button',
        action: () => {
          if (confirm('确定要重置所有Live2D设置吗？')) {
            console.log('重置Live2D设置');
          }
        }
      }
    ],
    [SettingsCategory.AUDIO]: [
      {
        id: 'inputDevice',
        label: '输入设备',
        description: '选择麦克风设备',
        type: 'select',
        value: 'default',
        options: [
          { label: '默认设备', value: 'default' }
        ]
      },
      {
        id: 'outputDevice',
        label: '输出设备',
        description: '选择扬声器设备',
        type: 'select',
        value: 'default',
        options: [
          { label: '默认设备', value: 'default' }
        ]
      },
      {
        id: 'inputVolume',
        label: '输入音量',
        description: '调整麦克风音量',
        type: 'select',
        value: 80,
        options: Array.from({ length: 11 }, (_, i) => ({
          label: `${i * 10}%`,
          value: i * 10
        }))
      },
      {
        id: 'outputVolume',
        label: '输出音量',
        description: '调整语音播放音量',
        type: 'select',
        value: 100,
        options: Array.from({ length: 11 }, (_, i) => ({
          label: `${i * 10}%`,
          value: i * 10
        }))
      },
      {
        id: 'noiseSuppression',
        label: '噪音抑制',
        description: '启用音频噪音抑制',
        type: 'toggle',
        value: true
      },
      {
        id: 'echoCancellation',
        label: '回声消除',
        description: '启用音频回声消除',
        type: 'toggle',
        value: true
      }
    ],
    [SettingsCategory.TENCENT]: [
      {
        id: 'testConnection',
        label: '测试连接',
        description: '测试腾讯云服务连接状态',
        type: 'button',
        action: () => {
          console.log('测试腾讯云连接');
        }
      },
      {
        id: 'showConfigGuide',
        label: '配置指南',
        description: '查看腾讯云服务配置教程',
        type: 'button',
        action: () => {
          window.open('https://console.cloud.tencent.com/cam/capi', '_blank');
        }
      },
      {
        id: 'region',
        label: '服务区域',
        description: '选择腾讯云服务区域',
        type: 'select',
        value: 'ap-beijing',
        options: [
          { label: '北京', value: 'ap-beijing' },
          { label: '上海', value: 'ap-shanghai' },
          { label: '广州', value: 'ap-guangzhou' },
          { label: '成都', value: 'ap-chengdu' },
          { label: '新加坡', value: 'ap-singapore' },
          { label: '香港', value: 'ap-hongkong' }
        ]
      },
      {
        id: 'voiceType',
        label: '语音类型',
        description: '选择TTS语音类型',
        type: 'select',
        value: '101018',
        options: [
          { label: '亲和女声', value: '101018' },
          { label: '亲和男声', value: '101001' },
          { label: '客服女声', value: '101009' },
          { label: '客服男声', value: '101011' },
          { label: '智选女声', value: '101007' },
          { label: '智选男声', value: '101008' }
        ]
      }
    ],
    [SettingsCategory.ADVANCED]: [
      {
        id: 'enableDebugMode',
        label: '调试模式',
        description: '启用详细的调试日志',
        type: 'toggle',
        value: false
      },
      {
        id: 'logLevel',
        label: '日志级别',
        description: '选择日志输出级别',
        type: 'select',
        value: 'info',
        options: [
          { label: '错误', value: 'error' },
          { label: '警告', value: 'warn' },
          { label: '信息', value: 'info' },
          { label: '调试', value: 'debug' }
        ]
      },
      {
        id: 'clearCache',
        label: '清除缓存',
        description: '清除应用缓存数据',
        type: 'button',
        action: () => {
          if (confirm('确定要清除所有缓存数据吗？')) {
            clearCache();
            console.log('清除缓存');
          }
        }
      },
      {
        id: 'exportSettings',
        label: '导出设置',
        description: '将当前设置导出为文件',
        type: 'button',
        action: () => {
          console.log('导出设置');
        }
      },
      {
        id: 'importSettings',
        label: '导入设置',
        description: '从文件导入设置配置',
        type: 'button',
        action: () => {
          console.log('导入设置');
        }
      },
      {
        id: 'resetAll',
        label: '恢复默认',
        description: '将所有设置恢复为默认值',
        type: 'button',
        action: () => {
          if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
            console.log('重置所有设置');
          }
        }
      }
    ]
  };

  // 加载系统健康状态
  useEffect(() => {
    const loadSystemHealth = async () => {
      try {
        const diagnosis = await getSystemDiagnosis();
        setSystemHealth(diagnosis);
      } catch (error) {
        console.error('加载系统健康状态失败:', error);
      }
    };

    loadSystemHealth();
  }, [getSystemDiagnosis]);

  // 渲染设置项
  const renderSettingItem = (item: SettingItem) => {
    switch (item.type) {
      case 'toggle':
        return (
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium">{item.label}</label>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
            <button
              className={`w-12 h-6 rounded-full transition-colors ${
                item.value ? 'bg-blue-500' : 'bg-gray-300'
              }`}
              onClick={() => {
                // 这里应该切换设置值
                console.log(`切换设置: ${item.id}`);
              }}
            >
              <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                item.value ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        );

      case 'select':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium">{item.label}</label>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={item.value}
              onChange={(e) => {
                console.log(`更改设置: ${item.id} = ${e.target.value}`);
              }}
            >
              {item.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'input':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium">{item.label}</label>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue={item.value}
              onChange={(e) => {
                console.log(`更改设置: ${item.id} = ${e.target.value}`);
              }}
            />
          </div>
        );

      case 'button':
        return (
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium">{item.label}</label>
              <p className="text-xs text-gray-500">{item.description}</p>
            </div>
            <Button
              variant="outline"
              onClick={item.action}
              className="w-full"
            >
              {item.label}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  // 保存设置
  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // 模拟保存过程
      await new Promise(resolve => setTimeout(resolve, 1000));
      setLastSaved(new Date());
    } catch (error) {
      console.error('保存设置失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="settings-panel space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center space-x-2">
            <Settings className="w-6 h-6" />
            <span>设置</span>
          </h2>
          <p className="text-gray-600">配置应用偏好设置</p>
        </div>
        <div className="flex items-center space-x-2">
          {lastSaved && (
            <span className="text-sm text-gray-500">
              最后保存: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <Button onClick={saveSettings} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存设置
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 系统健康状态 */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Monitor className="w-5 h-5" />
                <span>系统状态</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={runFullDiagnosis}
                disabled={isTesting}
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    检测中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重新检测
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <SystemHealth
              overall={systemHealth.overall}
              services={systemHealth.results.map((result: any) => ({
                name: result.details?.type || 'Unknown',
                status: result.success ? 'success' : 'error',
                details: result.message
              }))}
              lastCheck={lastTestTime || new Date()}
            />
          </CardContent>
        </Card>
      )}

      {/* 设置标签页 */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SettingsCategory)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value={SettingsCategory.GENERAL}>常规</TabsTrigger>
          <TabsTrigger value={SettingsCategory.LIVE2D}>Live2D</TabsTrigger>
          <TabsTrigger value={SettingsCategory.AUDIO}>音频</TabsTrigger>
          <TabsTrigger value={SettingsCategory.TENCENT}>腾讯云</TabsTrigger>
          <TabsTrigger value={SettingsCategory.ADVANCED}>高级</TabsTrigger>
        </TabsList>

        {/* 常规设置 */}
        <TabsContent value={SettingsCategory.GENERAL} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>常规设置</CardTitle>
              <CardDescription>基本应用配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsConfig[SettingsCategory.GENERAL].map(item => (
                <div key={item.id}>
                  {renderSettingItem(item)}
                  {item.id !== settingsConfig[SettingsCategory.GENERAL][settingsConfig[SettingsCategory.GENERAL].length - 1].id && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live2D设置 */}
        <TabsContent value={SettingsCategory.LIVE2D} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bot className="w-5 h-5" />
                <span>Live2D设置</span>
              </CardTitle>
              <CardDescription>虚拟角色和动画配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsConfig[SettingsCategory.LIVE2D].map(item => (
                <div key={item.id}>
                  {renderSettingItem(item)}
                  {item.id !== settingsConfig[SettingsCategory.LIVE2D][settingsConfig[SettingsCategory.LIVE2D].length - 1].id && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Live2D模型预览 */}
          <Card>
            <CardHeader>
              <CardTitle>模型预览</CardTitle>
              <CardDescription>当前选择的Live2D模型预览</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Live2D模型预览</p>
                  <p className="text-sm text-gray-400 mt-1">选择模型后显示预览</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 音频设置 */}
        <TabsContent value={SettingsCategory.AUDIO} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mic className="w-5 h-5" />
                <span>音频设置</span>
              </CardTitle>
              <CardDescription>语音录制和播放配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsConfig[SettingsCategory.AUDIO].map(item => (
                <div key={item.id}>
                  {renderSettingItem(item)}
                  {item.id !== settingsConfig[SettingsCategory.AUDIO][settingsConfig[SettingsCategory.AUDIO].length - 1].id && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 腾讯云设置 */}
        <TabsContent value={SettingsCategory.TENCENT} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Key className="w-5 h-5" />
                <span>腾讯云服务</span>
              </CardTitle>
              <CardDescription>语音识别和合成服务配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsConfig[SettingsCategory.TENCENT].map(item => (
                <div key={item.id}>
                  {renderSettingItem(item)}
                  {item.id !== settingsConfig[SettingsCategory.TENCENT][settingsConfig[SettingsCategory.TENCENT].length - 1].id && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 配置向导 */}
          <Card>
            <CardHeader>
              <CardTitle>配置向导</CardTitle>
              <CardDescription>详细的配置指导</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <HelpCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium">需要帮助配置腾讯云服务？</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      我们的配置向导将指导您完成所有必要的设置。
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        // 这里可以打开配置向导
                        console.log('打开配置向导');
                      }}
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      打开向导
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 高级设置 */}
        <TabsContent value={SettingsCategory.ADVANCED} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>高级设置</CardTitle>
              <CardDescription>开发者选项和系统配置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsConfig[SettingsCategory.ADVANCED].map(item => (
                <div key={item.id}>
                  {renderSettingItem(item)}
                  {item.id !== settingsConfig[SettingsCategory.ADVANCED][settingsConfig[SettingsCategory.ADVANCED].length - 1].id && (
                    <Separator className="mt-4" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 危险操作警告 */}
          <Card className="border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-orange-600">
                <AlertCircle className="w-5 h-5" />
                <span>危险操作</span>
              </CardTitle>
              <CardDescription>这些操作可能会影响应用正常运行</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-sm text-orange-600">
                  <AlertCircle className="w-4 h-4" />
                  <span>请谨慎执行以下操作</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('确定要清除所有缓存吗？这可能影响应用性能。')) {
                        console.log('清除缓存');
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    清除缓存
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('确定要重置所有设置吗？此操作不可撤销。')) {
                        console.log('重置所有设置');
                      }
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重置设置
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPanel;