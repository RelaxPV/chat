import { Telegraf, session } from 'telegraf';
import { message } from 'telegraf/filters';
import { code } from 'telegraf/format';
import config from 'config';
import { ogg } from './ogg.js';
import { openai } from './openai.js';
import { createReadStream, writeFileSync } from 'fs';
import axios from 'axios';

console.log(config.get('TEST_ENV'));

const INITIAL_SESSION = {
  messages: [],
};

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'));

bot.use(session());

bot.command('new', async (ctx) => {
  ctx.session = INITIAL_SESSION;
  await ctx.reply('send a voice or text message.');
});

bot.command('start', async (ctx) => {
  ctx.session = INITIAL_SESSION;
  await ctx.reply('send a voice or text message.');
});

bot.on(message('voice'), async (ctx) => {
  ctx.session ??= INITIAL_SESSION;
  try {
    const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
    const userId = String(ctx.message.from.id);
    const oggPath = await ogg.create(link.href, userId);
    const mp3Path = await ogg.toMp3(oggPath, userId);

    const text = await openai.transctiption(mp3Path);

    ctx.session.messages.push({ role: openai.roles.USER, content: text });

    const response = await openai.chat(ctx.session.messages);

    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    const audioPath = await convertTextToAudio(response.content);
    await ctx.replyWithVoice({ source: createReadStream(audioPath) });
  } catch (e) {
    console.log('error while processing voice message', e.message);
  }
});

bot.on(message('text'), async (ctx) => {
  ctx.session ??= INITIAL_SESSION;
  try {
    ctx.session.messages.push({
      role: openai.roles.USER,
      content: ctx.message.text,
    });

    const response = await openai.chat(ctx.session.messages);

    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    const audioPath = await convertTextToAudio(response.content);
    await ctx.replyWithVoice({ source: createReadStream(audioPath) });
  } catch (e) {
    console.log('error while processing voice message', e.message);
  }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

async function convertTextToAudio(text) {
  const url = 'https://texttospeech.googleapis.com/v1/text:synthesize?key=AIzaSyCN8rDZnyHfbcEacGH_drMicOVIeWCIHDo'; // Замените YOUR_API_KEY на ваш ключ API

  const data = {
    input: {
      text: text,
    },
    voice: {
      languageCode: 'ru-RU',
      name: 'ru-RU-Wavenet-C',
      ssmlGender: 'FEMALE',
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0, // Adjust the speaking rate as needed (1.0 is normal speed)
    },
  };

  try {
    const response = await axios.post(url, data);
    const audioContent = response.data.audioContent;
    const filePath = 'output.mp3';
    writeFileSync(filePath, audioContent, 'base64');
    return filePath;
  } catch (error) {
    console.log('Error converting text to audio:', error.message);
  }
}
