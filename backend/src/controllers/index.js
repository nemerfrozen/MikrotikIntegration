const services = require("../services");
const chatController = require("./chat");
const { formatQueueItems, formatAddressItems } = require("../services/formatters");

module.exports = {
  chat: chatController.chat,
  interfaces: async (req, res) => {
    const result = await services.execute("/ip/address/print");

    if (result instanceof Error || result?.message) {
      return res.status(502).json({ error: result.message || String(result) });
    }

    res.send(formatAddressItems(result.data));
  },
  queue: async (req, res) => {
    const result = await services.execute("/queue/simple/print");

    if (result instanceof Error || result?.message) {
      return res.status(502).json({ error: result.message || String(result) });
    }

    res.send(formatQueueItems(result.data));
  },
  home: (req, res) => {
    res.send("Hello World!");
  },
  deepseekStatus: async (req, res) => {
    const raw = process.env.DEEPSEEK_API_KEY || "";
    const apiKey = raw.trim().replace(/^["']|["']$/g, "");

    if (!apiKey) {
      return res.status(503).json({
        ok: false,
        keyConfigured: false,
        error: "DEEPSEEK_API_KEY no está en backend/.env",
      });
    }

    try {
      const response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(20000),
      });

      if (response.status === 401 || response.status === 403) {
        return res.status(503).json({
          ok: false,
          keyConfigured: true,
          reachable: true,
          error: "API key inválida o sin permiso",
          status: response.status,
        });
      }

      return res.json({
        ok: response.ok || response.status === 400,
        keyConfigured: true,
        reachable: true,
        status: response.status,
      });
    } catch (error) {
      return res.status(503).json({
        ok: false,
        keyConfigured: true,
        reachable: false,
        error: error.cause?.code || error.message,
      });
    }
  },
};
