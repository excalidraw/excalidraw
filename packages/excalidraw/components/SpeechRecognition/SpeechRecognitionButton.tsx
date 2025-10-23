import React, { useRef, useEffect, useState } from "react";
import { microphoneIcon, microphoneMutedIcon } from "../icons";
import { InlineIcon } from "../InlineIcon";

// Speech Recognition API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any)
    | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

// Extend Window interface for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

export interface SpeechRecognitionButtonProps {
  onTranscript: (transcript: string) => void;
  onError?: (error: string) => void;
  onListeningChange?: (isListening: boolean) => void;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  iconSize?: string;
  title?: string;
  ariaLabel?: string;
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export const SpeechRecognitionButton: React.FC<
  SpeechRecognitionButtonProps
> = ({
  onTranscript,
  onError,
  onListeningChange,
  disabled = false,
  className = "",
  buttonClassName = "",
  iconSize = "1.5em",
  title,
  ariaLabel,
  lang = "en-US",
  continuous = false,
  interimResults = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = interimResults;
      recognition.lang = lang;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
        onListeningChange?.(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        onTranscript(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error:", event.error);
        const errorMessage = `Speech recognition error: ${event.error}`;
        setSpeechError(errorMessage);
        onError?.(errorMessage);
        setIsListening(false);
        onListeningChange?.(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        onListeningChange?.(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
      const errorMessage = "Speech recognition not supported in this browser";
      setSpeechError(errorMessage);
      onError?.(errorMessage);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [
    onTranscript,
    onError,
    onListeningChange,
    lang,
    continuous,
    interimResults,
  ]);

  const handleVoiceDictation = () => {
    if (!speechSupported || !recognitionRef.current || disabled) {
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Failed to start speech recognition:", error);
        const errorMessage =
          "Failed to start voice recognition. Please try again.";
        setSpeechError(errorMessage);
        onError?.(errorMessage);
      }
    }
  };

  if (!speechSupported) {
    return null;
  }

  const defaultTitle = isListening ? "Stop voice input" : "Start voice input";
  const defaultAriaLabel = isListening
    ? "Stop voice input"
    : "Start voice input";

  return (
    <div className={`speech-recognition ${className}`}>
      <button
        className={`speech-recognition__button ${
          isListening ? "speech-recognition__button--listening" : ""
        } ${buttonClassName}`}
        onClick={handleVoiceDictation}
        disabled={disabled}
        type="button"
        title={title || defaultTitle}
        aria-label={ariaLabel || defaultAriaLabel}
      >
        <InlineIcon
          size={iconSize}
          icon={isListening ? microphoneIcon : microphoneMutedIcon}
        />
      </button>
      {speechError && (
        <div className="speech-recognition__error" role="alert">
          {speechError}
        </div>
      )}
    </div>
  );
};
