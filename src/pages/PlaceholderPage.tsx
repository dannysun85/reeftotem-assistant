/**
 * Placeholder Page
 * Generic "Coming Soon" page for unimplemented routes.
 */

import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bot,
  BookOpen,
  GitBranch,
  Clock,
  Puzzle,
  Radio,
  LayoutDashboard,
  Construction,
} from 'lucide-react';

const PAGE_META: Record<string, { icon: typeof Bot; labelKey: string }> = {
  '/agents': { icon: Bot, labelKey: 'sidebar.agents' },
  '/knowledge': { icon: BookOpen, labelKey: 'sidebar.knowledge' },
  '/workflows': { icon: GitBranch, labelKey: 'sidebar.workflows' },
  '/cron': { icon: Clock, labelKey: 'sidebar.cronTasks' },
  '/skills': { icon: Puzzle, labelKey: 'sidebar.skills' },
  '/channels': { icon: Radio, labelKey: 'sidebar.channels' },
  '/dashboard': { icon: LayoutDashboard, labelKey: 'sidebar.dashboard' },
};

export default function PlaceholderPage() {
  const location = useLocation();
  const { t } = useTranslation('common');

  const meta = PAGE_META[location.pathname];
  const Icon = meta?.icon ?? Construction;

  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">
            {meta ? t(meta.labelKey) : t('placeholder.unknown', '未知页面')}
          </h2>
          <p className="text-muted-foreground text-center">
            {t('placeholder.comingSoon', '此功能即将推出，敬请期待！')}
          </p>
          <Construction className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </div>
  );
}
