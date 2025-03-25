const fs = require('fs');
const {
  jidDecode,
  delay,
  generateWAMessageFromContent,
  proto,
} = require("@adiwajshing/baileys");
const { saveWarn, resetWarn } = require("./database/warn");
const { id3, ID3Writer } = require('browser-id3-writer');
const { tmpdir } = require("os");
const { getBuffer } = require("./utils");
const Crypto = require("crypto");
const path = require("path");
const cheerio = require("cheerio");
const FormData = require('form-data');
const { JSDOM } = require("jsdom");
const jimp = require("jimp");
const jsQR = require("jsqr");
const axios = require('axios');
const { spawn } = require('child_process');
const { ff, fmpeg }  = require('fluent-ffmpeg');
const fetch = require("node-fetch");
const googleTTS = require('google-tts-api');
const { loadMessage } = require("./database/store");
const fromBuffer = async () => {
    const module = await import("file-type");
    return module.fromBuffer;
};

const tmpFileOut = path.join(
    './media',
    `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.`
  );
  const tmpFileIn = path.join(
    './media',
    `${Crypto.randomBytes(6).readUIntLE(0, 6).toString(36)}.`
  );
const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) || {};
        return decode.user && decode.server ? `${decode.user}@${decode.server}` : jid;
    }
    return jid;
};
const extractUrlFromMessage = (message) => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const match = urlRegex.exec(message);
    return match ? match[0] : null;
};
const createMediaDirectoryIfNotExists = () => {
    const mediaDirectory = path.join(__dirname, "../media");
    if (!fs.existsSync(mediaDirectory)) {
        fs.mkdirSync(mediaDirectory);
    }
};
const Imgbb = async (filePath) => {
    const imgbbUploader = require("imgbb-uploader");
    const options = {
        apiKey: "36e527ff856648a857988db3ce025b4d",
        imagePath: filePath,
    };
    const result = await imgbbUploader(options);
    return result.url ? result.url : null;
};
const FiletypeFromUrl = async (url) => {
    const buffer = await getBuffer(url);
    const out = await fromBuffer(buffer);
    return out ? { type: out.mime.split("/")[0], buffer } : null;
};
const qrcode = async (string) => {
    const { toBuffer } = require("qrcode");
    let buff = await toBuffer(string);
    return buff;
  };
const isUrl = (url) => {
    return /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/gi.test(url);
};
const isIgUrl = (url) => {
    return /(?:(?:http|https):\/\/)?(?:www.)?(?:instagram.com|instagr.am|instagr.com)\/(\w+)/gim.test(url);
};
const secondsToDHMS = (seconds) => {
    seconds = Number(seconds);
    const days = Math.floor(seconds / (3600 * 24));
    seconds %= 3600 * 24;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    return `${days ? `${days} Days ` : ""}${hours ? `${hours} Hours ` : ""}${minutes ? `${minutes} Minutes ` : ""}${seconds ? `${seconds} Seconds` : ""}`;
};
const webp2mp4 = async (source) => {
    let form = new FormData();
    const isUrl = typeof source === "string" && /https?:\/\//.test(source);
    form.append("new-image-url", isUrl ? source : "");
    form.append("new-image", isUrl ? "" : source, "image.webp");
    
    let res = await fetch("https://ezgif.com/webp-to-mp4", { method: "POST", body: form });
    let html = await res.text();
    let { document } = new JSDOM(html).window;

    let form2 = new FormData();
    let obj = {};
    for (let input of document.querySelectorAll("form input[name]")) {
        obj[input.name] = input.value;
        form2.append(input.name, input.value);
    }
    
    let res2 = await fetch(`https://ezgif.com/webp-to-mp4/${obj.file}`, { method: "POST", body: form2 });
    let html2 = await res2.text();
    let { document: document2 } = new JSDOM(html2).window;
    
    return new URL(document2.querySelector("div#output > p.outfile > video > source").src, res2.url).toString();
};
const convertTextToSound = async (text, lang) => {
    try {
        const options = { lang: lang, slow: false, host: "https://translate.google.com" };
        const audioBase64Array = await googleTTS.getAllAudioBase64(text, options);
        const base64Data = audioBase64Array.map((audio) => audio.base64).join();
        const fileData = Buffer.from(base64Data, "base64");
        fs.writeFileSync("tts.mp3", fileData, { encoding: "base64" });

        return new Promise((resolve) => {
            fmpeg("tts.mp3").audioCodec("libopus").save("tts.opus").on("end", async () => {
                resolve(fs.readFileSync("tts.opus"));
            });
        });
    } catch (error) {
        throw new Error(error.message);
    }
};
const AddMp3Meta = async (songbuffer, coverBuffer, options = { title: "Rudhra-Bot", artist: ["Prince Rudh"] }) => {
    if (!Buffer.isBuffer(songbuffer)) songbuffer = await getBuffer(songbuffer);
    if (!Buffer.isBuffer(coverBuffer)) coverBuffer = await getBuffer(coverBuffer);
    
    const writer = new id3(songbuffer);
    writer.setFrame("TIT2", options.title).setFrame("TPE1", options.artist).setFrame("APIC", {
        type: 3,
        data: coverBuffer,
        description: "Prince Rudh",
    });

    writer.addTag();
    return Buffer.from(writer.arrayBuffer);
};
function ffmpeg(buffer, args = [], ext = '', ext2 = '') {
	return new Promise(async (resolve, reject) => {
		try {
			let tmp = tmpFileIn + ext
			let out = tmpFileOut + ext2
			console.log(tmp,out)
			await fs.promises.writeFile(tmp, buffer)
			spawn('ffmpeg', ['-y', '-i', tmp, ...args,
				out
			]).on('error', reject).on('close', async (code) => {
				try {
					//await fs.promises.unlink(tmp)
					if (code !== 0) return reject(code)
					resolve(await fs.promises.readFile(out))
					await fs.promises.unlink(out)
				} catch (e) {
					reject(e)
				}
			})
		} catch (e) {
			reject(e)
		}
	})
}
function getRandom(input) {
  if (Array.isArray(input) || typeof input === "string") {
    return input[Math.floor(Math.random() * input.length)];
  }
  if (typeof input === "number" && input > 0) {
    return Math.floor(Math.random() * input);
  }
  throw new Error("Invalid input: must be a non-empty array, string, or a positive number");
}
/**
 * Reads a QR code from an image buffer.
 * @param {Buffer} imageBuffer - The image buffer containing the QR code.
 * @returns {string|null} The decoded QR code data, or null if no QR code was found.
 */
async function readQr(imageBuffer) {
  try {
    const image = await jimp.read(imageBuffer);
    const { data, width, height } = image.bitmap;
    const code = jsQR(data, width, height);
    if (code) {
      return code.data;
    }
  } catch (err) {
    throw new Error(`Error reading QR code: ${err.message}`);
  }
  return null;
}
async function convertToJpegThumbnail(imageBuffer, width = 100, height = 100) {
	try {
		const image = await jimp.read(imageBuffer);
		image.resize(width, height);
		const jpegBuffer = await image.getBufferAsync(jimp.MIME_JPEG);
		const base64Thumbnail = jpegBuffer.toString('base64');
		return base64Thumbnail;
	} catch (error) {
		console.error('Error converting image to thumbnail:', error);
		throw error;
	}
}
function cutAudio(buff,start,end){
	let buf;
const media = fs.writeFileSync('./media/cut.mp3',buff)
	ff(media)
  .setStartTime('00:'+start)
  .setDuration(end)
  .output('./media/ouputcut.mp3')
  .on('end', function(err) {
    if(!err) {
	buf = fs.readFileSync('./media/ouputcut.mp3')
	}
  })
  .on('error', err => buf = false)
  return buf
}

function cutVideo(buff,start,end){
	let buf;
const media = fs.writeFileSync('./media/cut.mp4',buff)
	ff(media)
  .setStartTime('00:'+start)
  .setDuration(end)
  .output('./media/ouputcut.mp4')
  .on('end', function(err) {
    if(!err) {
	buf = fs.readFileSync('./media/ouputcut.mp4')
	}
  })
  .on('error', err => buf = false)
  return buf
}
function toAudio(buffer, ext) {
	return ffmpeg(buffer, ['-vn', '-ac', '2', '-b:a', '128k', '-ar', '44100', '-f', 'mp3'], ext || 'mp3', 'mp3')
}
function toVideo(buffer, ext) {
  return ffmpeg( buffer, ['-c:v  ', 'libx264  ', '-c:a  ', 'aac  ', '-ab  ', '128k  ', '-ar  ', '44100  ', '-crf  ', '32  ', '-preset  ', 'slow ',], ext,  'mp4 ');
}
function toPTT(buffer, ext) {
	return ffmpeg(buffer, ['-vn', '-c:a', 'libopus', '-b:a', '128k', '-vbr', 'on', '-compression_level', '10'], ext || 'mp3', 'opus')
}
  function isNumber(value) {
  return typeof value === "number" && !isNaN(value);
}
async function wawe(buff) {
    fs.writeFileSync("./temp.mp4", buff);
    return await fs.readFileSync("./temp.mp4");
    }
    
function MediaUrls(text) {
     let array = [];
     const regexp = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()'@:%_\+.~#?!&//=]*)/gi;
     let urls = text.match(regexp);
     if (urls) {
      urls.map(url => {
       if (['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webp'].includes(url.split('.').pop().toLowerCase())) {
        array.push(url);
       }
      });
      return array;
     } else {
      return false;
     }
    }

function createInteractiveMessage(data, options = {}) {
        const { jid, button, header, footer, body } = data;
        let buttons = [];
        for (let i = 0; i < button.length; i++) {
          let btn = button[i];
          let Button = {};
          Button.buttonParamsJson = JSON.stringify(btn.params);
          switch (btn.type) {
            case "copy":
              Button.name = "cta_copy";
              break;
            case "url":
              Button.name = "cta_url";
              break;
            case "location":
              Button.name = "send_location";
              break;
            case "address":
              Button.name = "address_message";
              break;
            case "call":
              Button.name = "cta_call";
              break;
            case "reply":
              Button.name = "quick_reply";
              break;
            case "list":
              Button.name = "single_select";
              break;
            default:
              Button.name = "quick_reply";
              break;
          }
          buttons.push(Button);
        }
        const mess = {
          viewOnceMessage: {
            message: {
              messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
              },
              interactiveMessage: proto.Message.InteractiveMessage.create({
                body: proto.Message.InteractiveMessage.Body.create({ ...body }),
                footer: proto.Message.InteractiveMessage.Footer.create({ ...footer }),
                header: proto.Message.InteractiveMessage.Header.create({ ...header }),
                nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create(
                  {
                    buttons: buttons,
                  }
                ),
              }),
            },
          },
        };
        let optional = generateWAMessageFromContent(jid, mess, options);
        return optional;
      }
function Interactive(data, options = {}) {
  const { jid, button, header, footer, body, quoted } = data;
  let buttons = [];
  for (let i = 0; i < button.length; i++) {
    let btn = button[i];
    let Button = {};
    Button.buttonParamsJson = JSON.stringify(btn.params);
    switch (btn.type) {
      case "copy":
        Button.name = "cta_copy";
        break;
      case "url":
        Button.name = "cta_url";
        break;
      case "location":
        Button.name = "send_location";
        break;
      case "address":
        Button.name = "address_message";
        break;
      case "call":
        Button.name = "cta_call";
        break;
      case "reply":
        Button.name = "quick_reply";
        break;
      case "list":
        Button.name = "single_select";
        break;
      default:
        Button.name = "quick_reply";
        break;
    }
    buttons.push(Button);
  }
  const mess = {
    viewOnceMessage: {
      message: {
        messageContextInfo: {
          deviceListMetadata: {},
          deviceListMetadataVersion: 2,
        },
        interactiveMessage: proto.Message.InteractiveMessage.create({
          body: proto.Message.InteractiveMessage.Body.create({ ...body }),
          footer: proto.Message.InteractiveMessage.Footer.create({ ...footer }),
          header: proto.Message.InteractiveMessage.Header.create({ ...header }),
          nativeFlowMessage:
            proto.Message.InteractiveMessage.NativeFlowMessage.create({
              buttons: buttons,
            })
        }),
        	contextInfo: {
					participant: "0@s.whatsapp.net",
					remoteJid: "0@s.whatsapp.net",
					quotedMessage: {
						conversation: quoted
					}
				}
      },
    },
  };
  let optional = generateWAMessageFromContent(jid, mess, options);
  return optional;
}
 async function AudioMetaData(audio, info = {}) {
        let title = info.title || "new-bot";
        let body = info.body ? [info.body] : [];
        let img = info.image || 'https://i.ibb.co/sFjZh7S/6883ac4d6a92.jpg';
        if (!Buffer.isBuffer(img)) img = await getBuffer(img);
        if (!Buffer.isBuffer(audio)) audio = await getBuffer(audio);
        const writer = new ID3Writer(audio);
        writer
          .setFrame("TIT2", title)
          .setFrame("TPE1", body)
          .setFrame("APIC", {
            type: 3,
            data: img,
            description: "NEW-BOT-MD",
          });
     writer.addTag();
     return Buffer.from(writer.arrayBuffer);
 }
async function setWarn(message, match, WARN_COUNT) {
    const userId = message.mention[0] || message.reply_message.sender;
    if (!userId) return message.reply("_Mention or reply to someone_");
    let reason = message?.reply_message.text || match;
    reason = reason.replace(/@(\d+)/, "");
    reason = reason ? reason.length <= 1 : "Reason not Provided";

    const warnInfo = await saveWarn(userId, reason);
    let userWarnCount = warnInfo ? warnInfo.warnCount : 0;
    userWarnCount++;
    await message.client.sendMessage(message.sender, { delete: message.data.key });
    await message.client.sendMessage(message.jid, { text: `_User_ @${userId.split("@")[0]} _warned._ \n_Warn Count: ${userWarnCount}._ \n_Reason: ${reason}_`, mentions: [userId] });
    if (userWarnCount > WARN_COUNT) {
      await message.reply("Warn limit exceeded kicking user");
      return await message.client.groupParticipantsUpdate(message.jid, userId, "remove");
    }
    return;
}

async function removeWarn(message) {
const userId = message.mention[0] || message.reply_message.sender;
    if (!userId) return message.reply("_Mention or reply to someone_");
    await resetWarn(userId);
    return await message.client.sendMessage(message.jid, { text: `_Warnings for @${userId.split("@")[0]} reset_`, mentions: [userId] });
}

module.exports = {
    fromBuffer,
    decodeJid,
    extractUrlFromMessage,
    createMediaDirectoryIfNotExists,
    Imgbb,
    FiletypeFromUrl,
    qrcode,
    isUrl,
    isIgUrl,
    secondsToDHMS,
    webp2mp4,
    convertTextToSound,
    AddMp3Meta,
    ffmpeg,
    getRandom,
    readQr,
    convertToJpegThumbnail,
    cutAudio,
    cutVideo,
    toAudio,
    toVideo,
    toPTT,
    isNumber,
    wawe,
    MediaUrls,
    createInteractiveMessage,
    Interactive,
    AudioMetaData,
    setWarn,
    removeWarn
};
