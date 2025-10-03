import { create } from 'zustand'

export interface Message {
  id: string
  text: string
  sender: 'user' | 'ai'
  timestamp: Date
}

interface ChatStore {
  messages: Message[]
  inputText: string
  isLoading: boolean
  setInputText: (text: string) => void
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  setLoading: (loading: boolean) => void
  clearMessages: () => void
  sendMessage: () => Promise<void>
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [
    {
      id: '1',
      text: '你好！我是Reeftotem Assistant的AI助手。有什么我可以帮助你的吗？',
      sender: 'ai',
      timestamp: new Date()
    }
  ],
  inputText: '',
  isLoading: false,

  setInputText: (text: string) => set({ inputText: text }),

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    }]
  })),

  clearMessages: () => set({ messages: [] }),

  sendMessage: async () => {
    const { inputText, messages, isLoading, addMessage, setInputText, setLoading } = get()

    if (!inputText.trim() || isLoading) return

    const userMessage: Omit<Message, 'id' | 'timestamp'> = {
      text: inputText.trim(),
      sender: 'user'
    }

    addMessage(userMessage)
    setInputText('')
    setLoading(true)

    try {
      // 模拟AI回复
      await new Promise(resolve => setTimeout(resolve, 1000))

      const aiResponse = await generateAIResponse(userMessage.text)

      addMessage({
        text: aiResponse,
        sender: 'ai'
      })
    } catch (error) {
      console.error('Error sending message:', error)

      addMessage({
        text: '抱歉，我遇到了一些问题。请稍后再试。',
        sender: 'ai'
      })
    } finally {
      setLoading(false)
    }
  }
}))

const generateAIResponse = async (userInput: string): Promise<string> => {
  const lowerInput = userInput.toLowerCase()

  if (lowerInput.includes('你好') || lowerInput.includes('hello')) {
    return '你好！很高兴见到你！我是你的AI助手，有什么可以帮你的吗？'
  } else if (lowerInput.includes('live2d') || lowerInput.includes('宠物')) {
    return 'Live2D宠物是一个可爱的桌面伴侣！你可以在系统托盘中找到控制菜单来显示或隐藏宠物。试试右键点击托盘图标看看有什么选项！'
  } else if (lowerInput.includes('拖拽') || lowerInput.includes('移动')) {
    return '你可以点击并拖拽Live2D宠物到屏幕的任何位置！宠物会跟着你的鼠标移动。试试看吧！'
  } else if (lowerInput.includes('功能') || lowerInput.includes('帮助')) {
    return 'Reeftotem Assistant有以下功能：\n1. 🐱 可爱的Live2D桌面宠物\n2. 💬 AI对话助手\n3. 🎮 拖拽移动宠物\n4. 🔧 系统托盘控制\n\n还有什么想了解的吗？'
  } else if (lowerInput.includes('再见') || lowerInput.includes('bye')) {
    return '再见！如果需要帮助，随时可以找我。别忘了在系统托盘中查看宠物哦！'
  } else {
    return `我理解你说的："${userInput}"。这是一个有趣的话题！你想了解更多关于Reeftotem Assistant的什么功能吗？`
  }
}