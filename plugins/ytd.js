const { rudhra, mode, isUrl } = require("../lib/");
const yts = require("yt-search");
const fetch = require("node-fetch");

rudhra({
    pattern: 'ytd ?(.*)',
    fromMe: mode,
    desc: 'Download audio or video from YouTube.',
    type: 'info'
}, async (message, match, client) => {
    const userInput = match || message.reply_message?.text;
    if (!userInput) return await message.reply("Please provide a YouTube link.");
    if (!isUrl(userInput)) return await message.reply("Invalid YouTube link. Please provide a valid one.");

    const videoUrl = userInput.trim();
    const ytApi = `https://api.siputzx.my.id/api/d/ytmp4?url=${videoUrl}`;
    const response = await fetch(ytApi);
    const result = await response.json();
    const data = result.data;
    const mp4 = data.dl;
    const title = data.title;
    const optionsText = `*${title}*\n\n *1.* *Video*\n *2.* *Audio*\n *3.* *Document*\n\n*ʀᴇᴘʟʏ ᴡɪᴛʜ ᴀ ɴᴜᴍʙᴇʀ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ*`;
    const contextInfoMessage = {
        text: optionsText,
        contextInfo: {
            externalAdReply: {
                title: "𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿",
                body: "ʀᴜᴅʜʀᴀ ʙᴏᴛ",
                sourceUrl: videoUrl,
                mediaUrl: videoUrl,
                mediaType: 1,
                showAdAttribution: true,
                thumbnailUrl: "https://i.imgur.com/xWzUYiF.png"
            }
        }
    };

    const sentMsg = await client.sendMessage(message.jid, contextInfoMessage, { quoted: message.data });

    // Listen for user response
    client.ev.on('messages.upsert', async (msg) => {
        const newMessage = msg.messages[0];

        if (
            newMessage.key.remoteJid === message.jid &&
            newMessage.message?.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id
        ) {
            const userReply = newMessage.message?.conversation || newMessage.message?.extendedTextMessage?.text;

            if (userReply === '1' && mp4) {
                // Send video
                await client.sendMessage(
                    message.jid,
                    { video: { url: mp4 }, mimetype: "video/mp4" },
                    { quoted: message.data }
                );
            } else if (userReply === '2' && mp4) {
                // Send audio
                await client.sendMessage(
                    message.jid,
                    { audio: { url: mp4 }, mimetype: "audio/mpeg" },
                    { quoted: message.data }
                );
            } else if (userReply === '3' && mp4) {
                // Send document
                await client.sendMessage(
                    message.jid,
                    {
                        document: { url: mp4 },
                        mimetype: 'audio/mpeg',
                        fileName: `${title}.mp3`,
                        caption: `_${title}_`
                    },
                    { quoted: message.data }
                );
            } else {
                await client.sendMessage(message.jid, { text: "Invalid option or unavailable media. Please reply with 1, 2, or 3." });
            }
        }
    });
});

rudhra({
    pattern: "song ?(.*)",
    fromMe: mode,
    desc: "Search and download audio from YouTube.",
    type: "downloader",
  }, async (message, match, client) => {
    try {
      match = match || message.reply_message?.text;
      if (!match) {
        return await message.reply("Please provide a YouTube link or search query.");
      }
      
      let url;
      if (isUrl(match) && match.includes("youtu")) {
        url = match;
      } else {
        const { videos } = await yts(match);
        if (videos.length === 0) {
          return await message.reply("No videos found for your search query.");
        }
        url = videos[0].url;
      }

      const ytApi = `https://api.siputzx.my.id/api/d/ytmp4?url=${url}`;
      const response = await fetch(ytApi);
      const result = await response.json();

      if (!result?.data?.dl || !result?.data?.title) {
        throw new Error("Invalid response from API.");
      }

      const { dl: mp3, title } = result.data;

      await message.reply(`_Downloading ${title}_`);
      await message.client.sendMessage(
        message.jid,
        { audio: { url: mp3 }, mimetype: "audio/mpeg" },
        { quoted: message.data }
      );
      await message.client.sendMessage(
        message.jid,
        {
          document: { url: mp3 },
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
          caption: `_${title}_`,
        },
        { quoted: message.data }
      );
    } catch (error) {
      console.error("Error fetching audio:", error.message);
      await message.reply("Failed to download audio. Please try again later.");
    }
 });

rudhra({
  pattern: "video ?(.*)",
  fromMe: mode,
  desc: "Search and download video from YouTube.",
  type: "downloader",
}, async (message, match, client) => {
  match = match || message.reply_message.text;
  if (!match) {
    return message.reply('Please provide a YouTube link or search query.');
  }

  if (isUrl(match) && match.includes('youtu')) {
    try {
      const ytApi = `https://api.siputzx.my.id/api/d/ytmp4?url=${match}`;
      const response = await fetch(ytApi, { timeout: 10000 }); // 10s timeout
      if (!response.ok) throw new Error('Failed to fetch from the API.');
      
      const result = await response.json();
      if (!result.data || !result.data.dl || !result.data.title) {
        throw new Error('Invalid API response.');
      }

      const { dl: mp4, title } = result.data;
      await message.reply(`_Downloading ${title}_`);
      await client.sendMessage(
        message.jid,
        { video: { url: mp4 }, mimetype: 'video/mp4', fileName: `${title}.mp4` },
        { quoted: message.data }
      );
    } catch (error) {
      console.error('Error fetching video:', error);
      await message.reply('Failed to download video. Please try again later.');
    }
  } else {
    try {
      const { videos } = await yts(match);
      if (videos.length === 0) {
        return message.reply('No results found for your query.');
      }
      const firstVideo = videos[0];
      const ytApi = `https://api.siputzx.my.id/api/d/ytmp4?url=${firstVideo.url}`;
      
      const response = await fetch(ytApi, { timeout: 10000 });
      if (!response.ok) throw new Error('Failed to fetch from the API.');
      
      const result = await response.json();
      if (!result.data || !result.data.dl || !result.data.title) {
        throw new Error('Invalid API response.');
      }

      const { dl: mp4, title } = result.data;
      await message.reply(`_Downloading ${title}_`);
      await client.sendMessage(
        message.jid,
        { video: { url: mp4 }, mimetype: 'video/mp4', fileName: `${title}.mp4` },
        { quoted: message.data }
      );
    } catch (error) {
      console.error('Error fetching video:', error);
      await message.reply('Failed to download video. Please try again later.');
    }
  }
});

rudhra({
  pattern: "yta ?(.*)",
  fromMe: mode,
  desc: "Download audio from YouTube.",
  type: "downloader",
}, async (message, match, client) => {
  match = match || message.reply_message.text;
  if (!match) {
    return await message.reply("Please provide a YouTube URL.");
  }

  try {
    const ytApi = `https://api.siputzx.my.id/api/d/ytmp4?url=${match}`;
    const response = await fetch(ytApi);
    const result = await response.json();
    const data = result.data;
    const mp3 = data.dl;
    const title = data.title;

        await message.reply(`_Downloading ${title}_`);
        await message.client.sendMessage(
            message.jid,
            { audio: { url: mp3 }, mimetype: 'audio/mp4' },
            { quoted: message.data }
          );
          await message.client.sendMessage(
            message.jid,
            { document: { url: mp3 }, mimetype: 'audio/mpeg', fileName: `${title}.mp3`, caption: `_${title}_` },
            { quoted: message.data }
          );
    } catch (error) {
        console.error('Error fetching audio:', error);
        await message.reply('Failed to download audio. Please try again later.');
    }
});

rudhra({
  pattern: "ytv ?(.*)",
  fromMe: mode,
  desc: "Download video from YouTube.",
  type: "downloader",
}, async (message, match, client) => {
  match = match || message.reply_message.text;
  if (!match) {
    return await message.reply("Please provide a YouTube URL.");
  }

  try {
    const ytApi = `https://api.siputzx.my.id/api/d/ytmp4?url=${match}`;
    const response = await fetch(ytApi);
    const result = await response.json();
    const data = result.data;
    const mp4 = data.dl;
    const title = data.title;

        await message.reply(`_Downloading ${title}_`);
        await message.client.sendMessage(
            message.jid,
            { video: { url: mp4 }, mimetype: 'video/mp4', fileName: `${title}.mp4` },
            { quoted: message.data }
        );
    } catch (error) {
        console.error('Error fetching video:', error);
        await message.reply('Failed to download video. Please try again later.');
    }
});

rudhra({
    pattern: "play ?(.*)",
    fromMe: mode,
    desc: "Search and download YouTube video/audio.",
    type: "downloader"
}, async (message, match, client) => {
    try {
        if (!match) {
            return await message.reply("Please provide a search term!");
        }

        // Search YouTube videos
        const result = await yts(match);
        if (!result.videos.length) {
            return await message.reply("No results found!");
        }

        const video = result.videos[0];
        const { url: playUrl, title, duration, thumbnail } = video;

        // Fetch download links
        const ytApi = `https://api.siputzx.my.id/api/d/ytmp4?url=${playUrl}`;
        const res = await fetch(ytApi);
        const ytplay = await res.json();

        if (!ytplay || !ytplay.data) {
            return await message.reply("Failed to fetch download links!");
        }

        const mp4 = ytplay.data.dl;

        // Display download options to the user
        const optionsText = `*_${title}_*\n\n *1.* *Video*\n *2.* *Audio*\n *3.* *Document*\n\n*ʀᴇᴘʟʏ ᴡɪᴛʜ ᴀ ɴᴜᴍʙᴇʀ ᴛᴏ ᴅᴏᴡɴʟᴏᴀᴅ*`;
        const contextInfoMessage = {
            text: optionsText,
            contextInfo: {
                mentionedJid: [message.sender],
                externalAdReply: {
                    title: title,
                    body: "ʀᴜᴅʜʀᴀ ʙᴏᴛ",
                    sourceUrl: playUrl,
                    mediaUrl: playUrl,
                    mediaType: 1,
                    showAdAttribution: true,
                    renderLargerThumbnail: false,
                    thumbnailUrl: thumbnail
                }
            }
        };

        const sentMsg = await client.sendMessage(message.jid, contextInfoMessage, { quoted: message.data });

        // Listen for user response
        client.ev.on('messages.upsert', async (msg) => {
            const newMessage = msg.messages[0];

            if (
                newMessage.key.remoteJid === message.jid &&
                newMessage.message?.extendedTextMessage?.contextInfo?.stanzaId === sentMsg.key.id
            ) {
                const userReply = newMessage.message?.conversation || newMessage.message?.extendedTextMessage?.text;

                if (userReply === '1') {
                    // Send video file
                    await client.sendMessage(
                        message.jid,
                        {
                            video: { url: mp4 },
                            mimetype: 'video/mp4',
                            caption: `*Title:* ${title}\n*Duration:* ${duration} seconds`
                        },
                        { quoted: message.data }
                    );
                } else if (userReply === '2') {
                    // Send audio file
                    await client.sendMessage(
                        message.jid,
                        {
                            audio: { url: mp4 },
                            mimetype: 'audio/mpeg',
                            fileName: `rudhra-bot.mp3`,
                            contextInfo: {
                                externalAdReply: {
                                    title: title,
                                    body: "ʀᴜᴅʜʀᴀ ʙᴏᴛ",
                                    sourceUrl: playUrl,
                                    mediaUrl: playUrl,
                                    mediaType: 1,
                                    showAdAttribution: true,
                                    renderLargerThumbnail: false,
                                    thumbnailUrl: thumbnail
                                }
                            }
                        },
                        { quoted: message.data }
                    );
                } else if (userReply === '3') {
                    // Send document file
                    await client.sendMessage(
                        message.jid,
                        {
                            document: { url: mp4 },
                            mimetype: 'audio/mpeg',
                            fileName: `${title}.mp3`,
                            caption: `_${title}_`
                        },
                        { quoted: message.data }
                    );
                } else {
                    await client.sendMessage(message.jid, { text: "Invalid option. Please reply with 1, 2, or 3." });
                }
            }
        });
    } catch (error) {
        await client.sendMessage(message.jid, { text: "An error occurred while fetching media. Please try again." });
    }
});

rudhra({
  pattern: 'yts ?(.*)', 
  fromMe: mode,
  desc: 'Search for videos on YouTube.',
  type: 'downloader'
}, async (message, match, client) => {
  const query = match;
  if (!query) {
    return await message.reply('*Please provide a search query.*');
  }

  yts(query, async (err, result) => {
    if (err) {
      return message.reply('*Error occurred while searching YouTube.*');
    }

    if (result && result.videos.length > 0) {
      let formattedMessage = '*YouTube Search Results:*\n\n';
      
      result.videos.slice(0, 10).forEach((video, index) => {
        formattedMessage += `*${index + 1}. ${video.title}*\nChannel: ${video.author.name}\nURL: ${video.url}\n\n`;
      });

      const contextInfoMessage = {
        text: formattedMessage,
        contextInfo: {
          mentionedJid: [message.sender],
          externalAdReply: {
          title: "𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗦𝗲𝗮𝗿𝗰𝗵 𝗥𝗲𝘀𝘂𝗹𝘁𝘀",
                    body: "ʀᴜᴅʜʀᴀ ʙᴏᴛ",
                    sourceUrl: "https://youtube.com/princerudh",
                    mediaUrl: "https://youtube.com",
                    mediaType: 1,
                    showAdAttribution: true,
                    renderLargerThumbnail: false,
                    thumbnailUrl: "https://raw.githubusercontent.com/rudhraan/media/refs/heads/main/image/yts.png"
          }
        }
      };

      await message.client.sendMessage(message.jid, contextInfoMessage);
    } else {
      await message.reply('*No results found for that query.*');
    }
  });
});
