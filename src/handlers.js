import { ogg, openaiVoiceHandler, convertTextToAudio as convert } from './services.js';
import { detectLanguage } from './utils.js';
import fs from 'fs/promises';

async function voiceHandler(ctx) {
  try {
    ctx.session = ctx.session || { messages: [] }; // Initialize ctx.session if it is undefined
    const { file_id } = ctx.message.voice;
    const fileLink = await ctx.telegram.getFileLink(file_id);
    const userId = String(ctx.message.from.id);
    const oggPath = await ogg.create(fileLink.href, userId);
    const mp3Path = await ogg.toMp3(oggPath, userId);
    const text = await openaiVoiceHandler.transcription(mp3Path);
    ctx.session.messages.push({ role: openaiVoiceHandler.roles.USER, content: text }); // Add user's voice transcription to ctx.session.messages
    const language = detectLanguage(text);
    const response = await openaiVoiceHandler.chat(ctx.session.messages, language);
    console.log('Chat Response:', response); // Add debug output
    ctx.session.messages.push({ role: openaiVoiceHandler.roles.ASSISTANT, content: response.content });
    const audioPath = await convert(response.content, language);
    await ctx.replyWithVoice({ source: audioPath });

    // Remove the audio file
    await fs.unlink(audioPath);
  } catch (error) {
    console.log('Error while processing voice message:', error.message);
  }
}

async function messageHandler(ctx) {
  try {
    ctx.session = ctx.session || { messages: [] }; // Initialize ctx.session if it is undefined
    const { voice, text } = ctx.message;
    if (voice) {
      return voiceHandler(ctx);
    } else if (text) {
      ctx.session.messages.push({ role: openaiVoiceHandler.roles.USER, content: text });
      const response = await openaiVoiceHandler.chat(ctx.session.messages);
      console.log('Chat Response:', response); // Add debug output
      ctx.session.messages.push({ role: openaiVoiceHandler.roles.ASSISTANT, content: response.content });
      await ctx.reply(response.content);
    }
  } catch (error) {
    console.log('Error while processing message:', error.message);
  }
}

export { voiceHandler, messageHandler };
