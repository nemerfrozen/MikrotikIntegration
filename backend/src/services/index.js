const MikroNode = require("../lib/mikronode/dist/mikronode");
const device = new MikroNode("192.168.37.1", 8728);
//device.setDebug(MikroNode.DEBUG);

module.exports.Query = async (query) => {
  console.log("Conectando a Mikrotik");
  try {
	return await device.connect()
    .then(([login]) => login("admin", "q1w2e3r4/*/*"))
    .then(function (conn) {
      let array = [];
      var chan = conn.openChannel();
	    const result = chan.write(query);

	  return result;
    });
  } catch (error) {
	return error;
  }
};
