require("dotenv").config();
const yargs = require("yargs");
const path = require("path");
const { promises: fs } = require("fs");
const emailRegEx = new RegExp(
  /^[a-zA-Z0-9_.+]*[a-zA-Z][a-zA-Z0-9_.+]*@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/
);
const EmailScanner = require("./emailClass");

const options = yargs.usage("Usage: --op <operation_name>").option("op", {
  alias: "operation",
  describe: "operation name",
  type: "string",
  demandOption: true,
}).argv;

const filepath = path.join(__dirname, `${yargs.argv["op"]}`);
const batchSize = 6;

async function main() {
  try {
    console.time("totalExeTime");
    const data = await fs.readFile(filepath, "utf8");

    const mailData = data.split("\r\n").filter((email) => email !== "");

    if (!data) {
      return console.log("File is empty");
    }

    let batchArray = [];
    for (let batch = 0; batch < mailData.length; batch += batchSize) {
      batchArray.push(mailData.slice(batch, batch + batchSize));
    }

    for (const email of batchArray) {
      let promiseArray = [];
      for (const mail of email) {
        if (emailRegEx.test(mail) === false) {
          continue;
        }
        const mailScanner = new EmailScanner();
        promiseArray.push(mailScanner.getUserDetails(mail));
      }
      console.log(promiseArray);
      await Promise.all(promiseArray);
    }
    console.timeEnd("totalExeTime");
  } catch (err) {
    console.log(err.errCode);
  }
}
main();
