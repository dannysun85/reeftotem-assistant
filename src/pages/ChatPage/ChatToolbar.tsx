/**
 * ChatToolbar
 * Shows current agent info, agent selector, provider badge, new session button, and refresh.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAgentsStore } from '@/stores/agents-store';
import { useProvidersStore } from '@/stores/providers-store';
import { useChatStore } from '@/stores/chat-store';
import { useSettingsStore } from '@/stores/settings-store';
import { Bot, RefreshCw, Plus, Settings, Volume2, VolumeX } from 'lucide-react';

export default function ChatToolbar() {
  const { t } = useTranslation('chat');
  const navigate = useNavigate();
  const { agents, activeAgentId, setActiveAgent, getActiveAgent, fetchAgents, fetchActiveAgentId } = useAgentsStore();
  const { providers, defaultProviderId, fetchProviders, fetchDefaultProvider } = useProvidersStore();
  const { newSession } = useChatStore();
  const { autoTtsEnabled, setAutoTtsEnabled } = useSettingsStore();
  const activeAgent = getActiveAgent();
  const [refreshing, setRefreshing] = useState(false);

  // Resolve which provider/model will be used
  const resolvedProviderId = activeAgent?.providerId || defaultProviderId;
  const resolvedProvider = providers.find((p) => p.id === resolvedProviderId);
  const resolvedModel = activeAgent?.model || resolvedProvider?.model || null;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchAgents(), fetchActiveAgentId(), fetchProviders(), fetchDefaultProvider()]);
    setRefreshing(false);
  }, [fetchAgents, fetchActiveAgentId, fetchProviders, fetchDefaultProvider]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-card shrink-0">
      {/* Agent selector */}
      {agents.length === 0 ? (
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {t('toolbar.noAgent', '未配置智能体')}
          </span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate('/agents')}>
            <Settings className="h-3 w-3 mr-1" />
            {t('toolbar.configAgent', '去配置')}
          </Button>
        </div>
      ) : (
        <>
          <span className="text-lg">{activeAgent?.avatar ?? '🤖'}</span>
          <Select value={activeAgentId ?? ''} onValueChange={(id) => setActiveAgent(id)}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder={t('toolbar.selectAgent', '选择智能体')} />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <span className="flex items-center gap-2">
                    <span>{a.avatar}</span>
                    <span>{a.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}

      {/* Right side controls */}
      <div className="flex items-center gap-1.5 ml-auto">
        {/* Provider + Model info */}
        {resolvedProvider && (
          <Badge variant="outline" className="text-[10px] font-normal">
            {resolvedProvider.name}
          </Badge>
        )}
        {resolvedModel && (
          <Badge variant="secondary" className="text-[10px] font-normal">
            {resolvedModel}
          </Badge>
        )}

        {/* TTS toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setAutoTtsEnabled(!autoTtsEnabled)}
            >
              {autoTtsEnabled ? (
                <Volume2 className="h-3.5 w-3.5" />
              ) : (
                <VolumeX className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {autoTtsEnabled
              ? t('tts.autoOn', '关闭自动朗读')
              : t('tts.autoOff', '开启自动朗读')}
          </TooltipContent>
        </Tooltip>

        {/* New session */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={newSession}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('toolbar.newSession', '新会话')}</TooltipContent>
        </Tooltip>

        {/* Refresh */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('toolbar.refresh', '刷新聊天')}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
