import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import axios, { AxiosError } from 'axios';
import './App.css';
import {
  Conversation,
  Message,
  createConversation,
  createId,
  loadStore,
  saveActiveId,
  saveConversations,
  titleFromMessage,
} from './conversations';
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  loadAutoSpeak,
  saveAutoSpeak,
  speak,
  abortListening,
  startListening,
  stopListening,
  stopSpeaking,
} from './speech';

const API_URL = 'http://localhost:3001';

type MessageVariant = 'default' | 'success' | 'warning' | 'error';

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

const renderData = (data: unknown) => {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const columns = Object.keys(data[0] as Record<string, unknown>);

  return (
    <div className="chat-data-table">
      <table className="table table-sm table-striped mb-0">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {columns.map((col) => (
                <td key={col}>{String((row as Record<string, unknown>)[col] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const getMessageVariant = (msg: Message): MessageVariant => {
  if (msg.action === 'updated' || msg.action === 'created') return 'success';
  if (msg.statusCode && msg.statusCode >= 500) return 'error';
  if (msg.error || msg.details) return 'error';
  if (msg.statusCode === 400 || msg.isError) return 'warning';
  return 'default';
};

const ErrorBlock = ({
  title,
  details,
  statusCode,
}: {
  title?: string;
  details?: string;
  statusCode?: number;
}) => (
  <div className="chat-error-box">
    <div className="chat-error-box__header">
      <span className="chat-error-box__badge">Error</span>
      {statusCode ? <span className="chat-error-box__code">HTTP {statusCode}</span> : null}
    </div>
    {title ? <p className="chat-error-box__title">{title}</p> : null}
    {details ? <p className="chat-error-box__details">{details}</p> : null}
  </div>
);

const SlackMessage = ({
  msg,
  speakingId,
  onSpeak,
}: {
  msg: Message;
  speakingId: string | null;
  onSpeak: (msg: Message) => void;
}) => {
  const variant = getMessageVariant(msg);
  const showErrorBlock = Boolean(
    (msg.error && msg.error !== msg.content) || msg.details
  );
  const errorTitle = msg.error && msg.error !== msg.content ? msg.error : undefined;
  const errorDetails =
    msg.details && msg.details !== msg.content ? msg.details : undefined;
  const isUser = msg.role === 'user';
  const isSpeaking = speakingId === msg.id;
  const canSpeak = isSpeechSynthesisSupported() && !isUser;

  return (
    <article
      className={`chat-message${variant !== 'default' ? ` chat-message--${variant}` : ''}`}
    >
      <div
        className={`chat-avatar ${isUser ? 'chat-avatar--user' : 'chat-avatar--assistant'}`}
        aria-hidden="true"
      >
        {isUser ? 'TÚ' : 'IA'}
      </div>
      <div className="chat-message-body">
        <div className="chat-message-meta">
          <span className="chat-author">{isUser ? 'Tú' : 'Asistente MikroTik'}</span>
          <time className="chat-time" dateTime={new Date(msg.createdAt).toISOString()}>
            {formatTime(msg.createdAt)}
          </time>
          {canSpeak ? (
            <button
              type="button"
              className={`chat-speak-btn${isSpeaking ? ' chat-speak-btn--active' : ''}`}
              onClick={() => onSpeak(msg)}
              aria-label={isSpeaking ? 'Detener lectura' : 'Escuchar respuesta'}
              title={isSpeaking ? 'Detener' : 'Escuchar'}
            >
              {isSpeaking ? 'Detener' : 'Escuchar'}
            </button>
          ) : null}
        </div>
        <p className="chat-text">{msg.content}</p>
        {msg.action === 'updated' ? <span className="chat-status">Actualizado</span> : null}
        {msg.action === 'created' ? <span className="chat-status">Creado</span> : null}
        {showErrorBlock ? (
          <ErrorBlock title={errorTitle} details={errorDetails} statusCode={msg.statusCode} />
        ) : null}
        {msg.command ? <code className="chat-command">{msg.command}</code> : null}
        {msg.data ? renderData(msg.data) : null}
      </div>
    </article>
  );
};

const parseChatPayload = (data: unknown): Record<string, unknown> => {
  if (data && typeof data === 'object') {
    return data as Record<string, unknown>;
  }
  return { error: 'Error en la solicitud.' };
};

const getAxiosErrorData = (err: unknown): { data: unknown; statusCode?: number } | undefined => {
  if (!(err instanceof AxiosError)) {
    return undefined;
  }

  return {
    data: err.response?.data,
    statusCode: err.response?.status,
  };
};

const buildAssistantMessage = (
  payload: Record<string, unknown>,
  statusCode?: number
): Message => {
  const explanation = payload.explanation ? String(payload.explanation) : undefined;
  const error = payload.error ? String(payload.error) : undefined;
  const details = payload.details ? String(payload.details) : undefined;
  const content = explanation || error || details || 'Sin respuesta.';
  const resolvedStatus = statusCode ?? (payload.statusCode ? Number(payload.statusCode) : undefined);
  const isError = Boolean(error || details || (resolvedStatus !== undefined && resolvedStatus >= 400));

  return {
    id: createId(),
    role: 'assistant',
    content,
    command: (payload.command as string | null | undefined) ?? null,
    action: (payload.action as string | null | undefined) ?? null,
    data: payload.data,
    error,
    details,
    statusCode: resolvedStatus,
    isError,
    createdAt: Date.now(),
  };
};

export default function App() {
  const initialStore = useMemo(() => loadStore(), []);
  const [conversations, setConversations] = useState<Conversation[]>(initialStore.conversations);
  const [activeId, setActiveId] = useState(initialStore.activeId);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(() => loadAutoSpeak());
  const [voiceHint, setVoiceHint] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dictatedTextRef = useRef('');
  const recognitionSupported = isSpeechRecognitionSupported();
  const synthesisSupported = isSpeechSynthesisSupported();

  const activeConversation =
    conversations.find((c) => c.id === activeId) || conversations[0];
  const messages = activeConversation?.messages || [];

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveActiveId(activeId);
  }, [activeId]);

  useEffect(() => {
    saveAutoSpeak(autoSpeak);
  }, [autoSpeak]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, activeId]);

  useEffect(() => {
    abortListening();
    stopSpeaking();
    dictatedTextRef.current = '';
    setListening(false);
    setSpeakingId(null);
    setVoiceHint('');
  }, [activeId]);

  useEffect(() => {
    return () => {
      abortListening();
      stopSpeaking();
    };
  }, []);

  const updateConversationMessages = (
    conversationId: string,
    updater: (prev: Message[]) => Message[],
    options?: { titleFrom?: string }
  ) => {
    setConversations((prev) =>
      prev.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;

        const nextMessages = updater(conversation.messages);
        const shouldRename =
          options?.titleFrom &&
          (conversation.title === 'Nueva conversación' ||
            conversation.messages.filter((m) => m.role === 'user').length === 0);

        return {
          ...conversation,
          messages: nextMessages,
          title: shouldRename ? titleFromMessage(options.titleFrom!) : conversation.title,
          updatedAt: Date.now(),
        };
      })
    );
  };

  const speakMessage = (msg: Message) => {
    if (!synthesisSupported) return;

    if (speakingId === msg.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }

    setSpeakingId(msg.id);
    speak(msg.content, {
      onEnd: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  };

  const appendAssistantMessage = (conversationId: string, message: Message) => {
    updateConversationMessages(conversationId, (prev) => [...prev, message]);

    if (autoSpeak && synthesisSupported && message.content) {
      setSpeakingId(message.id);
      speak(message.content, {
        onEnd: () => setSpeakingId(null),
        onError: () => setSpeakingId(null),
      });
    }
  };

  const createNewConversation = () => {
    if (loading) return;
    abortListening();
    stopSpeaking();
    dictatedTextRef.current = '';
    setListening(false);
    setSpeakingId(null);
    const next = createConversation();
    setConversations((prev) => [next, ...prev]);
    setActiveId(next.id);
    setInput('');
  };

  const selectConversation = (id: string) => {
    if (loading || id === activeId) return;
    setActiveId(id);
    setInput('');
  };

  const deleteConversation = (id: string) => {
    if (loading) return;

    const remaining = conversations.filter((conversation) => conversation.id !== id);

    if (remaining.length === 0) {
      const next = createConversation();
      setConversations([next]);
      setActiveId(next.id);
      setInput('');
      return;
    }

    setConversations(remaining);

    if (id === activeId) {
      const nextActive = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      setActiveId(nextActive.id);
      setInput('');
    }
  };

  const submitMessage = async (rawText?: string) => {
    const text = (rawText ?? input).trim();
    if (!text || loading || !activeConversation) return;

    abortListening();
    setListening(false);
    setVoiceHint('');
    dictatedTextRef.current = '';

    const conversationId = activeConversation.id;
    const userMessage: Message = {
      id: createId(),
      role: 'user',
      content: text,
      createdAt: Date.now(),
    };

    const history = activeConversation.messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .map((msg) => ({ role: msg.role, content: msg.content }));

    updateConversationMessages(conversationId, (prev) => [...prev, userMessage], {
      titleFrom: text,
    });
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/chat`, {
        instructions: text,
        history,
      });
      appendAssistantMessage(
        conversationId,
        buildAssistantMessage(parseChatPayload(response.data))
      );
    } catch (err: unknown) {
      const axiosError = getAxiosErrorData(err);

      if (axiosError?.data !== undefined) {
        appendAssistantMessage(
          conversationId,
          buildAssistantMessage(parseChatPayload(axiosError.data), axiosError.statusCode)
        );
      } else {
        appendAssistantMessage(
          conversationId,
          buildAssistantMessage({
            error: 'No se pudo conectar con el servidor',
            details: 'Verifica que el backend esté activo en http://localhost:3001',
          })
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionSupported || loading) return;

    if (listening) {
      stopListening();
      return;
    }

    stopSpeaking();
    setSpeakingId(null);
    dictatedTextRef.current = '';
    setListening(true);
    setVoiceHint('Escuchando… al terminar se enviará');

    startListening({
      onResult: (text) => {
        dictatedTextRef.current = text;
        setInput(text);
      },
      onError: (message) => {
        setVoiceHint(message);
        setListening(false);
      },
      onEnd: () => {
        setListening(false);
        const text = dictatedTextRef.current.trim();
        if (text) {
          setVoiceHint('');
          void submitMessage(text);
          return;
        }
        setVoiceHint((prev) =>
          prev === 'Escuchando… al terminar se enviará' ? '' : prev
        );
      },
    });
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    await submitMessage();
  };

  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="chat-shell">
      <aside className="chat-sidebar" aria-label="Conversaciones">
        <div className="chat-workspace">MikroTik</div>
        <button
          type="button"
          className="chat-new-btn"
          onClick={createNewConversation}
          disabled={loading}
        >
          + Nueva conversación
        </button>
        <div className="chat-nav-label">Conversaciones</div>
        <div className="chat-conversation-list">
          {sortedConversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`chat-channel-row${
                conversation.id === activeId ? ' chat-channel-row--active' : ''
              }`}
            >
              <button
                type="button"
                className="chat-channel-item"
                onClick={() => selectConversation(conversation.id)}
                disabled={loading}
              >
                <span className="chat-channel-hash">#</span>
                <span className="chat-channel-title">{conversation.title}</span>
              </button>
              <button
                type="button"
                className="chat-channel-delete"
                onClick={() => deleteConversation(conversation.id)}
                disabled={loading}
                aria-label={`Borrar conversación ${conversation.title}`}
                title="Borrar conversación"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="chat-app">
        <header className="chat-header">
          <div>
            <h1 className="chat-title"># {activeConversation?.title || 'asistente-ia'}</h1>
            <p className="chat-subtitle">Consulta y gestiona tu router en lenguaje natural</p>
          </div>
          {synthesisSupported ? (
            <label className="chat-auto-speak">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
              />
              Auto voz
            </label>
          ) : null}
        </header>

        <main className="chat-main">
          <div className="chat-messages">
            {messages.map((msg) => (
              <SlackMessage
                key={msg.id}
                msg={msg}
                speakingId={speakingId}
                onSpeak={speakMessage}
              />
            ))}
            {loading && (
              <article className="chat-message">
                <div className="chat-avatar chat-avatar--assistant" aria-hidden="true">
                  IA
                </div>
                <div className="chat-message-body">
                  <div className="chat-message-meta">
                    <span className="chat-author">Asistente MikroTik</span>
                    <span className="chat-time">ahora</span>
                  </div>
                  <div className="chat-typing-row">
                    <span className="chat-typing" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                    está consultando el router…
                  </div>
                </div>
              </article>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="chat-footer">
          <div className="chat-composer">
            <form className="chat-form" onSubmit={sendMessage}>
              <input
                type="text"
                className="chat-input"
                placeholder={
                  listening
                    ? 'Escuchando… habla ahora'
                    : `Mensaje a #${activeConversation?.title || 'asistente-ia'}`
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
                aria-label="Mensaje para el asistente"
              />
              <button
                type="button"
                className={`chat-mic${listening ? ' chat-mic--active' : ''}`}
                onClick={toggleListening}
                disabled={loading || !recognitionSupported}
                aria-label={listening ? 'Detener micrófono' : 'Hablar'}
                title={
                  recognitionSupported
                    ? listening
                      ? 'Detener micrófono'
                      : 'Hablar'
                    : 'Voz no soportada en este navegador'
                }
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z"
                  />
                </svg>
              </button>
              <button
                className="chat-send"
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Enviar mensaje"
                title="Enviar"
              >
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M2.2 10.4 17.1 2.7c.5-.3 1 .3.7.8L12 17.4c-.2.5-.9.5-1.2 0l-2.4-5.3-5.3-2.4c-.5-.2-.5-.9 0-1.2z"
                  />
                </svg>
              </button>
            </form>
          </div>
          <p className="chat-hint">
            {voiceHint ||
              (!recognitionSupported && !synthesisSupported
                ? 'Voz no disponible en este navegador (prueba Chrome o Edge)'
                : 'Micrófono: habla y al terminar se envía · Enter para escribir')}
          </p>
        </footer>
      </div>
    </div>
  );
}
