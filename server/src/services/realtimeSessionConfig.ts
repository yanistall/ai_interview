type RealtimeLanguage = 'zh-TW' | 'en-US';

export interface RealtimeSessionConfigInput {
  instructions: string;
  language: RealtimeLanguage;
  voiceName: string;
}

export function buildRealtimeSessionConfig({
  instructions,
  language,
  voiceName,
}: RealtimeSessionConfigInput) {
  return {
    type: 'realtime',
    model: 'gpt-realtime-1.5',
    instructions,
    output_modalities: ['audio'],
    audio: {
      input: {
        noise_reduction: { type: 'far_field' },
        transcription: {
          model: 'gpt-4o-transcribe',
          language: language === 'zh-TW' ? 'zh' : 'en',
          prompt: language === 'zh-TW'
            ? '請以繁體中文（台灣）記錄語音，保留英文專有名詞。'
            : 'Transcribe the interview in English, preserving proper names and technical terms.',
        },
        turn_detection: {
          type: 'semantic_vad',
          eagerness: 'low',
          create_response: false,
          interrupt_response: false,
        },
      },
      output: { voice: voiceName },
    },
  };
}
