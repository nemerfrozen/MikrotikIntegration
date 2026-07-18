export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  command?: string | null;
  action?: string | null;
  data?: unknown;
  error?: string;
  details?: string;
  statusCode?: number;
  isError?: boolean;
  createdAt: number;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = 'mikrotik-chat-conversations';
const ACTIVE_KEY = 'mikrotik-chat-active-id';

export const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const welcomeMessage = (): Message => ({
  id: createId(),
  role: 'assistant',
  content: 'Hola, soy tu asistente de MikroTik.',
  createdAt: Date.now(),
});

export const createConversation = (title = 'Nueva conversación'): Conversation => {
  const now = Date.now();
  return {
    id: createId(),
    title,
    messages: [welcomeMessage()],
    createdAt: now,
    updatedAt: now,
  };
};

export const titleFromMessage = (text: string) => {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Nueva conversación';
  return cleaned.length > 36 ? `${cleaned.slice(0, 36)}…` : cleaned;
};

export const loadStore = (): { conversations: Conversation[]; activeId: string } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const activeId = localStorage.getItem(ACTIVE_KEY);
    const conversations = raw ? (JSON.parse(raw) as Conversation[]) : [];

    if (!Array.isArray(conversations) || conversations.length === 0) {
      const first = createConversation();
      return { conversations: [first], activeId: first.id };
    }

    const validActive =
      activeId && conversations.some((c) => c.id === activeId)
        ? activeId
        : conversations[0].id;

    return { conversations, activeId: validActive };
  } catch {
    const first = createConversation();
    return { conversations: [first], activeId: first.id };
  }
};

export const saveConversations = (conversations: Conversation[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
};

export const saveActiveId = (activeId: string) => {
  localStorage.setItem(ACTIVE_KEY, activeId);
};
