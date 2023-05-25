import { Configuration, OpenAIApi } from 'openai';
import config from 'config';
import { createReadStream } from 'fs';

class OpenAI {
  roles = {
    ASSISTANT: 'assistant',
    USER: 'user',
    SYSTEM: 'system',
  };

  constructor(apiKey) {
    const configuration = new Configuration({
      apiKey,
    });
    this.openai = new OpenAIApi(configuration);
  }

  async chat(messages) {
    try {
      console.log('Chat Messages:', messages);
      const response = await this.openai.createChatCompletion({
        model: 'gpt-3.5-turbo',
        messages,
      });
      console.log('API Response:', response.data);
      if (response.data.choices && response.data.choices.length > 0) {
        const message = response.data.choices[0].message;
        console.log('Response Message:', message);
        return message;
      } else {
        console.log('Invalid API Response:', response.data);
        throw new Error('Invalid API response');
      }
    } catch (e) {
      console.log('Error while gpt chat', e.message);
    }
  }

  async transcription(filepath) {
    try {
      const response = await this.openai.createTranscription(
        createReadStream(filepath),
        'whisper-1'
      );
      console.log('Transcription Response:', response.data);
      return response.data.text;
    } catch (e) {
    }
  }
}

export const openaiVoiceHandler = new OpenAI(config.get('OPENAI_KEY'));
