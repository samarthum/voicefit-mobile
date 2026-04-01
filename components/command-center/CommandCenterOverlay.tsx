import { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Circle as SvgCircle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import {
  COLORS,
  confidenceLabel,
  formatMealTypeLabel,
  formatRecordingDuration,
  getMealVisualKind,
  SHOW_ESTIMATED_REVIEW_MACROS,
  WAVE_BAR_COUNT,
  WAVE_MAX,
  WAVE_MIN,
} from "./helpers";
import { useCommandCenterInternal } from "./CommandCenterProvider";

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

function MicGlyph({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path d="M12 15C9.79 15 8 13.21 8 11V6C8 3.79 9.79 2 12 2C14.21 2 16 3.79 16 6V11C16 13.21 14.21 15 12 15Z" stroke={color} strokeWidth={2} />
      <Path d="M5 10V11C5 14.87 8.13 18 12 18C15.87 18 19 14.87 19 11V10" stroke={color} strokeWidth={2} />
      <Path d="M12 18V22" stroke={color} strokeWidth={2} />
    </Svg>
  );
}

function CloseGlyph({ color = COLORS.textSecondary }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
      <Path d="M2 2L12 12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 2L2 12" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

function KeyboardGlyph({ color = COLORS.textSecondary }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M2 4.5H16C16.55 4.5 17 4.95 17 5.5V13.5C17 14.05 16.55 14.5 16 14.5H2C1.45 14.5 1 14.05 1 13.5V5.5C1 4.95 1.45 4.5 2 4.5Z" stroke={color} strokeWidth={1.8} />
      <Path d="M4.2 8H4.9M7.2 8H7.9M10.2 8H10.9M13.2 8H13.9M5 11H13" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function SendGlyph({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
      <Path d="M5 12L2 17L16 9L2 1L5 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 12H9" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PlusGlyph({ color = COLORS.textSecondary }: { color?: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 12 12" fill="none">
      <Path d="M6 1V11" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M1 6H11" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckGlyph({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
      <Path d="M13.2 3.8L6.2 12.2L2.8 8.8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Animated Waveform
// ---------------------------------------------------------------------------

function AnimatedWaveform({ active }: { active: boolean }) {
  const anims = useRef(
    Array.from({ length: WAVE_BAR_COUNT }, () => new Animated.Value(WAVE_MIN + Math.random() * (WAVE_MAX - WAVE_MIN))),
  ).current;
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const animate = useCallback(() => {
    if (!isMounted.current) return;
    const animations = anims.map((anim) =>
      Animated.timing(anim, {
        toValue: WAVE_MIN + Math.random() * (WAVE_MAX - WAVE_MIN),
        duration: 300 + Math.random() * 200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: false,
      }),
    );
    Animated.parallel(animations).start(({ finished }) => {
      if (finished && isMounted.current) animate();
    });
  }, [anims]);

  useEffect(() => {
    if (active) animate();
    else anims.forEach((anim) => anim.stopAnimation());
  }, [active, animate, anims]);

  return (
    <View style={styles.waveform}>
      {anims.map((anim, index) => (
        <Animated.View key={`wave-${index}`} style={[styles.waveBar, { height: anim, opacity: index % 2 === 0 ? 0.9 : 0.55 }]} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Meal Glyphs (for quick-add thumbnails)
// ---------------------------------------------------------------------------

function SaladMealGlyph({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="saladBowl" x1="32" y1="30" x2="32" y2="57" gradientUnits="userSpaceOnUse"><Stop stopColor="#FFFFFF" /><Stop offset={1} stopColor="#EDEEF2" /></LinearGradient>
        <RadialGradient id="leafGlow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 25) rotate(90) scale(16)"><Stop stopColor="#8DE39D" /><Stop offset={1} stopColor="#34C759" /></RadialGradient>
      </Defs>
      <Path d="M12 36C12 48.15 20.4 56 32 56C43.6 56 52 48.15 52 36V34H12V36Z" fill="url(#saladBowl)" />
      <Path d="M12 36C12 48.15 20.4 56 32 56C43.6 56 52 48.15 52 36V34H12V36Z" stroke="#1A1A1A" strokeWidth={2.2} />
      <Path d="M17 34C17.4 26.7 23.6 21 31.2 21C39.5 21 46.3 27.8 46.3 36" fill="url(#leafGlow)" />
      <Path d="M17 34C17.4 26.7 23.6 21 31.2 21C39.5 21 46.3 27.8 46.3 36" stroke="#1A1A1A" strokeWidth={2.2} strokeLinecap="round" />
      <SvgCircle cx={23} cy={30} r={3.2} fill="#FF6B60" />
      <SvgCircle cx={39} cy={29} r={3.2} fill="#FF9500" />
      <Ellipse cx={31.5} cy={28} rx={2.8} ry={3.5} fill="#9AE7B5" />
      <Path d="M22 41H42" stroke="#D7D9DF" strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function OatsMealGlyph({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="jarGlass" x1="32" y1="11" x2="32" y2="54" gradientUnits="userSpaceOnUse"><Stop stopColor="#FFFFFF" /><Stop offset={1} stopColor="#EEF0F4" /></LinearGradient>
        <LinearGradient id="oatFill" x1="32" y1="26" x2="32" y2="48" gradientUnits="userSpaceOnUse"><Stop stopColor="#F9CF86" /><Stop offset={1} stopColor="#E8B35D" /></LinearGradient>
      </Defs>
      <Rect x={17} y={10} width={30} height={44} rx={10} fill="url(#jarGlass)" stroke="#1A1A1A" strokeWidth={2.2} />
      <Rect x={22} y={22} width={20} height={24} rx={6} fill="url(#oatFill)" />
      <Path d="M22 26H42" stroke="#E0A64F" strokeWidth={2} strokeLinecap="round" />
      <Path d="M22 31H42" stroke="#E0A64F" strokeWidth={2} strokeLinecap="round" opacity={0.85} />
      <Path d="M22 36H37" stroke="#E0A64F" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
      <Rect x={20} y={15} width={24} height={4} rx={2} fill="#DADDE4" />
      <SvgCircle cx={45.5} cy={17.5} r={4.5} fill="#FF9500" />
      <Path d="M45.5 15.4V19.6M43.4 17.5H47.6" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" />
    </Svg>
  );
}

function SalmonMealGlyph({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="plateFill" x1="32" y1="16" x2="32" y2="52" gradientUnits="userSpaceOnUse"><Stop stopColor="#FFFFFF" /><Stop offset={1} stopColor="#EEF0F4" /></LinearGradient>
        <LinearGradient id="salmonFill" x1="22" y1="25" x2="44" y2="39" gradientUnits="userSpaceOnUse"><Stop stopColor="#FFA45B" /><Stop offset={1} stopColor="#FF7E3E" /></LinearGradient>
      </Defs>
      <Ellipse cx={32} cy={36} rx={22} ry={16} fill="url(#plateFill)" stroke="#1A1A1A" strokeWidth={2.2} />
      <Path d="M18 36C19.8 30.8 24.6 27 30.2 27H40.8C42.6 27 44 28.4 44 30.2C44 33.1 41.7 35.4 38.8 35.4H30.5C27.2 35.4 24.8 37.7 24 41" fill="url(#salmonFill)" />
      <Path d="M18 36C19.8 30.8 24.6 27 30.2 27H40.8C42.6 27 44 28.4 44 30.2C44 33.1 41.7 35.4 38.8 35.4H30.5C27.2 35.4 24.8 37.7 24 41" stroke="#1A1A1A" strokeWidth={1.8} strokeLinecap="round" />
      <Ellipse cx={42} cy={39} rx={7} ry={5.5} fill="#FBFBFD" stroke="#DADDE4" strokeWidth={1.5} />
      <SvgCircle cx={39.7} cy={37.8} r={0.9} fill="#D2D6DE" />
      <SvgCircle cx={42.2} cy={40.3} r={0.9} fill="#D2D6DE" />
      <SvgCircle cx={44.7} cy={37.8} r={0.9} fill="#D2D6DE" />
      <SvgCircle cx={20} cy={30} r={2} fill="#34C759" />
      <Path d="M19 30.3L20 28.2L21.1 30.3" stroke="#1A1A1A" strokeWidth={1} strokeLinecap="round" />
    </Svg>
  );
}

function QuickMealThumb({ description }: { description: string }) {
  const kind = getMealVisualKind(description);
  if (kind === "salad") return <SaladMealGlyph size={18} />;
  if (kind === "oats") return <OatsMealGlyph size={18} />;
  if (kind === "salmon") return <SalmonMealGlyph size={18} />;
  return <Ionicons name="restaurant-outline" size={13} color="#8E8E93" />;
}

// ---------------------------------------------------------------------------
// Main Overlay Component
// ---------------------------------------------------------------------------

export function CommandCenterOverlay() {
  const cc = useCommandCenterInternal();
  const insets = useSafeAreaInsets();

  const { commandState } = cc;
  const isVisible = commandState !== "cc_collapsed";
  const canCloseViaBackdrop = commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing";
  const modalAnimationType = Platform.OS === "web" ? "none" : "fade";
  const sheetBottomOverlap = Platform.OS === "android" ? 12 : 0;

  const displayedQuickAddItems = cc.quickAddItems.slice(0, 3);

  // ---- Render content per state ----

  const renderContent = () => {
    if (commandState === "cc_expanded_empty" || commandState === "cc_expanded_typing") {
      const sendDisabled = !cc.commandText.trim();
      return (
        <View style={styles.sheetContent}>
          <View style={styles.sheetHeaderExpanded}>
            <Text style={styles.sheetTitleExpanded}>Command Center</Text>
            <Pressable style={styles.sheetCloseCircle} onPress={cc.closeCommandCenter} testID="cc-close">
              <CloseGlyph />
            </Pressable>
          </View>
          <View style={styles.commandInputArea}>
            <TextInput
              style={styles.commandInputExpanded}
              placeholder='Try: "Had a chicken salad for lunch, about 450 calories"'
              placeholderTextColor={COLORS.textTertiary}
              value={cc.commandText}
              onChangeText={cc.handleCommandInputChange}
              multiline
              testID="cc-input-text"
            />
          </View>
          <View style={styles.ccActionsRow}>
            <View style={styles.ccActionsSide}>
              <Pressable style={styles.ccActionBtn}><KeyboardGlyph /></Pressable>
            </View>
            <Pressable style={styles.ccMicBig} onPress={() => void cc.startRecording()} testID="cc-big-mic">
              <View pointerEvents="none" style={styles.ccMicBigPulse} />
              <MicGlyph />
            </Pressable>
            <View style={[styles.ccActionsSide, styles.ccActionsSideRight]}>
              <Pressable style={[styles.ccSendCircle, sendDisabled && styles.ccSendCircleDisabled]} disabled={sendDisabled} onPress={() => void cc.sendTyped()} testID="cc-send">
                <SendGlyph />
              </Pressable>
            </View>
          </View>
          <Text style={styles.quickAddLabelExpanded}>Quick Add</Text>
          <View style={styles.quickAddRows}>
            {displayedQuickAddItems.map((item, index) => (
              <Pressable key={item.id} style={[styles.quickAddRow, index === displayedQuickAddItems.length - 1 && styles.quickAddRowLast]} testID={`cc-quick-add-${index}`} onPress={() => { void cc.runSaveAction({ kind: "quick_add", item }); }}>
                <View style={styles.quickAddLeft}>
                  <View style={styles.quickAddThumb}><QuickMealThumb description={item.description} /></View>
                  <View>
                    <Text style={styles.quickAddName}>{item.description}</Text>
                    <Text style={styles.quickAddDetail}>{item.calories} kcal · {formatMealTypeLabel(item.mealType)}</Text>
                  </View>
                </View>
                <View style={styles.quickAddPlus}><PlusGlyph /></View>
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    if (commandState === "cc_submitting_typed") {
      return (
        <View style={styles.sheetContentCentered}>
          <ActivityIndicator color={COLORS.black} />
          <Text style={styles.processingTitle}>Interpreting entry...</Text>
          <Text style={styles.processingBody}>{cc.commandText.trim()}</Text>
        </View>
      );
    }

    if (commandState === "cc_recording") {
      const liveText = cc.voiceTranscript.trim();
      return (
        <View style={styles.recordingSheet}>
          <View style={styles.recordingHeader}>
            <View style={styles.recordingHeaderSide}>
              <View style={styles.recordingTimerWrap}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingTimer}>{formatRecordingDuration(cc.recordingSeconds)}</Text>
              </View>
            </View>
            <View style={styles.recordingHeaderCenter}><Text style={styles.recordingTitle}>Listening</Text></View>
            <View style={[styles.recordingHeaderSide, styles.recordingHeaderSideRight]}>
              <Pressable style={styles.sheetCloseCircle} onPress={cc.closeCommandCenter} testID="cc-recording-discard"><CloseGlyph /></Pressable>
            </View>
          </View>
          <View style={styles.liveTranscriptWrap}>
            {liveText ? (
              <Text style={styles.liveTranscriptText}>{liveText}<Text style={styles.liveTranscriptCursor}>|</Text></Text>
            ) : (
              <Text style={styles.liveTranscriptHint}>Start speaking...</Text>
            )}
          </View>
          <AnimatedWaveform active={commandState === "cc_recording"} />
          <View style={styles.recordMicArea}>
            <Pressable style={styles.recordStopButton} onPress={() => void cc.stopRecording()} testID="cc-recording-stop">
              <View pointerEvents="none" style={styles.recordStopButtonOuter1} />
              <View pointerEvents="none" style={styles.recordStopButtonOuter2} />
              <View style={styles.recordStopSquare} />
            </Pressable>
            <Text style={styles.recordStopLabel}>Tap to stop</Text>
          </View>
        </View>
      );
    }

    if (commandState === "cc_transcribing_voice") {
      return (
        <View style={styles.sheetContent}>
          <View style={styles.interpretingHeader}>
            <View style={styles.interpretingHeaderSide} />
            <View style={styles.interpretingTitleRow}><ActivityIndicator color={COLORS.black} size="small" /><Text style={styles.sheetTitle}>Transcribing...</Text></View>
            <Pressable style={styles.sheetCloseCircle} onPress={cc.closeCommandCenter} testID="cc-transcribing-close"><CloseGlyph /></Pressable>
          </View>
          <View style={styles.interpretingDivider} />
          <View style={styles.transcribingCard}>
            <View style={styles.transcribingStatusRow}>
              <View style={styles.transcribingPill}><SparkleGlyph color={COLORS.textSecondary} /><Text style={styles.transcribingPillText}>Voice note captured</Text></View>
              <Text style={styles.transcribingDuration}>{cc.recordingSeconds > 0 ? formatRecordingDuration(cc.recordingSeconds) : "Just now"}</Text>
            </View>
            <Text style={styles.transcribingTitle}>Converting speech to text</Text>
            <Text style={styles.transcribingBody}>We&apos;re turning your recording into editable text before analysis.</Text>
            <View style={styles.transcribingWaveWrap}><AnimatedWaveform active /></View>
          </View>
        </View>
      );
    }

    if (commandState === "cc_interpreting_voice") {
      return (
        <View style={styles.sheetContent}>
          <View style={styles.interpretingHeader}>
            <View style={styles.interpretingHeaderSide} />
            <View style={styles.interpretingTitleRow}>
              {cc.isInterpretingVoice ? <ActivityIndicator color={COLORS.black} size="small" /> : null}
              <Text style={styles.sheetTitle}>Interpreting...</Text>
            </View>
            <Pressable style={styles.sheetCloseCircle} onPress={cc.closeCommandCenter} testID="cc-interpreting-close"><CloseGlyph /></Pressable>
          </View>
          <View style={styles.interpretingDivider} />
          <View style={styles.transcribingCard}>
            <View style={styles.transcribingStatusRow}>
              <View style={styles.transcribingPill}><SparkleGlyph color={COLORS.textSecondary} /><Text style={styles.transcribingPillText}>Transcript ready</Text></View>
              <Text style={styles.transcribingDuration}>Editable</Text>
            </View>
            <Text style={styles.transcribingTitle}>Understanding your entry</Text>
            <Text style={styles.transcribingBody}>Review the transcript below while we classify it into a meal, workout, or another log entry.</Text>
            <View style={styles.interpretingTranscriptCard}>
              <TextInput style={styles.voiceTranscriptInput} value={cc.voiceTranscript} onChangeText={cc.setVoiceTranscript} multiline placeholder="Transcript" placeholderTextColor={COLORS.textTertiary} testID="cc-voice-transcript" />
            </View>
          </View>
          <View style={styles.interpretingActions}>
            <Pressable style={styles.secondaryActionButton} onPress={() => { cc.setCommandText(cc.voiceTranscript); cc.setCommandState("cc_expanded_typing"); }} testID="cc-interpreting-edit">
              <Text style={styles.secondaryActionText}>Edit text</Text>
            </Pressable>
            <Pressable style={styles.secondaryActionButton} onPress={() => void cc.startRecording()} testID="cc-interpreting-retry-voice">
              <Text style={styles.secondaryActionText}>Retry voice</Text>
            </Pressable>
            <Pressable style={styles.primaryActionButton} onPress={cc.closeCommandCenter} testID="cc-interpreting-discard">
              <Text style={styles.primaryActionText}>Discard</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    if (commandState === "cc_review_meal" && cc.reviewDraft?.kind === "meal") {
      const meal = cc.reviewDraft.interpreted.payload;
      const confidence = confidenceLabel(cc.reviewDraft.confidence);
      return (
        <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
          <View style={styles.reviewHeader}>
            <Text style={styles.sheetTitle}>Review Meal</Text>
            <Pressable style={styles.sheetCloseCircle} onPress={cc.closeCommandCenter} testID="cc-review-close"><CloseGlyph /></Pressable>
          </View>
          <View style={styles.reviewTranscriptCard}>
            <Text style={styles.reviewTranscriptLabel}>YOU SAID</Text>
            <Text style={styles.reviewTranscriptText}>{cc.reviewDraft.transcript}</Text>
            <Pressable style={styles.reviewTranscriptEditWrap} onPress={cc.editReviewTranscript} testID="cc-review-edit-transcript"><Text style={styles.reviewTranscriptEdit}>Edit</Text></Pressable>
          </View>
          <View style={[styles.reviewConfidencePill, { backgroundColor: confidence.bg }]}>
            <View style={[styles.reviewConfidenceDot, { backgroundColor: confidence.color }]} />
            <Text style={[styles.reviewConfidenceText, { color: confidence.color }]}>{confidence.text}</Text>
          </View>
          <View style={styles.mealReviewCard}>
            <View style={styles.mealReviewHeader}>
              <Text style={styles.mealReviewTitle}>{meal.description}</Text>
              <View style={styles.mealTypeBadge}><Text style={styles.mealTypeBadgeText}>{meal.mealType.toUpperCase()}</Text></View>
            </View>
            <View style={styles.mealCaloriesHero}>
              <Text style={styles.mealCaloriesValue}>{meal.calories}</Text>
              <Text style={styles.mealCaloriesLabel}>calories</Text>
            </View>
            {SHOW_ESTIMATED_REVIEW_MACROS ? (
              <View style={styles.mealMacrosRow}>
                <View style={styles.mealMacroCell}><Text style={styles.mealMacroValue}>{cc.reviewDraft.macros.protein}g</Text><Text style={styles.mealMacroLabel}>PROTEIN</Text></View>
                <View style={styles.mealMacroCell}><Text style={styles.mealMacroValue}>{cc.reviewDraft.macros.carbs}g</Text><Text style={styles.mealMacroLabel}>CARBS</Text></View>
                <View style={styles.mealMacroCell}><Text style={styles.mealMacroValue}>{cc.reviewDraft.macros.fat}g</Text><Text style={styles.mealMacroLabel}>FAT</Text></View>
              </View>
            ) : null}
            <View style={styles.mealIngredientsSection}>
              <View style={styles.mealIngredientsHeader}><Text style={styles.mealIngredientsTitle}>INGREDIENTS</Text></View>
              {cc.reviewDraft.ingredients.map((ingredient) => (
                <View key={ingredient.id} style={styles.mealIngredientRow}>
                  <View style={styles.mealIngredientLeft}>
                    <Text style={styles.mealIngredientName}>{ingredient.name}</Text>
                    <View style={styles.mealIngredientQtyChip}><Text style={styles.mealIngredientQty}>{ingredient.quantity}</Text></View>
                  </View>
                  <View style={styles.mealIngredientRight}>
                    <Text style={styles.mealIngredientCal}>{ingredient.calories} cal</Text>
                  </View>
                </View>
              ))}
              <View style={styles.mealTimeRow}>
                <Text style={styles.mealTimeLabel}>Eaten at</Text>
                <Text style={styles.mealTimeValue}>{cc.reviewDraft.eatenAtLabel}</Text>
              </View>
            </View>
          </View>
          <View style={styles.reviewActions}>
            <Pressable style={styles.reviewSecondaryButton} onPress={cc.closeCommandCenter} testID="cc-review-discard"><Text style={styles.reviewSecondaryText}>Discard</Text></Pressable>
            <Pressable style={styles.reviewPrimaryButton} onPress={() => void cc.saveReviewedEntry()} testID="cc-review-save">
              <View style={styles.reviewPrimaryContent}><CheckGlyph /><Text style={styles.reviewPrimaryText}>Save Meal</Text></View>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    if (commandState === "cc_review_workout" && cc.reviewDraft?.kind === "workout") {
      const workout = cc.reviewDraft.interpreted.payload;
      const confidence = confidenceLabel(cc.reviewDraft.confidence);
      return (
        <ScrollView style={styles.reviewScroll} contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false} keyboardDismissMode="on-drag">
          <View style={styles.reviewHeader}>
            <Text style={styles.sheetTitle}>Review Workout</Text>
            <Pressable style={styles.sheetCloseCircle} onPress={cc.closeCommandCenter} testID="cc-review-close"><CloseGlyph /></Pressable>
          </View>
          <View style={styles.reviewTranscriptCard}>
            <Text style={styles.reviewTranscriptLabel}>YOU SAID</Text>
            <Text style={styles.reviewTranscriptText}>{cc.reviewDraft.transcript}</Text>
            <Pressable style={styles.reviewTranscriptEditWrap} onPress={cc.editReviewTranscript} testID="cc-review-edit-transcript"><Text style={styles.reviewTranscriptEdit}>Edit</Text></Pressable>
          </View>
          <View style={[styles.reviewConfidencePill, { backgroundColor: confidence.bg }]}>
            <View style={[styles.reviewConfidenceDot, { backgroundColor: confidence.color }]} />
            <Text style={[styles.reviewConfidenceText, { color: confidence.color }]}>{confidence.text}</Text>
          </View>
          <View style={styles.workoutReviewCard}>
            <View style={styles.workoutHeaderWrap}>
              <View style={styles.mealReviewHeader}>
                <Text style={styles.mealReviewTitle}>{workout.exerciseName}</Text>
                <View style={[styles.mealTypeBadge, styles.workoutTypeBadge]}><Text style={[styles.mealTypeBadgeText, styles.workoutTypeBadgeText]}>{cc.reviewDraft.exerciseTypeLabel}</Text></View>
              </View>
            </View>
            <View style={styles.workoutSetHeaderRow}>
              <Text style={[styles.workoutSetHeaderText, styles.workoutSetHeaderSet]}>SET</Text>
              <Text style={styles.workoutSetHeaderText}>KG</Text>
              <Text style={styles.workoutSetHeaderText}>REPS</Text>
              <Text style={styles.workoutSetHeaderText}>NOTES</Text>
            </View>
            {cc.reviewDraft.sets.map((set, index) => (
              <View key={set.id} style={styles.workoutSetRow}>
                <View style={styles.workoutSetNumBadge}><Text style={styles.workoutSetNumText}>{set.setNumber}</Text></View>
                <TextInput style={styles.workoutSetInput} value={set.weightKg} onChangeText={(v) => cc.updateWorkoutSet(index, { weightKg: v.replace(/[^0-9.]/g, "") })} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={COLORS.textTertiary} testID={`cc-review-workout-kg-${index}`} />
                <TextInput style={styles.workoutSetInput} value={set.reps} onChangeText={(v) => cc.updateWorkoutSet(index, { reps: v.replace(/[^0-9]/g, "") })} keyboardType="number-pad" placeholder="—" placeholderTextColor={COLORS.textTertiary} testID={`cc-review-workout-reps-${index}`} />
                <TextInput style={styles.workoutSetInput} value={set.notes} onChangeText={(v) => cc.updateWorkoutSet(index, { notes: v })} placeholder="—" placeholderTextColor={COLORS.textTertiary} testID={`cc-review-workout-notes-${index}`} />
              </View>
            ))}
            <Pressable style={styles.workoutAddSetRow} onPress={cc.addWorkoutSet} testID="cc-review-add-set"><Text style={styles.workoutAddSetText}>+ Add Set</Text></Pressable>
          </View>
          <View style={styles.workoutSessionRow}>
            <Text style={styles.workoutSessionLabel}>Add to session</Text>
            <Text style={styles.workoutSessionValue}>{cc.screenContext.sessionId ? "Current Session" : cc.reviewDraft.sessionLabel}</Text>
          </View>
          <View style={styles.reviewActions}>
            <Pressable style={styles.reviewSecondaryButton} onPress={cc.closeCommandCenter} testID="cc-review-discard"><Text style={styles.reviewSecondaryText}>Discard</Text></Pressable>
            <Pressable style={styles.reviewPrimaryButton} onPress={() => void cc.saveReviewedEntry()} testID="cc-review-save">
              <View style={styles.reviewPrimaryContent}><CheckGlyph /><Text style={styles.reviewPrimaryText}>Save Sets</Text></View>
            </Pressable>
          </View>
        </ScrollView>
      );
    }

    if (commandState === "cc_saving" || commandState === "cc_auto_saving" || commandState === "cc_quick_add_saving") {
      return (
        <View style={styles.sheetContentCentered}>
          <ActivityIndicator color={COLORS.black} />
          <Text style={styles.processingTitle}>Saving entry...</Text>
          <Text style={styles.processingBody}>Refreshing data</Text>
        </View>
      );
    }

    if (commandState === "cc_error" && cc.activeErrorCopy) {
      return (
        <View style={styles.sheetContent}>
          <Text style={styles.errorTitle}>{cc.activeErrorCopy.title}</Text>
          <Text style={styles.errorBody}>{cc.activeErrorCopy.body}</Text>
          {cc.commandErrorDetail ? <Text style={styles.errorDetail}>{cc.commandErrorDetail}</Text> : null}
          <Pressable style={styles.primaryActionButton} onPress={() => void cc.handleErrorPrimary()} testID="cc-error-primary"><Text style={styles.primaryActionText}>{cc.activeErrorCopy.primary}</Text></Pressable>
          {cc.activeErrorCopy.secondary ? (
            <Pressable style={styles.secondaryActionButton} onPress={cc.handleErrorSecondary} testID="cc-error-secondary"><Text style={styles.secondaryActionText}>{cc.activeErrorCopy.secondary}</Text></Pressable>
          ) : null}
          {cc.activeErrorCopy.tertiary ? (
            <Pressable style={styles.tertiaryActionButton} onPress={cc.closeCommandCenter} testID="cc-error-tertiary"><Text style={styles.tertiaryActionText}>{cc.activeErrorCopy.tertiary}</Text></Pressable>
          ) : null}
        </View>
      );
    }

    return null;
  };

  // ---- Toast (renders even when modal is closed) ----
  const toast = cc.commandToast ? (
    <View style={styles.toastWrap} pointerEvents="none" testID="cc-toast">
      <Text style={styles.toastText}>{cc.commandToast}</Text>
    </View>
  ) : null;

  if (!isVisible) return toast;

  return (
    <>
      <Modal visible transparent animationType={modalAnimationType} onRequestClose={() => { if (canCloseViaBackdrop) cc.closeCommandCenter(); }}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => { if (canCloseViaBackdrop) cc.closeCommandCenter(); }} />
          <View style={[styles.sheetWrap, { paddingBottom: insets.bottom + sheetBottomOverlap, marginBottom: -sheetBottomOverlap }]} testID={`cc-sheet-${commandState}`}>
            <View style={styles.sheetHandle} />
            {renderContent()}
          </View>
        </View>
      </Modal>
      {toast}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheetWrap: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 0, minHeight: 260 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginTop: 10, marginBottom: 14 },
  sheetContent: { gap: 0 },
  sheetContentCentered: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 10 },
  sheetHeaderExpanded: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 14 },
  sheetTitleExpanded: { fontSize: 20, fontWeight: "700", color: COLORS.textPrimary, letterSpacing: -0.3 },
  sheetCloseCircle: { width: 32, height: 32, borderRadius: 999, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  sheetTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  commandInputArea: { paddingBottom: 14 },
  commandInputExpanded: { minHeight: 92, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.textPrimary, fontSize: 16, lineHeight: 24, textAlignVertical: "top" },
  ccActionsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
  ccActionsSide: { width: 64, alignItems: "flex-start" },
  ccActionsSideRight: { alignItems: "flex-end" },
  ccActionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  ccMicBig: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.textPrimary, alignItems: "center", justifyContent: "center", position: "relative" },
  ccMicBigPulse: { position: "absolute", inset: -5, borderRadius: 999, borderWidth: 2.5, borderColor: "rgba(26,26,26,0.08)" },
  ccSendCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.textPrimary, alignItems: "center", justifyContent: "center" },
  ccSendCircleDisabled: { opacity: 0.3 },
  quickAddLabelExpanded: { fontSize: 13, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", color: COLORS.textSecondary, paddingTop: 4, paddingBottom: 10 },
  quickAddRows: { gap: 0 },
  quickAddRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, borderBottomWidth: 1, borderColor: COLORS.border },
  quickAddRowLast: { borderBottomWidth: 0 },
  quickAddLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  quickAddThumb: { width: 34, height: 34, borderRadius: 8, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  quickAddName: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary, lineHeight: 18 },
  quickAddDetail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2, lineHeight: 14 },
  quickAddPlus: { width: 28, height: 28, borderRadius: 999, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  reviewScroll: { maxHeight: 700 },
  reviewContent: { paddingBottom: 8 },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  reviewTranscriptCard: { borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, paddingTop: 11, paddingHorizontal: 12, paddingBottom: 12, position: "relative", marginBottom: 12 },
  reviewTranscriptLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, color: COLORS.textTertiary, marginBottom: 6 },
  reviewTranscriptText: { fontSize: 15, lineHeight: 22, color: COLORS.textPrimary, paddingRight: 44 },
  reviewTranscriptEditWrap: { position: "absolute", top: 10, right: 12 },
  reviewTranscriptEdit: { color: COLORS.weight, fontSize: 13, fontWeight: "600" },
  reviewConfidencePill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: "rgba(52,199,89,0.12)", paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  reviewConfidenceDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: COLORS.steps },
  reviewConfidenceText: { fontSize: 12, fontWeight: "700", color: COLORS.steps },
  mealReviewCard: { borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg, padding: 14, marginBottom: 14 },
  mealReviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  mealReviewTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: COLORS.textPrimary, letterSpacing: -0.2 },
  mealTypeBadge: { borderRadius: 999, backgroundColor: "rgba(255,149,0,0.12)", paddingHorizontal: 9, paddingVertical: 4 },
  mealTypeBadgeText: { color: COLORS.calories, fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  mealCaloriesHero: { alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  mealCaloriesValue: { fontSize: 52, fontWeight: "800", color: COLORS.calories, letterSpacing: -1.8, lineHeight: 54 },
  mealCaloriesLabel: { fontSize: 15, fontWeight: "600", color: COLORS.textSecondary },
  mealMacrosRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  mealMacroCell: { flex: 1, borderRadius: 11, backgroundColor: COLORS.surface, paddingVertical: 9, alignItems: "center" },
  mealMacroValue: { fontSize: 24, fontWeight: "700", color: COLORS.textPrimary, letterSpacing: -0.4 },
  mealMacroLabel: { marginTop: 1, fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: COLORS.textTertiary },
  mealIngredientsSection: { marginTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 14 },
  mealIngredientsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  mealIngredientsTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, color: COLORS.textTertiary },
  mealIngredientRow: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mealIngredientLeft: { flex: 1, gap: 2, paddingRight: 10 },
  mealIngredientName: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
  mealIngredientQty: { fontSize: 13, color: COLORS.textSecondary, fontWeight: "500" },
  mealIngredientQtyChip: { alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: COLORS.surface },
  mealIngredientRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  mealIngredientCal: { fontSize: 15, color: COLORS.calories, fontWeight: "700" },
  mealTimeRow: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mealTimeLabel: { fontSize: 15, color: COLORS.textSecondary, fontWeight: "500" },
  mealTimeValue: { fontSize: 15, color: COLORS.textPrimary, fontWeight: "600" },
  workoutReviewCard: { borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.bg, overflow: "hidden", marginBottom: 14 },
  workoutHeaderWrap: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 10 },
  workoutTypeBadge: { backgroundColor: "rgba(175,82,222,0.12)" },
  workoutTypeBadgeText: { color: "#AF52DE" },
  workoutSetHeaderRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  workoutSetHeaderText: { flex: 1, flexBasis: 0, textAlign: "center", fontSize: 11, fontWeight: "700", letterSpacing: 0.3, color: COLORS.textTertiary },
  workoutSetHeaderSet: { flex: 0, width: 38, textAlign: "left" },
  workoutSetRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.04)", overflow: "hidden" },
  workoutSetNumBadge: { width: 28, height: 28, borderRadius: 6, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" },
  workoutSetNumText: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  workoutSetInput: { flex: 1, flexBasis: 0, minWidth: 0, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: "transparent", backgroundColor: COLORS.surface, fontSize: 15, fontWeight: "600", color: COLORS.textPrimary, textAlign: "center", paddingHorizontal: 6 },
  workoutAddSetRow: { borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.04)", paddingVertical: 10, alignItems: "center" },
  workoutAddSetText: { fontSize: 14, fontWeight: "600", color: COLORS.weight },
  workoutSessionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 14, marginBottom: 12 },
  workoutSessionLabel: { fontSize: 15, color: COLORS.textSecondary, fontWeight: "500" },
  workoutSessionValue: { fontSize: 15, fontWeight: "600", color: COLORS.textPrimary },
  reviewActions: { flexDirection: "row", gap: 12 },
  reviewSecondaryButton: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  reviewSecondaryText: { fontSize: 16, fontWeight: "600", color: COLORS.textSecondary },
  reviewPrimaryButton: { flex: 2, minHeight: 52, borderRadius: 14, backgroundColor: COLORS.textPrimary, alignItems: "center", justifyContent: "center" },
  reviewPrimaryContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  reviewPrimaryText: { fontSize: 16, fontWeight: "700", color: COLORS.bg, letterSpacing: -0.2 },
  processingTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary },
  processingBody: { fontSize: 14, color: COLORS.textSecondary },
  recordingSheet: { alignItems: "center", paddingHorizontal: 8 },
  recordingHeader: { width: "100%", flexDirection: "row", alignItems: "center", marginBottom: 30 },
  recordingHeaderSide: { width: 82, alignItems: "flex-start" },
  recordingHeaderSideRight: { alignItems: "flex-end" },
  recordingHeaderCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  recordingTimerWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  recordingDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: COLORS.error },
  recordingTimer: { fontSize: 14, fontWeight: "600", color: COLORS.error },
  recordingTitle: { fontSize: 18, fontWeight: "700", color: COLORS.textPrimary, letterSpacing: -0.3 },
  liveTranscriptWrap: { width: "100%", minHeight: 60, marginBottom: 24, paddingHorizontal: 8, alignItems: "center" },
  liveTranscriptText: { fontSize: 20, fontWeight: "500", color: COLORS.textPrimary, lineHeight: 30, letterSpacing: -0.3, textAlign: "center" },
  liveTranscriptCursor: { color: COLORS.textPrimary },
  liveTranscriptHint: { fontSize: 16, color: COLORS.textTertiary, fontStyle: "italic" },
  waveform: { width: "100%", height: 60, marginBottom: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  waveBar: { width: 4, borderRadius: 999, backgroundColor: COLORS.textPrimary },
  recordMicArea: { alignItems: "center", gap: 16, marginBottom: 6 },
  recordStopButton: { width: 80, height: 80, borderRadius: 999, backgroundColor: COLORS.error, alignItems: "center", justifyContent: "center", position: "relative" },
  recordStopButtonOuter1: { position: "absolute", inset: -8, borderRadius: 999, borderWidth: 2.5, borderColor: "rgba(255,59,48,0.15)" },
  recordStopButtonOuter2: { position: "absolute", inset: -18, borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,59,48,0.08)" },
  recordStopSquare: { width: 24, height: 24, borderRadius: 5, backgroundColor: COLORS.bg },
  recordStopLabel: { fontSize: 14, fontWeight: "500", color: COLORS.textSecondary },
  transcribingCard: { borderRadius: 18, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 16, marginBottom: 8 },
  transcribingStatusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  transcribingPill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, backgroundColor: COLORS.bg, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  transcribingPillText: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary },
  transcribingDuration: { fontSize: 13, fontWeight: "600", color: COLORS.textTertiary },
  transcribingTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, color: COLORS.textPrimary },
  transcribingBody: { marginTop: 6, fontSize: 15, lineHeight: 22, color: COLORS.textSecondary },
  transcribingWaveWrap: { alignItems: "center", justifyContent: "center", paddingTop: 18, paddingBottom: 2 },
  interpretingTranscriptCard: { marginTop: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, overflow: "hidden" },
  interpretingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  interpretingHeaderSide: { width: 32 },
  interpretingTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, flex: 1 },
  interpretingDivider: { height: 1, backgroundColor: COLORS.border, marginBottom: 12 },
  voiceTranscriptInput: { minHeight: 96, backgroundColor: COLORS.bg, paddingHorizontal: 16, paddingVertical: 14, color: COLORS.textPrimary, fontSize: 16, lineHeight: 25, textAlignVertical: "top" },
  interpretingActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 16 },
  primaryActionButton: { borderRadius: 13, backgroundColor: COLORS.textPrimary, paddingHorizontal: 18, minHeight: 42, alignItems: "center", justifyContent: "center" },
  primaryActionText: { color: COLORS.bg, fontSize: 14, fontWeight: "700" },
  secondaryActionButton: { borderRadius: 13, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg, paddingHorizontal: 16, minHeight: 42, alignItems: "center", justifyContent: "center", flexShrink: 1 },
  secondaryActionText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "600" },
  tertiaryActionButton: { minHeight: 40, justifyContent: "center", alignItems: "center", paddingHorizontal: 8, alignSelf: "center" },
  tertiaryActionText: { fontSize: 14, color: COLORS.textSecondary, fontWeight: "600" },
  errorTitle: { fontSize: 22, fontWeight: "700", color: COLORS.textPrimary },
  errorBody: { marginTop: -2, fontSize: 14, color: COLORS.textSecondary },
  errorDetail: { fontSize: 13, color: COLORS.error, fontWeight: "600" },
  toastWrap: { position: "absolute", bottom: 136, alignSelf: "center", backgroundColor: COLORS.textPrimary, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  toastText: { fontSize: 13, color: COLORS.bg, fontWeight: "700" },
});
