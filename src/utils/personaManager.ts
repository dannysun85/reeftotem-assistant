import { invoke } from '@tauri-apps/api/core';

export interface PersonaConfig {
  id: string;
  name: string;
  modelPath: string;
  textures: string[];
  description: string;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    glowColor: string;
  };
}

export interface PersonasResponse {
  personas: Record<string, PersonaConfig>;
}

class PersonaManager {
  private static instance: PersonaManager;
  private personas: Record<string, PersonaConfig> = {};
  private currentPersona: string = 'HaruGreeter';
  private personasConfig: PersonasResponse | null = null;

  private constructor() {}

  static getInstance(): PersonaManager {
    if (!PersonaManager.instance) {
      PersonaManager.instance = new PersonaManager();
    }
    return PersonaManager.instance;
  }

  async loadPersonas(): Promise<void> {
    console.log('PersonaManager.loadPersonas: 开始加载角色配置');
    try {
      // 读取personas.json配置文件
      console.log('PersonaManager.loadPersonas: 请求 /models/personas.json');
      const response = await fetch('/models/personas.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      this.personasConfig = await response.json();
      this.personas = this.personasConfig.personas;
      console.log('PersonaManager.loadPersonas: 成功加载personas:', this.personas);
    } catch (error) {
      console.error('PersonaManager.loadPersonas: 加载personas失败，使用默认配置:', error);
      // 使用默认配置 - 修改为使用实际存在的HaruGreeter角色
      this.personas = {
        HaruGreeter: {
          id: 'HaruGreeter',
          name: 'Haru Greeter',
          modelPath: '/assets/live2d/characters/free/HaruGreeter/HaruGreeter.model3.json',
          textures: [],
          description: 'Live2D Haru Greeter 角色',
          theme: {
            primaryColor: '#FF69B4',
            secondaryColor: '#87CEEB',
            glowColor: '#FF69B4'
          }
        },
        Haru: {
          id: 'Haru',
          name: 'Haru',
          modelPath: '/assets/live2d/characters/free/Haru/Haru.model3.json',
          textures: [],
          description: 'Live2D Haru 角色',
          theme: {
            primaryColor: '#FFB6C1',
            secondaryColor: '#98FB98',
            glowColor: '#FFB6C1'
          }
        }
      };
      console.log('PersonaManager.loadPersonas: 使用默认配置完成');
    }
  }

  getPersonas(): Record<string, PersonaConfig> {
    console.log('PersonaManager.getPersonas: 返回personas:', Object.keys(this.personas));
    return this.personas;
  }

  getCurrentPersona(): PersonaConfig | null {
    const persona = this.personas[this.currentPersona] || null;
    console.log(`PersonaManager.getCurrentPersona: 当前角色=${this.currentPersona}, 角色:`, persona);
    return persona;
  }

  getCurrentPersonaId(): string {
    return this.currentPersona;
  }

  setCurrentPersona(personaId: string): void {
    if (this.personas[personaId]) {
      this.currentPersona = personaId;
      console.log('Switched to persona:', personaId);
    } else {
      console.warn('Persona not found:', personaId);
    }
  }

  async switchPersona(personaId: string): Promise<boolean> {
    try {
      await invoke('switch_persona', { persona: personaId });
      this.setCurrentPersona(personaId);
      return true;
    } catch (error) {
      console.error('Failed to switch persona:', error);
      return false;
    }
  }

  getPersonaById(id: string): PersonaConfig | null {
    return this.personas[id] || null;
  }
}

export const personaManager = PersonaManager.getInstance();
export default personaManager;