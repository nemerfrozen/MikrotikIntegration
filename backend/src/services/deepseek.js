const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
const { getSystemPrompt } = require("./commands");

const MAX_HISTORY = 20;

const normalizeHistory = (history = []) => {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        item.content.trim()
    )
    .slice(-MAX_HISTORY)
    .map((item) => ({
      role: item.role,
      content: item.content.trim(),
    }));
};

const callDeepSeek = async (messages, { json = false } = {}) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY no está configurada");
  }

  const body = {
    model: "deepseek-chat",
    messages,
    stream: false,
  };

  if (json) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("DeepSeek no devolvió respuesta");
  }

  return content;
};

const chat = async (instructions, history = []) => {
  const thread = normalizeHistory(history);

  const content = await callDeepSeek(
    [
      { role: "system", content: getSystemPrompt() },
      ...thread,
      { role: "user", content: instructions },
    ],
    { json: true }
  );

  return JSON.parse(content);
};

const INTERPRET_PROMPT = `Eres un asistente de red que explica resultados de MikroTik a personas no técnicas.
Responde en español, claro y breve (2-6 frases).
Usa el historial de la conversación para mantener el hilo (nombres de clientes ya mencionados, acciones previas).
- Resume lo importante: nombres, estado (activo/deshabilitado), límite de velocidad, IP/target, cantidad de resultados.
- Si maxLimit viene en bits (ej: 50000000/50000000), conviértelo a Mbps (subida/bajada).
- Si disabled es true/yes, di que está deshabilitado; si false/no, que está activo.
- Si no hay resultados, explícalo amablemente.
- No inventes datos que no estén en el JSON.
- No uses jerga técnica innecesaria ni muestres JSON crudo.`;

const interpret = async ({ instructions, command, search, action, data, history = [] }) => {
  const thread = normalizeHistory(history);
  const payload = {
    preguntaUsuario: instructions,
    comandoEjecutado: command,
    busqueda: search || null,
    accion: action || null,
    resultados: Array.isArray(data) ? data.slice(0, 30) : data,
    total: Array.isArray(data) ? data.length : data ? 1 : 0,
  };

  return callDeepSeek([
    { role: "system", content: INTERPRET_PROMPT },
    ...thread,
    {
      role: "user",
      content: `Interpreta estos resultados para el usuario:\n${JSON.stringify(payload)}`,
    },
  ]);
};

module.exports = { chat, interpret, normalizeHistory };
