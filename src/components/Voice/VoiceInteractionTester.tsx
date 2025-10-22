import React, { useState, useCallback } from 'react';
import {
  Mic,
  Square,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  TestTube,
  Play,
  Volume2,
  Brain,
  MessageCircle,
  Settings,
  RefreshCw
} from 'lucide-react';
import { tencentCloudVoiceService } from '../../lib/ai/TencentCloudVoiceService';
import { aiService } from '../../lib/ai/AIService';

// 测试步骤状态
interface TestStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: any;
  error?: string;
  duration?: number;
}

// 完整的语音交互测试组件
export const VoiceInteractionTester: React.FC = () => {
  const [testSteps, setTestSteps] = useState<TestStep[]>([
    {
      id: 'config',
      name: '配置检查',
      description: '检查腾讯云和AI服务配置',
      status: 'pending'
    },
    {
      id: 'permissions',
      name: '麦克风权限',
      description: '检查麦克风访问权限',
      status: 'pending'
    },
    {
      id: 'recording',
      name: '录音测试',
      description: '测试音频录制功能',
      status: 'pending'
    },
    {
      id: 'asr',
      name: '语音识别(ASR)',
      description: '测试腾讯云语音识别',
      status: 'pending'
    },
    {
      id: 'ai',
      name: 'AI模型回复',
      description: '测试AI大模型生成回复',
      status: 'pending'
    },
    {
      id: 'tts',
      name: '语音合成(TTS)',
      description: '测试腾讯云语音合成',
      status: 'pending'
    }
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [testText, setTestText] = useState('你好，这是一个语音交互测试');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [asrResult, setAsrResult] = useState<string>('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string>('');

  // 更新测试步骤状态
  const updateStep = useCallback((stepId: string, updates: Partial<TestStep>) => {
    setTestSteps(prev => prev.map(step =>
      step.id === stepId ? { ...step, ...updates } : step
    ));
  }, []);

  // 执行单个测试步骤
  const executeStep = useCallback(async (stepId: string): Promise<void> => {
    const startTime = Date.now();
    setCurrentStep(stepId);

    try {
      updateStep(stepId, { status: 'running' });

      switch (stepId) {
        case 'config':
          await testConfiguration();
          break;
        case 'permissions':
          await testMicrophonePermissions();
          break;
        case 'recording':
          await testRecording();
          break;
        case 'asr':
          await testASR();
          break;
        case 'ai':
          await testAI();
          break;
        case 'tts':
          await testTTS();
          break;
      }

      const duration = Date.now() - startTime;
      updateStep(stepId, {
        status: 'success',
        duration,
        result: '✅ 测试通过'
      });

    } catch (error: any) {
      const duration = Date.now() - startTime;
      updateStep(stepId, {
        status: 'error',
        error: error.message,
        duration
      });
      throw error;
    }
  }, [updateStep]);

  // 测试配置
  const testConfiguration = async () => {
    console.log('🔧 检查服务配置...');

    // 检查腾讯云配置
    const tencentConfigured = tencentCloudVoiceService.isConfigured();
    if (!tencentConfigured) {
      throw new Error('腾讯云服务未配置，请检查.env文件');
    }

    // 检查AI服务配置
    const aiConfig = aiService.getConfig();
    console.log('AI配置:', aiConfig);

    // 如果是Ollama，检查服务可用性
    if (aiConfig.provider === 'ollama') {
      const available = await aiService.checkAvailability();
      if (!available) {
        throw new Error('Ollama服务不可用，请确保已启动并下载模型');
      }
    }

    updateStep('config', {
      result: {
        tencent: tencentConfigured,
        ai: aiConfig
      }
    });
  };

  // 测试麦克风权限
  const testMicrophonePermissions = async () => {
    console.log('🎤 检查麦克风权限...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // 立即停止流
      stream.getTracks().forEach(track => track.stop());

      updateStep('permissions', { result: '麦克风权限已获取' });
    } catch (error: any) {
      throw new Error(`麦克风权限获取失败: ${error.message}`);
    }
  };

  // 测试录音
  const testRecording = async () => {
    console.log('🎙️ 测试录音功能...');

    return new Promise((resolve, reject) => {
      let mediaRecorder: MediaRecorder | null = null;
      let stream: MediaStream | null = null;
      let audioChunks: Blob[] = [];
      let timeoutId: NodeJS.Timeout;

      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      };

      try {
        // 获取麦克风流
        navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000
          }
        }).then((micStream) => {
          stream = micStream;

          // 创建MediaRecorder
          mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
          });

          audioChunks = [];

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunks.push(event.data);
            }
          };

          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
            const audioUrl = URL.createObjectURL(audioBlob);

            setAudioBlob(audioBlob);
            updateStep('recording', {
              result: {
                size: audioBlob.size,
                url: audioUrl,
                duration: 3000
              }
            });

            cleanup();
            resolve(audioBlob);
          };

          mediaRecorder.onerror = (event) => {
            cleanup();
            reject(new Error('录音过程中发生错误'));
          };

          // 开始录音
          mediaRecorder.start(100);

          // 3秒后自动停止
          timeoutId = setTimeout(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          }, 3000);

        }).catch(reject);

      } catch (error: any) {
        cleanup();
        reject(error);
      }
    });
  };

  // 测试ASR
  const testASR = async () => {
    console.log('🔍 测试语音识别...');

    if (!audioBlob) {
      throw new Error('没有可用的音频数据，请先进行录音测试');
    }

    const audioBuffer = await audioBlob.arrayBuffer();
    const result = await tencentCloudVoiceService.recognizeSpeech(audioBuffer);

    if (!result || !result.text) {
      throw new Error('语音识别失败或返回空结果');
    }

    setAsrResult(result.text);
    updateStep('asr', {
      result: {
        text: result.text,
        confidence: result.confidence
      }
    });
  };

  // 测试AI模型
  const testAI = async () => {
    console.log('🤖 测试AI模型...');

    if (!asrResult) {
      throw new Error('没有识别结果，请先进行ASR测试');
    }

    const response = await aiService.generateResponse(asrResult);

    if (!response || !response.text) {
      throw new Error('AI模型返回空回复');
    }

    setAiResponse(response.text);
    updateStep('ai', {
      result: {
        text: response.text,
        model: response.model,
        responseTime: response.responseTime
      }
    });
  };

  // 测试TTS
  const testTTS = async () => {
    console.log('🔊 测试语音合成...');

    const textToSynthesize = aiResponse || testText;
    const result = await tencentCloudVoiceService.synthesizeSpeech(textToSynthesize);

    if (!result || !result.audioData) {
      throw new Error('语音合成失败');
    }

    const audioUrl = URL.createObjectURL(new Blob([result.audioData], { type: 'audio/wav' }));
    setTtsAudioUrl(audioUrl);

    updateStep('tts', {
      result: {
        text: textToSynthesize,
        duration: result.duration,
        size: result.audioData.length,
        url: audioUrl
      }
    });
  };

  // 运行完整测试
  const runFullTest = useCallback(async () => {
    setIsRunning(true);

    // 重置所有步骤状态
    setTestSteps(prev => prev.map(step => ({
      ...step,
      status: 'pending' as const,
      error: undefined,
      result: undefined
    })));

    // 清空结果
    setAsrResult('');
    setAiResponse('');
    setTtsAudioUrl('');
    setAudioBlob(null);

    try {
      // 依次执行所有测试步骤
      for (const step of testSteps) {
        await executeStep(step.id);

        // 每步之间短暂延迟
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('✅ 所有测试步骤完成');

    } catch (error: any) {
      console.error('❌ 测试失败:', error);
    } finally {
      setIsRunning(false);
      setCurrentStep(null);
    }
  }, [testSteps, executeStep]);

  // 重置测试
  const resetTest = () => {
    setTestSteps(prev => prev.map(step => ({
      ...step,
      status: 'pending' as const,
      error: undefined,
      result: undefined
    })));
    setAsrResult('');
    setAiResponse('');
    setTtsAudioUrl('');
    setAudioBlob(null);
    setCurrentStep(null);
  };

  // 获取状态图标
  const getStatusIcon = (status: TestStep['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 rounded-full bg-gray-300" />;
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="voice-interaction-tester bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <TestTube className="w-5 h-5 text-blue-500" />
          语音交互完整流程测试
        </h2>
        <div className="flex gap-2">
          <button
            onClick={resetTest}
            disabled={isRunning}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4 inline mr-1" />
            重置
          </button>
          <button
            onClick={runFullTest}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                运行中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                开始测试
              </>
            )}
          </button>
        </div>
      </div>

      {/* 测试步骤列表 */}
      <div className="space-y-4">
        {testSteps.map((step) => (
          <div
            key={step.id}
            className={`border rounded-lg p-4 transition-all ${
              currentStep === step.id
                ? 'border-blue-500 bg-blue-50'
                : step.status === 'error'
                ? 'border-red-500 bg-red-50'
                : step.status === 'success'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {getStatusIcon(step.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium">{step.name}</h3>
                  {step.duration && (
                    <span className="text-xs text-gray-500">
                      {step.duration}ms
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">{step.description}</p>

                {/* 显示结果 */}
                {step.result && (
                  <div className="bg-gray-50 rounded p-2 text-xs">
                    <div className="font-medium mb-1">测试结果:</div>
                    <pre className="whitespace-pre-wrap text-gray-700">
                      {JSON.stringify(step.result, null, 2)}
                    </pre>
                  </div>
                )}

                {/* 显示错误 */}
                {step.error && (
                  <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                    <div className="font-medium mb-1">错误信息:</div>
                    <div>{step.error}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 测试结果展示 */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="font-medium mb-4">测试结果</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* ASR结果 */}
          {asrResult && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageCircle className="w-4 h-4 text-blue-500" />
                <h4 className="font-medium">语音识别结果</h4>
              </div>
              <p className="text-sm">{asrResult}</p>
            </div>
          )}

          {/* AI回复结果 */}
          {aiResponse && (
            <div className="bg-green-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-green-500" />
                <h4 className="font-medium">AI回复</h4>
              </div>
              <p className="text-sm">{aiResponse}</p>
            </div>
          )}
        </div>

        {/* TTS音频播放 */}
        {ttsAudioUrl && (
          <div className="mt-4 bg-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-purple-500" />
                <h4 className="font-medium">合成语音</h4>
              </div>
              <audio
                controls
                src={ttsAudioUrl}
                className="w-full max-w-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* 调试提示 */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <h4 className="font-medium text-yellow-800">调试提示</h4>
          </div>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• 打开浏览器开发者工具查看详细日志</li>
            <li>• 在.env文件中设置 <code>VITE_DEBUG_VOICE=true</code> 启用详细日志</li>
            <li>• 确保Ollama服务已启动: <code>ollama serve</code></li>
            <li>• 确保已下载模型: <code>ollama pull qwen2.5:7b</code></li>
            <li>• 检查腾讯云API密钥配置</li>
          </ul>
        </div>
      </div>
    </div>
  );
};