import { useAuth } from "@clerk/clerk-expo";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { apiFormRequest } from "@/lib/api-client";
import { haptic } from "@/lib/haptics";

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

// NUI-8: useAudioRecorder is a hook — must be called at the top level of this
// custom hook, never inside a nested function.
export function useCoachVoiceInput({
  onTranscript,
  onTranscriptFocus,
  minDurationMillis = 500,
}: UseCoachVoiceInputOptions): UseCoachVoiceInputResult {
  const { getToken } = useAuth();

  // NUI-8: hook-based recorder (expo-audio)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mountedRef = useRef(true);
  // Track recording start time for minDurationMillis check
  const recordingStartMsRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      // If recording is active on unmount, stop it (fire-and-forget)
      if (isRecording) {
        void recorder.stop().catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (isTranscribing || isRecording) return;

    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert(
          "Microphone",
          "Microphone permission is required to use voice input."
        );
        return;
      }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });

      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingStartMsRef.current = Date.now();

      haptic.press(); // NUI-6: medium haptic on record start
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
    }
  }, [isTranscribing, isRecording, recorder, safeSetIsRecording]);

  const stopAndTranscribe = useCallback(async () => {
    if (!isRecording || isTranscribing) return;

    safeSetIsRecording(false);
    safeSetIsTranscribing(true);
    haptic.tap(); // NUI-6: light haptic on stop

    try {
      await recorder.stop();
      const uri = recorder.uri;

      const durationMs = recordingStartMsRef.current != null
        ? Date.now() - recordingStartMsRef.current
        : 0;
      recordingStartMsRef.current = null;

      if (!uri || durationMs < minDurationMillis) {
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
    isRecording,
    isTranscribing,
    minDurationMillis,
    onTranscript,
    onTranscriptFocus,
    recorder,
    safeSetIsRecording,
    safeSetIsTranscribing,
  ]);

  const handleMicPress = useCallback(async () => {
    if (isTranscribing) return;

    if (isRecording) {
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
