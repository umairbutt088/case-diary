import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bounceable } from "./bounceable";

export function ImageViewerModal({
  visible,
  imageUrl,
  onClose,
}: {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Bounceable onPress={onClose} style={styles.closeBtn}>
            <MaterialIcons name="close" size={24} color="#FFF" />
          </Bounceable>
        </View>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="contain" />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "rgba(0,0,0,0.92)" 
  },
  header: { 
    flexDirection: "row", 
    justifyContent: "flex-end", 
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 10,
  },
  closeBtn: { 
    padding: 8, 
    backgroundColor: "rgba(255,255,255,0.15)", 
    borderRadius: 20 
  },
  image: { 
    flex: 1, 
    width: "100%", 
    height: "100%",
    marginTop: -40, // offset header height slightly
  },
});
