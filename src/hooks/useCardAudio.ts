import { useEffect } from "react";
import { useApp } from "./useApp";
export function useCardAudio(text: string | undefined, enabled = true) {
  const { settings } = useApp();
  useEffect(() => {
    if (
      !enabled ||
      !settings.autoPlayAudio ||
      !text ||
      !("speechSynthesis" in window)
    )
      return;
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "ja-JP";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
    return () => window.speechSynthesis.cancel();
  }, [text, enabled, settings.autoPlayAudio]);
}
