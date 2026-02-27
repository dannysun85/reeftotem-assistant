/**
 * Header Component
 * Top navigation bar with page title, search, notifications, and theme toggle.
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu';
import { useSettingsStore } from '@/stores/settings-store';
import {
  Search,
  Bell,
  Settings,
  Moon,
  Sun,
  Monitor,
  HelpCircle,
} from 'lucide-react';

export function Header() {
  const { t } = useTranslation('common');
  const { theme, setTheme } = useSettingsStore();

  return (
    <header className="h-16 border-b bg-card px-6 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold">Reeftotem Assistant</h1>
        <Badge variant="secondary">Beta</Badge>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="icon">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Bell className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t('header.theme', '主题')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={theme === 'light'}
              onCheckedChange={() => setTheme('light')}
            >
              <Sun className="mr-2 h-4 w-4" />
              {t('header.lightMode', '浅色模式')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={theme === 'dark'}
              onCheckedChange={() => setTheme('dark')}
            >
              <Moon className="mr-2 h-4 w-4" />
              {t('header.darkMode', '深色模式')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={theme === 'system'}
              onCheckedChange={() => setTheme('system')}
            >
              <Monitor className="mr-2 h-4 w-4" />
              {t('header.systemMode', '跟随系统')}
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <HelpCircle className="mr-2 h-4 w-4" />
              {t('header.help', '帮助中心')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
