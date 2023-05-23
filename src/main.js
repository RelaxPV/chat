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
  await ctx.reply('send a voice or text message:');
});

bot.command('start', async (ctx) => {
  ctx.session = INITIAL_SESSION;
  await ctx.reply('send a voice or text message:');
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

    const language = detectLanguage(text);

    const response = await openai.chat(ctx.session.messages, language);

    ctx.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    const audioPath = await convertTextToAudio(response.content, language);
    await ctx.replyWithVoice({ source: createReadStream(audioPath) });
  } catch (e) {
    console.log('error while processing voice message', e.message);
  }
});

bot.on('message', async (ctx) => {
  ctx.session ??= INITIAL_SESSION;

  if (ctx.message.voice) {
    // Обработка голосового сообщения
    try {
      const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id);
      const userId = String(ctx.message.from.id);
      const oggPath = await ogg.create(link.href, userId);
      const mp3Path = await ogg.toMp3(oggPath, userId);

      const text = await openai.transcription(mp3Path);

      ctx.session.messages.push({ role: openai.roles.USER, content: text });

      const language = detectLanguage(text);

      const response = await openai.chat(ctx.session.messages, language);

      ctx.session.messages.push({
        role: openai.roles.ASSISTANT,
        content: response.content,
      });

      const audioPath = await convertTextToAudio(response.content, language);
      await ctx.replyWithVoice({ source: createReadStream(audioPath) });
    } catch (e) {
      console.log('Error while processing voice message:', e.message);
    }
  } else if (ctx.message.text) {
    // Обработка текстового сообщения
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

      await ctx.reply(response.content); // Отправка текстового ответа
    } catch (e) {
      console.log('Error while processing text message:', e.message);
    }
  }
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

async function convertTextToAudio(text, language) {
  const GOOGLE_API_KEY = config.get('GOOGLE_API_KEY');
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`;

  const voice = getVoice(language);

  const data = {
    input: {
      text: text,
    },
    voice: voice,
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

function detectLanguage(text) {
  // Add your own language detection logic here
  // Return 'ru' for Russian and 'en' for English
  // You can use external libraries like 'franc' or 'langdetect' for language detection
  // For simplicity, let's assume that the text is Russian if it contains Cyrillic characters
  return /[а-яА-ЯЁё]/.test(text) ? 'ru' : 'en';
}

function getVoice(language) {
  const voices = {
    ru: {
      languageCode: 'ru-RU',
      name: 'ru-RU-Wavenet-C',
      ssmlGender: 'FEMALE',
    },
    en: {
      languageCode: 'en-US',
      name: 'en-US-Wavenet-D',
      ssmlGender: 'FEMALE',
    },
  };

  return voices[language];
}
