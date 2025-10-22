import React from 'react';
import { Badge } from './badge';
import { cn } from '@/lib/utils';

// 状态类型
export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'loading';

// 状态配置
const statusConfig = {
  success: {
    className: 'bg-green-100 text-green-800 border-green-200',
    icon: '✓',
    label: '正常'
  },
  warning: {
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: '⚠',
    label: '警告'
  },
  error: {
    className: 'bg-red-100 text-red-800 border-red-200',
    icon: '✕',
    label: '错误'
  },
  info: {
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: 'ℹ',
    label: '信息'
  },
  loading: {
    className: 'bg-gray-100 text-gray-800 border-gray-200 animate-pulse',
    icon: '⟳',
    label: '加载中'
  }
};

// StatusIndicator 组件属性
export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  showIcon?: boolean;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'solid';
  className?: string;
  children?: React.ReactNode;
}

/**
 * 状态指示器组件
 * 用于显示各种状态的视觉指示器
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  showIcon = true,
  showLabel = true,
  size = 'md',
  variant = 'default',
  className,
  children
}) => {
  const config = statusConfig[status];
  const displayLabel = label || config.label;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  const variantClasses = {
    default: config.className,
    outline: `border ${config.className.split(' ')[0]} border-current bg-transparent text-current`,
    solid: config.className
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium transition-colors',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
    >
      {showIcon && (
        <span className={cn(iconSizes[size], status === 'loading' && 'animate-spin')}>
          {config.icon}
        </span>
      )}
      {showLabel && (
        <span>{displayLabel}</span>
      )}
      {children}
    </div>
  );
};

// 服务状态指示器组件
export interface ServiceStatusProps {
  name: string;
  status: StatusType;
  lastCheck?: Date;
  details?: string;
  compact?: boolean;
}

/**
 * 服务状态指示器组件
 * 专门用于显示服务状态
 */
export const ServiceStatus: React.FC<ServiceStatusProps> = ({
  name,
  status,
  lastCheck,
  details,
  compact = false
}) => {
  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <StatusIndicator status={status} size="sm" showLabel={false} />
        <span className="text-sm font-medium">{name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center space-x-3">
        <StatusIndicator status={status} size="sm" />
        <div>
          <p className="font-medium">{name}</p>
          {details && (
            <p className="text-sm text-gray-600">{details}</p>
          )}
        </div>
      </div>
      {lastCheck && (
        <div className="text-right">
          <p className="text-xs text-gray-500">最后检查</p>
          <p className="text-xs text-gray-500">
            {lastCheck.toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
};

// 连接状态指示器组件
export interface ConnectionStatusProps {
  connected: boolean;
  service: string;
  latency?: number;
  error?: string;
  onRetry?: () => void;
}

/**
 * 连接状态指示器组件
 * 专门用于显示网络连接状态
 */
export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  connected,
  service,
  latency,
  error,
  onRetry
}) => {
  const status: StatusType = connected ? 'success' : 'error';
  const latencyText = latency ? `${latency}ms` : '';

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center space-x-3">
        <StatusIndicator
          status={connected ? 'success' : 'error'}
          size="sm"
          showLabel={false}
        />
        <div>
          <p className="font-medium">{service}</p>
          {connected && latency && (
            <p className="text-sm text-green-600">延迟: {latencyText}</p>
          )}
          {!connected && error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>
      </div>
      {!connected && onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          重试
        </button>
      )}
    </div>
  );
};

// 加载状态指示器组件
export interface LoadingStatusProps {
  message?: string;
  progress?: number;
  showProgress?: boolean;
}

/**
 * 加载状态指示器组件
 * 专门用于显示加载状态
 */
export const LoadingStatus: React.FC<LoadingStatusProps> = ({
  message = '加载中...',
  progress,
  showProgress = false
}) => {
  return (
    <div className="flex flex-col items-center space-y-3 p-4">
      <StatusIndicator status="loading" size="lg" showLabel={false} />
      <p className="text-sm text-gray-600">{message}</p>
      {showProgress && progress !== undefined && (
        <div className="w-full max-w-xs">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>进度</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// 系统健康状态组件
export interface SystemHealthProps {
  overall: 'healthy' | 'warning' | 'error';
  services: Array<{
    name: string;
    status: StatusType;
    details?: string;
  }>;
  lastCheck: Date;
}

/**
 * 系统健康状态组件
 * 显示整个系统的健康状态
 */
export const SystemHealth: React.FC<SystemHealthProps> = ({
  overall,
  services,
  lastCheck
}) => {
  const overallStatus: StatusType =
    overall === 'healthy' ? 'success' :
    overall === 'warning' ? 'warning' : 'error';

  const overallLabels = {
    healthy: '系统正常',
    warning: '系统警告',
    error: '系统错误'
  };

  return (
    <div className="space-y-4">
      {/* 总体状态 */}
      <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
        <div className="flex items-center space-x-3">
          <StatusIndicator status={overallStatus} />
          <div>
            <p className="font-semibold">{overallLabels[overall]}</p>
            <p className="text-sm text-gray-600">
              {services.filter(s => s.status === 'success').length} / {services.length} 服务正常
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">最后检查</p>
          <p className="text-xs text-gray-500">
            {lastCheck.toLocaleString()}
          </p>
        </div>
      </div>

      {/* 各服务状态 */}
      <div className="space-y-2">
        {services.map((service, index) => (
          <ServiceStatus
            key={index}
            name={service.name}
            status={service.status}
            details={service.details}
            compact={true}
          />
        ))}
      </div>
    </div>
  );
};

export default StatusIndicator;