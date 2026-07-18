const { formatQueueItems } = require("./formatters");

const filterQueuesByName = (queues, search) => {
  const term = search.toLowerCase().trim();
  if (!term) return queues;

  return queues.filter((queue) => queue.name.toLowerCase().includes(term));
};

const extractClientSearch = (instructions) => {
  const match = instructions.match(/cliente\s+(.+)/i);
  return match ? match[1].trim() : null;
};

const resolveQueueByName = (queues, search) => {
  const matches = filterQueuesByName(queues, search);

  if (matches.length === 0) {
    return { error: `No se encontraron clientes con el nombre "${search}".` };
  }

  if (matches.length > 1) {
    return {
      error: `Se encontraron ${matches.length} clientes con "${search}". Sé más específico.`,
      matches,
    };
  }

  return { queue: matches[0] };
};

module.exports = {
  formatQueueItems,
  filterQueuesByName,
  extractClientSearch,
  resolveQueueByName,
};
