const deepseek = require("../services/deepseek");
const services = require("../services");
const {
  getCommandDef,
  isAllowedCommand,
  validateParams,
} = require("../services/commands");
const { formatByType } = require("../services/formatters");
const {
  formatQueueItems,
  filterQueuesByName,
  extractClientSearch,
  resolveQueueByName,
} = require("../services/queue");

const QUEUE_PRINT = "/queue/simple/print";

const isMikrotikError = (result) => result instanceof Error || result?.message;

const formatReadData = (command, rawData, search) => {
  const def = getCommandDef(command);
  let data = formatByType(def?.formatter || "generic", rawData);

  if (def?.searchable && search) {
    data = filterQueuesByName(data, search);
  }

  return data;
};

const buildSearchExplanation = (search, data) => {
  if (data.length > 0) {
    return `Se encontraron ${data.length} cliente(s) con "${search}".`;
  }
  return `No se encontraron clientes con el nombre "${search}".`;
};

const explainForHuman = async ({
  instructions,
  command,
  search,
  action,
  data,
  history,
  fallback,
}) => {
  try {
    const interpreted = await deepseek.interpret({
      instructions,
      command,
      search,
      action,
      data,
      history,
    });
    return interpreted.trim() || fallback;
  } catch (error) {
    console.error("Interpret error:", error.message);
    return fallback;
  }
};

const executeWriteCommand = async (
  command,
  search,
  params,
  explanation,
  instructions,
  history
) => {
  const printResult = await services.execute(QUEUE_PRINT);

  if (isMikrotikError(printResult)) {
    return {
      status: 502,
      body: {
        explanation,
        command,
        error: "Error al conectar con MikroTik",
        details: printResult.message || String(printResult),
      },
    };
  }

  const queues = formatQueueItems(printResult.data);
  const resolved = resolveQueueByName(queues, search);

  if (resolved.error) {
    return {
      status: 400,
      body: {
        explanation: resolved.error,
        command,
        search,
        data: resolved.matches || null,
      },
    };
  }

  const mikrotikParams = {
    ".id": `*${resolved.queue.id}`,
    ...params,
  };

  console.log("Mutación MikroTik:", command, mikrotikParams);

  const setResult = await services.execute(command, mikrotikParams);

  if (isMikrotikError(setResult)) {
    return {
      status: 502,
      body: {
        explanation,
        command,
        search,
        error: "Error al ejecutar la acción en MikroTik",
        details: setResult.message || String(setResult),
      },
    };
  }

  const updatedQueue = {
    ...resolved.queue,
    ...params,
    disabled: params.disabled ?? resolved.queue.disabled,
    maxLimit: params["max-limit"] ?? resolved.queue.maxLimit,
  };

  const fallback =
    explanation || `Acción completada para "${resolved.queue.name}".`;

  const naturalExplanation = await explainForHuman({
    instructions,
    command,
    search,
    action: "updated",
    data: [updatedQueue],
    history,
    fallback,
  });

  return {
    status: 200,
    body: {
      explanation: naturalExplanation,
      command,
      search,
      action: "updated",
      data: [updatedQueue],
    },
  };
};

const chat = async (req, res) => {
  const { instructions, history } = req.body;

  if (!instructions || typeof instructions !== "string") {
    return res.status(400).json({ error: "Se requiere el campo 'instructions'" });
  }

  const thread = deepseek.normalizeHistory(history);

  try {
    const aiResponse = await deepseek.chat(instructions, thread);
    const { command, explanation } = aiResponse;
    const search = aiResponse.search || extractClientSearch(instructions);

    if (!command) {
      return res.json({
        explanation,
        command: null,
        data: null,
      });
    }

    if (!isAllowedCommand(command)) {
      return res.status(400).json({
        explanation: `Comando no permitido: ${command}`,
        command: null,
        data: null,
      });
    }

    const commandDef = getCommandDef(command);
    const paramsValidation = validateParams(command, aiResponse.params);

    if (!paramsValidation.valid) {
      return res.status(400).json({
        explanation: paramsValidation.error,
        command,
        data: null,
      });
    }

    if (commandDef.type === "write") {
      if (!search) {
        return res.status(400).json({
          explanation: "Se requiere el nombre del cliente para ejecutar esta acción.",
          command,
          data: null,
        });
      }

      const writeResponse = await executeWriteCommand(
        command,
        search,
        paramsValidation.params,
        explanation,
        instructions,
        thread
      );

      return res.status(writeResponse.status).json(writeResponse.body);
    }

    const result = await services.execute(command);

    if (isMikrotikError(result)) {
      return res.status(502).json({
        explanation,
        command,
        error: "Error al conectar con MikroTik",
        details: result.message || String(result),
      });
    }

    const data = formatReadData(command, result.data, search);
    let fallback = explanation;

    if (commandDef.searchable && search) {
      fallback = buildSearchExplanation(search, data);
    }

    const naturalExplanation = await explainForHuman({
      instructions,
      command,
      search,
      data,
      history: thread,
      fallback,
    });

    res.json({
      explanation: naturalExplanation,
      command,
      search: search || null,
      data,
    });
  } catch (error) {
    console.error("Chat error:", error.message);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { chat };
