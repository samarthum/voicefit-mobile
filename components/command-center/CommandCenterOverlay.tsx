import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MealIngredient } from "@voicefit/contracts/types";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import {
  COLORS,
  confidenceLabel,
  formatMealTypeLabel,
  formatRecordingDuration,
} from "./helpers";
import { useCommandCenterOverlay } from "./CommandCenterProvider";
import { IngredientEditor, type IngredientEditorMode } from "./IngredientEditor";
import type { MealReviewIngredient } from "./types";
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

function CameraGlyph({ color = t.textSoft }: { color?: string }) {
  return (
    <Svg width={20} height={18} viewBox="0 0 20 18" fill="none">
      <Path
        d="M6.2 3L7.5 1.2H12.5L13.8 3H17C18.1 3 19 3.9 19 5V15C19 16.1 18.1 17 17 17H3C1.9 17 1 16.1 1 15V5C1 3.9 1.9 3 3 3H6.2Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M10 13.2C11.77 13.2 13.2 11.77 13.2 10C13.2 8.23 11.77 6.8 10 6.8C8.23 6.8 6.8 8.23 6.8 10C6.8 11.77 8.23 13.2 10 13.2Z"
        stroke={color}
        strokeWidth={1.6}
        fill="none"
      />
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

// `Sheet` is now just the INNER shell rendered inside the gorhom
// `BottomSheetModal` (see `CommandCenterOverlay`). It no longer owns
// presentation, the backdrop, or keyboard avoidance — gorhom does all of that.
// It renders the optional title row (with close button) plus the per-state
// content, padded for the bottom safe area. Sizing is dynamic: the content
// wraps in a `BottomSheetView` so short states stay short and tall states are
// capped + scrolled by gorhom (review states use BottomSheetScrollView inside).
function Sheet({
  title,
  onClose,
  children,
  showCloseButton = true,
  closeButtonTestID = "cc-close",
}: {
  title?: string | null;
  onClose: () => void;
  children: ReactNode;
  showCloseButton?: boolean;
  closeButtonTestID?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <BottomSheetView style={[styles.sheetContent, { paddingBottom: insets.bottom + 22 }]}>
      {title ? (
        <View style={styles.sheetTitleRow}>
          <Text style={styles.sheetTitleText}>{title}</Text>
          {showCloseButton ? (
            <Pressable
              style={styles.sheetCloseCircle}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              testID={closeButtonTestID}
            >
              <CloseGlyph />
            </Pressable>
          ) : (
            <View style={styles.sheetCloseCircle} />
          )}
        </View>
      ) : null}
      {children}
    </BottomSheetView>
  );
}

// ---------------------------------------------------------------------------
// Interpreting screen (shared by typed + voice states)
// ---------------------------------------------------------------------------

type InterpretingCopy = { label: string; elapsed: string };

function getInterpretingCopy(
  state: "cc_submitting_typed" | "cc_submitting_photo" | "cc_transcribing_voice" | "cc_interpreting_voice",
  recordingSeconds: number,
): InterpretingCopy {
  if (state === "cc_submitting_photo") {
    return { label: "Saving your photo…", elapsed: "0.7s" };
  }
  if (state === "cc_submitting_typed") {
    return { label: "Processing your entry…", elapsed: "0.7s" };
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
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const { state, input } = snapshot;
  const isTyped = state === "cc_submitting_typed";
  const isPhoto = state === "cc_submitting_photo";
  const transcript = isTyped || isPhoto ? input.text : input.voiceTranscript;
  const setTranscript = (text: string) => {
    dispatch(isTyped || isPhoto ? { type: "text.set", text } : { type: "voice.transcript.change", text });
  };
  const copy = getInterpretingCopy(
    state as "cc_submitting_typed" | "cc_submitting_photo" | "cc_transcribing_voice" | "cc_interpreting_voice",
    input.recordingSeconds,
  );
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);

  const headerCloseTestID =
    state === "cc_transcribing_voice"
      ? "cc-transcribing-close"
      : state === "cc_interpreting_voice"
      ? "cc-interpreting-close"
      : undefined;

  const onEditPress = () => {
    if (isPhoto) {
      dispatch({ type: "photo.context.edit" });
      return;
    }
    if (isTyped) {
      dispatch({ type: "text.edit" });
      return;
    }
    setIsEditingTranscript(true);
  };

  const displayText = transcript.trim() ? `"${transcript.trim()}"` : isPhoto ? "Photo selected" : "";

  return (
    <Sheet
      title={null}
      onClose={() => dispatch({ type: "close" })}
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
                onPress={() => dispatch({ type: "close" })}
                accessibilityRole="button"
                accessibilityLabel="Close"
                testID={headerCloseTestID}
              >
                <CloseGlyph />
              </Pressable>
            ) : null}
          </View>
        </View>

        {isEditingTranscript && !isTyped ? (
          <View>
            <BottomSheetTextInput
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
          {!isTyped && !isPhoto ? (
            <Pressable
              style={styles.interpretingButton}
              onPress={() => void dispatch({ type: "voice.start" })}
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
            <Text style={styles.interpretingButtonText}>{isPhoto ? "Edit context" : "Edit text"}</Text>
          </Pressable>
          <Pressable
            style={styles.interpretingButton}
            onPress={() => dispatch({ type: "close" })}
            testID="cc-interpreting-discard"
          >
            <Text style={styles.interpretingButtonTextMute}>Discard</Text>
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

function IdleSheet() {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const { input, quickAddItems, screenContext } = snapshot;
  const sendDisabled = !input.text.trim();
  const isWorkout = screenContext.screen === "workout";
  const placeholder = isWorkout
    ? 'Try "did 3 sets of squats at 80…"'
    : 'Try "had a chicken caesar and a diet coke for lunch"…';

  return (
    <View style={styles.idleBody}>
      <View style={styles.idleInputCard}>
        <BottomSheetTextInput
          style={styles.idleInput}
          placeholder={placeholder}
          placeholderTextColor={t.textSoft}
          value={input.text}
          onChangeText={(text) => dispatch({ type: "text.change", text })}
          multiline
          testID="cc-input-text"
        />
      </View>

      <View style={styles.idleActionsRow}>
        <Pressable
          style={styles.idleSquareBtn}
          onPress={() => void dispatch({ type: "photo.menu.open" })}
          accessibilityRole="button"
          accessibilityLabel="Add meal photo"
          testID="cc-camera"
        >
          <CameraGlyph />
        </Pressable>

        <Pressable
          style={styles.idleMicWrap}
          onPress={() => void dispatch({ type: "voice.start" })}
          accessibilityRole="button"
          accessibilityLabel="Start voice input"
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
          onPress={() => void dispatch({ type: "text.submit" })}
          accessibilityRole="button"
          accessibilityLabel="Submit entry"
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
                dispatch({ type: "text.change", text: `3 sets of ${exercise.name}` });
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
          {quickAddItems.slice(0, 3).map((item, index) => (
            <Pressable
              key={item.id}
              style={styles.frequentRow}
              onPress={() => {
                void dispatch({ type: "quick-add.save", item });
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
}

function PhotoContextSheet({ onClose }: { onClose: () => void }) {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const photo = snapshot.input.selectedMealPhoto;

  return (
    <Sheet title="Log meal photo" onClose={onClose}>
      <View style={styles.photoBody}>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={styles.photoPreview}
            resizeMode="cover"
            testID="cc-photo-preview"
          />
        ) : (
          <View style={styles.photoPreviewFallback}>
            <CameraGlyph color={t.textMute} />
          </View>
        )}

        <View style={styles.photoContextCard}>
          <BottomSheetTextInput
            style={styles.photoContextInput}
            placeholder="Add context, e.g. chicken, rice, and sauce"
            placeholderTextColor={t.textSoft}
            value={snapshot.input.text}
            onChangeText={(text) => dispatch({ type: "text.change", text })}
            multiline
            testID="cc-photo-context"
          />
        </View>

        <View style={styles.photoActions}>
          <Pressable
            style={styles.photoSecondaryButton}
            onPress={() => void dispatch({ type: "photo.menu.open" })}
            testID="cc-photo-replace"
          >
            <Text style={styles.photoSecondaryText}>Change photo</Text>
          </Pressable>
          <Pressable
            style={styles.photoPrimaryButton}
            onPress={() => void dispatch({ type: "photo.submit" })}
            testID="cc-photo-submit"
          >
            <Text style={styles.photoPrimaryText}>Submit photo</Text>
            <SparkSendGlyph color={t.accentInk} />
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

function RecordingSheet({ onClose }: { onClose: () => void }) {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const liveText = snapshot.input.voiceTranscript.trim();

  return (
    <Sheet title={null} onClose={onClose} showCloseButton={false}>
      <View style={styles.listeningBody}>
        <View style={styles.listeningHeader}>
          <View style={styles.listeningHeaderSide}>
            <View style={styles.listeningTimerWrap}>
              <View style={styles.listeningDot} />
              <Text style={styles.listeningTimer}>{formatRecordingDuration(snapshot.input.recordingSeconds)}</Text>
            </View>
          </View>
          <View style={styles.listeningHeaderCenter}>
            <Text style={styles.listeningTitle}>Listening</Text>
          </View>
          <View style={[styles.listeningHeaderSide, styles.listeningHeaderSideRight]}>
            <Pressable
              style={styles.sheetCloseCircle}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Discard recording"
              testID="cc-recording-discard"
            >
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
          <Pressable
            style={styles.listeningStopCore}
            onPress={() => void dispatch({ type: "voice.stop" })}
            accessibilityRole="button"
            accessibilityLabel="Stop recording"
            testID="cc-recording-stop"
          >
            <View style={styles.listeningStopSquare} />
          </Pressable>
        </View>

        <Text style={styles.listeningCaption}>TAP TO STOP</Text>
      </View>
    </Sheet>
  );
}

function MealReviewSheet({
  onClose,
  onAddIngredient,
  onEditIngredient,
  onLongPressIngredient,
}: {
  onClose: () => void;
  onAddIngredient: () => void;
  onEditIngredient: (ingredient: MealReviewIngredient) => void;
  onLongPressIngredient: (ingredient: MealReviewIngredient) => void;
}) {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const insets = useSafeAreaInsets();
  const reviewDraft = snapshot.review?.kind === "meal" ? snapshot.review : null;
  if (!reviewDraft) return null;

  const meal = reviewDraft.interpreted.payload;
  const mealTypeLabel = formatMealTypeLabel(meal.mealType).toUpperCase();
  const totalGramsLabel = `${Math.round(reviewDraft.totalGrams)} G`;
  const eyebrowParts = [mealTypeLabel, reviewDraft.eatenAtLabel, totalGramsLabel].filter(Boolean);
  const eyebrow = eyebrowParts.join(" · ");

  return (
    <BottomSheetScrollView
      contentContainerStyle={[styles.mealReviewContent, { paddingBottom: insets.bottom + 22 }]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    >
        <View style={styles.mealReviewYouSaidRow}>
          <Text style={styles.mealReviewYouSaidLabel}>YOU SAID</Text>
          <Pressable onPress={() => dispatch({ type: "review.transcript.edit" })} testID="cc-review-edit-transcript">
            <Text style={styles.mealReviewEditLink}>EDIT</Text>
          </Pressable>
        </View>
        <Text style={styles.mealReviewTranscript}>{`"${reviewDraft.transcript}"`}</Text>

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

          <View style={styles.mealReviewMacrosGrid}>
            <View style={styles.mealReviewMacroCell}>
              <Text style={styles.mealReviewMacroLabel}>PROTEIN</Text>
              <View style={styles.mealReviewMacroValueRow}>
                <Text style={[styles.mealReviewMacroValue, styles.mealReviewMacroValueAccent]}>
                  {reviewDraft.macros.protein}
                </Text>
                <Text style={styles.mealReviewMacroUnit}>g</Text>
              </View>
            </View>
            <View style={styles.mealReviewMacroCell}>
              <Text style={styles.mealReviewMacroLabel}>CARBS</Text>
              <View style={styles.mealReviewMacroValueRow}>
                <Text style={[styles.mealReviewMacroValue, styles.mealReviewMacroValueSoft]}>
                  {reviewDraft.macros.carbs}
                </Text>
                <Text style={styles.mealReviewMacroUnit}>g</Text>
              </View>
            </View>
            <View style={styles.mealReviewMacroCell}>
              <Text style={styles.mealReviewMacroLabel}>FAT</Text>
              <View style={styles.mealReviewMacroValueRow}>
                <Text style={[styles.mealReviewMacroValue, styles.mealReviewMacroValueSoft]}>
                  {reviewDraft.macros.fat}
                </Text>
                <Text style={styles.mealReviewMacroUnit}>g</Text>
              </View>
            </View>
          </View>

          <View style={styles.mealReviewDivider} />

          <View style={styles.mealReviewIngredientsHeader}>
            <Text style={styles.mealReviewIngredientsTitle}>INGREDIENTS</Text>
            <Pressable onPress={onAddIngredient} testID="cc-review-add-ingredient">
              <Text style={styles.mealReviewAddLink}>+ ADD</Text>
            </Pressable>
          </View>

          {reviewDraft.ingredients.map((ingredient, index) => (
            <Pressable
              key={ingredient.id}
              onPress={() => onEditIngredient(ingredient)}
              onLongPress={() => onLongPressIngredient(ingredient)}
              delayLongPress={400}
              style={[
                styles.mealReviewIngredientRow,
                index === 0 ? null : styles.mealReviewIngredientRowDivider,
              ]}
              testID={`cc-review-ingredient-${index}`}
            >
              <View style={styles.mealReviewIngredientCopy}>
                <Text style={styles.mealReviewIngredientName}>{ingredient.name}</Text>
                <Text style={styles.mealReviewIngredientMacros}>
                  {`P ${Math.round(ingredient.proteinG)}g · C ${Math.round(ingredient.carbsG)}g · F ${Math.round(ingredient.fatG)}g`}
                </Text>
              </View>
              <Text style={styles.mealReviewIngredientQty}>{`${Math.round(ingredient.grams)} g`}</Text>
              <Text style={styles.mealReviewIngredientCal}>{ingredient.calories}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.mealReviewActions}>
          <Pressable
            style={styles.mealReviewDiscardButton}
            onPress={onClose}
            testID="cc-review-discard"
          >
            <Text style={styles.mealReviewDiscardText}>DISCARD</Text>
          </Pressable>
          <Pressable
            style={styles.mealReviewSaveButton}
            onPress={() => void dispatch({ type: "review.save" })}
            testID="cc-review-save"
          >
            <Text style={styles.mealReviewSaveText}>Save meal</Text>
            <CheckGlyph color={t.accentInk} />
          </Pressable>
        </View>
    </BottomSheetScrollView>
  );
}

function WorkoutReviewSheet({ onClose }: { onClose: () => void }) {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const insets = useSafeAreaInsets();
  const reviewDraft = snapshot.review?.kind === "workout" ? snapshot.review : null;
  if (!reviewDraft) return null;

  const workout = reviewDraft.interpreted.payload;
  const confidence = confidenceLabel(reviewDraft.confidence);
  const segmentCount = Math.max(0, Math.min(4, Math.round(reviewDraft.confidence * 4)));
  const eyebrow = reviewDraft.exerciseTypeLabel.toUpperCase();
  const sessionLabel = snapshot.screenContext.sessionId ? "Current session" : reviewDraft.sessionLabel;

  return (
    <BottomSheetScrollView
      contentContainerStyle={[styles.mealReviewContent, { paddingBottom: insets.bottom + 22 }]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    >
        <View style={styles.mealReviewYouSaidRow}>
          <Text style={styles.mealReviewYouSaidLabel}>YOU SAID</Text>
          <Pressable onPress={() => dispatch({ type: "review.transcript.edit" })} testID="cc-review-edit-transcript">
            <Text style={styles.mealReviewEditLink}>EDIT</Text>
          </Pressable>
        </View>
        <Text style={styles.mealReviewTranscript}>{`"${reviewDraft.transcript}"`}</Text>

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

          {reviewDraft.sets.map((set, index) => (
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
              <BottomSheetTextInput
                style={[styles.workoutSetCellInput, styles.workoutSetColKg]}
                value={set.weightKg}
                onChangeText={(v) =>
                  dispatch({ type: "workout-set.update", index, patch: { weightKg: v.replace(/[^0-9.]/g, "") } })
                }
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={t.textMute}
                testID={`cc-review-workout-kg-${index}`}
              />
              <BottomSheetTextInput
                style={[styles.workoutSetCellInput, styles.workoutSetColReps]}
                value={set.reps}
                onChangeText={(v) =>
                  dispatch({ type: "workout-set.update", index, patch: { reps: v.replace(/[^0-9]/g, "") } })
                }
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={t.textMute}
                testID={`cc-review-workout-reps-${index}`}
              />
              <BottomSheetTextInput
                style={[styles.workoutSetCellNotesInput, styles.workoutSetColNotes]}
                value={set.notes}
                onChangeText={(v) => dispatch({ type: "workout-set.update", index, patch: { notes: v } })}
                placeholder="—"
                placeholderTextColor={t.textMute}
                testID={`cc-review-workout-notes-${index}`}
              />
            </View>
          ))}

          <Pressable
            style={styles.workoutAddSetButton}
            onPress={() => dispatch({ type: "workout-set.add" })}
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
            onPress={onClose}
            testID="cc-review-discard"
          >
            <Text style={styles.mealReviewDiscardText}>DISCARD</Text>
          </Pressable>
          <Pressable
            style={styles.mealReviewSaveButton}
            onPress={() => void dispatch({ type: "review.save" })}
            testID="cc-review-save"
          >
            <Text style={styles.mealReviewSaveText}>Save sets</Text>
            <CheckGlyph color={t.accentInk} />
          </Pressable>
        </View>
    </BottomSheetScrollView>
  );
}

function SavingSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title={null} onClose={onClose} showCloseButton={false}>
      <View style={styles.sheetContentCentered}>
        <VoiceRing state="interpreting" size={180} />
        <Text style={styles.savingCaption}>Saving…</Text>
      </View>
    </Sheet>
  );
}

function ErrorSheet({ onClose }: { onClose: () => void }) {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const { error, input } = snapshot;
  if (!error.copy) return null;

  const isMicError = error.subtype === "mic_permission_denied";
  const isVoiceError = error.subtype === "voice_interpret_failure";
  const tone = isMicError ? t.warn : t.negative;
  const toneTintBg = isMicError ? "rgba(255,179,71,0.12)" : "rgba(255,107,107,0.12)";
  const toneTintBorder = isMicError ? "rgba(255,179,71,0.35)" : "rgba(255,107,107,0.35)";
  const recBars = [4, 6, 3, 5, 4, 6, 5, 3, 4, 5, 4, 3];

  return (
    <Sheet
      title={null}
      onClose={onClose}
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

        <Text style={styles.errorHeading}>{error.copy.title}</Text>
        <Text style={styles.errorMessage}>{error.copy.body}</Text>
        {error.detail ? (
          <Text style={[styles.errorDetailLine, { color: tone }]}>
            {error.detail}
          </Text>
        ) : null}

        {isVoiceError ? (
          <View style={styles.errorRecStrip} testID="cc-error-rec-strip">
            <Text style={styles.errorRecLabel}>REC</Text>
            <View style={styles.errorRecBars}>
              {recBars.map((h, i) => (
                <View key={i} style={[styles.errorRecBar, { height: h }]} />
              ))}
            </View>
            <Text style={[styles.errorRecDuration, { color: tone }]}>
              {formatRecordingDuration(input.recordingSeconds)}
            </Text>
          </View>
        ) : null}

        <View style={styles.errorActions}>
          <Pressable
            style={styles.errorPrimaryButton}
            onPress={() => void dispatch({ type: "error.primary" })}
            testID="cc-error-primary"
          >
            <Svg width={14} height={14} viewBox="0 0 14 14">
              <Path
                d="M3 3V1L0 4L3 7V5C6 5 8 7 8 10H10C10 6 7 3 3 3Z"
                fill={t.accentInk}
              />
              <Path
                d="M11 11V13L14 10L11 7V9C8 9 6 7 6 4H4C4 8 7 11 11 11Z"
                fill={t.accentInk}
              />
            </Svg>
            <Text style={styles.errorPrimaryText}>{error.copy.primary}</Text>
          </Pressable>
          {error.copy.secondary ? (
            <Pressable
              style={styles.errorSecondaryButton}
              onPress={() => dispatch({ type: "error.secondary" })}
              testID="cc-error-secondary"
            >
              <Svg width={14} height={14} viewBox="0 0 14 14">
                <Path
                  d="M2 10L10 2L13 5L5 13H2V10Z"
                  stroke={t.text}
                  strokeWidth={1.4}
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
              <Text style={styles.errorSecondaryText}>{error.copy.secondary}</Text>
            </Pressable>
          ) : null}
          {error.copy.tertiary ? (
            <Pressable
              style={styles.errorTertiaryButton}
              onPress={onClose}
              testID="cc-error-tertiary"
            >
              <Text style={styles.errorTertiaryText}>{error.copy.tertiary}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Main Overlay Component
// ---------------------------------------------------------------------------

export function CommandCenterOverlay() {
  const { snapshot, dispatch } = useCommandCenterOverlay();
  const { height: windowHeight } = useWindowDimensions();

  const { state: commandState, review: reviewDraft, error, toast } = snapshot;
  const isVisible = commandState !== "cc_collapsed";
  const canCloseViaBackdrop =
    commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing";
  const closeCommandCenter = useCallback(() => dispatch({ type: "close" }), [dispatch]);

  // gorhom owns presentation now. We drive it imperatively from the command
  // state machine: present the sheet for every "open" state except cc_saved
  // (which renders its own RN-Modal toast), dismiss it otherwise. The
  // `programmaticDismissRef` flag lets `onDismiss` distinguish OUR dismiss()
  // calls (state transitions) from a user swipe/backdrop dismiss — only the
  // latter should reset the command state back to collapsed.
  const sheetRef = useRef<BottomSheetModal>(null);
  const programmaticDismissRef = useRef(false);
  // Tracks whether we've actually presented the sheet so we never dismiss()
  // before the first present(). Without this, the effect's else-branch runs on
  // the initial collapsed mount and sets programmaticDismissRef = true; the
  // first real swipe/backdrop dismiss then gets treated as programmatic and
  // never syncs state back to collapsed, leaving the app "open" while the sheet
  // is closed (so later taps can't re-open it).
  const hasPresentedRef = useRef(false);
  const shouldPresentSheet = isVisible && commandState !== "cc_saved";

  useEffect(() => {
    if (shouldPresentSheet) {
      hasPresentedRef.current = true;
      sheetRef.current?.present();
    } else if (hasPresentedRef.current) {
      hasPresentedRef.current = false;
      programmaticDismissRef.current = true;
      sheetRef.current?.dismiss();
    }
  }, [shouldPresentSheet]);

  const handleSheetDismiss = useCallback(() => {
    // Programmatic dismiss (state transition) — already handled by the reducer.
    if (programmaticDismissRef.current) {
      programmaticDismissRef.current = false;
      return;
    }
    // User-initiated swipe/backdrop dismiss — keep app state in sync.
    closeCommandCenter();
  }, [closeCommandCenter]);

  // Dynamic sizing capped near the old `maxHeight: "92%"` so short states
  // (idle/listening/interpreting/saving/error) hug their content while tall
  // review states scroll inside the cap.
  const maxDynamicContentSize = windowHeight * 0.92;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.55}
        pressBehavior={canCloseViaBackdrop ? "close" : "none"}
      />
    ),
    [canCloseViaBackdrop],
  );

  // Ingredient editor sheet state — local to the overlay because nothing else
  // needs to read it. The editor mounts on top of the meal review sheet so
  // the user keeps the meal context visible behind a darkened backdrop.
  const [ingredientEditor, setIngredientEditor] = useState<IngredientEditorMode | null>(null);

  // Auto-dismiss the editor if the review sheet itself goes away (user
  // discarded, navigated, etc.) so we don't leave a stale modal mounted.
  useEffect(() => {
    if (commandState !== "cc_review_meal" && ingredientEditor) {
      setIngredientEditor(null);
    }
  }, [commandState, ingredientEditor]);

  const openAddIngredientEditor = () => setIngredientEditor({ kind: "add" });
  const openEditIngredientEditor = (ingredient: MealReviewIngredient) =>
    setIngredientEditor({ kind: "edit", ingredient });
  const closeIngredientEditor = () => setIngredientEditor(null);

  const handleLongPressIngredient = (ingredient: MealReviewIngredient) => {
    Alert.alert(
      "Delete ingredient?",
      `Remove "${ingredient.name}" from this meal.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => dispatch({ type: "ingredient.remove", id: ingredient.id }),
        },
      ],
    );
  };

  const renderContent = () => {
    if (commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing") {
      return (
        <Sheet title="Log anything" onClose={closeCommandCenter}>
          <IdleSheet />
        </Sheet>
      );
    }

    if (commandState === "cc_photo_context") {
      return <PhotoContextSheet onClose={closeCommandCenter} />;
    }

    if (
      commandState === "cc_submitting_typed" ||
      commandState === "cc_submitting_photo" ||
      commandState === "cc_transcribing_voice" ||
      commandState === "cc_interpreting_voice"
    ) {
      return <InterpretingScreen />;
    }

    if (commandState === "cc_recording") {
      return <RecordingSheet onClose={closeCommandCenter} />;
    }

    if (commandState === "cc_review_meal" && reviewDraft?.kind === "meal") {
      return (
        <MealReviewSheet
          onClose={closeCommandCenter}
          onAddIngredient={openAddIngredientEditor}
          onEditIngredient={openEditIngredientEditor}
          onLongPressIngredient={handleLongPressIngredient}
        />
      );
    }

    if (commandState === "cc_review_workout" && reviewDraft?.kind === "workout") {
      return <WorkoutReviewSheet onClose={closeCommandCenter} />;
    }

    if (
      commandState === "cc_saving" ||
      commandState === "cc_auto_saving" ||
      commandState === "cc_quick_add_saving"
    ) {
      return <SavingSheet onClose={closeCommandCenter} />;
    }

    if (commandState === "cc_error" && error.copy) {
      return <ErrorSheet onClose={closeCommandCenter} />;
    }

    // No active content (collapsed / cc_saved while the sheet animates closed).
    // Render a minimal BottomSheetView so dynamic sizing always has a measurable
    // child instead of a bare `null`.
    return (
      <BottomSheetView style={styles.sheetEmpty}>
        <View />
      </BottomSheetView>
    );
  };

  const toastNode = toast.message ? (
    <View style={styles.toastWrap} pointerEvents="none" testID="cc-toast">
      <Text style={styles.toastText}>{toast.message}</Text>
    </View>
  ) : null;

  return (
    <>
      <BottomSheetModal
        ref={sheetRef}
        onDismiss={handleSheetDismiss}
        enableDynamicSizing
        maxDynamicContentSize={maxDynamicContentSize}
        enablePanDownToClose={canCloseViaBackdrop}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleStyle={styles.sheetHandleRow}
        handleIndicatorStyle={styles.sheetHandle}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >
        {renderContent()}
      </BottomSheetModal>

      {/* The SavedToast keeps its own RN Modal — it shows AFTER the bottom
          sheet dismisses, so there's no z-order conflict, and converting it
          is out of scope. */}
      {commandState === "cc_saved" ? (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={closeCommandCenter}>
          <SavedToast />
        </Modal>
      ) : null}

      {/* IngredientEditor remains an RN Modal (already keyboard-fixed
          separately). It mounts above the gorhom sheet during meal review. */}
      {ingredientEditor && commandState === "cc_review_meal" ? (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={closeIngredientEditor}
        >
          <IngredientEditor
            mode={ingredientEditor}
            fetchInterpreted={(name, grams) =>
              dispatch({ type: "ingredient.lookup", name, grams }) as Promise<MealIngredient>
            }
            onSubmitAdd={(ingredient) => {
              dispatch({ type: "ingredient.add", ingredient });
              closeIngredientEditor();
            }}
            onSubmitEdit={(replacement) => {
              if (ingredientEditor.kind !== "edit") return;
              const id = ingredientEditor.ingredient.id;
              // grams-only edit returns a MealReviewIngredient (already scaled
              // locally); rename returns an authoritative MealIngredient from
              // the LLM. Either works as a replacement input.
              dispatch({ type: "ingredient.replace", id, replacement });
              closeIngredientEditor();
            }}
            onCancel={closeIngredientEditor}
          />
        </Modal>
      ) : null}
      {toastNode}
    </>
  );
}

function SavedToast() {
  const { snapshot } = useCommandCenterOverlay();
  const insets = useSafeAreaInsets();
  const draft = snapshot.review;

  let titleNode: ReactNode;
  const footerLabel = snapshot.toast.lastSavedKcalLeft != null
    ? `${snapshot.toast.lastSavedKcalLeft.toLocaleString()} KCAL LEFT TODAY`
    : "ENTRY SAVED";

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
  } else if (snapshot.toast.message) {
    titleNode = <Text style={styles.savedToastBody}>{snapshot.toast.message}</Text>;
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
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // gorhom-owned sheet chrome. The rounded top + border live on the
  // backgroundStyle; the handle row/indicator match the old hand-rolled look.
  sheetBackground: {
    backgroundColor: t.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: t.line,
  },
  sheetContent: { paddingTop: 0 },
  sheetEmpty: { height: 1 },
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
    backgroundColor: "transparent",
  },
  idleMicHaloMid: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  idleMicCore: {
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F1419",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
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

  // Photo context
  photoBody: { paddingHorizontal: 22, paddingBottom: 4 },
  photoPreview: {
    width: "100%",
    aspectRatio: 1.35,
    borderRadius: 18,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
  },
  photoPreviewFallback: {
    width: "100%",
    aspectRatio: 1.35,
    borderRadius: 18,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
  photoContextCard: {
    marginTop: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 16,
    padding: 14,
    minHeight: 84,
  },
  photoContextInput: {
    fontFamily: font.sans[400],
    fontSize: 14.5,
    color: t.text,
    lineHeight: 21,
    minHeight: 56,
    padding: 0,
    textAlignVertical: "top",
  },
  photoActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 16,
  },
  photoSecondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    alignItems: "center",
    justifyContent: "center",
  },
  photoSecondaryText: {
    fontFamily: font.sans[600],
    fontSize: 13,
    fontWeight: "600",
    color: t.textSoft,
  },
  photoPrimaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  photoPrimaryText: {
    fontFamily: font.sans[700],
    fontSize: 13.5,
    fontWeight: "700",
    color: t.accentInk,
  },

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
  mealReviewIngredientCopy: {
    flex: 1,
    paddingRight: 8,
  },
  mealReviewIngredientName: {
    fontFamily: font.sans[400],
    fontSize: 14,
    color: t.text,
  },
  mealReviewIngredientMacros: {
    marginTop: 3,
    fontFamily: font.mono[400],
    fontSize: 10.5,
    color: t.textMute,
    letterSpacing: 0.2,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorRecStrip: {
    marginTop: 16,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  errorRecLabel: {
    fontFamily: font.mono[400],
    fontSize: 11,
    color: t.textMute,
  },
  errorRecBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  errorRecBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: t.textMute,
  },
  errorRecDuration: {
    fontFamily: font.mono[600],
    fontSize: 11,
    fontWeight: "600",
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
  listeningBarGlow: {},
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
    backgroundColor: "transparent",
  },
  listeningStopHaloMid: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  listeningStopCore: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: t.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F1419",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
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
