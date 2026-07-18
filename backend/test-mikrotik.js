require("dotenv").config();
const services = require("./src/services");

const command = process.argv[2] || "/system/identity/print";

services
  .Query(command)
  .then((result) => {
    if (result instanceof Error || (result?.message && !result?.data)) {
      console.error("ERROR:", result.message || result);
      process.exit(1);
    }

    console.log("OK - Mikrotik conectado");
    console.log(JSON.stringify(result.data, null, 2));
  })
  .catch((error) => {
    console.error("ERROR:", error.message);
    process.exit(1);
  });
