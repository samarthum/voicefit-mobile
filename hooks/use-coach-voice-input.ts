import { useAuth } from "@clerk/clerk-expo";
import { Audio } from "expo-av";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { apiFormRequest } from "@/lib/api-client";

type UseCoachVoiceInputOptions = {
  onTranscript: (transcript: string) => void;
  onTranscriptFocus?: () => void;
  minDurationMillis?: number;
};

export type UseCoachVoiceInputResult = {
  isRecording: boolean;
  isRecordingMic: boolean;
  isTranscribing: boolean;
  startRecording: () => Promise<void>;
  stopAndTranscribe: () => Promise<void>;
  handleMicPress: () => Promise<void>;
};

export function useCoachVoiceInput({
  onTranscript,
  onTranscriptFocus,
  minDurationMillis = 500,
}: UseCoachVoiceInputOptions): UseCoachVoiceInputResult {
  const { getToken } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      const activeRecording = recordingRef.current;
      recordingRef.current = null;
      if (activeRecording) {
        activeRecording.setOnRecordingStatusUpdate(null);
        void activeRecording.stopAndUnloadAsync().catch(() => undefined);
      }
    };
  }, []);

  const safeSetIsRecording = useCallback((next: boolean) => {
    if (mountedRef.current) {
      setIsRecording(next);
    }
  }, []);

  const safeSetIsTranscribing = useCallback((next: boolean) => {
    if (mountedRef.current) {
      setIsTranscribing(next);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isTranscribing || recordingRef.current) return;

    let nextRecording: Audio.Recording | null = null;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Microphone",
          "Microphone permission is required to use voice input."
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      nextRecording = new Audio.Recording();
      await nextRecording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await nextRecording.startAsync();

      recordingRef.current = nextRecording;
      safeSetIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      if (mountedRef.current) {
        Alert.alert(
          "Voice input",
          "Could not start recording. Please try again."
        );
      }
      safeSetIsRecording(false);

      if (nextRecording) {
        await nextRecording.stopAndUnloadAsync().catch(() => undefined);
      }
    }
  }, [isTranscribing, safeSetIsRecording]);

  const stopAndTranscribe = useCallback(async () => {
    const activeRecording = recordingRef.current;
    if (!activeRecording || isTranscribing) return;

    recordingRef.current = null;
    safeSetIsRecording(false);
    safeSetIsTranscribing(true);

    try {
      activeRecording.setOnRecordingStatusUpdate(null);
      await activeRecording.stopAndUnloadAsync();
      const status = await activeRecording.getStatusAsync();
      const uri = activeRecording.getURI();

      if (!uri || (status.durationMillis ?? 0) < minDurationMillis) {
        return;
      }

      const token = await getToken();
      if (!token) throw new Error("Not signed in");

      const formData = new FormData();
      formData.append("audio", {
        uri,
        name: `coach-${Date.now()}.m4a`,
        type: "audio/m4a",
      } as unknown as Blob);

      const { transcript } = await apiFormRequest<{ transcript: string }>(
        "/api/transcribe",
        formData,
        { token }
      );

      const cleaned = transcript.trim();
      if (cleaned && mountedRef.current) {
        onTranscript(cleaned);
        onTranscriptFocus?.();
      }
    } catch (err) {
      console.error("Transcription error:", err);
      if (mountedRef.current) {
        Alert.alert(
          "Voice input",
          "Could not transcribe that recording. Please try again."
        );
      }
    } finally {
      safeSetIsTranscribing(false);
    }
  }, [
    getToken,
    isTranscribing,
    minDurationMillis,
    onTranscript,
    onTranscriptFocus,
    safeSetIsRecording,
    safeSetIsTranscribing,
  ]);

  const handleMicPress = useCallback(async () => {
    if (isTranscribing) return;

    if (recordingRef.current || isRecording) {
      await stopAndTranscribe();
      return;
    }

    await startRecording();
  }, [isRecording, isTranscribing, startRecording, stopAndTranscribe]);

  return {
    isRecording,
    isRecordingMic: isRecording,
    isTranscribing,
    startRecording,
    stopAndTranscribe,
    handleMicPress,
  };
}
