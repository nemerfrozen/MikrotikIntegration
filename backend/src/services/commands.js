const COMMANDS = {
  "/queue/simple/print": {
    type: "read",
    description: "listar/buscar colas simples (clientes), límites y consumo (rate/bytes)",
    searchable: true,
    formatter: "queue",
  },
  "/queue/simple/set": {
    type: "write",
    mode: "update",
    description: "habilitar/deshabilitar o cambiar límite de cola",
    requiresSearch: true,
    resolveFrom: "/queue/simple/print",
    allowedParams: ["disabled", "max-limit"],
  },
  "/queue/simple/add": {
    type: "write",
    mode: "create",
    description: "crear cola simple (nuevo cliente)",
    allowedParams: ["name", "target", "max-limit", "disabled"],
    requiredParams: ["name", "target"],
  },
  "/ip/address/print": {
    type: "read",
    description: "listar direcciones IP",
    formatter: "address",
  },
  "/interface/print": {
    type: "read",
    description: "listar interfaces",
    formatter: "generic",
  },
  "/ip/firewall/filter/print": {
    type: "read",
    description: "listar reglas de firewall",
    formatter: "generic",
  },
};

const EXAMPLES = [
  '"cliente carolina messi" -> {"command": "/queue/simple/print", "search": "carolina messi", "explanation": "Buscar cliente en colas simples"}',
  '"listar todas las colas" -> {"command": "/queue/simple/print", "search": null, "explanation": "Listar colas simples"}',
  '"deshabilitar cliente carolina messi" -> {"command": "/queue/simple/set", "search": "carolina messi", "params": {"disabled": "yes"}, "explanation": "Deshabilitar cola del cliente"}',
  '"habilitar cliente juan" -> {"command": "/queue/simple/set", "search": "juan", "params": {"disabled": "no"}, "explanation": "Habilitar cola del cliente"}',
  '"crear cliente ana perez ip 10.10.10.50 limite 20M/20M" -> {"command": "/queue/simple/add", "params": {"name": "ana perez", "target": "10.10.10.50/32", "max-limit": "20M/20M"}, "explanation": "Crear cola del cliente"}',
  '"agregar cliente pedro con ip 192.168.1.20" -> {"command": "/queue/simple/add", "params": {"name": "pedro", "target": "192.168.1.20/32", "max-limit": "10M/10M"}, "explanation": "Crear cola del cliente"}',
  '"listar interfaces" -> {"command": "/interface/print", "explanation": "Listar interfaces del router"}',
  '"consumo de carolina messi" / "cuál es el consumo de su conexión" (con historial) -> {"command": "/queue/simple/print", "search": "carolina messi", "explanation": "Consultar consumo del cliente en colas"}',
];

const getCommandDef = (command) => COMMANDS[command] || null;

const isAllowedCommand = (command) => Boolean(getCommandDef(command));

const getSystemPrompt = () => {
  const commandList = Object.entries(COMMANDS)
    .map(([path, def]) => `- ${path} — ${def.description}`)
    .join("\n");

  return `Eres un asistente que traduce instrucciones en lenguaje natural a comandos de la API de MikroTik RouterOS.
Usa el historial de la conversación para resolver referencias (ej: "deshabilítalo", "el anterior", "ese cliente").
Responde ÚNICAMENTE con un JSON válido con esta estructura:
{"command": "/ruta/comando", "search": "texto opcional o null", "params": {}, "explanation": "breve explicación"}

Comandos disponibles:
${commandList}

Para buscar clientes, ver límites o consumo/velocidad actual usa "/queue/simple/print" con "search".
Para modificar un cliente (habilitar, deshabilitar, cambiar límite) usa "/queue/simple/set" con "search" y "params".
Params permitidos en set: disabled ("yes"/"no"), max-limit (ej: "20M/20M" o "20000000/20000000").
Para crear un cliente/cola usa "/queue/simple/add" con params name, target (IP, mejor con /32) y opcional max-limit.
Params permitidos en add: name, target, max-limit, disabled.
IMPORTANTE: responde SIEMPRE con JSON completo y válido, nunca vacío ni texto fuera del JSON.

Ejemplos:
${EXAMPLES.join("\n")}
- Historial menciona "carolina messi" y usuario dice "deshabilítalo" -> {"command": "/queue/simple/set", "search": "carolina messi", "params": {"disabled": "yes"}, "explanation": "Deshabilitar cola del cliente referido"}

Si no hay búsqueda por nombre, omite "search" o usa null.
Si no hay params, omite "params" o usa null.
Si la instrucción no corresponde a ningún comando, usa "command": null y explica por qué en "explanation".`;
};

const normalizeParamKey = (key) => {
  if (key === "maxLimit") return "max-limit";
  return key;
};

const validateParams = (command, params, { search } = {}) => {
  const def = getCommandDef(command);
  if (!def || def.type !== "write") {
    return { valid: true, params: {} };
  }

  const source = params && typeof params === "object" ? { ...params } : {};

  if (def.mode === "create" && !source.name && search) {
    source.name = search;
  }

  if (Object.keys(source).length === 0) {
    return { valid: false, error: "Se requieren params para comandos de escritura" };
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(source)) {
    const paramKey = normalizeParamKey(key);
    if (!def.allowedParams.includes(paramKey)) {
      return { valid: false, error: `Parámetro no permitido: ${key}` };
    }
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      sanitized[paramKey] = String(value).trim();
    }
  }

  if (Object.keys(sanitized).length === 0) {
    return { valid: false, error: "Se requiere al menos un parámetro" };
  }

  if (def.requiredParams) {
    for (const required of def.requiredParams) {
      if (!sanitized[required]) {
        return {
          valid: false,
          error: `Para crear una cola se requiere "${required}" (ej: name y target/IP).`,
        };
      }
    }
  }

  return { valid: true, params: sanitized };
};

module.exports = {
  COMMANDS,
  getCommandDef,
  isAllowedCommand,
  getSystemPrompt,
  validateParams,
};
