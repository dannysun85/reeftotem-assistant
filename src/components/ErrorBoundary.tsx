import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, RefreshCw, Bug, Copy, Mail, FileText, Trash2, RotateCcw } from 'lucide-react';

// 错误类型枚举
export enum ErrorType {
  LIVE2D_LOAD = 'LIVE2D_LOAD',
  AUDIO_ACCESS = 'AUDIO_ACCESS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RENDER_ERROR = 'RENDER_ERROR',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 错误详情接口
interface ErrorDetails {
  type: ErrorType;
  message: string;
  stack?: string;
  timestamp: Date;
  userAgent: string;
  url: string;
  componentStack?: string;
  additionalInfo?: Record<string, any>;
}

// 错误日志存储接口
interface ErrorLog {
  id: string;
  details: ErrorDetails;
  resolved: boolean;
  resolvedAt?: Date;
}

// Props接口
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  enableErrorLogging?: boolean;
  maxLogs?: number;
}

// State接口
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorLogs: ErrorLog[];
  selectedErrorId: string | null;
  showDetails: boolean;
}

/**
 * Live2D错误边界组件
 * 用于捕获和处理Live2D相关错误，提供友好的错误显示和恢复机制
 */
export class Live2DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private errorReportingEndpoint = process.env.NODE_ENV === 'production'
    ? 'https://api.reeftotem.com/errors'
    : null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorLogs: [],
      selectedErrorId: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo
    });

    // 生成错误详情
    const errorDetails: ErrorDetails = {
      type: this.categorizeError(error),
      message: error.message,
      stack: error.stack,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      componentStack: errorInfo.componentStack,
      additionalInfo: this.getAdditionalErrorInfo(error)
    };

    // 创建错误日志
    const errorLog: ErrorLog = {
      id: this.generateErrorId(),
      details: errorDetails,
      resolved: false
    };

    // 添加错误日志
    this.setState(prevState => ({
      errorLogs: [errorLog, ...prevState.errorLogs].slice(0, this.props.maxLogs || 50)
    }));

    // 调用外部错误处理回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 发送错误报告
    if (this.props.enableErrorLogging && this.errorReportingEndpoint) {
      this.reportError(errorDetails);
    }

    // 记录到控制台
    console.error('Live2D错误边界捕获到错误:', error, errorInfo);
  }

  // 错误分类
  private categorizeError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    if (message.includes('live2d') || stack.includes('live2d')) {
      if (message.includes('load') || message.includes('init')) {
        return ErrorType.LIVE2D_LOAD;
      }
      return ErrorType.RENDER_ERROR;
    }

    if (message.includes('microphone') || message.includes('audio') || message.includes('getusermedia')) {
      return ErrorType.AUDIO_ACCESS;
    }

    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
      return ErrorType.NETWORK_ERROR;
    }

    if (message.includes('config') || message.includes('environment')) {
      return ErrorType.CONFIGURATION_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  // 获取额外的错误信息
  private getAdditionalErrorInfo(error: Error): Record<string, any> {
    const info: Record<string, any> = {
      timestamp: new Date().toISOString(),
      page: window.location.pathname,
      live2dLoaded: !!(window as any).Live2DCubismCore,
      webglSupported: !!this.checkWebGLSupport(),
      audioContextSupported: !!(window.AudioContext || (window as any).webkitAudioContext)
    };

    // 尝试获取Live2D相关状态
    try {
      if ((window as any).live2dManager) {
        info.live2dManagerState = (window as any).live2dManager.getState?.();
      }
    } catch (e) {
      // 忽略获取状态时的错误
    }

    return info;
  }

  // 检查WebGL支持
  private checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  // 生成错误ID
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 发送错误报告
  private async reportError(errorDetails: ErrorDetails): Promise<void> {
    if (!this.errorReportingEndpoint) return;

    try {
      await fetch(this.errorReportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorDetails)
      });
    } catch (reportingError) {
      console.error('发送错误报告失败:', reportingError);
    }
  }

  // 重试恢复
  private handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });

    // 刷新页面以重新加载资源
    window.location.reload();
  };

  // 标记错误为已解决
  private handleResolveError = (errorId: string): void => {
    this.setState(prevState => ({
      errorLogs: prevState.errorLogs.map(log =>
        log.id === errorId
          ? { ...log, resolved: true, resolvedAt: new Date() }
          : log
      )
    }));
  };

  // 删除错误日志
  private handleDeleteError = (errorId: string): void => {
    this.setState(prevState => ({
      errorLogs: prevState.errorLogs.filter(log => log.id !== errorId)
    }));
  };

  // 清除所有错误日志
  private handleClearAllErrors = (): void => {
    this.setState({
      errorLogs: []
    });
  };

  // 复制错误详情
  private handleCopyErrorDetails = (errorDetails: ErrorDetails): void => {
    const detailsText = `
错误类型: ${errorDetails.type}
错误消息: ${errorDetails.message}
发生时间: ${errorDetails.timestamp.toISOString()}
页面地址: ${errorDetails.url}
浏览器: ${errorDetails.userAgent}

堆栈信息:
${errorDetails.stack || '无'}

组件堆栈:
${errorDetails.componentStack || '无'}

额外信息:
${JSON.stringify(errorDetails.additionalInfo, null, 2)}
    `.trim();

    navigator.clipboard.writeText(detailsText).then(() => {
      // 可以添加复制成功的提示
    }).catch(err => {
      console.error('复制失败:', err);
    });
  };

  // 发送错误反馈
  private handleSendFeedback = (errorDetails: ErrorDetails): void => {
    const subject = encodeURIComponent(`Live2D应用错误报告 - ${errorDetails.type}`);
    const body = encodeURIComponent(`
你好，

我在使用Live2D应用时遇到了以下错误：

错误类型: ${errorDetails.type}
错误消息: ${errorDetails.message}
发生时间: ${errorDetails.timestamp.toISOString()}

请帮助解决这个问题。

谢谢！
    `.trim());

    window.open(`mailto:support@reeftotem.com?subject=${subject}&body=${body}`);
  };

  // 获取错误类型显示名称
  private getErrorTypeDisplayName = (type: ErrorType): string => {
    const typeNames = {
      [ErrorType.LIVE2D_LOAD]: 'Live2D加载错误',
      [ErrorType.AUDIO_ACCESS]: '音频访问错误',
      [ErrorType.NETWORK_ERROR]: '网络连接错误',
      [ErrorType.RENDER_ERROR]: '渲染错误',
      [ErrorType.CONFIGURATION_ERROR]: '配置错误',
      [ErrorType.UNKNOWN_ERROR]: '未知错误'
    };
    return typeNames[type] || '未知错误';
  };

  // 获取错误类型颜色
  private getErrorTypeColor = (type: ErrorType): string => {
    const colors = {
      [ErrorType.LIVE2D_LOAD]: 'bg-red-100 text-red-800 border-red-200',
      [ErrorType.AUDIO_ACCESS]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      [ErrorType.NETWORK_ERROR]: 'bg-blue-100 text-blue-800 border-blue-200',
      [ErrorType.RENDER_ERROR]: 'bg-purple-100 text-purple-800 border-purple-200',
      [ErrorType.CONFIGURATION_ERROR]: 'bg-orange-100 text-orange-800 border-orange-200',
      [ErrorType.UNKNOWN_ERROR]: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[type] || colors[ErrorType.UNKNOWN_ERROR];
  };

  // 渲染错误界面
  private renderErrorInterface(): ReactNode {
    const { error, errorInfo, errorLogs, selectedErrorId, showDetails } = this.state;
    const selectedError = errorLogs.find(log => log.id === selectedErrorId);

    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full space-y-6">
          {/* 主要错误显示 */}
          <Card className="border-red-200">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-red-800">应用遇到错误</CardTitle>
              <CardDescription className="text-red-600">
                Live2D应用在运行过程中遇到了一个错误，但别担心，我们可以尝试解决这个问题。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 错误信息 */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h3 className="font-medium text-red-800 mb-2">错误详情:</h3>
                  <p className="text-sm text-red-700 font-mono">{error.message}</p>
                </div>
              )}

              {/* 快速修复建议 */}
              <div className="space-y-3">
                <h4 className="font-medium">快速修复建议:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    onClick={this.handleRetry}
                    className="w-full"
                    variant="default"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    重新加载应用
                  </Button>
                  <Button
                    onClick={() => window.location.reload()}
                    className="w-full"
                    variant="outline"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    强制刷新页面
                  </Button>
                </div>
              </div>

              {/* 错误类型 */}
              {error && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">错误类型:</span>
                  <Badge className={this.getErrorTypeColor(this.categorizeError(error))}>
                    {this.getErrorTypeDisplayName(this.categorizeError(error))}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 错误日志 */}
          {errorLogs.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">错误日志</CardTitle>
                    <CardDescription>最近发生的错误记录</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={this.handleClearAllErrors}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      清除
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => this.setState({ showDetails: !showDetails })}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      {showDetails ? '隐藏详情' : '显示详情'}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {errorLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedErrorId === log.id
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => this.setState({ selectedErrorId: log.id })}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge className={this.getErrorTypeColor(log.details.type)}>
                            {this.getErrorTypeDisplayName(log.details.type)}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {log.details.timestamp.toLocaleTimeString()}
                          </span>
                          {log.resolved && (
                            <Badge variant="outline" className="text-green-600">
                              已解决
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          {!log.resolved && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                this.handleResolveError(log.id);
                              }}
                            >
                              标记解决
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              this.handleDeleteError(log.id);
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 truncate">{log.details.message}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 选中错误的详细信息 */}
          {selectedError && showDetails && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">错误详细信息</CardTitle>
                <CardDescription>错误 #{selectedError.id} 的完整信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">错误类型:</span>
                    <Badge className={`ml-2 ${this.getErrorTypeColor(selectedError.details.type)}`}>
                      {this.getErrorTypeDisplayName(selectedError.details.type)}
                    </Badge>
                  </div>
                  <div>
                    <span className="font-medium">发生时间:</span>
                    <span className="ml-2">{selectedError.details.timestamp.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <span className="font-medium text-sm">错误消息:</span>
                  <div className="mt-1 p-2 bg-gray-50 rounded text-sm font-mono">
                    {selectedError.details.message}
                  </div>
                </div>

                {selectedError.details.stack && (
                  <div>
                    <span className="font-medium text-sm">堆栈信息:</span>
                    <div className="mt-1 p-2 bg-gray-50 rounded text-xs font-mono max-h-32 overflow-y-auto">
                      {selectedError.details.stack}
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => this.handleCopyErrorDetails(selectedError.details)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    复制详情
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => this.handleSendFeedback(selectedError.details)}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    发送反馈
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`https://github.com/reeftotem/assistant/issues`, '_blank')}
                  >
                    <Bug className="w-4 h-4 mr-2" />
                    查看已知问题
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // 渲染正常内容
  private renderNormalContent(): ReactNode {
    return this.props.children;
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return this.renderErrorInterface();
    }

    return this.renderNormalContent();
  }
}

// Live2D专用错误边界高阶组件
export const withLive2DErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) => {
  const WrappedComponent = (props: P) => (
    <Live2DErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </Live2DErrorBoundary>
  );

  WrappedComponent.displayName = `withLive2DErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

// 错误边界Hook（用于函数组件）
export const useErrorBoundary = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  return {
    error,
    setError: captureError,
    resetError
  };
};

export default Live2DErrorBoundary;