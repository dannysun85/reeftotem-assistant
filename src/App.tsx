import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { MainLayout } from '@/components/layout';
import ChatPage from '@/pages/ChatPage';
import SettingsPage from '@/pages/SettingsPage';
import AgentsPage from '@/pages/AgentsPage';
import DashboardPage from '@/pages/DashboardPage';
import KnowledgePage from '@/pages/KnowledgePage';
import WorkflowPage from '@/pages/WorkflowPage';
import ChannelsPage from '@/pages/ChannelsPage';
import SkillsPage from '@/pages/SkillsPage';
import CronPage from '@/pages/CronPage';
import McpPage from '@/pages/McpPage';
import A2aPage from '@/pages/A2aPage';
import SpotlightPage from '@/pages/SpotlightPage';
import SetupPage from '@/pages/SetupPage';

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Routes>
        {/* Standalone pages (no MainLayout) */}
        <Route path="spotlight" element={<SpotlightPage />} />
        <Route path="setup" element={<SetupPage />} />
        {/* Main app with sidebar */}
        <Route element={<MainLayout />}>
          <Route index element={<ChatPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="knowledge" element={<KnowledgePage />} />
          <Route path="workflows" element={<WorkflowPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="skills" element={<SkillsPage />} />
          <Route path="mcp" element={<McpPage />} />
          <Route path="a2a" element={<A2aPage />} />
          <Route path="cron" element={<CronPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
