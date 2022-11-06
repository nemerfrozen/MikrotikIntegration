const services = require("../services");

module.exports = {
  interfaces: async (req, res) => {
    //const query = req.query.query;
    const query = "/ip/address/print";
    const result = await services.Query(query);
    console.log(result);
    res.send(result);
   
  },
  queue: async (req, res) => {
    const query = "/queue/simple/print";
    const result = await services.Query(query);
    console.log(result);
    res.send(result);
  },
  home: (req, res) => {
    res.send("Hello World!");
  },
};
