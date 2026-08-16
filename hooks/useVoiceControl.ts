
import { useState, useEffect, useCallback, useRef } from 'react';

export interface VoiceCommand {
  command: string;
  action: (transcript: string) => void;
  keywords: string[];
}

interface UseVoiceControlProps {
  onCommand: (cmd: string, transcript: string) => void;
}

export const useVoiceControl = ({ onCommand }: UseVoiceControlProps) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSupported(true);
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US'; // Default to English for commands, could make dynamic

        rec.onstart = () => setIsListening(true);
        rec.onend = () => setIsListening(false);
        rec.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };

        rec.onresult = (event: any) => {
          const last = event.results.length - 1;
          const text = event.results[last][0].transcript.trim().toLowerCase();
          setTranscript(text);
          console.log("Voice Input:", text);

          // Command Matching Logic
          if (text.includes('home') || text.includes('dashboard')) onCommandRef.current('home', text);
          else if (text.includes('translate') || text.includes('translator')) onCommandRef.current('translator', text);
          // The 'duplicates' command went with the Check Duplicates tab. Note it
          // also matched the bare word "check", so removing it makes that word
          // available again rather than silently routing to a tab that is gone.
          else if (text.includes('salla')) onCommandRef.current('salla', text);
          else if (text.includes('zid')) onCommandRef.current('zid', text);
          else if (text.includes('reset') || text.includes('clear')) onCommandRef.current('reset', text);
          else if (text.includes('start') || text.includes('process') || text.includes('go') || text.includes('run')) onCommandRef.current('start', text);
          else if (text.includes('logs') || text.includes('history')) onCommandRef.current('toggle_logs', text);
        };

        setRecognition(rec);
      }
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }, [isListening, recognition]);

  return { isListening, toggleListening, transcript, isSupported };
};
