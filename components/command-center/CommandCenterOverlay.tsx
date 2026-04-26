import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import {
  COLORS,
  confidenceLabel,
  formatMealTypeLabel,
  formatRecordingDuration,
  SHOW_ESTIMATED_REVIEW_MACROS,
} from "./helpers";
import { useCommandCenterInternal } from "./CommandCenterProvider";
import { EXERCISE_CATALOG } from "../../lib/exercise-catalog";
import { color as t, font, radius } from "../../lib/tokens";
import { LoadingBlock } from "../pulse/LoadingSkeleton";
import { VoiceRing } from "../pulse/VoiceRing";

// ---------------------------------------------------------------------------
// SVG Glyphs
// ---------------------------------------------------------------------------

function SparkleGlyph({ color = COLORS.textTertiary }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill={color} />
    </Svg>
  );
}

function MicGlyph({ color = t.accentInk }: { color?: string }) {
  return (
    <Svg width={22} height={28} viewBox="0 0 22 28" fill="none">
      <Rect x={7} y={1} width={8} height={14} rx={4} fill={color} />
      <Path d="M3 13C3 17.5 6.5 21 11 21C15.5 21 19 17.5 19 13" stroke={color} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      <Path d="M11 21V26M7 26H15" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function CloseGlyph({ color = t.textSoft }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M2 2L12 12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 2L2 12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function KeyboardGlyph({ color = t.textSoft }: { color?: string }) {
  return (
    <Svg width={18} height={14} viewBox="0 0 18 14" fill="none">
      <Path d="M1.5 1H16.5C17.05 1 17.5 1.45 17.5 2V12C17.5 12.55 17.05 13 16.5 13H1.5C0.95 13 0.5 12.55 0.5 12V2C0.5 1.45 0.95 1 1.5 1Z" stroke={color} strokeWidth={1.4} fill="none" />
      <Path d="M4.2 7H4.9M8.7 7H9.4M13.2 7H13.9M5 10H13" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

function SparkSendGlyph({ color = t.text }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 14 14" fill="none">
      <Path d="M3 7L11 3L7 11L6 8L3 7Z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function PlusGlyph({ color = t.accent }: { color?: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path d="M6 1V11" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 6H11" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckGlyph({ color = t.accentInk }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M13.2 3.8L6.2 12.2L2.8 8.8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function BlinkingCursor() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setVisible((v) => !v), 500);
    return () => clearInterval(id);
  }, []);
  return <View style={[styles.listeningCursor, !visible && styles.listeningCursorHidden]} />;
}

function InterpretingDots() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % 3), 350);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.interpretingDotsRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.interpretingDot,
            i === active ? styles.interpretingDotActive : styles.interpretingDotIdle,
          ]}
        />
      ))}
    </View>
  );
}

const LISTENING_BAR_HEIGHTS = [6, 14, 22, 10, 28, 36, 20, 40, 32, 26, 38, 24, 14, 30, 18, 10, 22, 14, 8, 4];

// ---------------------------------------------------------------------------
// Sheet shell
// ---------------------------------------------------------------------------

function Sheet({
  title,
  onClose,
  children,
  showCloseButton = true,
  canCloseViaBackdrop,
  closeButtonTestID = "cc-close",
}: {
  title?: string | null;
  onClose: () => void;
  children: ReactNode;
  showCloseButton?: boolean;
  canCloseViaBackdrop: boolean;
  closeButtonTestID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.sheetRoot}>
      <Pressable
        style={styles.sheetBackdrop}
        onPress={() => {
          if (canCloseViaBackdrop) onClose();
        }}
      />
      <View style={[styles.sheetContainer, { paddingBottom: insets.bottom + 22 }]}>
        <View style={styles.sheetHandleRow}>
          <View style={styles.sheetHandle} />
        </View>
        {title ? (
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitleText}>{title}</Text>
            {showCloseButton ? (
              <Pressable style={styles.sheetCloseCircle} onPress={onClose} testID={closeButtonTestID}>
                <CloseGlyph />
              </Pressable>
            ) : (
              <View style={styles.sheetCloseCircle} />
            )}
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Interpreting screen (shared by typed + voice states)
// ---------------------------------------------------------------------------

type InterpretingCopy = { label: string; elapsed: string };

function getInterpretingCopy(
  state: "cc_submitting_typed" | "cc_transcribing_voice" | "cc_interpreting_voice",
  recordingSeconds: number,
): InterpretingCopy {
  if (state === "cc_submitting_typed") {
    return { label: "Interpreting your entry…", elapsed: "0.7s" };
  }
  if (state === "cc_transcribing_voice") {
    return {
      label: "Converting speech to text…",
      elapsed: recordingSeconds > 0 ? formatRecordingDuration(recordingSeconds) : "—",
    };
  }
  return {
    label: "Analyzing your entry…",
    elapsed: recordingSeconds > 0 ? formatRecordingDuration(recordingSeconds) : "—",
  };
}

function InterpretingScreen() {
  const cc = useCommandCenterInternal();
  const isTyped = cc.commandState === "cc_submitting_typed";
  const transcript = isTyped ? cc.commandText : cc.voiceTranscript;
  const setTranscript = isTyped ? cc.setCommandText : cc.setVoiceTranscript;
  const copy = getInterpretingCopy(
    cc.commandState as "cc_submitting_typed" | "cc_transcribing_voice" | "cc_interpreting_voice",
    cc.recordingSeconds,
  );
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);

  const headerCloseTestID =
    cc.commandState === "cc_transcribing_voice"
      ? "cc-transcribing-close"
      : cc.commandState === "cc_interpreting_voice"
      ? "cc-interpreting-close"
      : undefined;

  const onEditPress = () => {
    if (isTyped) {
      cc.setCommandState("cc_expanded_typing");
      return;
    }
    setIsEditingTranscript(true);
  };

  const displayText = transcript.trim() ? `"${transcript.trim()}"` : "";

  return (
    <Sheet
      title={null}
      onClose={cc.closeCommandCenter}
      canCloseViaBackdrop={false}
      showCloseButton={false}
    >
      <View style={styles.statePadding}>
        <View style={styles.interpretingTopRow}>
          <Text style={styles.interpretingEyebrow}>YOU SAID</Text>
          <View style={styles.interpretingTopRowRight}>
            <Pressable onPress={onEditPress} testID="cc-interpreting-edit-link">
              <Text style={styles.interpretingEditLink}>EDIT</Text>
            </Pressable>
            {headerCloseTestID ? (
              <Pressable
                style={styles.interpretingHeaderClose}
                onPress={cc.closeCommandCenter}
                testID={headerCloseTestID}
              >
                <CloseGlyph />
              </Pressable>
            ) : null}
          </View>
        </View>

        {isEditingTranscript && !isTyped ? (
          <View>
            <TextInput
              style={styles.interpretingTranscriptInput}
              value={transcript}
              onChangeText={setTranscript}
              multiline
              placeholder="Transcript"
              placeholderTextColor={t.textMute}
              testID="cc-voice-transcript"
              autoFocus
            />
            <Pressable
              style={styles.interpretingDoneButton}
              onPress={() => setIsEditingTranscript(false)}
            >
              <Text style={styles.interpretingDoneText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onEditPress}>
            <Text style={styles.interpretingTranscript}>{displayText}</Text>
          </Pressable>
        )}

        <View style={styles.interpretingStatusPill}>
          <InterpretingDots />
          <Text style={styles.interpretingStatusLabel}>{copy.label}</Text>
          <Text style={styles.interpretingStatusElapsed}>{copy.elapsed}</Text>
        </View>

        <View style={styles.interpretingSkeletonCard}>
          <LoadingBlock width="55%" height={16} radius={4} style={styles.skelLine2} />
          <LoadingBlock
            width="30%"
            height={10}
            radius={4}
            style={[styles.skelLine2, styles.skelSecond]}
          />
          <View style={styles.interpretingSkeletonRow}>
            <View style={styles.skelFlex}>
              <LoadingBlock height={46} radius={10} style={styles.skelLine} />
            </View>
            <View style={styles.skelFlex}>
              <LoadingBlock height={46} radius={10} style={styles.skelLine} />
            </View>
            <View style={styles.skelFlex}>
              <LoadingBlock height={46} radius={10} style={styles.skelLine} />
            </View>
          </View>
        </View>

        <View style={styles.interpretingButtonsRow}>
          {!isTyped ? (
            <Pressable
              style={styles.interpretingButton}
              onPress={() => void cc.startRecording()}
              testID="cc-interpreting-retry-voice"
            >
              <Text style={styles.interpretingButtonText}>Retry</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.interpretingButton}
            onPress={onEditPress}
            testID="cc-interpreting-edit"
          >
            <Text style={styles.interpretingButtonText}>Edit text</Text>
          </Pressable>
          <Pressable
            style={styles.interpretingButton}
            onPress={cc.closeCommandCenter}
            testID="cc-interpreting-discard"
          >
            <Text style={styles.interpretingButtonTextMute}>Discard</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Main Overlay Component
// ---------------------------------------------------------------------------

export function CommandCenterOverlay() {
  const cc = useCommandCenterInternal();

  const { commandState } = cc;
  const isVisible = commandState !== "cc_collapsed";
  const canCloseViaBackdrop =
    commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing";
  const modalAnimationType = Platform.OS === "web" ? "none" : "slide";

  const renderIdle = () => {
    const sendDisabled = !cc.commandText.trim();
    const isWorkout = cc.screenContext.screen === "workout";
    const placeholder = isWorkout
      ? 'Try "did 3 sets of squats at 80…"'
      : 'Try "had a chicken caesar and a diet coke for lunch"…';

    return (
      <View style={styles.idleBody}>
        <View style={styles.idleInputCard}>
          <TextInput
            style={styles.idleInput}
            placeholder={placeholder}
            placeholderTextColor={t.textSoft}
            value={cc.commandText}
            onChangeText={cc.handleCommandInputChange}
            multiline
            testID="cc-input-text"
          />
        </View>

        <View style={styles.idleActionsRow}>
          <Pressable style={styles.idleSquareBtn}>
            <KeyboardGlyph />
          </Pressable>

          <Pressable
            style={styles.idleMicWrap}
            onPress={() => void cc.startRecording()}
            testID="cc-big-mic"
          >
            <View pointerEvents="none" style={styles.idleMicHaloOuter} />
            <View pointerEvents="none" style={styles.idleMicHaloMid} />
            <View style={styles.idleMicCore}>
              <MicGlyph />
            </View>
          </Pressable>

          <Pressable
            style={[styles.idleSquareBtn, sendDisabled && styles.idleSquareBtnDisabled]}
            disabled={sendDisabled}
            onPress={() => void cc.sendTyped()}
            testID="cc-send"
          >
            <SparkSendGlyph />
          </Pressable>
        </View>

        <Text style={styles.idleCaption}>HOLD TO SPEAK · OR TYPE</Text>

        {isWorkout ? (
          <View style={styles.frequentSection}>
            <Text style={styles.frequentLabel}>FREQUENT</Text>
            {EXERCISE_CATALOG.slice(0, 5).map((exercise, index) => (
              <Pressable
                key={exercise.name}
                style={styles.frequentRow}
                onPress={() => {
                  cc.handleCommandInputChange(`3 sets of ${exercise.name}`);
                }}
                testID={`cc-exercise-${index}`}
              >
                <View style={styles.frequentText}>
                  <Text style={styles.frequentName}>{exercise.name}</Text>
                  <Text style={styles.frequentSub}>
                    {exercise.equipment} · {exercise.group}
                  </Text>
                </View>
                <View style={styles.frequentPlus}>
                  <PlusGlyph />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.frequentSection}>
            <Text style={styles.frequentLabel}>FREQUENT</Text>
            {cc.quickAddItems.slice(0, 3).map((item, index) => (
              <Pressable
                key={item.id}
                style={styles.frequentRow}
                onPress={() => {
                  void cc.runSaveAction({ kind: "quick_add", item });
                }}
                testID={`cc-quick-add-${index}`}
              >
                <View style={styles.frequentText}>
                  <Text style={styles.frequentName}>{item.description}</Text>
                  <Text style={styles.frequentSub}>{item.calories} kcal</Text>
                </View>
                <View style={styles.frequentPlus}>
                  <PlusGlyph />
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    if (commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing") {
      return (
        <Sheet title="Log anything" onClose={cc.closeCommandCenter} canCloseViaBackdrop={canCloseViaBackdrop}>
          {renderIdle()}
        </Sheet>
      );
    }

    if (
      commandState === "cc_submitting_typed" ||
      commandState === "cc_transcribing_voice" ||
      commandState === "cc_interpreting_voice"
    ) {
      return <InterpretingScreen />;
    }

    if (commandState === "cc_recording") {
      const liveText = cc.voiceTranscript.trim();
      return (
        <Sheet title={null} onClose={cc.closeCommandCenter} canCloseViaBackdrop={false} showCloseButton={false}>
          <View style={styles.listeningBody}>
            <View style={styles.listeningHeader}>
              <View style={styles.listeningHeaderSide}>
                <View style={styles.listeningTimerWrap}>
                  <View style={styles.listeningDot} />
                  <Text style={styles.listeningTimer}>{formatRecordingDuration(cc.recordingSeconds)}</Text>
                </View>
              </View>
              <View style={styles.listeningHeaderCenter}>
                <Text style={styles.listeningTitle}>Listening</Text>
              </View>
              <View style={[styles.listeningHeaderSide, styles.listeningHeaderSideRight]}>
                <Pressable style={styles.sheetCloseCircle} onPress={cc.closeCommandCenter} testID="cc-recording-discard">
                  <CloseGlyph />
                </Pressable>
              </View>
            </View>

            <View style={styles.listeningTranscriptWrap}>
              <Text style={styles.listeningTranscriptText}>
                {liveText ? liveText : <Text style={styles.listeningTranscriptPlaceholder}>Start speaking…</Text>}
              </Text>
              <BlinkingCursor />
            </View>

            <View style={styles.listeningWaveformRow}>
              {LISTENING_BAR_HEIGHTS.map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.listeningBar,
                    {
                      height: h * 1.4,
                      backgroundColor: i > 9 ? t.accent : t.textSoft,
                      opacity: i > 15 ? 0.3 : 1,
                    },
                    i > 9 && styles.listeningBarGlow,
                  ]}
                />
              ))}
            </View>

            <View style={styles.listeningStopWrap}>
              <View pointerEvents="none" style={styles.listeningStopHaloOuter} />
              <View pointerEvents="none" style={styles.listeningStopHaloMid} />
              <Pressable style={styles.listeningStopCore} onPress={() => void cc.stopRecording()} testID="cc-recording-stop">
                <View style={styles.listeningStopSquare} />
              </Pressable>
            </View>

            <Text style={styles.listeningCaption}>TAP TO STOP</Text>
          </View>
        </Sheet>
      );
    }

    if (commandState === "cc_review_meal" && cc.reviewDraft?.kind === "meal") {
      const meal = cc.reviewDraft.interpreted.payload;
      const confidence = confidenceLabel(cc.reviewDraft.confidence);
      const segmentCount = Math.max(0, Math.min(4, Math.round(cc.reviewDraft.confidence * 4)));
      const assumptions = meal.assumptions ?? [];
      const confidenceText = assumptions.length > 0
        ? `${confidence.text} · ${assumptions[0]}`
        : confidence.text;
      const mealTypeLabel = formatMealTypeLabel(meal.mealType).toUpperCase();
      const eyebrow = cc.reviewDraft.eatenAtLabel
        ? `${mealTypeLabel} · ${cc.reviewDraft.eatenAtLabel}`
        : mealTypeLabel;
      return (
        <Sheet
          title={null}
          onClose={cc.closeCommandCenter}
          canCloseViaBackdrop={false}
          showCloseButton={false}
          closeButtonTestID="cc-review-close"
        >
          <ScrollView
            style={styles.reviewScroll}
            contentContainerStyle={styles.mealReviewContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            <View style={styles.mealReviewYouSaidRow}>
              <Text style={styles.mealReviewYouSaidLabel}>YOU SAID</Text>
              <Pressable onPress={cc.editReviewTranscript} testID="cc-review-edit-transcript">
                <Text style={styles.mealReviewEditLink}>EDIT</Text>
              </Pressable>
            </View>
            <Text style={styles.mealReviewTranscript}>{`"${cc.reviewDraft.transcript}"`}</Text>

            <View style={styles.mealReviewBigCard}>
              <View style={styles.mealReviewHeroRow}>
                <View style={styles.mealReviewHeroLeft}>
                  <Text style={styles.mealReviewEyebrow}>{eyebrow}</Text>
                  <Text style={styles.mealReviewName}>{meal.description}</Text>
                </View>
                <View style={styles.mealReviewHeroRight}>
                  <Text style={styles.mealReviewKcal}>{meal.calories}</Text>
                  <Text style={styles.mealReviewKcalCaption}>KCAL · EST.</Text>
                </View>
              </View>

              {SHOW_ESTIMATED_REVIEW_MACROS ? (
                <View style={styles.mealReviewMacrosGrid}>
                  <View style={styles.mealReviewMacroCell}>
                    <Text style={styles.mealReviewMacroLabel}>PROTEIN</Text>
                    <View style={styles.mealReviewMacroValueRow}>
                      <Text style={[styles.mealReviewMacroValue, styles.mealReviewMacroValueAccent]}>
                        {cc.reviewDraft.macros.protein}
                      </Text>
                      <Text style={styles.mealReviewMacroUnit}>g</Text>
                    </View>
                  </View>
                  <View style={styles.mealReviewMacroCell}>
                    <Text style={styles.mealReviewMacroLabel}>CARBS</Text>
                    <View style={styles.mealReviewMacroValueRow}>
                      <Text style={[styles.mealReviewMacroValue, styles.mealReviewMacroValueSoft]}>
                        {cc.reviewDraft.macros.carbs}
                      </Text>
                      <Text style={styles.mealReviewMacroUnit}>g</Text>
                    </View>
                  </View>
                  <View style={styles.mealReviewMacroCell}>
                    <Text style={styles.mealReviewMacroLabel}>FAT</Text>
                    <View style={styles.mealReviewMacroValueRow}>
                      <Text style={[styles.mealReviewMacroValue, styles.mealReviewMacroValueSoft]}>
                        {cc.reviewDraft.macros.fat}
                      </Text>
                      <Text style={styles.mealReviewMacroUnit}>g</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              <View style={styles.mealReviewDivider} />

              <View style={styles.mealReviewIngredientsHeader}>
                <Text style={styles.mealReviewIngredientsTitle}>INGREDIENTS</Text>
                <Pressable onPress={() => {}}>
                  <Text style={styles.mealReviewAddLink}>+ ADD</Text>
                </Pressable>
              </View>

              {cc.reviewDraft.ingredients.map((ingredient, index) => (
                <View
                  key={ingredient.id}
                  style={[
                    styles.mealReviewIngredientRow,
                    index === 0 ? null : styles.mealReviewIngredientRowDivider,
                  ]}
                >
                  <Text style={styles.mealReviewIngredientName}>{ingredient.name}</Text>
                  <Text style={styles.mealReviewIngredientQty}>{ingredient.quantity}</Text>
                  <Text style={styles.mealReviewIngredientCal}>{ingredient.calories}</Text>
                </View>
              ))}
            </View>

            <View style={styles.mealReviewConfidenceRow}>
              <View style={styles.mealReviewConfidenceBar}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.mealReviewConfidenceSegment,
                      { backgroundColor: i < segmentCount ? t.accent : t.line },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.mealReviewConfidenceText}>{confidenceText}</Text>
            </View>

            <View style={styles.mealReviewActions}>
              <Pressable
                style={styles.mealReviewDiscardButton}
                onPress={cc.closeCommandCenter}
                testID="cc-review-discard"
              >
                <Text style={styles.mealReviewDiscardText}>DISCARD</Text>
              </Pressable>
              <Pressable
                style={styles.mealReviewSaveButton}
                onPress={() => void cc.saveReviewedEntry()}
                testID="cc-review-save"
              >
                <Text style={styles.mealReviewSaveText}>Save meal</Text>
                <CheckGlyph color={t.accentInk} />
              </Pressable>
            </View>
          </ScrollView>
        </Sheet>
      );
    }

    if (commandState === "cc_review_workout" && cc.reviewDraft?.kind === "workout") {
      const workout = cc.reviewDraft.interpreted.payload;
      const confidence = confidenceLabel(cc.reviewDraft.confidence);
      const segmentCount = Math.max(0, Math.min(4, Math.round(cc.reviewDraft.confidence * 4)));
      const eyebrow = cc.reviewDraft.exerciseTypeLabel.toUpperCase();
      const sessionLabel = cc.screenContext.sessionId ? "Current session" : cc.reviewDraft.sessionLabel;
      return (
        <Sheet
          title={null}
          onClose={cc.closeCommandCenter}
          canCloseViaBackdrop={false}
          showCloseButton={false}
          closeButtonTestID="cc-review-close"
        >
          <ScrollView
            style={styles.reviewScroll}
            contentContainerStyle={styles.mealReviewContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          >
            <View style={styles.mealReviewYouSaidRow}>
              <Text style={styles.mealReviewYouSaidLabel}>YOU SAID</Text>
              <Pressable onPress={cc.editReviewTranscript} testID="cc-review-edit-transcript">
                <Text style={styles.mealReviewEditLink}>EDIT</Text>
              </Pressable>
            </View>
            <Text style={styles.mealReviewTranscript}>{`"${cc.reviewDraft.transcript}"`}</Text>

            <View style={styles.mealReviewBigCard}>
              <View style={styles.mealReviewHeroRow}>
                <View style={styles.mealReviewHeroLeft}>
                  <Text style={styles.mealReviewEyebrow}>{eyebrow}</Text>
                  <Text style={styles.mealReviewName}>{workout.exerciseName}</Text>
                </View>
              </View>

              <View style={styles.mealReviewDivider} />

              <View style={styles.mealReviewIngredientsHeader}>
                <Text style={styles.mealReviewIngredientsTitle}>SETS</Text>
              </View>

              <View style={styles.workoutSetTableHeader}>
                <Text style={[styles.workoutSetColLabel, styles.workoutSetColSet]}>SET</Text>
                <Text style={[styles.workoutSetColLabel, styles.workoutSetColKg]}>KG</Text>
                <Text style={[styles.workoutSetColLabel, styles.workoutSetColReps]}>REPS</Text>
                <Text style={[styles.workoutSetColLabel, styles.workoutSetColNotes]}>NOTES</Text>
              </View>

              {cc.reviewDraft.sets.map((set, index) => (
                <View
                  key={set.id}
                  style={[
                    styles.workoutSetTableRow,
                    index === 0 ? null : styles.workoutSetTableRowDivider,
                  ]}
                >
                  <Text style={[styles.workoutSetCellNumber, styles.workoutSetColSet]}>
                    {set.setNumber}
                  </Text>
                  <TextInput
                    style={[styles.workoutSetCellInput, styles.workoutSetColKg]}
                    value={set.weightKg}
                    onChangeText={(v) =>
                      cc.updateWorkoutSet(index, { weightKg: v.replace(/[^0-9.]/g, "") })
                    }
                    keyboardType="decimal-pad"
                    placeholder="—"
                    placeholderTextColor={t.textMute}
                    testID={`cc-review-workout-kg-${index}`}
                  />
                  <TextInput
                    style={[styles.workoutSetCellInput, styles.workoutSetColReps]}
                    value={set.reps}
                    onChangeText={(v) =>
                      cc.updateWorkoutSet(index, { reps: v.replace(/[^0-9]/g, "") })
                    }
                    keyboardType="number-pad"
                    placeholder="—"
                    placeholderTextColor={t.textMute}
                    testID={`cc-review-workout-reps-${index}`}
                  />
                  <TextInput
                    style={[styles.workoutSetCellNotesInput, styles.workoutSetColNotes]}
                    value={set.notes}
                    onChangeText={(v) => cc.updateWorkoutSet(index, { notes: v })}
                    placeholder="—"
                    placeholderTextColor={t.textMute}
                    testID={`cc-review-workout-notes-${index}`}
                  />
                </View>
              ))}

              <Pressable
                style={styles.workoutAddSetButton}
                onPress={cc.addWorkoutSet}
                testID="cc-review-add-set"
              >
                <Text style={styles.workoutAddSetButtonText}>+ ADD SET</Text>
              </Pressable>
            </View>

            <View style={styles.mealReviewConfidenceRow}>
              <View style={styles.mealReviewConfidenceBar}>
                {[0, 1, 2, 3].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.mealReviewConfidenceSegment,
                      { backgroundColor: i < segmentCount ? t.accent : t.line },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.mealReviewConfidenceText}>{confidence.text}</Text>
            </View>

            <View style={styles.workoutSessionRowNew}>
              <Text style={styles.workoutSessionLabelNew}>Add to session</Text>
              <Text style={styles.workoutSessionValueNew}>{sessionLabel}</Text>
            </View>

            <View style={styles.mealReviewActions}>
              <Pressable
                style={styles.mealReviewDiscardButton}
                onPress={cc.closeCommandCenter}
                testID="cc-review-discard"
              >
                <Text style={styles.mealReviewDiscardText}>DISCARD</Text>
              </Pressable>
              <Pressable
                style={styles.mealReviewSaveButton}
                onPress={() => void cc.saveReviewedEntry()}
                testID="cc-review-save"
              >
                <Text style={styles.mealReviewSaveText}>Save sets</Text>
                <CheckGlyph color={t.accentInk} />
              </Pressable>
            </View>
          </ScrollView>
        </Sheet>
      );
    }

    if (
      commandState === "cc_saving" ||
      commandState === "cc_auto_saving" ||
      commandState === "cc_quick_add_saving"
    ) {
      return (
        <Sheet title={null} onClose={cc.closeCommandCenter} canCloseViaBackdrop={false} showCloseButton={false}>
          <View style={styles.sheetContentCentered}>
            <VoiceRing state="interpreting" size={180} />
            <Text style={styles.savingCaption}>Saving…</Text>
          </View>
        </Sheet>
      );
    }

    if (commandState === "cc_error" && cc.activeErrorCopy) {
      const isMicError = cc.commandErrorSubtype === "mic_permission_denied";
      const tone = isMicError ? t.warn : t.negative;
      const toneTintBg = isMicError ? "rgba(255,179,71,0.12)" : "rgba(255,107,107,0.12)";
      const toneTintBorder = isMicError ? "rgba(255,179,71,0.35)" : "rgba(255,107,107,0.35)";
      return (
        <Sheet
          title={null}
          onClose={cc.closeCommandCenter}
          canCloseViaBackdrop={false}
          showCloseButton={false}
        >
          <View style={styles.errorBody}>
            <View
              style={[
                styles.errorIconTile,
                { backgroundColor: toneTintBg, borderColor: toneTintBorder },
              ]}
            >
              <Svg width={22} height={22} viewBox="0 0 22 22">
                <Path
                  d="M11 2L20 19H2L11 2Z"
                  stroke={tone}
                  strokeWidth={1.8}
                  strokeLinejoin="round"
                  fill="none"
                />
                <Path d="M11 9V13" stroke={tone} strokeWidth={1.8} strokeLinecap="round" />
                <Path d="M11 16L11 16.01" stroke={tone} strokeWidth={2.4} strokeLinecap="round" />
              </Svg>
            </View>

            <Text style={styles.errorHeading}>{cc.activeErrorCopy.title}</Text>
            <Text style={styles.errorMessage}>{cc.activeErrorCopy.body}</Text>
            {cc.commandErrorDetail ? (
              <Text style={[styles.errorDetailLine, { color: tone }]}>
                {cc.commandErrorDetail}
              </Text>
            ) : null}

            <View style={styles.errorActions}>
              <Pressable
                style={styles.errorPrimaryButton}
                onPress={() => void cc.handleErrorPrimary()}
                testID="cc-error-primary"
              >
                <Text style={styles.errorPrimaryText}>{cc.activeErrorCopy.primary}</Text>
              </Pressable>
              {cc.activeErrorCopy.secondary ? (
                <Pressable
                  style={styles.errorSecondaryButton}
                  onPress={cc.handleErrorSecondary}
                  testID="cc-error-secondary"
                >
                  <Text style={styles.errorSecondaryText}>{cc.activeErrorCopy.secondary}</Text>
                </Pressable>
              ) : null}
              {cc.activeErrorCopy.tertiary ? (
                <Pressable
                  style={styles.errorTertiaryButton}
                  onPress={cc.closeCommandCenter}
                  testID="cc-error-tertiary"
                >
                  <Text style={styles.errorTertiaryText}>{cc.activeErrorCopy.tertiary}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Sheet>
      );
    }

    return null;
  };

  const toast = cc.commandToast ? (
    <View style={styles.toastWrap} pointerEvents="none" testID="cc-toast">
      <Text style={styles.toastText}>{cc.commandToast}</Text>
    </View>
  ) : null;

  if (!isVisible) return toast;

  if (commandState === "cc_saved") {
    return (
      <>
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={cc.closeCommandCenter}>
          <SavedToast />
        </Modal>
        {toast}
      </>
    );
  }

  return (
    <>
      <Modal
        visible
        transparent
        animationType={modalAnimationType}
        statusBarTranslucent
        onRequestClose={() => {
          if (canCloseViaBackdrop) cc.closeCommandCenter();
        }}
      >
        {renderContent()}
      </Modal>
      {toast}
    </>
  );
}

function SavedToast() {
  const cc = useCommandCenterInternal();
  const insets = useSafeAreaInsets();
  const draft = cc.reviewDraft;

  let titleNode: ReactNode;
  let footerLabel = "ENTRY SAVED";

  if (draft?.kind === "meal") {
    const { description, calories, mealType } = draft.interpreted.payload;
    const mealLabel = formatMealTypeLabel(mealType).toLowerCase();
    titleNode = (
      <Text style={styles.savedToastBody}>
        {description} — <Text style={styles.savedToastBodyAccent}>{calories} kcal</Text> added to {mealLabel}.
      </Text>
    );
  } else if (draft?.kind === "workout") {
    const { exerciseName } = draft.interpreted.payload;
    const setsCount = draft.sets.length;
    const setsLabel = setsCount === 1 ? "set" : "sets";
    titleNode = (
      <Text style={styles.savedToastBody}>
        {exerciseName} — <Text style={styles.savedToastBodyAccent}>{setsCount} {setsLabel}</Text> saved.
      </Text>
    );
  } else if (cc.commandToast) {
    titleNode = <Text style={styles.savedToastBody}>{cc.commandToast}</Text>;
  } else {
    titleNode = <Text style={styles.savedToastBody}>Entry saved.</Text>;
  }

  return (
    <View style={styles.savedToastRoot} pointerEvents="box-none">
      <View style={styles.savedToastDim} pointerEvents="none" />
      <View
        style={[styles.savedToastCard, { bottom: insets.bottom + 120 }]}
        testID="cc-saved-toast"
      >
        <View style={styles.savedToastTopRow}>
          <View style={styles.savedToastCheckCircle}>
            <CheckGlyph color={t.accentInk} />
          </View>
          <Text style={styles.savedToastEyebrow}>LOGGED</Text>
        </View>
        {titleNode}
        <View style={styles.savedToastFooter}>
          <Text style={styles.savedToastFooterLabel}>{footerLabel}</Text>
          <Pressable onPress={() => undefined} testID="cc-saved-undo">
            <Text style={styles.savedToastUndo}>Undo</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  sheetContainer: {
    backgroundColor: t.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: t.line,
    paddingTop: 0,
    maxHeight: "92%",
  },
  sheetHandleRow: { alignItems: "center", paddingTop: 10, paddingBottom: 14 },
  sheetHandle: { width: 40, height: 4, borderRadius: 999, backgroundColor: t.line2 },
  sheetTitleRow: {
    paddingHorizontal: 22,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitleText: {
    fontFamily: font.sans[600],
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.4,
    color: t.text,
  },
  sheetCloseCircle: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: t.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  statePadding: { paddingHorizontal: 22 },
  sheetContentCentered: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 22 },

  // Idle state
  idleBody: { paddingHorizontal: 22 },
  idleInputCard: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 16,
    padding: 16,
    minHeight: 100,
  },
  idleInput: {
    fontFamily: font.sans[400],
    fontSize: 14.5,
    color: t.text,
    lineHeight: 21,
    minHeight: 68,
    padding: 0,
    textAlignVertical: "top",
  },
  idleActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 24,
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  idleSquareBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
  idleSquareBtnDisabled: { opacity: 0.4 },
  idleMicWrap: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  idleMicHaloOuter: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 999,
    backgroundColor: "rgba(199,251,65,0.07)",
  },
  idleMicHaloMid: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: "rgba(199,251,65,0.15)",
  },
  idleMicCore: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: t.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  idleCaption: {
    fontFamily: font.sans[500],
    fontSize: 11,
    color: t.textMute,
    letterSpacing: 1.76,
    textAlign: "center",
    marginTop: 4,
  },
  frequentSection: { marginTop: 24 },
  frequentLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    color: t.textSoft,
    marginBottom: 10,
    paddingLeft: 4,
  },
  frequentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: t.line,
  },
  frequentText: { flex: 1 },
  frequentName: {
    fontFamily: font.sans[500],
    fontSize: 14.5,
    fontWeight: "500",
    color: t.text,
  },
  frequentSub: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
    marginTop: 3,
  },
  frequentPlus: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },

  // Review states
  reviewScroll: { maxHeight: 700 },

  // Meal review (Phase 4 — Pulse design)
  mealReviewContent: { paddingHorizontal: 22, paddingBottom: 8 },
  mealReviewYouSaidRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  mealReviewYouSaidLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.accent,
  },
  mealReviewEditLink: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: t.accent,
  },
  mealReviewTranscript: {
    fontFamily: font.sans[400],
    fontSize: 13.5,
    lineHeight: 19,
    color: t.textSoft,
    marginBottom: 16,
  },
  mealReviewBigCard: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  mealReviewHeroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  mealReviewHeroLeft: { flex: 1 },
  mealReviewEyebrow: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.accent,
  },
  mealReviewName: {
    fontFamily: font.sans[600],
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.44,
    color: t.text,
    marginTop: 6,
    lineHeight: 25,
  },
  mealReviewHeroRight: { alignItems: "flex-end" },
  mealReviewKcal: {
    fontFamily: font.mono[500],
    fontSize: 44,
    color: t.accent,
    letterSpacing: -1.76,
    lineHeight: 44,
  },
  mealReviewKcalCaption: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: t.textMute,
    marginTop: 2,
  },
  mealReviewMacrosGrid: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  mealReviewMacroCell: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mealReviewMacroLabel: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: t.textMute,
  },
  mealReviewMacroValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 4,
  },
  mealReviewMacroValue: {
    fontFamily: font.mono[500],
    fontSize: 18,
    letterSpacing: -0.36,
  },
  mealReviewMacroValueAccent: { color: t.accent },
  mealReviewMacroValueSoft: { color: t.textSoft },
  mealReviewMacroUnit: {
    fontFamily: font.sans[400],
    fontSize: 10,
    color: t.textMute,
    marginLeft: 2,
  },
  mealReviewDivider: {
    height: 1,
    backgroundColor: t.line,
    marginTop: 18,
    marginBottom: 12,
  },
  mealReviewIngredientsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  mealReviewIngredientsTitle: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.textMute,
  },
  mealReviewAddLink: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    color: t.accent,
  },
  mealReviewIngredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  mealReviewIngredientRowDivider: {
    borderTopWidth: 1,
    borderTopColor: t.line,
  },
  mealReviewIngredientName: {
    flex: 1,
    fontFamily: font.sans[400],
    fontSize: 14,
    color: t.text,
  },
  mealReviewIngredientQty: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
    width: 56,
    textAlign: "right",
  },
  mealReviewIngredientCal: {
    fontFamily: font.mono[400],
    fontSize: 14,
    color: t.text,
    width: 42,
    textAlign: "right",
  },
  mealReviewConfidenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
  },
  mealReviewConfidenceBar: {
    flexDirection: "row",
    gap: 3,
  },
  mealReviewConfidenceSegment: {
    width: 14,
    height: 3,
    borderRadius: 2,
  },
  mealReviewConfidenceText: {
    fontFamily: font.sans[400],
    fontSize: 11,
    color: t.textSoft,
    flexShrink: 1,
  },
  mealReviewActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  mealReviewDiscardButton: {
    width: 110,
    height: 52,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  mealReviewDiscardText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.52,
    textTransform: "uppercase",
    color: t.textSoft,
  },
  mealReviewSaveButton: {
    flex: 1,
    height: 52,
    backgroundColor: t.accent,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mealReviewSaveText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    color: t.accentInk,
    letterSpacing: 0.28,
  },
  // Workout review (Phase 5 — Pulse design)
  workoutSetTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  workoutSetTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  workoutSetTableRowDivider: {
    borderTopWidth: 1,
    borderTopColor: t.line,
  },
  workoutSetColLabel: {
    fontFamily: font.sans[600],
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: t.textMute,
  },
  workoutSetColSet: { width: 36, textAlign: "left" },
  workoutSetColKg: { width: 64, textAlign: "center" },
  workoutSetColReps: { width: 56, textAlign: "center" },
  workoutSetColNotes: { flex: 1, textAlign: "left", paddingLeft: 8 },
  workoutSetCellNumber: {
    fontFamily: font.mono[500],
    fontSize: 14,
    color: t.text,
  },
  workoutSetCellInput: {
    fontFamily: font.mono[500],
    fontSize: 15,
    color: t.text,
    height: 32,
    paddingVertical: 0,
  },
  workoutSetCellNotesInput: {
    fontFamily: font.sans[400],
    fontSize: 13,
    color: t.text,
    height: 32,
    paddingVertical: 0,
    paddingLeft: 8,
  },
  workoutAddSetButton: {
    paddingVertical: 12,
    alignItems: "flex-start",
  },
  workoutAddSetButtonText: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: t.accent,
  },
  workoutSessionRowNew: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: t.line,
    borderBottomWidth: 1,
    borderBottomColor: t.line,
  },
  workoutSessionLabelNew: {
    fontFamily: font.sans[400],
    fontSize: 13.5,
    color: t.textSoft,
  },
  workoutSessionValueNew: {
    fontFamily: font.sans[600],
    fontSize: 13.5,
    fontWeight: "600",
    color: t.text,
  },
  savingCaption: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1.04,
    textTransform: "uppercase",
    color: t.textMute,
  },

  // Error state (Phase 5 — Pulse design)
  errorBody: { paddingHorizontal: 22, paddingBottom: 8 },
  errorIconTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  errorHeading: {
    fontFamily: font.sans[600],
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.44,
    color: t.text,
    lineHeight: 26,
  },
  errorMessage: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: t.textSoft,
    marginTop: 8,
    lineHeight: 21,
  },
  errorDetailLine: {
    fontFamily: font.sans[600],
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 10,
  },
  errorActions: {
    marginTop: 20,
    flexDirection: "column",
    gap: 8,
  },
  errorPrimaryButton: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  errorPrimaryText: {
    fontFamily: font.sans[700],
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.28,
    color: t.accentInk,
  },
  errorSecondaryButton: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
  errorSecondaryText: {
    fontFamily: font.sans[600],
    fontSize: 14,
    fontWeight: "600",
    color: t.text,
  },
  errorTertiaryButton: {
    width: "100%",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  errorTertiaryText: {
    fontFamily: font.sans[600],
    fontSize: 13.5,
    fontWeight: "600",
    letterSpacing: 0.135,
    color: t.textMute,
  },

  // Saved toast (Phase 5)
  savedToastRoot: { ...StyleSheet.absoluteFillObject },
  savedToastDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  savedToastCard: {
    position: "absolute",
    left: 18,
    right: 18,
    backgroundColor: t.surface2,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  savedToastTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  savedToastCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  savedToastEyebrow: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.accent,
  },
  savedToastBody: {
    fontFamily: font.sans[600],
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.17,
    lineHeight: 22,
    color: t.text,
  },
  savedToastBodyAccent: {
    color: t.accent,
  },
  savedToastFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  savedToastFooterLabel: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.05,
    textTransform: "uppercase",
    color: t.textMute,
  },
  savedToastUndo: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.accent,
  },

  // Listening state
  listeningBody: { paddingHorizontal: 22 },
  listeningHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 26 },
  listeningHeaderSide: { width: 82, alignItems: "flex-start" },
  listeningHeaderSideRight: { alignItems: "flex-end" },
  listeningHeaderCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  listeningTimerWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: t.accent,
    shadowColor: t.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  listeningTimer: { fontFamily: font.mono[400], fontSize: 13, color: t.text },
  listeningTitle: { fontFamily: font.sans[600], fontSize: 16, fontWeight: "600", color: t.text, letterSpacing: -0.16 },
  listeningTranscriptWrap: {
    minHeight: 80,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  listeningTranscriptText: {
    fontFamily: font.sans[500],
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 30,
    color: t.text,
    letterSpacing: -0.33,
    textAlign: "center",
  },
  listeningTranscriptPlaceholder: {
    color: t.textSoft,
  },
  listeningCursor: {
    width: 2,
    height: 22,
    backgroundColor: t.accent,
    marginLeft: 3,
    marginBottom: 4,
  },
  listeningCursorHidden: { opacity: 0 },
  listeningWaveformRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    height: 70,
    paddingTop: 30,
    paddingBottom: 26,
  },
  listeningBar: {
    width: 4,
    borderRadius: 2,
  },
  listeningBarGlow: {
    shadowColor: t.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  listeningStopWrap: {
    width: 116,
    height: 116,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  listeningStopHaloOuter: {
    position: "absolute",
    width: 116,
    height: 116,
    borderRadius: 999,
    backgroundColor: "rgba(199,251,65,0.07)",
  },
  listeningStopHaloMid: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "rgba(199,251,65,0.15)",
  },
  listeningStopCore: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: t.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  listeningStopSquare: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: t.accentInk,
  },
  listeningCaption: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    color: t.textMute,
    letterSpacing: 1.76,
    textAlign: "center",
    marginTop: 14,
  },
  interpretingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  interpretingTopRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  interpretingEyebrow: {
    fontFamily: font.sans[600],
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.68,
    textTransform: "uppercase",
    color: t.accent,
  },
  interpretingEditLink: {
    fontFamily: font.sans[600],
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: t.accent,
  },
  interpretingHeaderClose: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: t.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  interpretingTranscript: {
    fontFamily: font.sans[500],
    fontSize: 19,
    fontWeight: "500",
    lineHeight: 27,
    color: t.text,
    letterSpacing: -0.28,
  },
  interpretingTranscriptInput: {
    fontFamily: font.sans[500],
    fontSize: 19,
    fontWeight: "500",
    lineHeight: 27,
    color: t.text,
    letterSpacing: -0.28,
    minHeight: 96,
    padding: 0,
    textAlignVertical: "top",
  },
  interpretingDoneButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 10,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  interpretingDoneText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    color: t.text,
    fontWeight: "600",
  },
  interpretingStatusPill: {
    marginTop: 24,
    marginBottom: 18,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  interpretingDotsRow: { flexDirection: "row", gap: 4 },
  interpretingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.accent,
  },
  interpretingDotIdle: { opacity: 0.3 },
  interpretingDotActive: {
    opacity: 1,
    shadowColor: t.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  interpretingStatusLabel: {
    flex: 1,
    fontFamily: font.sans[400],
    fontSize: 14,
    color: t.textSoft,
  },
  interpretingStatusElapsed: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
  },
  interpretingSkeletonCard: {
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  interpretingSkeletonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  skelLine: { backgroundColor: t.line },
  skelLine2: { backgroundColor: t.line2 },
  skelSecond: { marginTop: 10 },
  skelFlex: { flex: 1 },
  interpretingButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  interpretingButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
  interpretingButtonText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.text,
  },
  interpretingButtonTextMute: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.textMute,
  },
  toastWrap: { position: "absolute", bottom: 136, alignSelf: "center", backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  toastText: { fontFamily: font.sans[700], fontSize: 13, color: t.accentInk, fontWeight: "700" },
});
