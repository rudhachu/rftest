const { rudhra, mode, setWarn, removeWarn } = require('../lib/');
const {  WARN_COUNT } = require("../config")

rudhra({
	pattern: 'warn',
	fromMe: true,
	desc: 'To get remoteJid',
	type: 'whatsapp'
}, async (message, match) => {
	await setWarn(message, match, WARN_COUNT)
});

rudhra({
	pattern: 'resetwarn',
	fromMe: true,
	desc: 'To get remoteJid',
	type: 'whatsapp'
}, async (message, match) => {
	await removeWarn(message)
});
