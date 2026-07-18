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

const safeParseJson = (content) => {
  const cleaned = String(content || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (!cleaned) {
    throw new Error("La IA devolvió una respuesta vacía. Intenta de nuevo.");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("La IA devolvió un formato inválido. Intenta de nuevo.");
  }
};

const getApiKey = () => {
  const raw = process.env.DEEPSEEK_API_KEY || "";
  return raw.trim().replace(/^["']|["']$/g, "");
};

const describeFetchError = (error) => {
  const code = error?.cause?.code || error?.code;
  if (code === "ENOTFOUND") {
    return "No se resolvió api.deepseek.com (DNS). Revisa internet o DNS.";
  }
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "ETIMEDOUT") {
    return `Conexión bloqueada o interrumpida (${code}). Revisa firewall/proxy/VPN.`;
  }
  if (code === "UND_ERR_CONNECT_TIMEOUT" || code === "ABORT_ERR") {
    return "Timeout al conectar con DeepSeek. Revisa internet o proxy.";
  }
  return `No se pudo conectar con DeepSeek (${code || error.message}). Revisa internet, firewall o DEEPSEEK_API_KEY.`;
};

const callDeepSeek = async (messages, { json = false } = {}) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY no está configurada en backend/.env");
  }

  const body = {
    model: "deepseek-chat",
    messages,
    stream: false,
  };

  if (json) {
    body.response_format = { type: "json_object" };
  }

  let response;
  try {
    response = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    console.error("DeepSeek fetch error:", error.message, error.cause || "");
    throw new Error(describeFetchError(error));
  }

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 401 || response.status === 403) {
      throw new Error("DEEPSEEK_API_KEY inválida o sin permiso. Revisa backend/.env");
    }
    throw new Error(`DeepSeek API error: ${response.status} - ${error || "sin detalle"}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("DeepSeek devolvió una respuesta vacía o inválida. Intenta de nuevo.");
  }

  const content = data.choices?.[0]?.message?.content;

  if (!content || !String(content).trim()) {
    throw new Error("DeepSeek no devolvió contenido. Intenta de nuevo.");
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

  return safeParseJson(content);
};

const INTERPRET_PROMPT = `Eres un asistente de red que explica resultados de MikroTik a personas no técnicas.
Responde en español, claro y breve (2-6 frases).
Usa el historial de la conversación para mantener el hilo (nombres de clientes ya mencionados, acciones previas).
- Resume lo importante: nombres, estado (activo/deshabilitado), límite de velocidad, consumo (rate/bytes), IP/target, cantidad de resultados.
- Si maxLimit o rate vienen en bits (ej: 50000000/50000000), conviértelo a Mbps (subida/bajada).
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
