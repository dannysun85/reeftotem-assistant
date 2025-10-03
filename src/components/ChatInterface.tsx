import React, { useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useChatStore } from '@/stores/chat-store'
import { Send, Sparkles, Settings, HelpCircle, Gamepad2 } from 'lucide-react'

const ChatInterface: React.FC = () => {
  const {
    messages,
    inputText,
    isLoading,
    setInputText,
    sendMessage,
    addMessage
  } = useChatStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 自动调整textarea高度
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [inputText])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const quickActions = [
    { text: '介绍一下Live2D宠物', icon: Sparkles, label: '关于宠物' },
    { text: '有哪些功能？', icon: Settings, label: '功能介绍' },
    { text: '如何使用拖拽功能？', icon: Gamepad2, label: '拖拽教程' }
  ]

  const handleShowPet = async () => {
    try {
      await invoke('show_live2d_window')
      console.log('Live2D宠物显示成功')
    } catch (error) {
      console.error('显示Live2D宠物失败:', error)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* 侧边栏 */}
      <div className="w-80 bg-card border-r">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-8">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground">
                🤖
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">Reeftotem Assistant</h1>
              <p className="text-sm text-muted-foreground">你的AI助手 & Live2D宠物</p>
            </div>
          </div>

          {/* 宠物状态卡片 */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">宠物状态</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShowPet}
                  className="ml-auto"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  显示宠物
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center space-x-2 text-sm">
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  就绪
                </Badge>
                <span className="text-muted-foreground">宠物待命中</span>
              </div>
            </CardContent>
          </Card>

          {/* 快速操作 */}
          <Card className="mb-6">
            <CardHeader>
              <h3 className="text-lg font-semibold">快速操作</h3>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="w-full justify-start h-auto p-3"
                    onClick={() => setInputText(action.text)}
                  >
                    <action.icon className="h-4 w-4 mr-2" />
                    <span className="text-sm">{action.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 统计信息 */}
          <Card>
            <CardHeader>
              <h3 className="text-lg font-semibold">对话统计</h3>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">总消息数</span>
                  <span className="font-medium">{messages.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI回复数</span>
                  <span className="font-medium">
                    {messages.filter(m => m.sender === 'ai').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col">
        {/* 聊天头部 */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="p-4">
            <h2 className="text-xl font-semibold">AI对话助手</h2>
            <p className="text-sm text-muted-foreground mt-1">
              与你的AI助手进行对话，了解Live2D宠物的更多功能
            </p>
          </div>
        </div>

        {/* 消息区域 */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[70%] ${
                    message.sender === 'user' ? 'order-2' : 'order-1'
                  }`}
                >
                  <Card
                    className={`${
                      message.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <Avatar className="h-8 w-8 mt-1">
                          <AvatarFallback
                            className={`${
                              message.sender === 'user'
                                ? 'bg-primary-foreground text-primary'
                                : 'bg-secondary text-secondary-foreground'
                            }`}
                          >
                            {message.sender === 'user' ? '👤' : '🤖'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {message.text}
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <span
                              className={`text-xs ${
                                message.sender === 'user'
                                  ? 'text-primary-foreground/70'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {formatTime(message.timestamp)}
                            </span>
                            {message.sender === 'ai' && (
                              <Badge
                                variant="secondary"
                                className="text-xs"
                              >
                                AI
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ))}

            {/* 加载指示器 */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[70%]">
                  <Card className="bg-muted">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="h-2 w-2 bg-foreground rounded-full animate-bounce" />
                          <div className="h-2 w-2 bg-foreground rounded-full animate-bounce delay-100" />
                          <div className="h-2 w-2 bg-foreground rounded-full animate-bounce delay-200" />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          AI正在思考...
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* 输入区域 */}
        <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="p-4">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-end space-x-2">
                <Textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息... (Enter发送，Shift+Enter换行)"
                  className="min-h-[40px] max-h-[120px] resize-none"
                  rows={1}
                  disabled={isLoading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!inputText.trim() || isLoading}
                  size="icon"
                  className="shrink-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatInterface