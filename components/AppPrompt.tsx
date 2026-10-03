import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { color as t, font, radius } from "@/lib/tokens";

type Action = { text?: string; style?: "default" | "cancel" | "destructive"; onPress?: () => unknown };
type Request = {
  title: string; message?: string; actions: Action[]; owner: object;
  onDismiss?: () => void; status: "ready" | "busy"; error?: string;
};

/** One local prompt, never a queue. Bind it to the caller's route/draft scope. */
export function useAppPrompt(scope: readonly unknown[] = []) {
  const scopeRef = useRef({ values: scope, owner: {} });
  const requestRef = useRef<Request | null>(null);
  const alive = useRef(true);
  const [, render] = useState(0);
  if (scope.length !== scopeRef.current.values.length || scope.some((v, i) => !Object.is(v, scopeRef.current.values[i]))) {
    scopeRef.current = { values: scope, owner: {} };
  }
  const owner = scopeRef.current.owner;
  const cancel = useCallback(() => {
    const request = requestRef.current;
    if (!request || request.status === "busy") return;
    requestRef.current = null;
    if (alive.current) render(v => v + 1);
    const action = request.actions.find(a => a.style === "cancel");
    action?.onPress?.();
    request.onDismiss?.();
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const request = requestRef.current;
      requestRef.current = null;
      request?.onDismiss?.();
    };
  }, []);
  useEffect(() => {
    const request = requestRef.current;
    if (request && request.owner !== owner) {
      requestRef.current = null;
      request.onDismiss?.();
      render(v => v + 1);
    }
  }, [owner]);
  const alert = useCallback((title: string, message?: string, actions: Action[] = [{ text: "OK", style: "cancel" }], options?: { onDismiss?: () => void }) => {
    if (!alive.current || scopeRef.current.owner !== owner) return;
    const previous = requestRef.current;
    requestRef.current = null;
    previous?.onDismiss?.();
    requestRef.current = { title, message, actions, owner, onDismiss: options?.onDismiss, status: "ready" };
    render(v => v + 1);
  }, [owner]);
  const request = requestRef.current;
  const visible = request?.owner === owner ? request : null;
  const settle = async (target: Request, action: Action) => {
    if (!alive.current || requestRef.current !== target || scopeRef.current.owner !== target.owner || target.status !== "ready") return;
    // Consume before callbacks, React commits, and asynchronous writes.
    target.status = "busy";
    if (action.style === "cancel") {
      requestRef.current = null;
      render(v => v + 1);
      action.onPress?.();
      target.onDismiss?.();
      return;
    }
    try {
      const result = action.onPress?.();
      if (result && typeof (result as Promise<unknown>).then === "function") {
        render(v => v + 1);
        await result;
      }
      if (requestRef.current === target && scopeRef.current.owner === target.owner && alive.current) {
        requestRef.current = null;
        render(v => v + 1);
      }
    } catch (error) {
      if (requestRef.current === target && scopeRef.current.owner === target.owner && alive.current) {
        requestRef.current = { ...target, status: "ready", error: error instanceof Error ? error.message : "Please try again." };
        render(v => v + 1);
      }
    }
  };
  const dismiss = (target: Request) => {
    if (requestRef.current !== target || scopeRef.current.owner !== target.owner) return;
    cancel();
  };
  const dialog = visible ? <Modal key={String(visible.title)} visible transparent animationType="fade" accessibilityLabel={visible.title} onRequestClose={() => dismiss(visible)}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFillObject} accessibilityRole="button" accessibilityLabel="Dismiss dialog" testID="app-prompt-backdrop" onPress={() => dismiss(visible)} />
      <View style={styles.card} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text accessibilityRole="header" style={styles.title}>{visible.title}</Text>
          {visible.message ? <Text style={styles.message}>{visible.message}</Text> : null}
          {visible.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
          <View style={styles.actions}>
            {visible.actions.map((action, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={action.text} accessibilityState={{ disabled: visible.status === "busy", busy: visible.status === "busy" }} disabled={visible.status === "busy"} testID={`app-prompt-action-${i}`} onPress={() => settle(visible, action)} style={({pressed}) => [styles.action, action.style === "cancel" ? styles.cancel : styles.choice, pressed && {opacity:0.65}]}>
              <Text style={[styles.actionText, action.style === "destructive" && styles.destructive, action.style === "cancel" && styles.cancelText]}>{action.text}</Text>
            </Pressable>)}
            {visible.status === "busy" ? <View style={styles.busy} accessibilityRole="alert"><ActivityIndicator color={t.accent}/><Text style={styles.message}>Working…</Text></View> : null}
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal> : null;
  return { alert, dialog, cancel };
}
const styles = StyleSheet.create({
  overlay: { flex:1, justifyContent:"center", alignItems:"center", padding:24, backgroundColor:"rgba(15,20,25,0.38)" },
  card: { width:"100%", maxWidth:380, maxHeight:"90%", borderRadius:radius.lg, backgroundColor:t.surface, borderWidth:1, borderColor:t.line2, overflow:"hidden" },
  content: { padding:24 }, title:{fontFamily:font.sans[600],fontSize:21,lineHeight:27,letterSpacing:-0.4,color:t.text},
  message:{fontFamily:font.sans[400],fontSize:15,lineHeight:22,color:t.textSoft,marginTop:10},
  error:{fontFamily:font.sans[400],fontSize:14,lineHeight:21,color:t.negative,marginTop:12},
  actions:{marginTop:22,gap:8},action:{minHeight:48,paddingHorizontal:16,paddingVertical:14,justifyContent:"center",alignItems:"center",borderRadius:radius.sm},
  choice:{backgroundColor:t.surface2},cancel:{backgroundColor:t.surface},actionText:{fontFamily:font.sans[600],fontSize:15,color:t.accent},cancelText:{color:t.textSoft},destructive:{color:t.negative},
  busy:{flexDirection:"row",gap:12,alignItems:"center",justifyContent:"center"},
});
