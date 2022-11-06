const services = require("../services");

module.exports = {
  interfaces: async (req, res) => {
    let _interface =[];
    //const query = req.query.query;
    const query = "/ip/address/print";
    const result = await services.Query(query);
    result.data.map((item) => {
       let data = {
          id: item[0].value.replace("*", ""),
          address: item[1].value,
          network: item[2].value,
          actualInterface: item[3].value,
          invalid: item[4].value,
          dynamic: item[5].value,
          disabled: item[6].value,
         }

      _interface.push(data);
    });
    
    res.send(_interface);
   
  },
  queue: async (req, res) => {
    let _queue =[];
    const query = "/queue/simple/print";
    const result = await services.Query(query);
    console.log(result.data[0]);
    result.data.map((item) => {
      //console.log(item[1]);
        let data = {
          id: item[0].value.replace("*", ""),
          name: item[1].value,
          target: item[2].value,
          maxLimit: item[8].value,
          disabled: item[29].value,
          
        }
        _queue.push(data);
    });
    res.send(_queue);
  },
  home: (req, res) => {
    res.send("Hello World!");
  },
};
