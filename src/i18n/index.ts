import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// EN
import enCommon from './locales/en/common.json';
import enSettings from './locales/en/settings.json';
import enDashboard from './locales/en/dashboard.json';
import enChat from './locales/en/chat.json';
import enChannels from './locales/en/channels.json';
import enSkills from './locales/en/skills.json';
import enMcp from './locales/en/mcp.json';
import enA2a from './locales/en/a2a.json';
import enCron from './locales/en/cron.json';
import enSetup from './locales/en/setup.json';
import enAgents from './locales/en/agents.json';
import enSpotlight from './locales/en/spotlight.json';
import enKnowledge from './locales/en/knowledge.json';
import enWorkflows from './locales/en/workflows.json';

// ZH
import zhCommon from './locales/zh/common.json';
import zhSettings from './locales/zh/settings.json';
import zhDashboard from './locales/zh/dashboard.json';
import zhChat from './locales/zh/chat.json';
import zhChannels from './locales/zh/channels.json';
import zhSkills from './locales/zh/skills.json';
import zhMcp from './locales/zh/mcp.json';
import zhA2a from './locales/zh/a2a.json';
import zhCron from './locales/zh/cron.json';
import zhSetup from './locales/zh/setup.json';
import zhAgents from './locales/zh/agents.json';
import zhSpotlight from './locales/zh/spotlight.json';
import zhKnowledge from './locales/zh/knowledge.json';
import zhWorkflows from './locales/zh/workflows.json';

// JA
import jaCommon from './locales/ja/common.json';
import jaSettings from './locales/ja/settings.json';
import jaDashboard from './locales/ja/dashboard.json';
import jaChat from './locales/ja/chat.json';
import jaChannels from './locales/ja/channels.json';
import jaSkills from './locales/ja/skills.json';
import jaMcp from './locales/ja/mcp.json';
import jaA2a from './locales/ja/a2a.json';
import jaCron from './locales/ja/cron.json';
import jaSetup from './locales/ja/setup.json';
import jaAgents from './locales/ja/agents.json';
import jaSpotlight from './locales/ja/spotlight.json';
import jaKnowledge from './locales/ja/knowledge.json';
import jaWorkflows from './locales/ja/workflows.json';

export const SUPPORTED_LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
    { code: 'ja', label: '日本語' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const resources = {
    en: {
        common: enCommon,
        settings: enSettings,
        dashboard: enDashboard,
        chat: enChat,
        channels: enChannels,
        skills: enSkills,
        mcp: enMcp,
        a2a: enA2a,
        cron: enCron,
        setup: enSetup,
        agents: enAgents,
        spotlight: enSpotlight,
        knowledge: enKnowledge,
        workflows: enWorkflows,
    },
    zh: {
        common: zhCommon,
        settings: zhSettings,
        dashboard: zhDashboard,
        chat: zhChat,
        channels: zhChannels,
        skills: zhSkills,
        mcp: zhMcp,
        a2a: zhA2a,
        cron: zhCron,
        setup: zhSetup,
        agents: zhAgents,
        spotlight: zhSpotlight,
        knowledge: zhKnowledge,
        workflows: zhWorkflows,
    },
    ja: {
        common: jaCommon,
        settings: jaSettings,
        dashboard: jaDashboard,
        chat: jaChat,
        channels: jaChannels,
        skills: jaSkills,
        mcp: jaMcp,
        a2a: jaA2a,
        cron: jaCron,
        setup: jaSetup,
        agents: jaAgents,
        spotlight: jaSpotlight,
        knowledge: jaKnowledge,
        workflows: jaWorkflows,
    },
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'zh',
        fallbackLng: 'en',
        defaultNS: 'common',
        ns: ['common', 'settings', 'dashboard', 'chat', 'channels', 'skills', 'mcp', 'a2a', 'cron', 'setup', 'agents', 'spotlight', 'knowledge', 'workflows'],
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;
