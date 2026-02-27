/**
 * AgentTemplateSelector
 * Predefined agent templates for quick creation.
 */

import { useTranslation } from 'react-i18next';
import type { AgentConfig } from '@/types/agent';

const AGENT_TEMPLATES: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Blank Agent',
    avatar: '🤖',
    description: 'Start from scratch',
    systemPrompt: '',
    providerId: null,
    model: '',
    temperature: 0.7,
    maxTokens: null,
    skillIds: [],
    knowledgeBaseIds: [],
    channelBindings: [],
    isDefault: false,
  },
  {
    name: 'Coding Assistant',
    avatar: '💻',
    description: 'Expert programmer for code generation and debugging',
    systemPrompt: 'You are an expert programmer. Help users write, debug, and optimize code. Provide clear explanations and follow best practices.',
    providerId: null,
    model: '',
    temperature: 0.3,
    maxTokens: null,
    skillIds: [],
    knowledgeBaseIds: [],
    channelBindings: [],
    isDefault: false,
  },
  {
    name: 'Creative Writer',
    avatar: '✍️',
    description: 'Imaginative writer for stories, articles, and more',
    systemPrompt: 'You are a creative writer. Help users write engaging stories, articles, poems, and other creative content.',
    providerId: null,
    model: '',
    temperature: 0.9,
    maxTokens: null,
    skillIds: [],
    knowledgeBaseIds: [],
    channelBindings: [],
    isDefault: false,
  },
  {
    name: 'Translator',
    avatar: '🌐',
    description: 'Multi-language translation specialist',
    systemPrompt: 'You are a professional translator. Translate text accurately while preserving meaning, tone, and context. Support multiple languages.',
    providerId: null,
    model: '',
    temperature: 0.3,
    maxTokens: null,
    skillIds: [],
    knowledgeBaseIds: [],
    channelBindings: [],
    isDefault: false,
  },
  {
    name: 'Data Analyst',
    avatar: '📊',
    description: 'Analyze data and generate insights',
    systemPrompt: 'You are a data analyst. Help users analyze data, create reports, and generate actionable insights. Explain complex concepts clearly.',
    providerId: null,
    model: '',
    temperature: 0.5,
    maxTokens: null,
    skillIds: [],
    knowledgeBaseIds: [],
    channelBindings: [],
    isDefault: false,
  },
  {
    name: 'Tutor',
    avatar: '📚',
    description: 'Patient teacher for learning any subject',
    systemPrompt: 'You are a patient and knowledgeable tutor. Explain concepts clearly, use examples, and adapt to the learner\'s level. Encourage questions.',
    providerId: null,
    model: '',
    temperature: 0.6,
    maxTokens: null,
    skillIds: [],
    knowledgeBaseIds: [],
    channelBindings: [],
    isDefault: false,
  },
  {
    name: 'Chat Companion',
    avatar: '🎭',
    description: 'Friendly conversational partner',
    systemPrompt: 'You are a friendly and empathetic companion. Engage in natural conversation, share perspectives, and be supportive.',
    providerId: null,
    model: '',
    temperature: 0.8,
    maxTokens: null,
    skillIds: [],
    knowledgeBaseIds: [],
    channelBindings: [],
    isDefault: false,
  },
];

interface AgentTemplateSelectorProps {
  onSelect: (template: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export default function AgentTemplateSelector({ onSelect }: AgentTemplateSelectorProps) {
  const { t } = useTranslation('agents');

  return (
    <div className="grid grid-cols-2 gap-3">
      {AGENT_TEMPLATES.map((template, i) => (
        <button
          key={i}
          onClick={() => onSelect(template)}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left"
        >
          <span className="text-2xl">{template.avatar}</span>
          <div className="min-w-0">
            <div className="text-sm font-medium">{template.name}</div>
            <div className="text-xs text-muted-foreground truncate">{template.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
