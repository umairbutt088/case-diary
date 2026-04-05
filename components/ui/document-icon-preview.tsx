import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { getDocumentDownloadUrl } from "@/lib/case-documents";
import type { AppColors } from "@/constants/color-palette";

export function DocumentIconPreview({
  filePath,
  mimeType,
  C,
}: {
  filePath: string;
  mimeType: string | null;
  C: AppColors;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const isImage = mimeType?.startsWith("image/");
  const isPdf = mimeType === "application/pdf";

  useEffect(() => {
    if (isImage) {
      let cancelled = false;
      getDocumentDownloadUrl(filePath)
        .then((url) => {
          if (!cancelled) setSignedUrl(url);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }
  }, [filePath, isImage]);

  if (isImage) {
    return (
      <View style={[styles.box, { backgroundColor: C.cream50, padding: 0, overflow: "hidden" }]}>
        {signedUrl ? (
          <Image source={{ uri: signedUrl }} style={styles.fill} contentFit="cover" />
        ) : (
          <MaterialIcons name="image" size={24} color={C.gray50} />
        )}
      </View>
    );
  }

  if (isPdf) {
    return (
      <View style={[styles.box, { backgroundColor: "#FFEBEB" }]}>
        <MaterialIcons name="picture-as-pdf" size={24} color="#D32F2F" />
      </View>
    );
  }

  // Default document fallback
  return (
    <View style={[styles.box, { backgroundColor: C.cream50 }]}>
      <MaterialIcons name="insert-drive-file" size={24} color={C.gray50} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  fill: {
    width: "100%",
    height: "100%",
  },
});
