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
};
