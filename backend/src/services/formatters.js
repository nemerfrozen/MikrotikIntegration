const getField = (item, key, index) => {
  if (item[key] !== undefined) return item[key];
  if (Array.isArray(item) && item[index]?.value !== undefined) return item[index].value;
  return undefined;
};

const formatQueueItems = (rawData) =>
  rawData.map((item) => ({
    id: String(getField(item, ".id", 0) || "").replace("*", ""),
    name: getField(item, "name", 1),
    target: getField(item, "target", 2),
    maxLimit: getField(item, "max-limit", 8) ?? getField(item, "maxLimit", 8),
    disabled: getField(item, "disabled", 29),
  }));

const formatAddressItems = (rawData) =>
  rawData.map((item) => ({
    id: String(getField(item, ".id", 0) || "").replace("*", ""),
    address: getField(item, "address", 1),
    network: getField(item, "network", 2),
    actualInterface: getField(item, "interface", 3) ?? getField(item, "actualInterface", 3),
    invalid: getField(item, "invalid", 4),
    dynamic: getField(item, "dynamic", 5),
    disabled: getField(item, "disabled", 6),
  }));

const formatGenericItems = (rawData) =>
  rawData.map((item) => {
    if (!Array.isArray(item)) {
      return item;
    }

    const row = {};
    item.forEach(({ field, value }) => {
      row[field] = value;
    });
    return row;
  });

const formatByType = (type, rawData) => {
  switch (type) {
    case "queue":
      return formatQueueItems(rawData);
    case "address":
      return formatAddressItems(rawData);
    default:
      return formatGenericItems(rawData);
  }
};

module.exports = {
  formatQueueItems,
  formatAddressItems,
  formatGenericItems,
  formatByType,
};
