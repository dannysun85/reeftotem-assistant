import React, { useState, useRef, useEffect } from 'react';

// 安全的Tauri invoke函数
const safeInvoke = async (command: string, args?: any) => {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke(command, args);
    } else {
      console.warn(`Tauri环境不可用，跳过命令: ${command}`);
      return null;
    }
  } catch (error) {
    console.error(`Tauri invoke失败 (${command}):`, error);
    return null;
  }
};

// 安全的Tauri listen函数
const safeListen = async (event: string, handler: (event: any) => void) => {
  try {
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { listen } = await import('@tauri-apps/api/event');
      return await listen(event, handler);
    } else {
      console.warn(`Tauri环境不可用，跳过事件监听: ${event}`);
      return { unlisten: () => {} }; // 返回空的unlisten函数
    }
  } catch (error) {
    console.error(`Tauri listen失败 (${event}):`, error);
    return { unlisten: () => {} };
  }
};

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export const CleanSimpleChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: '你好！我是Reeftotem Assistant的AI助手。有什么我可以帮助你的吗？\n\n💡 提示：左键点击系统托盘图标可以控制Live2D宠物',
      sender: 'ai',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 监听系统托盘事件
  useEffect(() => {
    const setupEventListeners = async () => {
      // 监听显示宠物事件
      const unlistenShowPet = await safeListen('show-pet', () => {
        console.log('系统托盘：显示宠物事件触发');
        // 可以在这里添加额外的UI状态更新
      });

      // 监听隐藏宠物事件
      const unlistenHidePet = await safeListen('hide-pet', () => {
        console.log('系统托盘：隐藏宠物事件触发');
        // 可以在这里添加额外的UI状态更新
      });

      // 监听切换宠物事件
      const unlistenTogglePet = await safeListen('toggle-pet', () => {
        console.log('系统托盘：切换宠物事件触发');
        // 可以在这里添加额外的UI状态更新
      });

      // 监听应用退出事件
      const unlistenAppExit = await safeListen('app-exit', () => {
        console.log('系统托盘：应用退出事件触发');
        // 可以在这里添加清理逻辑
      });

      // 清理函数
      return () => {
        unlistenShowPet?.unlisten?.();
        unlistenHidePet?.unlisten?.();
        unlistenTogglePet?.unlisten?.();
        unlistenAppExit?.unlisten?.();
      };
    };

    setupEventListeners();
  }, []);

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // 模拟AI回复
      await new Promise(resolve => setTimeout(resolve, 1000));

      const aiResponse = await generateAIResponse(userMessage.text);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '抱歉，我遇到了一些问题。请稍后再试。',
        sender: 'ai',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAIResponse = async (userInput: string): Promise<string> => {
    // 简单的模拟AI回复逻辑
    const lowerInput = userInput.toLowerCase();

    if (lowerInput.includes('你好') || lowerInput.includes('hello')) {
      return '你好！很高兴见到你！我是你的AI助手，有什么可以帮你的吗？';
    } else if (lowerInput.includes('live2d') || lowerInput.includes('宠物')) {
      return 'Live2D宠物是一个可爱的桌面伴侣！你可以在系统托盘中找到控制菜单来显示或隐藏宠物。试试左键点击托盘图标看看有什么选项！';
    } else if (lowerInput.includes('拖拽') || lowerInput.includes('移动')) {
      return '你可以点击并拖拽Live2D宠物到屏幕的任何位置！宠物会跟着你的鼠标移动。试试看吧！';
    } else if (lowerInput.includes('功能') || lowerInput.includes('帮助')) {
      return 'Reeftotem Assistant有以下功能：\n1. 🐱 可爱的Live2D桌面宠物\n2. 💬 AI对话助手\n3. 🎮 拖拽移动宠物\n4. 🔧 系统托盘控制\n\n还有什么想了解的吗？';
    } else if (lowerInput.includes('再见') || lowerInput.includes('bye')) {
      return '再见！如果需要帮助，随时可以找我。别忘了在系统托盘中查看宠物哦！';
    } else {
      return `我理解你说的："${userInput}"。这是一个有趣的话题！你想了解更多关于Reeftotem Assistant的什么功能吗？`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#f8fafc',
      fontFamily: 'Inter, system-ui, Avenir, Helvetica, Arial, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: '#3b82f6',
        color: 'white',
        padding: '1rem 1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600' }}>
            🤖 Reeftotem Assistant
          </h1>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', opacity: 0.9 }}>
            你的AI助手 & Live2D宠物
          </p>
        </div>
      </header>

      {/* Main Chat Area */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white'
      }}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem'
        }}>
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                marginBottom: '1rem',
                justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '70%',
                display: 'flex',
                flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: '0.5rem'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: message.sender === 'user' ? '#3b82f6' : '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                  {message.sender === 'user' ? '👤' : '🤖'}
                </div>
                <div>
                  <div style={{
                    backgroundColor: message.sender === 'user' ? '#3b82f6' : '#f1f5f9',
                    color: message.sender === 'user' ? 'white' : '#1e293b',
                    padding: '0.75rem 1rem',
                    borderRadius: '0.75rem',
                    marginBottom: '0.25rem',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {message.text}
                  </div>
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    textAlign: message.sender === 'user' ? 'right' : 'left'
                  }}>
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}>
                  🤖
                </div>
                <div style={{
                  backgroundColor: '#f1f5f9',
                  color: '#1e293b',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.75rem'
                }}>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#94a3b8',
                      animation: 'bounce 1.4s infinite ease-in-out both'
                    }}></div>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#94a3b8',
                      animation: 'bounce 1.4s infinite ease-in-out both',
                      animationDelay: '0.16s'
                    }}></div>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: '#94a3b8',
                      animation: 'bounce 1.4s infinite ease-in-out both',
                      animationDelay: '0.32s'
                    }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          borderTop: '1px solid #e2e8f0',
          padding: '1rem 1.5rem',
          backgroundColor: 'white'
        }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter发送，Shift+Enter换行)"
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                lineHeight: '1.5',
                resize: 'none',
                minHeight: '40px',
                maxHeight: '120px',
                outline: 'none'
              }}
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
              style={{
                backgroundColor: !inputText.trim() || isLoading ? '#d1d5db' : '#3b82f6',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.5rem',
                cursor: !inputText.trim() || isLoading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              {isLoading ? '发送中...' : '发送'}
            </button>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};