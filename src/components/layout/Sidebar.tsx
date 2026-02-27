/**
 * Sidebar Component
 * Application navigation sidebar with ClawX navigation items.
 */

import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSettingsStore } from '@/stores/settings-store';
import {
  MessageSquare,
  Bot,
  BookOpen,
  GitBranch,
  LayoutDashboard,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
  User,
  LogOut,
  Radio,
  Puzzle,
  Clock,
  Wrench,
  ArrowLeftRight,
} from 'lucide-react';

const NAV_ITEMS = [
  { icon: MessageSquare, labelKey: 'sidebar.chat', path: '/' },
  { icon: Bot, labelKey: 'sidebar.agents', path: '/agents' },
  { icon: BookOpen, labelKey: 'sidebar.knowledge', path: '/knowledge' },
  { icon: GitBranch, labelKey: 'sidebar.workflows', path: '/workflows' },
  { icon: Radio, labelKey: 'sidebar.channels', path: '/channels' },
  { icon: Puzzle, labelKey: 'sidebar.skills', path: '/skills' },
  { icon: Wrench, labelKey: 'sidebar.mcpTools', path: '/mcp' },
  { icon: ArrowLeftRight, labelKey: 'sidebar.a2a', path: '/a2a' },
  { icon: Clock, labelKey: 'sidebar.cronTasks', path: '/cron' },
  { icon: LayoutDashboard, labelKey: 'sidebar.dashboard', path: '/dashboard' },
  { icon: Settings, labelKey: 'sidebar.settings', path: '/settings' },
] as const;

export function Sidebar() {
  const { t } = useTranslation('common');
  const { sidebarCollapsed, toggleSidebar } = useSettingsStore();

  const handleShowPet = async () => {
    try {
      await invoke('show_live2d_window');
    } catch (error) {
      console.error('Failed to show Live2D pet:', error);
    }
  };

  return (
    <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} border-r bg-card flex flex-col transition-all duration-200`}>
      {/* Sidebar Header */}
      <div className="flex h-16 items-center px-4 border-b">
        <div className={`flex items-center space-x-2 ${sidebarCollapsed && 'justify-center'}`}>
          <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
            <Bot className="h-5 w-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <span className="text-lg font-semibold">Reeftotem</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="ml-auto"
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-4 flex-1">
        <div className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  sidebarCollapsed ? 'justify-center px-2' : ''
                } ${
                  isActive
                    ? 'bg-secondary text-secondary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && (
                <span className="ml-2">{t(item.labelKey)}</span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* User Menu */}
      <div className="p-4 border-t">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={`w-full justify-start ${sidebarCollapsed && 'justify-center px-2'}`}>
              <UserCircle className="h-4 w-4" />
              {!sidebarCollapsed && (
                <span className="ml-2">{t('nav.user', '用户')}</span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{t('nav.myAccount', '我的账户')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              {t('nav.profile', '个人资料')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShowPet}>
              <Bot className="mr-2 h-4 w-4" />
              {t('nav.showPet', '显示宠物')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => invoke('exit_app').catch(console.error)}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t('nav.logout', '退出登录')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
