// The browser's default ja-JP voice is often the weakest one installed: prefer natural/enhanced voices, then well-known good ones.
const voiceScore = (v: SpeechSynthesisVoice) => (/premium|enhanced|natural|neural/i.test(v.name) ? 2 : 0) + (/kyoko|o-ren|google|nanami|haruka/i.test(v.name) ? 1 : 0);
function japaneseVoice() {
  return window.speechSynthesis.getVoices().filter(v => v.lang.replace('_', '-').toLowerCase().startsWith('ja')).sort((a, b) => voiceScore(b) - voiceScore(a))[0];
}

// A lone kana is one short mora: speak it slowly, and twice (see sayKana) so a beginner can catch it.
export function speak(text: string, rate = 0.45) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.voice = japaneseVoice() ?? null; // voices load lazily; null falls back to the browser default
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

export const sayKana = (ch: string) => speak(`${ch}。${ch}`);
