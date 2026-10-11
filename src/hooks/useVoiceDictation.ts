import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// On-device dictation via the WebView / browser speech engine.
// Zero server cost, zero audio ever leaves the device — the user just talks
// and their prayer appears. Silently unavailable where the engine isn't there.
// ---------------------------------------------------------------------------

type SpeechCtor = new () => any;

function getCtor(): SpeechCtor | null {
  const w = window as any;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as SpeechCtor | null;
}

export function useVoiceDictation(lang: string, onText: (chunk: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => !!getCtor());
  const recRef = useRef<any>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* already stopped */
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return false;
    try {
      const rec = new Ctor();
      rec.lang = lang;
      rec.interimResults = false;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        let chunk = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) chunk += e.results[i][0].transcript;
        }
        if (chunk.trim()) onTextRef.current(chunk.trim());
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recRef.current = rec;
      rec.start();
      setListening(true);
      return true;
    } catch {
      setListening(false);
      return false;
    }
  }, [lang]);

  useEffect(() => () => {
    try {
      recRef.current?.abort?.();
    } catch {
      /* noop */
    }
  }, []);

  return { supported, listening, start, stop };
}

/** BCP-47 tag for the speech engine, from our app language code. */
export const SPEECH_LANG: Record<string, string> = {
  en: "en-US",
  es: "es-419",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  fil: "fil-PH",
  hi: "hi-IN",
  id: "id-ID",
};
