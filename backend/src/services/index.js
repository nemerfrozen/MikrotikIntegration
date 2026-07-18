const REST_URL = (process.env.MIKROTIK_REST_URL || "http://192.168.216.1:9001/rest").replace(/\/$/, "");
const REST_USER = process.env.MIKROTIK_USER || "admin";
const REST_PASSWORD = process.env.MIKROTIK_PASSWORD || "";

const getAuthHeader = () => {
  const credentials = Buffer.from(`${REST_USER}:${REST_PASSWORD}`).toString("base64");
  return `Basic ${credentials}`;
};

const commandToRequest = (command, params) => {
  const normalized = command.replace(/^\//, "");

  if (command.endsWith("/print")) {
    return {
      method: "GET",
      path: normalized.replace(/\/print$/, ""),
    };
  }

  if (command.endsWith("/set")) {
    const id = params?.[".id"];
    if (!id) {
      throw new Error("Se requiere .id para comandos set");
    }

    const body = { ...params };
    delete body[".id"];

    return {
      method: "PATCH",
      path: `${normalized.replace(/\/set$/, "")}/${id}`,
      body,
    };
  }

  throw new Error(`Comando no soportado: ${command}`);
};

const execute = async (command, params = null) => {
  console.log("Conectando a Mikrotik REST:", command, params || "");

  try {
    const { method, path, body } = commandToRequest(command, params);
    const url = `${REST_URL}/${path}`;

    const options = {
      method,
      headers: {
        Authorization: getAuthHeader(),
        Accept: "application/json",
      },
    };

    if (body && Object.keys(body).length > 0) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const text = await response.text();

    if (!response.ok) {
      throw new Error(`MikroTik REST ${response.status}: ${text || response.statusText}`);
    }

    if (!text) {
      return { data: [] };
    }

    const parsed = JSON.parse(text);
    const data = Array.isArray(parsed) ? parsed : [parsed];

    return { data };
  } catch (error) {
    return error;
  }
};

module.exports = {
  execute,
  Query: execute,
};
