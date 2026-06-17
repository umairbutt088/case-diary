import { MaterialIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Share,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AddJudgeBottomSheet } from "@/components/add-case/add-judge-bottom-sheet";
import { DateField } from "@/components/add-case/date-field";
import { JudgeNameSelector } from "@/components/add-case/judge-name-selector";
import { CaseFeeDetailCard } from "@/components/case-fee-detail-card";
import { CourtPortalBottomSheet } from "@/components/court-portal-bottom-sheet";
import {
    DisposeCaseModal,
    type DisposeCaseFormValues,
} from "@/components/dispose-case-modal";
import { ThemedText } from "@/components/themed-text";
import { Bounceable } from "@/components/ui/bounceable";
import { DocumentIconPreview } from "@/components/ui/document-icon-preview";
import { DocumentNameModal } from "@/components/ui/document-name-modal";
import { ImageViewerModal } from "@/components/ui/image-viewer-modal";
import { ScreenHeader } from "@/components/ui/screen-header";
import { getPartyTerminology } from "@/constants/case-form";
import {
    modalSheetBackground,
    type AppColors,
} from "@/constants/color-palette";
import { type PakistanCourtPortal } from "@/constants/court-cms";
import { theme } from "@/constants/theme";
import { useAppTheme } from "@/context/app-theme-context";
import { useAuth } from "@/context/auth-context";
import { useAccessGuard } from "@/hooks/use-access-guard";
import { useIsOnline } from "@/hooks/use-is-online";
import { useThemePalette } from "@/hooks/use-theme-palette";
import {
    deleteCaseDocument,
    getCaseDocuments,
    getDocumentDownloadUrl,
    uploadCaseDocument
} from "@/lib/case-documents";
import { formatFeeAmount, getRemainingFee } from "@/lib/case-fees";
import { useCanViewCaseFees } from "@/lib/case-fee-access";
import { addCaseHearingEntry, getCaseHearingHistory } from "@/lib/case-hearings";
import {
    getCachedCaseById,
    patchCachedCase,
    removeCachedCase,
    upsertCachedCase,
} from "@/lib/cases-cache";
import { addPendingCaseDelete, addPendingProceedingSave } from "@/lib/offline-queue";
import { supabase } from "@/lib/supabase";
import type { CaseRow } from "@/types/case";
import {
    formatCaseDate,
    getCaseDisplayTitle,
    getTodayISO,
    isIsoDateBefore,
} from "@/types/case";
import type { CaseDocumentRow } from "@/types/case-document";
import type { CaseHearingRow } from "@/types/case-hearing";
import type { ClientRow } from "@/types/client";

const DETAIL_HEARING_PAGE_SIZE = 20;

type CaseDetailStyles = ReturnType<typeof createCaseDetailStyles>;

function createCaseDetailStyles(
  C: AppColors,
  onPrimary: string,
  modalSheet: string,
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: C.background,
    },
    editBtn: {
      minWidth: 34,
      minHeight: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    shareBtn: {
      minWidth: 34,
      minHeight: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    card: {
      backgroundColor: C.pureWhite,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      ...theme.shadow,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: C.gray50,
      marginBottom: 16,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    detailRow: {
      marginBottom: 14,
    },
    detailLabel: {
      fontSize: 13,
      color: C.gray50,
      marginBottom: 4,
    },
    detailValue: {
      fontSize: 16,
      color: C.black,
    },
    overduePill: {
      alignSelf: "flex-start",
      marginTop: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      backgroundColor: C.themeRed + "1A",
      borderWidth: 1,
      borderColor: C.themeRed + "40",
      maxWidth: "100%",
    },
    overduePillButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    overduePillText: {
      fontSize: 12,
      fontWeight: "700",
      color: C.themeRed,
      letterSpacing: 0.2,
    },
    historyItem: {
      marginBottom: 14,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: C.borderGray,
    },
    historyDate: {
      fontSize: 14,
      fontWeight: "600",
      color: C.black,
      marginBottom: 4,
    },
    historyJudge: {
      fontSize: 13,
      color: C.gray50,
      marginBottom: 4,
    },
    historyProceeding: {
      fontSize: 15,
      color: C.black,
      marginBottom: 4,
    },
    historyNext: {
      fontSize: 13,
      color: C.gray50,
    },
    currentHearingCard: {
      marginBottom: 14,
      padding: 12,
      borderRadius: 12,
      backgroundColor: C.cream50,
    },
    currentHearingTitle: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: C.gray50,
      marginBottom: 4,
      fontWeight: "600",
    },
    currentHearingDate: {
      fontSize: 20,
      fontWeight: "700",
      color: C.black,
      marginBottom: 6,
    },
    currentHearingDetail: {
      fontSize: 15,
      color: C.black,
    },
    currentHearingJudge: {
      marginTop: 6,
      fontSize: 14,
      color: C.gray50,
    },
    previousHeading: {
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      color: C.gray50,
      marginBottom: 10,
      fontWeight: "600",
    },
    seeAllBtn: {
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    seeAllBtnText: {
      fontSize: 14,
      fontWeight: "600",
      color: C.black,
    },
    addProceedingBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: C.cream50,
    },
    addProceedingText: {
      fontSize: 15,
      fontWeight: "600",
      color: C.black,
    },
    courtPortalHint: {
      fontSize: 12,
      lineHeight: 17,
      color: C.gray50,
      marginBottom: 10,
    },
    courtPortalModalIntro: {
      fontSize: 13,
      lineHeight: 19,
      color: C.black80,
      marginBottom: 10,
    },
    courtPortalSectionTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: C.gray50,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginTop: 16,
      marginBottom: 8,
    },
    courtPortalSectionTitleFirst: {
      marginTop: 0,
    },
    /** Extra inset so cards aren’t flush to the sheet; avoids ScrollView clipping shadows. */
    courtPortalListContent: {
      paddingTop: 6,
      paddingBottom: 10,
      paddingHorizontal: 4,
    },
    courtPortalOption: {
      marginBottom: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.pureWhite,
    },
    courtPortalOptionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    courtPortalOptionTexts: {
      flex: 1,
    },
    courtPortalOptionLabel: {
      fontSize: 16,
      fontWeight: "600",
      color: C.black90,
      letterSpacing: -0.2,
    },
    courtPortalOptionDesc: {
      fontSize: 13,
      lineHeight: 18,
      color: C.gray70,
      marginTop: 4,
    },
    courtPortalOptionSelected: {
      borderColor: C.themeBlack,
      backgroundColor: C.cream50,
      borderWidth: 1,
    },
    courtPortalOptionIconCol: {
      width: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    courtPortalScroll: {
      maxHeight: 400,
    },
    courtPortalOpenBtn: {
      marginTop: 14,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: C.themeBlack,
    },
    courtPortalOpenBtnDisabled: {
      opacity: 0.45,
    },
    courtPortalOpenBtnText: {
      color: onPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    modalCard: {
      width: "100%",
      backgroundColor: modalSheet,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      padding: 16,
      paddingBottom: 24,
      maxHeight: "85%",
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: C.black,
    },
    modalClose: {
      minWidth: 32,
      minHeight: 32,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: C.background,
    },
    proceedingForm: {
      flexGrow: 0,
      maxHeight: "100%",
    },
    proceedingFormContent: {
      marginBottom: 8,
      padding: 8,
      borderRadius: 10,
      backgroundColor: C.background,
    },
    previousInfoBox: {
      marginBottom: 10,
      borderRadius: 8,
      backgroundColor: C.cream50,
      padding: 10,
    },
    previousInfoLabel: {
      fontSize: 11,
      fontWeight: "600",
      color: C.gray50,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    previousInfoDate: {
      fontSize: 16,
      fontWeight: "700",
      color: C.black,
      marginBottom: 2,
    },
    previousInfoText: {
      fontSize: 14,
      color: C.black,
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: C.gray50,
      marginBottom: 6,
      marginTop: 8,
      textTransform: "uppercase",
    },
    textInput: {
      borderWidth: 1,
      borderColor: C.borderGray,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      fontSize: 14,
      color: C.black,
      backgroundColor: C.background,
    },
    textArea: {
      minHeight: 72,
      textAlignVertical: "top",
    },
    formErrorText: {
      marginTop: 10,
      fontSize: 13,
      color: C.themeRed,
    },
    saveProceedingBtn: {
      marginTop: 12,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: C.themeBlack,
    },
    saveProceedingBtnText: {
      color: onPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    proceedingAddJudgeFallback: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 8,
      marginBottom: 4,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.borderGray,
      backgroundColor: C.pureWhite,
      alignSelf: "flex-start",
    },
    proceedingAddJudgeFallbackText: {
      fontSize: 15,
      fontWeight: "600",
      color: C.black,
    },
    detailValueRow: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
      justifyContent: "space-between",
      gap: 8,
    },
    detailValuePressable: {
      flex: 1,
    },
    copyIconButton: {
      padding: 4,
      alignSelf: "flex-end",
    },
    copyToastWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: "center",
      alignItems: "center",
    },
    copyToastText: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      fontSize: 14,
      color: "#FFFFFF",
      backgroundColor: "rgba(0,0,0,0.82)",
      overflow: "hidden",
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    errorText: {
      color: C.themeRed,
      fontSize: 16,
    },
    deleteButton: {
      marginTop: 12,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: C.themeRed,
    },
    deleteButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.themeRed,
    },
    disposeButton: {
      marginTop: 24,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    disposeButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: C.black,
    },
    disposedBanner: {
      marginBottom: 14,
      padding: 14,
      borderRadius: 12,
      backgroundColor: C.grey100,
      borderWidth: 1,
      borderColor: C.borderGray,
    },
    disposedBannerTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: C.black,
      marginBottom: 4,
    },
    disposedBannerText: {
      fontSize: 14,
      color: C.gray50,
      lineHeight: 20,
    },
    restoreButton: {
      marginTop: 12,
      alignSelf: "flex-start",
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: C.themeBlack,
    },
    restoreButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: onPrimary,
    },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getCaseSummaryText(params: {
  caseData: CaseRow;
  title: string;
  linkedClientName?: string | null;
  includeFees?: boolean;
}) {
  const { caseData, title, linkedClientName, includeFees = true } = params;
  const lines = [
    `Case Summary: ${title}`,
    "",
    `Case Number: ${caseData.case_number?.trim() || "—"}`,
    `Case Type: ${caseData.case_sub_type?.trim() || caseData.case_type?.trim() || "—"}`,
    `Court Tier: ${caseData.court_tier?.trim() || "—"}`,
    `Court Room: ${caseData.court_room?.trim() || "—"}`,
    `Judge: ${caseData.judge_name?.trim() || "—"}`,
    `Client: ${linkedClientName?.trim() || caseData.linked_client_name?.trim() || "—"}`,
    "",
    `Date of Filing: ${formatCaseDate(caseData.date_of_filing)}`,
    `Next Hearing: ${formatCaseDate(caseData.next_hearing_date)}`,
    `Current Status: ${caseData.current_status?.trim() || "—"}`,
    `Next Status: ${caseData.next_status?.trim() || "—"}`,
  ];
  if (includeFees) {
    lines.push(
      "",
      `Total Fee: ${formatFeeAmount(caseData.total_fee)}`,
      `Fee Received: ${formatFeeAmount(caseData.fee_received)}`,
      `Remaining Fee: ${formatFeeAmount(getRemainingFee(caseData.total_fee, caseData.fee_received))}`,
    );
  }
  lines.push("", `Generated: ${new Date().toLocaleString()}`);
  return lines.join("\n");
}

function buildCaseSummaryHtml(params: {
  caseData: CaseRow;
  title: string;
  linkedClientName?: string | null;
  includeFees?: boolean;
}) {
  const { caseData, title, linkedClientName, includeFees = true } = params;
  const rows = [
    ["Case Number", caseData.case_number?.trim() || "—"],
    ["Case Type", caseData.case_sub_type?.trim() || caseData.case_type?.trim() || "—"],
    ["Court Tier", caseData.court_tier?.trim() || "—"],
    ["Court Room", caseData.court_room?.trim() || "—"],
    ["Judge", caseData.judge_name?.trim() || "—"],
    ["Client", linkedClientName?.trim() || caseData.linked_client_name?.trim() || "—"],
    ["Date of Filing", formatCaseDate(caseData.date_of_filing)],
    ["Next Hearing", formatCaseDate(caseData.next_hearing_date)],
    ["Current Status", caseData.current_status?.trim() || "—"],
    ["Next Status", caseData.next_status?.trim() || "—"],
    ...(includeFees
      ? [
          ["Total Fee", formatFeeAmount(caseData.total_fee)],
          ["Fee Received", formatFeeAmount(caseData.fee_received)],
          [
            "Remaining Fee",
            formatFeeAmount(getRemainingFee(caseData.total_fee, caseData.fee_received)),
          ],
        ]
      : []),
  ]
    .map(
      ([label, value]) => `
        <tr>
          <th>${escapeHtml(label)}</th>
          <td>${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; margin: 24px; color: #1f1f1f; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .meta { margin-bottom: 16px; font-size: 13px; color: #5c5c5c; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { border: 1px solid #d8d8d8; padding: 10px; text-align: left; vertical-align: top; }
          th { width: 34%; background: #f2f2f2; font-weight: 600; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
        <table>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
}

function DetailRow({
  label,
  value,
  onValueLongPress,
  valueAccessibilityHint,
  onCopyPress,
  s,
  C,
}: {
  label: string;
  value: string | null | undefined;
  onValueLongPress?: () => void;
  valueAccessibilityHint?: string;
  onCopyPress?: () => void;
  s: CaseDetailStyles;
  C: AppColors;
}) {
  const text = value?.trim() || "—";
  return (
    <View style={s.detailRow}>
      <ThemedText style={s.detailLabel}>{label}</ThemedText>
      <View style={s.detailValueRow}>
        {onValueLongPress ? (
          <Pressable
            onLongPress={onValueLongPress}
            delayLongPress={250}
            accessibilityLabel={`${label}: ${text}`}
            accessibilityHint={valueAccessibilityHint}
            style={s.detailValuePressable}
          >
            <ThemedText style={s.detailValue}>{text}</ThemedText>
          </Pressable>
        ) : (
          <ThemedText style={[s.detailValue, s.detailValuePressable]}>
            {text}
          </ThemedText>
        )}
        {onCopyPress ? (
          <Bounceable
            onPress={onCopyPress}
            style={s.copyIconButton}
            hitSlop={8}
            accessibilityLabel={`Copy ${label}`}
          >
            <MaterialIcons name="content-copy" size={16} color={C.gray50} />
          </Bounceable>
        ) : null}
      </View>
    </View>
  );
}

function SectionCard({
  title,
  children,
  s,
}: {
  title: string;
  children: React.ReactNode;
  s: CaseDetailStyles;
}) {
  return (
    <View style={s.card}>
      <ThemedText style={s.sectionTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

export default function CaseDetailScreen() {
  const { id: idParam, addProceeding } = useLocalSearchParams<{
    id: string;
    addProceeding?: string;
  }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const router = useRouter();
  const { session, effectiveOwnerId, can } = useAuth();
  const viewAccessGuard = useAccessGuard("view_cases");
  const canEditCases = can("edit_cases");
  const canTrashCase = can("edit_cases") && can("delete_cases");
  const canDisposeCase = can("edit_cases") && can("dispose_cases");
  const canManageDocuments = can("manage_documents");
  const isOnline = useIsOnline();
  const C = useThemePalette();
  const { isDark } = useAppTheme();
  const onPrimary = isDark ? C.black : C.pureWhite;
  const modalSheet = modalSheetBackground(C, isDark);
  const styles = useMemo(
    () => createCaseDetailStyles(C, onPrimary, modalSheet),
    [C, onPrimary, modalSheet],
  );
  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const showCaseFees = useCanViewCaseFees(caseData);
  const [linkedClient, setLinkedClient] = useState<ClientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [disposeModalVisible, setDisposeModalVisible] = useState(false);
  const [disposing, setDisposing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [hearingHistory, setHearingHistory] = useState<CaseHearingRow[]>([]);
  const [showProceedingForm, setShowProceedingForm] = useState(false);
  const [nextStatusDraft, setNextStatusDraft] = useState("");
  const [nextDateDraft, setNextDateDraft] = useState("");
  const [judgeNameDraft, setJudgeNameDraft] = useState("");
  const [showProceedingAddJudgeSheet, setShowProceedingAddJudgeSheet] = useState(false);
  const [savingProceeding, setSavingProceeding] = useState(false);
  const [proceedingError, setProceedingError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [isSharingCase, setIsSharingCase] = useState(false);
  
  // Documents state
  const [documents, setDocuments] = useState<CaseDocumentRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  // Pending file waiting for the user to name it before upload
  const [pendingFile, setPendingFile] = useState<{
    uri: string;
    suggestedName: string;
    mimeType: string;
    size?: number;
  } | null>(null);

  const [showCourtPortalModal, setShowCourtPortalModal] = useState(false);

  const openCourtPortalUrl = useCallback((entry: PakistanCourtPortal) => {
    const url = entry.url;

    const open = async () => {
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) {
          throw new Error("UNSUPPORTED_URL");
        }
        await Linking.openURL(url);
      } catch {
        try {
          await WebBrowser.openBrowserAsync(url, {
            presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
          });
        } catch {
          Alert.alert("Error", "Could not open the court website.");
        }
      }
    };

    setTimeout(() => {
      void open();
    }, Platform.OS === "ios" ? 350 : 150);
  }, []);

  const copyNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** After Add Judge closes, reopen Add proceeding when user opened judge from that flow. */
  const resumeProceedingAfterJudgeRef = useRef(false);

  const openAddJudgeFromProceeding = () => {
    resumeProceedingAfterJudgeRef.current = true;
    setShowProceedingForm(false);
    setShowProceedingAddJudgeSheet(true);
  };

  const handleProceedingAddJudgeSheetClose = () => {
    setShowProceedingAddJudgeSheet(false);
    if (resumeProceedingAfterJudgeRef.current) {
      resumeProceedingAfterJudgeRef.current = false;
      setShowProceedingForm(true);
    }
  };

  const showCopyNotice = (message: string) => {
    setCopyNotice(message);
    if (copyNoticeTimeoutRef.current) clearTimeout(copyNoticeTimeoutRef.current);
    copyNoticeTimeoutRef.current = setTimeout(() => {
      setCopyNotice(null);
      copyNoticeTimeoutRef.current = null;
    }, 1400);
  };

  useFocusEffect(
    useCallback(() => {
      if (!id) {
        setError("Invalid case");
        setLoading(false);
        return;
      }

      let cancelled = false;

      (async () => {
        if (session?.user?.id && !isOnline) {
          const cached = await getCachedCaseById(session.user.id, id);
          if (cancelled) return;
          setLoading(false);
          if (!cached) {
            setError("Case not available offline");
            setCaseData(null);
            return;
          }
          setError(null);
          setCaseData(cached);
          return;
        }

        setLoading(true);
        setError(null);

        const { data, error: e } = await supabase
          .from("cases")
          .select("*")
          .eq("id", id)
          .single();

        if (cancelled) return;
        setLoading(false);

        if (e) {
          setError(e.message || "Failed to load case");
          setCaseData(null);
          return;
        }

        const row = data as CaseRow;
        setCaseData(row);
        if (session?.user?.id) {
          await upsertCachedCase(session.user.id, row);
        }

        if (isOnline && canManageDocuments) {
          setLoadingDocs(true);
          try {
            const docs = await getCaseDocuments(id.toString());
            if (!cancelled) setDocuments(docs);
          } catch (err) {
            console.error("Failed to load documents", err);
          } finally {
            if (!cancelled) setLoadingDocs(false);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [canManageDocuments, id, isOnline, session?.user?.id]),
  );

  useEffect(() => {
    if (!canManageDocuments) {
      setDocuments([]);
      setLoadingDocs(false);
    }
  }, [canManageDocuments]);

  useEffect(() => {
    const clientId = caseData?.linked_client_id;
    if (!clientId) {
      setLinkedClient(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error: e } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (cancelled) return;
      if (!e && data) setLinkedClient(data as ClientRow);
      else setLinkedClient(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [caseData?.linked_client_id]);

  useEffect(() => {
    const caseId = caseData?.id;
    const userId = session?.user?.id;
    if (!caseId || !userId) {
      setHearingHistory([]);
      return;
    }
    if (!isOnline) {
      return;
    }

    let cancelled = false;
    (async () => {
      const history = await getCaseHearingHistory(caseId, userId, {
        limit: DETAIL_HEARING_PAGE_SIZE,
        offset: 0,
      });
      if (cancelled) return;
      setHearingHistory((prev) => {
        const pendingLocals = prev.filter((e) => e.id.startsWith("local_"));
        const stillPending = pendingLocals.filter(
          (local) =>
            !history.some(
              (row) =>
                row.hearing_date === local.hearing_date &&
                row.next_hearing_date === local.next_hearing_date &&
                (row.proceeding ?? "") === (local.proceeding ?? "") &&
                (row.current_status ?? "") === (local.current_status ?? "") &&
                (row.next_status ?? "") === (local.next_status ?? "") &&
                (row.judge_name ?? "") === (local.judge_name ?? ""),
            ),
        );
        const merged = [...stillPending, ...history];
        merged.sort((a, b) => {
          const byHearing = (b.hearing_date || "").localeCompare(a.hearing_date || "");
          if (byHearing !== 0) return byHearing;
          return (b.created_at || "").localeCompare(a.created_at || "");
        });
        return merged;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [caseData?.id, session?.user?.id, isOnline]);

  useEffect(() => {
    setNextDateDraft(caseData?.next_hearing_date || "");
  }, [caseData?.next_hearing_date]);

  /** Open Add proceeding from home / list when navigating with `?addProceeding=1`. */
  useEffect(() => {
    if (!caseData || addProceeding !== "1") return;
    setProceedingError(null);
    setNextStatusDraft("");
    setNextDateDraft(caseData.next_hearing_date || "");
    setJudgeNameDraft(caseData.judge_name?.trim() ?? "");
    setShowProceedingForm(true);
    requestAnimationFrame(() => {
      router.setParams({ addProceeding: undefined });
    });
  }, [caseData, addProceeding, router]);

  useEffect(() => {
    if (showProceedingForm && caseData) {
      setJudgeNameDraft(caseData.judge_name?.trim() ?? "");
    }
  }, [showProceedingForm, caseData]);

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current) {
        clearTimeout(copyNoticeTimeoutRef.current);
      }
    };
  }, []);

  if (viewAccessGuard.blocked) {
    return null;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.black} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !caseData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScreenHeader title="Error" />
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>
            {error || "Case not found"}
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const title = getCaseDisplayTitle(caseData);
  const isDisposed = Boolean(caseData.disposed_at);
  const todayIso = getTodayISO();
  const isCaseOverdue =
    Boolean(caseData.next_hearing_date) &&
    isIsoDateBefore(caseData.next_hearing_date?.slice(0, 10) || "", todayIso);
  const recentHearings = hearingHistory.slice(0, 1);
  const hasMoreHearings = hearingHistory.length > 1;
  const previousHearingDate = caseData.next_hearing_date || getTodayISO();
  const previousProceeding =
    caseData.next_status?.trim() ||
    caseData.current_status?.trim() ||
    "Proceeding updated";
  const copyCaseNumber = async () => {
    if (!caseData.case_number?.trim()) {
      showCopyNotice("No case number");
      return;
    }
    await Clipboard.setStringAsync(caseData.case_number.trim());
    showCopyNotice("Case number copied");
  };
  const shareCaseAsText = async () => {
    if (isSharingCase) return;
    setIsSharingCase(true);
    try {
      const message = getCaseSummaryText({
        caseData,
        title,
        linkedClientName: linkedClient?.name,
        includeFees: showCaseFees,
      });
      await Share.share({
        title: `Case Summary - ${title}`,
        message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not share case summary.";
      Alert.alert("Share failed", message);
    } finally {
      setIsSharingCase(false);
    }
  };

  const shareCaseAsPdf = async () => {
    if (isSharingCase) return;
    setIsSharingCase(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing is not available on this device.");
        return;
      }
      const html = buildCaseSummaryHtml({
        caseData,
        title,
        linkedClientName: linkedClient?.name,
        includeFees: showCaseFees,
      });
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: "Share case summary PDF",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not export case summary.";
      Alert.alert("Export failed", message);
    } finally {
      setIsSharingCase(false);
    }
  };

  const openShareSheet = () => {
    if (isSharingCase) return;
    Alert.alert("Share case summary", "Choose a format", [
      { text: "Text", onPress: () => void shareCaseAsText() },
      { text: "PDF", onPress: () => void shareCaseAsPdf() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const partyTerms = getPartyTerminology(caseData.court_tier ?? "", caseData.case_sub_type ?? "");
  const openAddProceedingForm = () => {
    if (!canEditCases) {
      Alert.alert("Restricted", "You do not have permission to edit case proceedings.");
      return;
    }
    setProceedingError(null);
    setNextStatusDraft("");
    setNextDateDraft(caseData.next_hearing_date || "");
    setJudgeNameDraft(caseData.judge_name?.trim() ?? "");
    setShowProceedingForm(true);
  };
  const saveProceeding = async () => {
    if (!session?.user?.id || !effectiveOwnerId) return;
    if (!nextDateDraft.trim()) {
      setProceedingError("Next hearing date is required.");
      return;
    }
    if (!nextStatusDraft.trim()) {
      setProceedingError("Next proceeding detail is required.");
      return;
    }

    const resolvedCurrentStatus = previousProceeding;
    const resolvedNextStatus = nextStatusDraft.trim();
    const resolvedNextDate = nextDateDraft.trim();

    if (isIsoDateBefore(resolvedNextDate, previousHearingDate)) {
      setProceedingError(
        `Next hearing date must be on or after ${formatCaseDate(previousHearingDate)}`,
      );
      return;
    }

    setSavingProceeding(true);
    setProceedingError(null);

    const patch = {
      current_status: resolvedCurrentStatus,
      next_status: resolvedNextStatus,
      next_hearing_date: resolvedNextDate,
      updated_at: new Date().toISOString(),
    };

    if (!isOnline) {
      const uid = effectiveOwnerId;
      const judgeResolved = judgeNameDraft.trim() || null;
      try {
        await addPendingProceedingSave({
          userId: uid,
          caseId: caseData.id,
          hearingDate: previousHearingDate,
          proceeding: previousProceeding,
          judgeName: judgeResolved,
          currentStatus: resolvedCurrentStatus,
          nextStatus: resolvedNextStatus,
          nextHearingDate: resolvedNextDate,
          casePatch: patch,
        });
        await patchCachedCase(uid, caseData.id, patch);
        setCaseData((prev) => (prev ? { ...prev, ...patch } : prev));
        const nowIso = new Date().toISOString();
        const localEntry: CaseHearingRow = {
          id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          case_id: caseData.id,
          user_id: uid,
          hearing_date: previousHearingDate,
          proceeding: previousProceeding,
          judge_name: judgeResolved,
          current_status: resolvedCurrentStatus,
          next_status: resolvedNextStatus,
          next_hearing_date: resolvedNextDate,
          created_at: nowIso,
          updated_at: nowIso,
        };
        setHearingHistory((prev) => {
          const merged = [localEntry, ...prev];
          merged.sort((a, b) => {
            const byHearing = (b.hearing_date || "").localeCompare(a.hearing_date || "");
            if (byHearing !== 0) return byHearing;
            return (b.created_at || "").localeCompare(a.created_at || "");
          });
          return merged;
        });
        setNextStatusDraft("");
        setNextDateDraft(resolvedNextDate);
        setJudgeNameDraft(caseData.judge_name?.trim() ?? "");
        setShowProceedingForm(false);
        showCopyNotice("Saved offline. Will sync when you are online.");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Could not save offline.";
        setProceedingError(message);
      } finally {
        setSavingProceeding(false);
      }
      return;
    }

    const hearingResult = await addCaseHearingEntry({
      caseId: caseData.id,
      userId: effectiveOwnerId,
      hearingDate: previousHearingDate,
      proceeding: previousProceeding,
      currentStatus: resolvedCurrentStatus,
      nextStatus: resolvedNextStatus,
      nextHearingDate: resolvedNextDate,
      judgeName: judgeNameDraft.trim() || null,
    });

    if (!hearingResult.ok) {
      setSavingProceeding(false);
      setProceedingError(hearingResult.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("cases")
      .update(patch)
      .eq("id", caseData.id)
      .eq("user_id", effectiveOwnerId);

    if (updateError) {
      setSavingProceeding(false);
      setProceedingError(updateError.message || "Failed to update case status.");
      return;
    }

    await patchCachedCase(session.user.id, caseData.id, patch);
    setCaseData((prev) => (prev ? { ...prev, ...patch } : prev));

    const history = await getCaseHearingHistory(caseData.id, effectiveOwnerId, {
      limit: DETAIL_HEARING_PAGE_SIZE,
      offset: 0,
    });
    setHearingHistory(history);

    setNextStatusDraft("");
    setNextDateDraft(resolvedNextDate);
    setJudgeNameDraft(caseData.judge_name?.trim() ?? "");
    setShowProceedingForm(false);
    setSavingProceeding(false);
  };

  const handleUploadResult = async (fileUri: string, fileName: string, mimeType: string, fileSize?: number) => {
    if (fileSize && fileSize > 20 * 1024 * 1024) {
      Alert.alert("File too large", "Please select a file smaller than 20MB.");
      return;
    }
    
    if (!caseData?.id || !session?.user?.id || !effectiveOwnerId) return;
    setUploadingDoc(true);
    try {
      const newDoc = await uploadCaseDocument({
        caseId: caseData.id,
        userId: effectiveOwnerId,
        fileUri,
        fileName,
        mimeType,
        fileSize,
      });

      setDocuments((prev) => [newDoc, ...prev]);
      Alert.alert("Success", "Document uploaded successfully.");
    } catch (err) {
      console.error(err);
      Alert.alert("Upload Failed", err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: "*/*",
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        setPendingFile({
          uri: file.uri,
          suggestedName: file.name,
          mimeType: file.mimeType || "application/octet-stream",
          size: file.size,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        const suggestedName = file.fileName || file.uri.split('/').pop() || "image.jpg";
        setPendingFile({
          uri: file.uri,
          suggestedName,
          mimeType: file.mimeType || "image/jpeg",
          size: file.fileSize,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Required", "Camera access is needed to take photos.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        const suggestedName = file.fileName || file.uri.split('/').pop() || "photo.jpg";
        setPendingFile({
          uri: file.uri,
          suggestedName,
          mimeType: file.mimeType || "image/jpeg",
          size: file.fileSize,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDocumentNameConfirmed = async (chosenName: string) => {
    if (!pendingFile) return;
    const { uri, mimeType, size } = pendingFile;
    await handleUploadResult(uri, chosenName, mimeType, size);
    setPendingFile(null);
  };

  const handleDocumentNameCancelled = () => {
    setPendingFile(null);
  };

  const handleAddDocument = async () => {
    if (!canManageDocuments) {
      Alert.alert("Restricted", "You do not have permission to manage documents.");
      return;
    }
    if (!caseData?.id || !session?.user?.id) return;
    if (!isOnline) {
      Alert.alert("Offline", "You need to be online to upload documents.");
      return;
    }

    Alert.alert(
      "Attach Document",
      "Choose a source",
      [
        { text: "Camera", onPress: () => void handleTakePhoto() },
        { text: "Gallery", onPress: () => void handlePickImage() },
        { text: "Choose a File", onPress: () => void handlePickDocument() },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const handleDeleteDocument = (docId: string, filePath: string) => {
    if (!canManageDocuments) {
      Alert.alert("Restricted", "You do not have permission to delete documents.");
      return;
    }
    if (!isOnline) {
      Alert.alert("Offline", "You need to be online to delete documents.");
      return;
    }
    
    Alert.alert(
      "Delete Document?",
      "Are you sure you want to permanently delete this document?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteCaseDocument(docId, filePath);
              setDocuments((prev) => prev.filter((d) => d.id !== docId));
            } catch {
              Alert.alert("Error", "Could not delete document.");
            }
          }
        }
      ]
    );
  };

  const handleViewDocument = async (doc: CaseDocumentRow) => {
    try {
      const url = await getDocumentDownloadUrl(doc.file_path);
      if (doc.mime_type?.startsWith("image/")) {
        setViewerUrl(url);
      } else {
        await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
      }
    } catch {
      Alert.alert("Error", "Could not open document.");
    }
  };


  const handleDisposeCase = async (values: DisposeCaseFormValues) => {
    if (!caseData?.id || !session?.user?.id) return;
    if (!canDisposeCase) {
      Alert.alert("Restricted", "You do not have permission to dispose cases.");
      return;
    }
    if (!isOnline) {
      Alert.alert("Offline", "You need to be online to dispose a case.");
      return;
    }
    if (!values.disposedDate || values.disposedDate.length < 10) {
      Alert.alert("Missing date", "Select a disposal date.");
      return;
    }

    setDisposing(true);
    try {
      const disposedAt = new Date(`${values.disposedDate.slice(0, 10)}T12:00:00`).toISOString();
      const { error } = await supabase
        .from("cases")
        .update({
          disposed_at: disposedAt,
          disposal_note: values.note.trim() || null,
        })
        .eq("id", caseData.id)
        .eq("user_id", effectiveOwnerId ?? session.user.id);

      if (error) throw error;

      await removeCachedCase(session.user.id, caseData.id);
      setDisposeModalVisible(false);
      Alert.alert("Case disposed", "This case has been moved to Disposed cases.", [
        { text: "OK", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Could not dispose case.";
      Alert.alert("Error", message);
    } finally {
      setDisposing(false);
    }
  };

  const handleRestoreDisposedCase = () => {
    if (!caseData?.id || !session?.user?.id) return;
    if (!canDisposeCase) {
      Alert.alert("Restricted", "You do not have permission to restore disposed cases.");
      return;
    }
    if (!isOnline) {
      Alert.alert("Offline", "You need to be online to restore a case.");
      return;
    }

    Alert.alert(
      "Restore to active?",
      "This case will reappear in your diary and cause lists.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          onPress: async () => {
            setRestoring(true);
            try {
              const { data, error } = await supabase
                .from("cases")
                .update({ disposed_at: null, disposal_note: null })
                .eq("id", caseData.id)
                .eq("user_id", effectiveOwnerId ?? session.user.id)
                .select("*")
                .single();

              if (error) throw error;

              const row = data as CaseRow;
              setCaseData(row);
              await upsertCachedCase(session.user.id, row);
              Alert.alert("Restored", "Case is active again.");
            } catch (e: unknown) {
              const message = e instanceof Error ? e.message : "Could not restore case.";
              Alert.alert("Error", message);
            } finally {
              setRestoring(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScreenHeader
        title={title}
        onTitleLongPress={() => Alert.alert("Case title", title, [{ text: "OK" }])}
        rightComponent={
          <View style={styles.headerActions}>
            <Bounceable
              style={styles.shareBtn}
              onPress={openShareSheet}
              disabled={isSharingCase}
              accessibilityLabel="Share case summary"
            >
              {isSharingCase ? (
                <ActivityIndicator size="small" color={C.black} />
              ) : (
                <MaterialIcons name="share" size={20} color={C.black} />
              )}
            </Bounceable>
            <Bounceable
              style={styles.editBtn}
              onPress={canEditCases ? () => router.push(`/case/${id}/edit`) : undefined}
              disabled={!canEditCases}
              accessibilityLabel="Edit case"
            >
              <MaterialIcons name="edit" size={20} color={C.black} />
            </Bounceable>
          </View>
        }
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(400).springify().damping(20)}>
          {isDisposed ? (
            <View style={styles.disposedBanner}>
              <ThemedText style={styles.disposedBannerTitle}>
                Disposed · {formatCaseDate(caseData.disposed_at?.slice(0, 10) ?? null)}
              </ThemedText>
              {caseData.disposal_note ? (
                <ThemedText style={styles.disposedBannerText}>{caseData.disposal_note}</ThemedText>
              ) : (
                <ThemedText style={styles.disposedBannerText}>
                  This case is hidden from active diary and cause lists.
                </ThemedText>
              )}
              {canDisposeCase ? (
                <Bounceable
                  style={styles.restoreButton}
                  onPress={handleRestoreDisposedCase}
                  disabled={restoring}
                >
                  <ThemedText style={styles.restoreButtonText}>
                    {restoring ? "Restoring…" : "Restore to active"}
                  </ThemedText>
                </Bounceable>
              ) : null}
            </View>
          ) : null}

          <SectionCard s={styles} title="Parties & type">
            <DetailRow s={styles} C={C} label={partyTerms.firstParty} value={caseData.petitioner_name} />
            <DetailRow s={styles} C={C} label={partyTerms.secondParty} value={caseData.respondent_name} />
            <DetailRow
              s={styles}
              C={C}
              label="Case number"
              value={caseData.case_number}
              onValueLongPress={() => void copyCaseNumber()}
              onCopyPress={() => void copyCaseNumber()}
              valueAccessibilityHint="Long press to copy case number"
            />
            <DetailRow s={styles} C={C} label="Case type" value={caseData.case_type} />
            <DetailRow s={styles} C={C} label="Type of case" value={caseData.case_sub_type} />
          </SectionCard>

          <SectionCard s={styles} title="Court">
            <DetailRow s={styles} C={C} label="Court tier" value={caseData.court_tier} />
            <DetailRow s={styles} C={C} label="Court room location" value={caseData.court_room} />
            <DetailRow s={styles} C={C} label="Judge name" value={caseData.judge_name} />
            <ThemedText style={styles.courtPortalHint}>
              Copy your case number from above, pick trial court, High Court, or Supreme Court in
              the list, then tap Open website.
            </ThemedText>
            <Bounceable
              style={styles.addProceedingBtn}
              onPress={() => setShowCourtPortalModal(true)}
              accessibilityLabel="Choose court portal for case search"
            >
              <MaterialIcons name="public" size={18} color={C.black} />
              <ThemedText style={styles.addProceedingText}>
                Search case in court website
              </ThemedText>
            </Bounceable>
          </SectionCard>

          <SectionCard s={styles} title="Client">
            <DetailRow
              s={styles}
              C={C}
              label="My client is"
              value={
                caseData.my_client_is === "petitioner"
                  ? partyTerms.firstParty
                  : caseData.my_client_is === "respondent"
                    ? partyTerms.secondParty
                    : null
              }
            />
            {linkedClient ? (
              <>
                <DetailRow s={styles} C={C} label="Client name" value={linkedClient.name} />
                {linkedClient.care_of?.trim() ? (
                  <DetailRow s={styles} C={C} label="Care of" value={linkedClient.care_of} />
                ) : null}
                {linkedClient.address?.trim() ? (
                  <DetailRow s={styles} C={C} label="Address" value={linkedClient.address} />
                ) : null}
                {linkedClient.phone?.trim() ? (
                  <DetailRow s={styles} C={C} label="Phone" value={linkedClient.phone} />
                ) : null}
                {linkedClient.email?.trim() ? (
                  <DetailRow s={styles} C={C} label="Email" value={linkedClient.email} />
                ) : null}
              </>
            ) : caseData.linked_client_name ? (
              <DetailRow
                s={styles}
                C={C}
                label="Linked client"
                value={caseData.linked_client_name}
              />
            ) : null}
          </SectionCard>

          <SectionCard s={styles} title="Dates & status">
            <DetailRow
              s={styles}
              C={C}
              label="Date of filing"
              value={
                caseData.date_of_filing
                  ? formatCaseDate(caseData.date_of_filing)
                  : null
              }
            />
            <DetailRow
              s={styles}
              C={C}
              label="Next hearing date"
              value={
                caseData.next_hearing_date
                  ? formatCaseDate(caseData.next_hearing_date)
                  : null
              }
            />
            {isCaseOverdue ? (
              <Bounceable
                style={[styles.overduePill, styles.overduePillButton]}
                onPress={canEditCases ? openAddProceedingForm : undefined}
                disabled={!canEditCases}
                accessibilityRole="button"
                accessibilityLabel="Overdue. Add proceeding"
              >
                <MaterialIcons name="warning-amber" size={14} color={C.themeRed} />
                <ThemedText style={styles.overduePillText}>OVERDUE</ThemedText>
              </Bounceable>
            ) : null}
            <DetailRow s={styles} C={C} label="Current status" value={caseData.current_status} />
            <DetailRow s={styles} C={C} label="Next status" value={caseData.next_status} />
          </SectionCard>

          <SectionCard s={styles} title="Hearing history">
            <Bounceable
              style={styles.addProceedingBtn}
              onPress={() => {
                if (!canEditCases) return;
                if (showProceedingForm) {
                  setShowProceedingForm(false);
                  setProceedingError(null);
                  return;
                }
                openAddProceedingForm();
              }}
            >
              <MaterialIcons
                name={showProceedingForm ? "close" : "add"}
                size={18}
                color={C.black}
              />
              <ThemedText style={styles.addProceedingText}>
                Add proceeding
              </ThemedText>
            </Bounceable>

            <View style={styles.currentHearingCard}>
              <ThemedText style={styles.currentHearingTitle}>Next hearing</ThemedText>
              <ThemedText style={styles.currentHearingDate}>
                {caseData.next_hearing_date
                  ? formatCaseDate(caseData.next_hearing_date)
                  : "No date set"}
              </ThemedText>
              <ThemedText style={styles.currentHearingDetail}>
                {(caseData.next_status || caseData.current_status || "No proceeding detail").trim()}
              </ThemedText>
              {caseData.judge_name?.trim() ? (
                <ThemedText style={styles.currentHearingJudge}>
                  Judge: {caseData.judge_name.trim()}
                </ThemedText>
              ) : null}
            </View>

            <ThemedText style={styles.previousHeading}>Previous hearings</ThemedText>

            {recentHearings.length === 0 ? (
              <DetailRow s={styles} C={C} label="Proceedings" value="No history yet" />
            ) : (
              recentHearings.map((entry) => (
                <View key={entry.id} style={styles.historyItem}>
                  <ThemedText style={styles.historyDate}>
                    {formatCaseDate(entry.hearing_date)}
                  </ThemedText>
                  {entry.judge_name?.trim() ? (
                    <ThemedText style={styles.historyJudge}>
                      Judge: {entry.judge_name.trim()}
                    </ThemedText>
                  ) : null}
                  <ThemedText style={styles.historyProceeding}>
                    {(entry.proceeding || entry.current_status || "Proceeding updated").trim()}
                  </ThemedText>
                  <ThemedText style={styles.historyNext}>
                    Next: {entry.next_status?.trim() || "—"} •{" "}
                    {entry.next_hearing_date
                      ? formatCaseDate(entry.next_hearing_date)
                      : "No date"}
                  </ThemedText>
                </View>
              ))
            )}

            {hasMoreHearings ? (
              <Bounceable
                style={styles.seeAllBtn}
                onPress={() => router.push(`/case/${id}/hearings`)}
              >
                <ThemedText style={styles.seeAllBtnText}>See all hearings</ThemedText>
                <MaterialIcons name="chevron-right" size={18} color={C.black} />
              </Bounceable>
            ) : null}
          </SectionCard>

          {showCaseFees ? (
            <CaseFeeDetailCard
              caseId={caseData.id}
              userId={effectiveOwnerId ?? caseData.user_id}
              totalFee={caseData.total_fee}
              feeReceived={caseData.fee_received}
              canRecord={canEditCases}
              isOnline={isOnline}
              onFeeUpdated={async (feeReceived) => {
                const patch = { fee_received: feeReceived };
                setCaseData((prev) => (prev ? { ...prev, ...patch } : prev));
                if (session?.user?.id) {
                  await patchCachedCase(session.user.id, caseData.id, patch);
                }
              }}
            />
          ) : null}

          {canManageDocuments ? (
            <SectionCard s={styles} title="Documents">
              <Bounceable
                style={styles.addProceedingBtn}
                onPress={handleAddDocument}
                disabled={uploadingDoc}
              >
                {uploadingDoc ? (
                  <ActivityIndicator size="small" color={C.black} />
                ) : (
                  <MaterialIcons name="upload-file" size={18} color={C.black} />
                )}
                <ThemedText style={styles.addProceedingText}>
                  {uploadingDoc ? "Uploading..." : "Add Document"}
                </ThemedText>
              </Bounceable>

              {loadingDocs ? (
                <ActivityIndicator size="small" color={C.black} />
              ) : documents.length === 0 ? (
                <DetailRow s={styles} C={C} label="Files" value="No documents attached yet" />
              ) : (
                <>
                  {documents.slice(0, 2).map((doc) => (
                    <View key={doc.id} style={styles.historyItem}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Bounceable style={{ flex: 1, flexDirection: "row", alignItems: "center", paddingRight: 8 }} onPress={() => void handleViewDocument(doc)}>
                          <DocumentIconPreview filePath={doc.file_path} mimeType={doc.mime_type} C={C} />
                          <View style={{ flex: 1 }}>
                            <ThemedText style={styles.historyDate} numberOfLines={1}>{doc.file_name}</ThemedText>
                            <ThemedText style={styles.historyNext}>
                              {doc.size_bytes ? (doc.size_bytes / 1024).toFixed(1) + " KB" : "Unknown size"} • {formatCaseDate(doc.created_at)}
                            </ThemedText>
                          </View>
                        </Bounceable>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <Bounceable
                            onPress={() => handleDeleteDocument(doc.id, doc.file_path)}
                          >
                            <MaterialIcons name="delete-outline" size={20} color={C.themeRed} />
                          </Bounceable>
                        </View>
                      </View>
                    </View>
                  ))}
                  {documents.length > 2 && (
                    <Bounceable
                      style={styles.seeAllBtn}
                      onPress={() => router.push(`/case/${id}/documents`)}
                    >
                      <ThemedText style={styles.seeAllBtnText}>See all documents ({documents.length})</ThemedText>
                      <MaterialIcons name="chevron-right" size={18} color={C.black} />
                    </Bounceable>
                  )}
                </>
              )}
            </SectionCard>
          ) : null}

          {canDisposeCase && !isDisposed ? (
            <Bounceable
              style={styles.disposeButton}
              onPress={() => {
                if (!isOnline) {
                  Alert.alert("Offline", "You need to be online to dispose a case.");
                  return;
                }
                setDisposeModalVisible(true);
              }}
              disabled={disposing}
            >
              <ThemedText style={styles.disposeButtonText}>Mark as disposed</ThemedText>
            </Bounceable>
          ) : null}

          {canTrashCase && !isDisposed ? (
            <Bounceable
              style={styles.deleteButton}
              onPress={() => {
              Alert.alert(
                "Move to Trash?",
                "The case will be moved to Trash. You can restore it anytime from Settings → Trash.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Move to Trash",
                    style: "destructive",
                    onPress: async () => {
                      if (!id || !session?.user?.id) return;
                      if (!isOnline) {
                        await addPendingCaseDelete(session.user.id, id);
                        await removeCachedCase(session.user.id, id);
                        router.replace("/(tabs)");
                        return;
                      }
                      setDeleting(true);
                      const { error: e } = await supabase
                        .from("cases")
                        .update({ deleted_at: new Date().toISOString() })
                        .eq("id", id)
                        .eq("user_id", effectiveOwnerId ?? session.user.id);
                      setDeleting(false);
                      if (e) {
                        Alert.alert("Error", e.message);
                        return;
                      }
                      await removeCachedCase(session.user.id, id);
                      router.replace("/(tabs)");
                    },
                  },
                ],
              );
              }}
              disabled={deleting}
            >
              {deleting ? (
                <ThemedText style={styles.deleteButtonText}>Moving to Trash…</ThemedText>
              ) : (
                <ThemedText style={styles.deleteButtonText}>Move to Trash</ThemedText>
              )}
            </Bounceable>
          ) : null}
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showProceedingForm}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowProceedingForm(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => {
                if (!savingProceeding) {
                  setShowProceedingForm(false);
                }
              }}
            />
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Add proceeding</ThemedText>
              <Bounceable
                style={styles.modalClose}
                onPress={() => {
                  if (!savingProceeding) {
                    setShowProceedingForm(false);
                  }
                }}
              >
                <MaterialIcons name="close" size={20} color={C.black} />
              </Bounceable>
              </View>

              <ScrollView
              style={styles.proceedingForm}
              contentContainerStyle={styles.proceedingFormContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.previousInfoBox}>
                <ThemedText style={styles.previousInfoLabel}>Previous hearing</ThemedText>
                <ThemedText style={styles.previousInfoDate}>
                  {formatCaseDate(previousHearingDate)}
                </ThemedText>
                <ThemedText style={styles.previousInfoText}>
                  {previousProceeding}
                </ThemedText>
              </View>

              <JudgeNameSelector
                label="Judge at this hearing"
                value={judgeNameDraft}
                courtTier={caseData.court_tier ?? ""}
                onChange={setJudgeNameDraft}
                onPressAddJudge={openAddJudgeFromProceeding}
                allowAddJudgeWithoutCourtTier
                placeholder="Select judge"
                hint={
                  caseData.court_tier?.trim()
                    ? "Judges are filtered by this case's court tier."
                    : "Add a court tier on the case (Edit case) to filter the list, or use Add judge to create one and pick a tier."
                }
              />
              {!caseData.court_tier?.trim() ? (
                <Bounceable
                  style={styles.proceedingAddJudgeFallback}
                  onPress={openAddJudgeFromProceeding}
                >
                  <MaterialIcons name="person-add" size={18} color={C.black} />
                  <ThemedText style={styles.proceedingAddJudgeFallbackText}>
                    Add judge
                  </ThemedText>
                </Bounceable>
              ) : null}

              <ThemedText style={styles.inputLabel}>Next proceeding detail</ThemedText>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={nextStatusDraft}
                onChangeText={setNextStatusDraft}
                placeholder="e.g. Evidence, Final arguments"
                placeholderTextColor={C.gray50}
                multiline
                autoCorrect={false}
                spellCheck={false}
              />

              <DateField
                label="Next hearing date"
                required
                value={nextDateDraft}
                onChange={setNextDateDraft}
                placeholder="e.g. 30/03/2026"
              />

              {proceedingError ? (
                <ThemedText style={styles.formErrorText}>{proceedingError}</ThemedText>
              ) : null}

              <Bounceable
                style={styles.saveProceedingBtn}
                onPress={() => void saveProceeding()}
                disabled={savingProceeding}
              >
                <ThemedText style={styles.saveProceedingBtnText}>
                  {savingProceeding ? "Saving..." : "Save proceeding"}
                </ThemedText>
              </Bounceable>
              </ScrollView>
            </View>
        </KeyboardAvoidingView>
      </Modal>

      <CourtPortalBottomSheet
        visible={showCourtPortalModal}
        onClose={() => setShowCourtPortalModal(false)}
        onOpenPortal={openCourtPortalUrl}
      />

      <AddJudgeBottomSheet
        visible={showProceedingAddJudgeSheet}
        defaultCourtTier={caseData.court_tier ?? ""}
        onClose={handleProceedingAddJudgeSheetClose}
        onSaved={(judge) => {
          setJudgeNameDraft(judge.name);
        }}
      />

      {copyNotice ? (
        <View pointerEvents="none" style={styles.copyToastWrap}>
          <ThemedText style={styles.copyToastText}>{copyNotice}</ThemedText>
        </View>
      ) : null}

      <ImageViewerModal
        visible={viewerUrl !== null}
        imageUrl={viewerUrl}
        onClose={() => setViewerUrl(null)}
      />

      {canManageDocuments ? (
        <DocumentNameModal
          visible={pendingFile !== null}
          suggestedName={pendingFile?.suggestedName ?? ""}
          saving={uploadingDoc}
          onConfirm={(name) => void handleDocumentNameConfirmed(name)}
          onCancel={handleDocumentNameCancelled}
        />
      ) : null}

      <DisposeCaseModal
        visible={disposeModalVisible}
        saving={disposing}
        onSave={(values) => void handleDisposeCase(values)}
        onCancel={() => {
          if (disposing) return;
          setDisposeModalVisible(false);
        }}
      />
    </SafeAreaView>
  );
}
