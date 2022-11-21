const fetch = require("./fetch");
const auth = require("./auth");
const regex = new RegExp(
  /([\(])?(?!666|000|9\d{2})\d{3}[()]?[ -](?!00)\d{2}[ -](?!0{4})\d{4}\b/
);

const fileRegex = new RegExp(
  /([\(])?\d{3,4}([- \)])?(\s)?\d{2}([- \s])?\d{3,4}([-])?(\d{2})?/
);
const { promises: fs } = require("fs");
const path = require("path");
const readXlsxFile = require("read-excel-file/node");
const XLSX = require("xlsx");
const filereader = require("./filereader");
const newLine = "\r\n";
const date = new Date().toJSON().replaceAll(":", "-").slice(0, 10);
const filepath = path.join(__dirname, `log/${date}.csv`).toString();
const allowed_extension = ["csv", "docs", "docx", "xlsx", "xls"];
const current_dir = __dirname;

class EmailScanner {
  constructor() {
    this.userDetails = {};
    this.finalDetails = {};
    this.nextPage = null;
    this.mailArray = [];
    this.csvHeader = [
      "mailFolder",
      "sender",
      "receiver",
      "subject",
      "dateReceive",
    ];
    this.finalArray = [];
    this.attachmentDataOfMessageById = [];
    this.attachmentFoundFileName = [];
    this.attachmentFoundFileListExtension = [];
    this.isAllowedAttachment = false;
    this.attachmentFoundFileList = [];
    this.attachmentFoundFileList = [];
    this.totalMailsScanned = 0;
    this.mailsWithoutAttachments = 0;
    this.totalAttachments = 0;
  }

  async getUserDetails(email) {
    try {
      const authResponse = await auth.getToken(auth.tokenRequest);
      const user = await fetch.callApi(
        `${auth.apiConfig.uri}/${email}`,
        authResponse.accessToken
      );

      this.userDetails = user.data;

      await this.fetchMails();
    } catch (err) {
      console.log(err, "Error getting user details");
    }
  }

  async fetchMails() {
    const authResponse = await auth.getToken(auth.tokenRequest);
    const mailResponse = await fetch.callApi(
      `${auth.apiConfig.uri}/${this.userDetails.mail}/messages?top=1000`,
      authResponse.accessToken
    );

    const mails = mailResponse.data;

    if (mailResponse.status === 200) {
      this.nextPage = mails["@odata.nextLink"]
        ? mails["@odata.nextLink"]
        : null;

      if (mails.value) {
        this.mailArray = mails.value;
        this.totalMailsScanned += mails.value.length;
        console.log(
          this.totalMailsScanned,
          "total mails scanned ==============================="
        );

        let mailWithoutAtt = this.mailArray.filter((mail) =>
          regex.test(mail.body.content)
        );
        this.mailsWithoutAttachments += mailWithoutAtt.length;
        console.log(
          this.mailsWithoutAttachments,
          "mails without attachments >>>>>>>>>>>>>>>>"
        );
        let mailsWithAtt = this.mailArray.filter((mail) => mail.hasAttachments);
        this.totalAttachments += mailsWithAtt.length;
        console.log(
          this.totalAttachments,
          "total attachments ///////////////////////////////"
        );
        for (let mail of this.mailArray) {
          try {
            if (mail.hasAttachments) {
              await this.getAllAttachmentsByMessageId(mail.id);
            }

            if (regex.test(mail.body.content) || this.isAllowedAttachment) {
              const mailFolderName = await this.mailFolder(
                mail.parentFolderId,
                this.userDetails.mail
              );
              this.finalDetails.mailFolder = mailFolderName;
              this.finalDetails.sender = mail.sender.emailAddress.address;
              this.finalDetails.receiver =
                mail.toRecipients[0].emailAddress.address;
              this.finalDetails.subject = mail.subject;
              this.finalDetails.dateReceived = mail.receivedDateTime;
              const objCSV = [this.finalDetails];
              await this.toCSV(objCSV);
              this.isAllowedAttachment = false;
            }
          } catch (e) {
            console.log(e);
          }
        }
      }

      while (this.nextPage) {
        const authResponse = await auth.getToken(auth.tokenRequest);
        const mailResponse = await fetch.callApi(
          `${this.nextPage}`,
          authResponse.accessToken
        );
        const mails = mailResponse.data;
        if (mailResponse.status === 200) {
          this.nextPage = mails["@odata.nextLink"]
            ? mails["@odata.nextLink"]
            : null;

          if (mails.value) {
            this.mailArray = mails.value;
            this.totalMailsScanned += mails.value.length;
            console.log(
              this.totalMailsScanned,
              "total mails scanned ==============================="
            );

            let mailWithoutAtt = this.mailArray.filter((mail) =>
              regex.test(mail.body.content)
            );
            this.mailsWithoutAttachments += mailWithoutAtt.length;
            console.log(
              this.mailsWithoutAttachments,
              "mails without attachments >>>>>>>>>>>>>>>>"
            );
            let mailsWithAtt = this.mailArray.filter(
              (mail) => mail.hasAttachments
            );
            this.totalAttachments += mailsWithAtt.length;
            console.log(
              this.totalAttachments,
              "total attachments ///////////////////////////////"
            );
            for (let mail of this.mailArray) {
              try {
                if (mail.hasAttachments) {
                  await this.getAllAttachmentsByMessageId(mail.id);
                }

                if (regex.test(mail.body.content) || this.isAllowedAttachment) {
                  const mailFolderName = await this.mailFolder(
                    mail.parentFolderId,
                    this.userDetails.mail
                  );
                  this.finalDetails.mailFolder = mailFolderName;
                  this.finalDetails.sender = mail.sender.emailAddress.address;
                  this.finalDetails.receiver =
                    mail.toRecipients[0].emailAddress.address;
                  this.finalDetails.subject = mail.subject;
                  this.finalDetails.dateReceived = mail.receivedDateTime;
                  const objCSV = [this.finalDetails];
                  await this.toCSV(objCSV);
                  this.isAllowedAttachment = false;
                }
              } catch (e) {
                console.log(e);
              }
            }
          }
        } else {
          console.log(
            `something went wrong in while loop with status code ${mailResponse.status} and with details as ${mails}  `
          );
        }
      }
    } else {
      console.log(
        `something went wrong out of while loop with status code ${mailResponse.status} and with details as ${mails}`
      );
    }
  }

  async getAllAttachmentsByMessageId(mId) {
    try {
      const authResponse = await auth.getToken(auth.tokenRequest);
      const attachments = await fetch.callApi(
        `${auth.apiConfig.uri}/${this.userDetails.mail}/messages/${mId}/attachments`,
        authResponse.accessToken
      );

      this.attachmentDataOfMessageById = attachments.data.value;

      await this.createFilesByContentBytes();
    } catch (err) {
      console.log(err, attachments.status);
    }
  }

  async createFilesByContentBytes() {
    try {
      this.attachmentFoundFileName = [];
      this.attachmentFoundFileListExtension = [];
      for (let attData of this.attachmentDataOfMessageById) {
        this.attachmentFoundFileName.push(attData.name);
        const fileType = attData.name.split(".").pop();
        if (allowed_extension.includes(fileType)) {
          this.isAllowedAttachment = true;
          const time_ref = Date.now();

          const fileName = attData.name.split(".")[0].replace(" ", "_");
          const binaryString = Buffer.from(attData.contentBytes, "base64");

          const filePathAttach = path
            .join(__dirname, `temp/${fileName}-${time_ref}.${fileType}`)
            .toString();
          await fs.writeFile(filePathAttach, binaryString);

          const pathA = path
            .join(__dirname, `temp/${fileName}-${time_ref}.${fileType}`)
            .toString();
          await this.checkAttachmentContentSSN(fileType, pathA);
          await this.removeFile(pathA);
        }
      }
    } catch (err) {
      console.log(err);
    }
  }

  async removeFile(filePath) {
    if (path) {
      await fs.unlink(filePath);
    } else {
      console.log("file dosent exist");
    }
  }

  async checkAttachmentContentSSN(fileType, path) {
    try {
      if (fileType === "xlsx" || fileType === "xls") {
        let filecontent = "";
        let result = {};
        const data = await fs.readFile(path);
        const fData = new Uint8Array(data);
        let workbook = XLSX.read(data, { type: "array" });
        workbook.SheetNames.forEach(async function (sheetName) {
          let roa = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            header: 1,
          });
          if (roa.length) result[sheetName] = roa;
        });
        filecontent = JSON.stringify(result);

        const fileContentString = filecontent;

        if (fileRegex.test(fileContentString)) {
          this.attachmentFoundFileList.push(fileType);
        }
      } else if (fileType === "docx" || fileType === "doc") {
        let filecontentDocx = "";
        await filereader.extract(path).then(function (res, err) {
          if (err) {
            console.log(err);
          }
          filecontentDocx = res;
        });

        if (fileRegex.test(filecontentDocx)) {
          this.attachmentFoundFileList.push(fileType);
        }
      } else if (fileType === "txt" || fileType === "csv") {
        const data = await fs.readFile(path);
        if (regex.test(data)) {
          this.attachmentFoundFileList.push(fileType);
        }
      } else {
        console.log(fileType);
      }
    } catch (e) {
      console.log(e);
    }
  }

  async createFinalDetails() {
    const finalMailAarray = this.mailsWithSSN;

    this.finalArray = [];
    for (const mail of finalMailAarray) {
      const mailFolderName = await this.mailFolder(
        mail.parentFolderId,
        this.userDetails.mail
      );
      this.finalDetails.mailFolder = mailFolderName;
      this.finalDetails.sender = mail.sender.emailAddress.address;
      this.finalDetails.receiver = mail.toRecipients[0].emailAddress.address;
      this.finalDetails.subject = mail.subject;
      this.finalDetails.dateReceived = mail.receivedDateTime;
      const objCSV = [this.finalDetails];
      await this.toCSV(objCSV);
    }
  }

  async mailFolder(folderID, mail) {
    try {
      const authResponse = await auth.getToken(auth.tokenRequest);
      const mailFolders = await fetch.callApi(
        `${auth.apiConfig.uri}/${mail}/mailFolders/${folderID}/?includeHiddenFolders=true&$select=displayName`,
        authResponse.accessToken
      );
      const mailFolderName = mailFolders.data.displayName;

      return mailFolderName;
    } catch (err) {
      console.log("error in mailFolder" + mailFolders.status);
    }
  }

  async toCSV(objArray) {
    const filePathExists = await this.pathExists();

    if (filePathExists === false) {
      const csvHeaderData = this.csvHeader.map((row) => row).toString();

      await fs.writeFile(filepath, csvHeaderData);
    }
    const csvBodyData = objArray
      .map((row) => `${newLine}${Object.values(row)}`)
      .toString();

    await fs.appendFile(filepath, csvBodyData, "utf8");
  }

  async pathExists() {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }
}
module.exports = EmailScanner;
