const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  delay,
  makeCacheableSignalKeyStore,
  makeInMemoryStore
} = require("@adiwajshing/baileys");
const fs = require("fs");
const path = require("path");
const {exec} = require("child_process");
const util = require("util");
const io = require("socket.io-client");
const pino = require("pino");
const { getBanStatus } = require("./database/banbot");
const config = require("../config");
const store = require("./database/store");
const { MakeSession } = require("./session");
const { Message, commands, numToJid, PREFIX } = require("./index");
const { serialize } = require("./serialize");
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

global.__basedir = __dirname;
global.db = {
  cmd: {},
  database: {},
  ...(global.db || {})
};

const readAndRequireFiles = async (directory) => {
  try {
    const files = await fs.promises.readdir(directory);
    return Promise.all(
      files
        .filter((file) => path.extname(file).toLowerCase() === ".js")
        .map((file) => require(path.join(directory, file)))
    );
  } catch (error) {
    console.error("Error reading and requiring files:", error);
    throw error;
  }
};
function executeCommand(command) {
      return new Promise(function (resolve, reject) {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(stdout.trim());
        });
      });
    };
  
async function initialize() {
  if (!fs.existsSync("./session/creds.json")) {
    await MakeSession(config.SESSION_ID, "./session");
    console.log("Version : " + require("../package.json").version);
  }
  console.log("WhatsApp Bot Initializing...");
  
  await readAndRequireFiles(path.join(__dirname, "./database"));

  await config.DATABASE.sync();
  console.log("Database synchronized.");

  console.log("Installing Plugins...");
  await readAndRequireFiles(path.join(__dirname, "../plugins"));
  console.log("Plugins Installed!");  
  async function connectToWhatsApp() {
    try {
      console.log("Connecting to WhatsApp...");
      const { state, saveCreds } = await useMultiFileAuthState("./session/");

      const { version } = await fetchLatestBaileysVersion();
      const logger = pino({ level: "silent" });
      const client = makeWASocket({
        logger,
        printQRInTerminal: false,
        downloadHistory: false,
        syncFullHistory: false,
        browser: Browsers.macOS("Desktop"),
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        version,
      });
      
    client.store = store;
    client.ev.on("chats.update", async (chats) =>
    chats.forEach(async (chat) => await store.saveChat(chat))
    );
	client.ev.on('connection.update', async (node) => {
		const { connection, lastDisconnect } = node;
		if (connection == 'open') {
			console.log("Connecting to Whatsapp...");
			console.log('Connected');
			await delay(5000);
			const sudo = numToJid(config.SUDO.split(',')[0]) || client.user.id;
			const startMsg = `*𝗥𝗨𝗗𝗛𝗥𝗔 𝗦𝗧𝗔𝗥𝗧𝗘𝗗!*\n\n𝗩𝗲𝗿𝘀𝗶𝗼𝗻 : ${require("../package.json").version}\n𝗣𝗿𝗲𝗳𝗶𝘅 : ${PREFIX}\n𝗠𝗼𝗱𝗲 : ${config.MODE}\n𝗣𝗹𝘂𝗴𝗶𝗻𝘀 : ${ commands.filter((command) => command.pattern).length }\n𝗦𝘂𝗱𝗼 : ${config.SUDO}\n`;
			await client.sendMessage(sudo, { text: startMsg });
    }
        if (connection === 'close') {
			if (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut) {
				await delay(300);
				connectToWhatsApp();
				console.log('Reconnecting...');
				console.log(node)
			} else {
				console.log('Connection Closed');
				await delay(3000);
				process.exit(0);
			}
		}
	});
	
	client.ev.on('creds.update', saveCreds);

	client.ev.on('messages.upsert', async (upsert) => {
		if (!upsert.type === 'notify') return;
		msg = upsert.messages[0];
		if (!msg.message) return;
		const message = new Message(client, msg);
		const status = await getBanStatus(message.jid);
		if (status === 'off' && !message.isSudo) return;
		if (message.type === "templateButtonReplyMessage") {
		    message.text = msg.message[message.type].selectedId;
		} else if (message.type === "interactiveResponseMessage") {
		    message.text = JSON.parse(msg.message[message.type].nativeFlowResponseMessage.paramsJson).id;
		};
		await serialize(JSON.parse(JSON.stringify(msg)), client);
		await store.saveMessage(msg, message.sender);
		const isBot = (message.fromMe && message.id.startsWith('BAE5') && message.id.length == 12) || (message.fromMe && message.id.startsWith('BAE5') && message.id.length === 16);
        if (!(!isBot || (isBot && message.text && /(kick|warn|dlt)$/.test(message.text)))) {
          return;
        }
		if (config.LOG_MSG && !message.data.key.fromMe) console.log(`[MESSAGE] [${message.pushName || message.sender.split('@')[0]}] : ${message.text || message.type || null}`);
		if (config.READ_MSG == true && message.data.key.remoteJid !== 'status@broadcast') await client.readMessages([message.data.key]);
		if (config.DISABLE_PM && message.jid.endsWith("@s.whatsapp.net") && !message.isSudo) {
        return;
        }
        if (config.ALLWAYS_ONLINE) {
        await client.sendPresenceUpdate("available", message.jid);
         } else {
        await client.sendPresenceUpdate("unavailable", message.jid);
        }
		commands.map(async (command) => {
		   if (command.fromMe && command.fromMe !== 'public' && !message.isSudo) return;
                   if (typeof command.pattern === "string" && command.pattern.trim() !== "") {
                       let EventCmd = command.pattern.replace(/[^a-zA-Z0-9-+]/g, '');		if (message.text.toLowerCase().trim().startsWith(PREFIX + EventCmd)) {
			   if (config.READ_CMD) await client.readMessages([message.data.key]);
			        message.command = PREFIX + EventCmd;
			let match = message.text.slice(message.command.length).trim();
				command.function(message, match, client).catch((e) => {
						console.log(e);
							});
						}
					}
					if (command.on === "all" && message) {
						command.function(message, message.text, client);
					} else if (command.on === "text" && message.text) {
						command.function(message, message.text, client);
					} else if (command.on === "sticker" && message.type === "stickerMessage") {
						command.function(message, message.text, client);
					} else if (command.on === "image" && message.type === "imageMessage") {
						command.function(message, message.text, client);
					} else if (command.on === "video" && message.type === "videoMessage") {
						command.function(message, message.text, client);
					} else if (command.on === "audio" && message.type === "audioMessage") {
						command.function(message, message.text, client);
					} else if (command.on === "delete" && message.type === "protocolMessage") {
						message.messageId = msg.message.protocolMessage.key?.id;
						command.function(message, message.text, client);
					}
				});
	});
	return client;
    } catch (error) {
      console.error("Error connecting to WhatsApp:", error);
      throw error;
    }
  }

  await connectToWhatsApp();
}

app.get('/', (req, res) => {
    res.send('BOT STARTED!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

module.exports = { initialize };
