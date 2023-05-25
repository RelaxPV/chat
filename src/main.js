import { Telegraf, session } from 'telegraf';
import config from 'config';
import { messageHandler, voiceHandler } from './handlers.js';
import { openaiVoiceHandler } from './openai.js';

console.log(config.get('TEST_ENV'));

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'));
bot.use(session());

bot.command(['start', 'new'], async (ctx) => {
  ctx.session = ctx.session || { messages: [] };
  const userMessage = 'Привет!'; // Первое сообщение от пользователя
  ctx.session.messages.push({ role: openaiVoiceHandler.roles.USER, content: userMessage });
  
  const response = await openaiVoiceHandler.chat(ctx.session.messages);
  ctx.session.messages.push({ role: openaiVoiceHandler.roles.ASSISTANT, content: response.content });
  
  await ctx.reply(response.content);
});




bot.on('voice', voiceHandler);
bot.on('message', messageHandler);

bot.launch();
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
