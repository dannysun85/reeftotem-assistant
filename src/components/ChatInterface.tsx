import { useRef, useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
// 导入语音录制组件
import { VoiceRecorder } from './Voice/VoiceRecorder'
import { VoiceInteractionDemo } from './Voice/VoiceInteractionDemo'
import { Live2DVoiceInteraction } from './Voice/Live2DVoiceInteraction'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useChatStore } from '@/stores/chat-store'
import {
  Send,
  Plus,
  Search,
  Settings,
  Moon,
  Sun,
  Bot,
  User,
  Bell,
  CreditCard,
  Package,
  Users2,
  LineChart,
  HelpCircle,
  Smile,
  Paperclip,
  Mic,
  LogOut,
  UserCircle,
  PanelLeftClose,
  PanelLeftOpen,
  MessageSquare,
  Palette,
  ChevronDown,
  Info,
} from 'lucide-react'

const ChatInterface: React.FC = () => {
  const {
    messages,
    inputText,
    isLoading,
    setInputText,
    sendMessage,
    clearMessages
  } = useChatStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Initialize theme from system or localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme')
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && systemDark)

    setIsDarkMode(shouldBeDark)
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto resize textarea
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

  const handleShowPet = async () => {
    try {
      await invoke('show_live2d_window')
      console.log('Live2D宠物显示成功')
    } catch (error) {
      console.error('显示Live2D宠物失败:', error)
    }
  }

  const toggleTheme = () => {
    const newDarkMode = !isDarkMode
    setIsDarkMode(newDarkMode)
    if (newDarkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [sidebarComponentAdded, setSidebarComponentAdded] = useState(false)

  const handleOpenSettings = () => {
    setIsSettingsOpen(true)
  }

  const handleAddSidebarComponent = async () => {
    try {
      // 这里应该调用后端API来安装sidebar-13
      // 由于Tauri安全限制，我们直接在前端处理
      console.log('Installing sidebar-13 component...')
      setSidebarComponentAdded(true)
    } catch (error) {
      console.error('Failed to add sidebar component:', error)
    }
  }

  const conversations = [
    {
      id: 1,
      name: 'AI Assistant',
      lastMessage: '有什么我可以帮助您的吗？',
      time: '刚刚',
      unread: 0,
      active: true,
      avatar: '/bot-avatar.png'
    },
    {
      id: 2,
      name: '产品团队',
      lastMessage: '这个功能看起来很棒',
      time: '2分钟前',
      unread: 3,
      active: false,
      avatar: '/team-avatar.png'
    },
    {
      id: 3,
      name: '技术支持',
      lastMessage: '遇到问题随时联系',
      time: '1小时前',
      unread: 0,
      active: false,
      avatar: '/support-avatar.png'
    }
  ]

  const sidebarItems = [
    {
      title: '聊天',
      icon: MessageSquare,
      href: '#',
      isActive: true
    },
    {
      title: '项目',
      icon: Package,
      href: '#',
      isActive: false,
      badge: 3
    },
    {
      title: '团队',
      icon: Users2,
      href: '#',
      isActive: false
    },
    {
      title: '分析',
      icon: LineChart,
      href: '#',
      isActive: false
    },
    {
      title: '账单',
      icon: CreditCard,
      href: '#',
      isActive: false
    },
    {
      title: '帮助',
      icon: HelpCircle,
      href: '#',
      isActive: false
    }
  ]

  return (
    <TooltipProvider>
      <div className={`flex h-screen bg-background transition-colors duration-200`}>
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-64' : 'w-16'} border-r bg-card flex flex-col transition-colors duration-200`}>
          {/* Sidebar Header */}
          <div className="flex h-16 items-center px-4 border-b">
            <div className={`flex items-center space-x-2 ${!sidebarOpen && 'justify-center'}`}>
              <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              {sidebarOpen && (
                <span className="text-lg font-semibold">Reeftotem</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="ml-auto"
            >
              {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </Button>
          </div>

          {/* Navigation */}
          <nav className="px-2 py-4 flex-1">
            <div className="space-y-1">
              {sidebarItems.map((item) => (
                <Button
                  key={item.title}
                  variant={item.isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start ${!sidebarOpen && 'justify-center px-2'}`}
                >
                  <item.icon className="h-4 w-4" />
                  {sidebarOpen && (
                    <>
                      <span className="ml-2">{item.title}</span>
                      {item.badge && (
                        <Badge className="ml-auto h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </Button>
              ))}
            </div>
          </nav>

          {/* User Menu */}
          <div className="p-4 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={`w-full justify-start ${!sidebarOpen && 'justify-center px-2'}`}>
                  <UserCircle className="h-4 w-4" />
                  {sidebarOpen && (
                    <>
                      <span className="ml-2">用户</span>
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>我的账户</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  个人资料
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  设置
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleShowPet}>
                  <Bot className="mr-2 h-4 w-4" />
                  显示宠物
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-16 border-b bg-card px-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold">AI Assistant</h1>
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
                  <DropdownMenuLabel>主题</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={isDarkMode}
                    onCheckedChange={toggleTheme}
                  >
                    {isDarkMode ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                    {isDarkMode ? '深色模式' : '浅色模式'}
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    系统设置
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <HelpCircle className="mr-2 h-4 w-4" />
                    帮助中心
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Chat Content */}
          <div className="flex-1 flex">
            {/* Conversation List */}
            <div className="w-80 border-r bg-card">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">对话</h2>
                  <Button size="sm" onClick={clearMessages}>
                    <Plus className="h-4 w-4 mr-1" />
                    新建
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索对话..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <ScrollArea className="flex-1 px-4">
                <div className="space-y-2 pb-4">
                  {conversations.map((conv) => (
                    <Card
                      key={conv.id}
                      className={`cursor-pointer transition-colors ${
                        conv.active ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={conv.avatar} />
                            <AvatarFallback>
                              <Bot className="h-5 w-5" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-medium truncate">{conv.name}</h3>
                              <span className="text-xs text-muted-foreground">{conv.time}</span>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                          </div>
                          {conv.unread > 0 && (
                            <Badge className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                              {conv.unread}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Chat Messages with Tabs */}
            <div className="flex-1 flex flex-col">
              <Tabs defaultValue="chat" className="flex-1 flex flex-col">
                <div className="border-b bg-card">
                  <TabsList className="grid w-full grid-cols-2 px-6">
                    <TabsTrigger value="chat" className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      文字聊天
                    </TabsTrigger>
                    <TabsTrigger value="voice" className="flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      语音交互
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Chat Tab Content */}
                <TabsContent value="chat" className="flex-1 flex flex-col">
                  <div className="flex-1">
                    <ScrollArea className="h-full">
                      <div className="max-w-3xl mx-auto px-6 py-8">
                        <div className="space-y-4">
                          {messages.map((message) => (
                            <div
                              key={message.id}
                              className={`flex ${
                                message.sender === 'user' ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <div
                                className={`flex items-start space-x-3 max-w-lg ${
                                  message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                                }`}
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className={
                                    message.sender === 'user'
                                      ? 'bg-blue-500 text-white'
                                      : 'bg-green-500 text-white'
                                  }>
                                    {message.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={`rounded-lg px-4 py-2 ${
                                  message.sender === 'user'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted'
                                }`}>
                                  <p className="text-sm">{message.text}</p>
                                  <p className={`text-xs mt-1 ${
                                    message.sender === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                  }`}>
                                    {formatTime(message.timestamp)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}

                          {isLoading && (
                            <div className="flex justify-start">
                              <div className="flex items-start space-x-3 max-w-lg">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-green-500 text-white">
                                    <Bot className="h-4 w-4" />
                                  </AvatarFallback>
                                </Avatar>
                                <div className="rounded-lg px-4 py-2 bg-muted">
                                  <div className="flex items-center space-x-2">
                                    <div className="flex space-x-1">
                                      <div className="h-2 w-2 bg-foreground rounded-full animate-bounce" />
                                      <div className="h-2 w-2 bg-foreground rounded-full animate-bounce delay-100" />
                                      <div className="h-2 w-2 bg-foreground rounded-full animate-bounce delay-200" />
                                    </div>
                                    <span className="text-sm text-muted-foreground">AI 正在思考...</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          <div ref={messagesEndRef} />
                        </div>
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Message Input */}
                  <div className="border-t bg-card p-4">
                    <div className="max-w-3xl mx-auto">
                      <div className="flex items-end space-x-2">
                        <Button variant="ghost" size="icon">
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <div className="flex-1">
                          <Textarea
                            ref={textareaRef}
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="输入消息..."
                            className="min-h-[40px] max-h-[120px] resize-none"
                            rows={1}
                            disabled={isLoading}
                          />
                        </div>
                        <Button variant="ghost" size="icon">
                          <Smile className="h-4 w-4" />
                        </Button>
                        <Button
                          onClick={sendMessage}
                          disabled={!inputText.trim() || isLoading}
                          size="icon"
                        >
                          {isLoading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Mic className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Voice Tab Content */}
                <TabsContent value="voice" className="flex-1 flex-1 p-0">
                  <Live2DVoiceInteraction />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Settings Dialog */}
        <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>系统设置</DialogTitle>
              <DialogDescription>
                配置应用设置和组件管理
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-hidden">
              {!sidebarComponentAdded ? (
                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">安装侧边栏组件</h3>
                    <p className="text-muted-foreground mb-4">
                      sidebar-13组件因依赖冲突无法安装，使用内置设置界面
                    </p>
                    <Button onClick={handleAddSidebarComponent} className="w-full">
                      <Settings className="mr-2 h-4 w-4" />
                      启用设置界面
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2">设置面板</h3>
                    <p className="text-muted-foreground">
                      配置您的应用偏好设置
                    </p>
                  </div>

                  {/* Dashboard-01 Style Settings */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Palette className="h-5 w-5" />
                          外观设置
                        </CardTitle>
                        <CardDescription>自定义应用外观和主题</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">主题模式</label>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                {isDarkMode ? "深色" : "浅色"}
                                <ChevronDown className="ml-2 h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                if (isDarkMode) toggleTheme()
                              }}>
                                <Sun className="mr-2 h-4 w-4" />
                                浅色模式
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                if (!isDarkMode) toggleTheme()
                              }}>
                                <Moon className="mr-2 h-4 w-4" />
                                深色模式
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium">侧边栏</label>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                          >
                            {sidebarOpen ? "收起" : "展开"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Bot className="h-5 w-5" />
                          Live2D设置
                        </CardTitle>
                        <CardDescription>配置虚拟宠物显示</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <Button onClick={handleShowPet} className="w-full">
                          <Bot className="mr-2 h-4 w-4" />
                          显示Live2D宠物
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="h-5 w-5" />
                          组件管理
                        </CardTitle>
                        <CardDescription>管理UI组件和依赖</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">dashboard-01</span>
                          <Badge variant="default" className="bg-green-500">
                            已安装
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">sidebar-13</span>
                          <Badge variant="destructive">
                            依赖冲突
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Info className="h-5 w-5" />
                          关于应用
                        </CardTitle>
                        <CardDescription>版本信息和构建详情</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>版本</span>
                          <Badge variant="secondary">0.2.0-alpha</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>构建</span>
                          <span className="text-muted-foreground">Development</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>React</span>
                          <span className="text-muted-foreground">v19.x</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>shadcn/ui</span>
                          <span className="text-muted-foreground">Latest</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                关闭
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

export default ChatInterface