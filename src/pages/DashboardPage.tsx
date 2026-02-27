/**
 * Dashboard Page
 * Overview of system status, providers, agents, and quick actions.
 * Enhanced with uptime counter, recent activity, and dev mode support.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useProvidersStore } from '@/stores/providers-store';
import { useAgentsStore } from '@/stores/agents-store';
import { useSettingsStore } from '@/stores/settings-store';
import { getProviderIconUrl, shouldInvertInDark, getProviderTypeInfo } from '@/lib/providers';
import {
  Zap,
  Shield,
  Bot,
  UserCircle,
  MessageSquare,
  Plus,
  Settings,
  ArrowRight,
  Clock,
  Activity,
} from 'lucide-react';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds % 60}s`;
}

// Track app start time once per session
const APP_START_TIME = Date.now();

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { providers, fetchProviders, fetchDefaultProvider, defaultProviderId } = useProvidersStore();
  const { agents, fetchAgents, fetchActiveAgentId, getActiveAgent } = useAgentsStore();
  const devModeUnlocked = useSettingsStore((s) => s.devModeUnlocked);

  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    fetchProviders();
    fetchDefaultProvider();
    fetchAgents();
    fetchActiveAgentId();
  }, []);

  // Live uptime counter
  useEffect(() => {
    const update = () => setUptime(Math.floor((Date.now() - APP_START_TIME) / 1000));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeAgent = getActiveAgent();
  const enabledProviders = providers.filter((p) => p.enabled);

  const statCards = [
    {
      icon: Zap,
      title: t('stats.mode', 'AI Mode'),
      value: <Badge variant="secondary">{t('stats.directMode', 'Direct Mode')}</Badge>,
      color: 'text-yellow-500',
    },
    {
      icon: Shield,
      title: t('stats.providers', 'Providers'),
      value: <span className="text-2xl font-bold">{enabledProviders.length}</span>,
      subtitle: t('stats.providersConfigured', 'configured'),
      onClick: () => navigate('/settings'),
      color: 'text-blue-500',
    },
    {
      icon: Bot,
      title: t('stats.agents', 'Agents'),
      value: <span className="text-2xl font-bold">{agents.length}</span>,
      subtitle: t('stats.agentsCreated', 'created'),
      onClick: () => navigate('/agents'),
      color: 'text-green-500',
    },
    {
      icon: Clock,
      title: t('stats.uptime', 'Uptime'),
      value: <span className="text-lg font-mono font-medium">{formatUptime(uptime)}</span>,
      color: 'text-orange-500',
    },
  ];

  const quickActions = [
    { icon: MessageSquare, label: t('actions.newChat', 'New Chat'), onClick: () => navigate('/') },
    { icon: Plus, label: t('actions.addProvider', 'Add Provider'), onClick: () => navigate('/settings') },
    { icon: Bot, label: t('actions.createAgent', 'Create Agent'), onClick: () => navigate('/agents') },
    { icon: Settings, label: t('actions.settings', 'Settings'), onClick: () => navigate('/settings') },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">{t('title', 'Dashboard')}</h2>
          <p className="text-muted-foreground">{t('description', 'Overview of your AI assistant')}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((card, i) => (
            <Card
              key={i}
              className={card.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}
              onClick={card.onClick}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`h-8 w-8 rounded-lg bg-muted flex items-center justify-center ${card.color}`}>
                    <card.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
                  {card.onClick && <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />}
                </div>
                <div>{card.value}</div>
                {card.subtitle && (
                  <p className="text-xs text-muted-foreground mt-1">{card.subtitle}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Agent Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-purple-500" />
              {t('stats.activeAgent', 'Active Agent')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeAgent ? (
              <div className="flex items-center gap-4">
                <span className="text-3xl">{activeAgent.avatar}</span>
                <div className="flex-1">
                  <p className="font-medium">{activeAgent.name}</p>
                  {activeAgent.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">{activeAgent.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {activeAgent.model && <Badge variant="outline">{activeAgent.model}</Badge>}
                  {activeAgent.isDefault && <Badge variant="secondary">Default</Badge>}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">{t('stats.noActiveAgent', 'No agent selected')}</p>
                <Button variant="outline" size="sm" onClick={() => navigate('/agents')}>
                  {t('actions.createAgent', 'Create Agent')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('quickActions', 'Quick Actions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
              {quickActions.map((action, i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="h-auto py-4 flex flex-col items-center gap-2"
                  onClick={action.onClick}
                >
                  <action.icon className="h-5 w-5" />
                  <span className="text-sm">{action.label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              {t('recentActivity', 'Recent Activity')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Configured Providers */}
            <div>
              <p className="text-sm font-medium mb-2">{t('stats.providers', 'Providers')}</p>
              {enabledProviders.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {enabledProviders.slice(0, 8).map((p) => {
                    const iconUrl = getProviderIconUrl(p.type);
                    return (
                      <Badge key={p.id} variant="outline" className="flex items-center gap-1.5 py-1">
                        {iconUrl ? (
                          <img
                            src={iconUrl}
                            alt={p.name}
                            className={`h-3.5 w-3.5 ${shouldInvertInDark(p.type) ? 'dark:invert' : ''}`}
                          />
                        ) : null}
                        <span>{p.name}</span>
                        {p.hasKey && <span className="text-green-500 text-[10px]">&#10003;</span>}
                        {p.id === defaultProviderId && <span className="text-yellow-500 text-[10px]">&#9733;</span>}
                      </Badge>
                    );
                  })}
                  {enabledProviders.length > 8 && (
                    <Badge variant="secondary">+{enabledProviders.length - 8} more</Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('noProviders', 'No providers configured')}</p>
              )}
            </div>

            {/* Agents */}
            <div>
              <p className="text-sm font-medium mb-2">{t('stats.agents', 'Agents')}</p>
              {agents.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {agents.slice(0, 12).map((a) => (
                    <Badge key={a.id} variant="outline" className="flex items-center gap-1 py-1">
                      <span>{a.avatar}</span>
                      <span>{a.name}</span>
                    </Badge>
                  ))}
                  {agents.length > 12 && (
                    <Badge variant="secondary">+{agents.length - 12} more</Badge>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('noAgents', 'No agents created')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dev Info - only when dev mode is on */}
        {devModeUnlocked && (
          <Card className="border-dashed border-yellow-500/50">
            <CardHeader>
              <CardTitle className="text-lg text-yellow-600 dark:text-yellow-400">
                {t('devInfo', 'Developer Info')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted p-3 text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Mode</span>
                  <span>Direct (Local)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Providers</span>
                  <span>{enabledProviders.length} enabled / {providers.length} total</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Agents</span>
                  <span>{agents.length} total</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Session Uptime</span>
                  <span>{formatUptime(uptime)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
