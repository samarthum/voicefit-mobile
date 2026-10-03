import { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { SheetShell } from "./SheetShell";
import { color as t, font } from "@/lib/tokens";
import type { PhotoPickerMode } from "../controller";

export function PhotoSourceState({ choose, onClose }: {
  choose: (mode: PhotoPickerMode | null) => void; onClose: () => void;
}) {
  useEffect(() => {
    const subscription = BackHandler?.addEventListener("hardwareBackPress", () => { choose(null); return true; });
    return () => subscription?.remove();
  }, [choose]);
  return <SheetShell onClose={onClose} scrollable>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back to logging" testID="cc-photo-source-back" onPress={() => choose(null)} style={styles.back}>
        <Icon name="back" size={20} color={t.text} />
      </Pressable>
      <Text style={styles.title}>Add a meal photo</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" testID="cc-close" onPress={onClose} style={styles.back}><Icon name="close" size={18} color={t.textSoft}/></Pressable>
    </View>
    <View style={styles.options}>
      {([{ mode: "camera", label: "Take photo", icon: "camera" }, { mode: "library", label: "Choose from library", icon: "image" }] as const).map(item =>
        <Pressable key={item.mode} testID={`cc-photo-source-${item.mode}`} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => choose(item.mode)} style={({pressed}) => [styles.row, pressed && {opacity:0.65}]}>
          <View style={styles.icon}><Icon name={item.icon} size={22} color={t.accent}/></View>
          <Text style={styles.label}>{item.label}</Text><Icon name="chevronRight" size={18} color={t.textMute}/>
        </Pressable>)}
    </View>
  </SheetShell>;
}
const styles=StyleSheet.create({
 header:{flexDirection:"row",alignItems:"center",paddingHorizontal:18,paddingBottom:18,gap:8},back:{width:44,height:44,alignItems:"center",justifyContent:"center"},
 title:{flex:1,fontFamily:font.sans[600],fontSize:20,letterSpacing:-0.4,color:t.text},
 options:{paddingHorizontal:22,gap:12},row:{minHeight:72,padding:16,flexDirection:"row",alignItems:"center",gap:14,borderRadius:18,backgroundColor:t.surface,borderWidth:1,borderColor:t.line2},
 icon:{width:40,height:40,alignItems:"center",justifyContent:"center",backgroundColor:t.accentTintBg,borderRadius:14},label:{flex:1,fontFamily:font.sans[500],fontSize:16,color:t.text},
});
