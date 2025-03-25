let commands = [];
const config = require('../config');
const PREFIX = (!config.HANDLERS || config.HANDLERS.trim() == 'null' || config.HANDLERS.trim() == 'false') ? '' : config.HANDLERS.trim();
function rudhra(info, func) {
  let types = ["video","image","text","all","sticker","audio","delete"];
  let infos = {
    type: info["type"] === undefined || undefined ? "others" : info["type"],
    fromMe: info["fromMe"] === undefined ? false : info["fromMe"],
    desc: info["desc"] === undefined ? "" : info["desc"],
    dontAddCommandList: info["dontAddCommandList"] === undefined ? false : info["dontAddCommandList"],
    function: func
  };
  if (info.on === undefined && info.pattern === undefined) { infos.on = "message"; infos.fromMe = false;} 
  else if (info.on !== undefined && types.includes(info.on)) { infos.on = info.on; if (info.pattern !== undefined) infos.pattern = info.pattern === undefined ? [] : info.pattern;} 
  else infos.pattern = info.pattern === undefined ? [] : info.pattern;
  commands.push(infos);
  return infos;
};

module.exports = {
rudhra: rudhra,
commands: commands,
PREFIX: (config.HANDLERS ? config.HANDLERS.startsWith("^") ? config.HANDLERS.match(/\[(\W*)\]/)?.[1]?.[0] : config.HANDLERS.replace(/\[/g, "").replace(/\]/g, "") : "").trim() || config.HANDLERS,
mode: config.MODE == 'public' ? false : true
};
