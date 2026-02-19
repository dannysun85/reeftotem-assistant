// AI大模型服务
// 提供智能对话生成功能，支持多种AI模型

// AI模型配置接口
export interface AIModelConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'local';
  apiKey?: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

// AI对话消息接口
export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

// AI回复结果接口
export interface AIResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timestamp: number;
  responseTime: number;
}

/**
 * AI大模型服务类
 * 提供智能对话生成功能
 */
export class AIService {
  private static instance: AIService;
  private config: AIModelConfig;
  private conversationHistory: AIMessage[] = [];

  constructor() {
    // 从环境变量读取配置
    const provider = (import.meta.env.VITE_AI_PROVIDER as any) || 'ollama';

    let config: AIModelConfig = {
      provider,
      model: 'default',
      temperature: parseFloat(import.meta.env.VITE_AI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(import.meta.env.VITE_AI_MAX_TOKENS || '1000'),
      systemPrompt: `你是Reeftotem Assistant，一个可爱、友善、智能的AI助手。你的特点：
1. 性格温柔可爱，有时会带点小幽默
2. 回答简洁明了，通常在100字以内
3. 对用户表现出关心和友好
4. 适当使用表情符号和语气词
5. 可以聊日常话题、提供帮助和建议

请用自然的中文回复，就像一个好朋友在聊天一样。`
    };

    // 根据不同的provider配置相应的参数
    switch (provider) {
      case 'ollama':
        config.model = import.meta.env.VITE_OLLAMA_MODEL || 'qwen2.5:7b';
        config.baseUrl = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434';
        break;
      case 'openai':
        config.apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        config.model = import.meta.env.VITE_OPENAI_MODEL || 'gpt-3.5-turbo';
        break;
      case 'anthropic':
        config.apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
        config.model = import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
        break;
      case 'local':
        config.model = 'local';
        break;
    }

    this.config = config;

    // 调试日志
    if (import.meta.env.VITE_DEBUG_AI === 'true') {
      console.log('🔧 AI服务初始化配置:', config);
    }
  }

  /**
   * 获取AI服务单例
   */
  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * 配置AI模型
   */
  configure(config: Partial<AIModelConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('AI服务配置已更新:', this.config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): AIModelConfig {
    return { ...this.config };
  }

  /**
   * 清空对话历史
   */
  clearHistory(): void {
    this.conversationHistory = [];
    console.log('AI对话历史已清空');
  }

  /**
   * 获取对话历史
   */
  getHistory(): AIMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * 生成AI回复
   */
  async generateResponse(userMessage: string): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const isDebug = import.meta.env.VITE_DEBUG_AI === 'true';

      if (isDebug) {
        console.log('🤖 开始生成AI回复...');
        console.log('📝 用户输入:', userMessage);
        console.log('🔧 当前AI配置:', this.config);
      }

      // 添加用户消息到历史
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
        timestamp: Date.now()
      });

      // 根据不同的provider调用相应的API
      let response: AIResponse;

      switch (this.config.provider) {
        case 'ollama':
          response = await this.callOllamaAPI(userMessage);
          break;
        case 'openai':
          response = await this.callOpenAIAPI(userMessage);
          break;
        case 'anthropic':
          response = await this.callAnthropicAPI(userMessage);
          break;
        case 'local':
          response = await this.generateLocalResponse(userMessage);
          break;
        default:
          throw new Error(`不支持的AI提供商: ${this.config.provider}`);
      }

      // 添加AI回复到历史
      this.conversationHistory.push({
        role: 'assistant',
        content: response.text,
        timestamp: Date.now()
      });

      // 限制历史记录长度
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      console.log('✅ AI回复生成完成:', response.text);
      return response;

    } catch (error: any) {
      console.error('❌ AI回复生成失败:', error);

      // 降级到本地回复
      console.log('🔄 降级到本地回复生成...');
      return this.generateLocalResponse(userMessage);
    }
  }

  /**
   * 调用Ollama API
   */
  private async callOllamaAPI(userMessage: string): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: this.buildPrompt(userMessage),
          stream: false,
          options: {
            temperature: this.config.temperature || 0.7,
            num_predict: this.config.maxTokens || 1000,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      return {
        text: data.response?.trim() || '抱歉，我现在无法回复。',
        model: this.config.model,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      };

    } catch (error: any) {
      console.error('Ollama API调用失败:', error);
      throw error;
    }
  }

  /**
   * 调用OpenAI API
   */
  private async callOpenAIAPI(userMessage: string): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: this.buildMessages(userMessage),
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens || 1000,
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const message = data.choices[0]?.message?.content || '抱歉，我现在无法回复。';

      return {
        text: message.trim(),
        model: this.config.model,
        usage: data.usage,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      };

    } catch (error: any) {
      console.error('OpenAI API调用失败:', error);
      throw error;
    }
  }

  /**
   * 调用Anthropic API
   */
  private async callAnthropicAPI(userMessage: string): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: this.buildAnthropicMessages(userMessage),
          max_tokens: this.config.maxTokens || 1000,
          temperature: this.config.temperature || 0.7,
        })
      });

      if (!response.ok) {
        throw new Error(`Anthropic API请求失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const message = data.content[0]?.text || '抱歉，我现在无法回复。';

      return {
        text: message.trim(),
        model: this.config.model,
        usage: data.usage,
        timestamp: Date.now(),
        responseTime: Date.now() - startTime
      };

    } catch (error: any) {
      console.error('Anthropic API调用失败:', error);
      throw error;
    }
  }

  /**
   * 生成本地回复（降级方案）
   */
  private async generateLocalResponse(userMessage: string): Promise<AIResponse> {
    const startTime = Date.now();

    // 简单的本地回复逻辑
    const text = userMessage.toLowerCase();
    let response = '';

    // 基础问候
    if (text.includes('你好') || text.includes('hi') || text.includes('hello')) {
      response = '你好呀！很高兴见到你！😊 我是你的AI助手，有什么可以帮你的吗？';
    } else if (text.includes('再见') || text.includes('拜拜')) {
      response = '再见啦！期待下次和你聊天！👋';
    } else if (text.includes('谢谢') || text.includes('感谢')) {
      response = '不客气！能帮到你我很开心！😊';
    }
    // 天气相关
    else if (text.includes('天气')) {
      response = '今天天气很不错呢！☀️ 适合出去走走，记得带伞哦！';
    }
    // 询问功能
    else if (text.includes('功能') || text.includes('能做什么')) {
      response = '我可以和你聊天、回答问题、提供帮助！虽然我现在只是本地运行，但我会努力做你最好的AI伙伴！💪';
    }
    // 询问身份
    else if (text.includes('你是谁') || text.includes('你是')) {
      response = '我是Reeftotem Assistant！一个可爱友善的AI助手~ 🎈 很高兴认识你！';
    }
    // 情感表达
    else if (text.includes('喜欢') || text.includes('爱')) {
      response = '哇~ 谢谢你喜欢我！我也很喜欢和你聊天！🥰 你有什么开心的事想分享吗？';
    } else if (text.includes('开心') || text.includes('高兴')) {
      response = '看到你开心我也很开心！🎉 继续保持好心情哦！';
    } else if (text.includes('难过') || text.includes('伤心')) {
      response = '抱抱你~ 🤗 没关系，有什么不开心的可以和我说说，我会陪着你的。';
    }
    // 日常对话
    else if (text.includes('吃饭') || text.includes('饿')) {
      response = '记得按时吃饭哦！🍚 身体最重要啦！';
    } else if (text.includes('累') || text.includes('疲劳')) {
      response = '辛苦啦！要记得休息哦~ 😴 可以听点音乐放松一下。';
    } else if (text.includes('忙')) {
      response = '工作再忙也要注意身体呢！💪 记得适当休息一下~';
    }
    // 默认回复
    else {
      const defaultResponses = [
        '嗯嗯，我明白你的意思！😊',
        '这很有趣！能多告诉我一些吗？',
        '我在认真听呢，继续说吧！👂',
        '哇，这个话题很有意思！✨',
        '我理解你的想法！有什么需要帮助的吗？',
        '让我想想... 嗯，我觉得你说得对！🤔',
        '谢谢你的分享！学到了新知识~ 📚',
      ];
      response = defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    }

    return {
      text: response,
      model: 'local',
      timestamp: Date.now(),
      responseTime: Date.now() - startTime
    };
  }

  /**
   * 构建Ollama提示词
   */
  private buildPrompt(userMessage: string): string {
    let prompt = this.config.systemPrompt || '';

    // 添加对话历史
    if (this.conversationHistory.length > 0) {
      prompt += '\n\n对话历史:\n';
      this.conversationHistory.slice(-5).forEach(msg => {
        prompt += `${msg.role === 'user' ? '用户' : '助手'}: ${msg.content}\n`;
      });
    }

    prompt += `\n用户: ${userMessage}\n助手: `;

    return prompt;
  }

  /**
   * 构建OpenAI消息格式
   */
  private buildMessages(userMessage: string): Array<{role: string; content: string}> {
    const messages: Array<{role: string; content: string}> = [];

    // 添加系统提示
    if (this.config.systemPrompt) {
      messages.push({ role: 'system', content: this.config.systemPrompt });
    }

    // 添加对话历史
    this.conversationHistory.slice(-10).forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });

    // 添加当前用户消息
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  /**
   * 构建Anthropic消息格式
   */
  private buildAnthropicMessages(userMessage: string): Array<{role: string; content: string}> {
    const messages: Array<{role: string; content: string}> = [];

    // 添加对话历史（排除系统消息）
    this.conversationHistory.slice(-10).forEach(msg => {
      if (msg.role !== 'system') {
        messages.push({ role: msg.role, content: msg.content });
      }
    });

    // 添加当前用户消息
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  /**
   * 检查AI服务可用性
   */
  async checkAvailability(): Promise<boolean> {
    try {
      if (this.config.provider === 'ollama') {
        const response = await fetch(`${this.config.baseUrl}/api/tags`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        return response.ok;
      }

      // 对于其他提供商，这里可以添加相应的检查逻辑
      return true;

    } catch (error) {
      console.warn('AI服务可用性检查失败:', error);
      return false;
    }
  }

  /**
   * 获取可用的模型列表（仅适用于Ollama）
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      if (this.config.provider !== 'ollama') {
        return [this.config.model];
      }

      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error('获取模型列表失败');
      }

      const data = await response.json();
      return data.models?.map((model: any) => model.name) || [this.config.model];

    } catch (error) {
      console.error('获取模型列表失败:', error);
      return [this.config.model];
    }
  }
}

// 导出单例实例
export const aiService = AIService.getInstance();

// Hook封装
export const useAIService = () => {
  const generateResponse = aiService.generateResponse.bind(aiService);
  const configure = aiService.configure.bind(aiService);
  const clearHistory = aiService.clearHistory.bind(aiService);
  const getHistory = aiService.getHistory.bind(aiService);
  const getConfig = aiService.getConfig.bind(aiService);
  const checkAvailability = aiService.checkAvailability.bind(aiService);
  const getAvailableModels = aiService.getAvailableModels.bind(aiService);

  return {
    generateResponse,
    configure,
    clearHistory,
    getHistory,
    getConfig,
    checkAvailability,
    getAvailableModels
  };
};