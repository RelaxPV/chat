import axios from 'axios';
import fs from 'fs';
import config from 'config';

function detectLanguage(text) {
  return /[а-яА-ЯЁё]/.test(text) ? 'ru' : 'en';
}

async function convertTextToAudio(text, language) {
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.get('GOOGLE_API_KEY')}`;

  const voice = getVoice(language);

  const data = {
    input: {
      text: text,
    },
    voice: voice,
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.0,
    },
  };

  try {
    const response = await axios.post(url, data);
    const audioContent = response.data.audioContent;
    const filePath = `audio/${Date.now()}.mp3`;
    fs.writeFileSync(filePath, Buffer.from(audioContent, 'base64'));
    console.log('Audio file successfully created:', filePath);
    return filePath;
  } catch (error) {
    console.log('Error creating audio file:', error.message);
  }
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

export { detectLanguage, convertTextToAudio };
