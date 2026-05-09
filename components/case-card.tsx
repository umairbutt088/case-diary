import { Bounceable } from "@/components/ui/bounceable";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { CopilotStep, walkthroughable } from "react-native-copilot";
import Animated, {
    FadeInUp,
    FadeOut,
    LinearTransition
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { COURT_TIERS } from "@/constants/case-form";
import type { AppColors } from "@/constants/color-palette";
import { useThemePalette } from "@/hooks/use-theme-palette";
import type { CaseRow } from "@/types/case";
import { formatCaseDate, getCaseDisplayTitle, isCaseOverdue } from "@/types/case";

const CASE_DETAILS_SNIPPET_LENGTH = 80;
const WalkthroughableView = walkthroughable(View);

function getCaseDetailsSnippet(row: CaseRow): string {
  if (row.notes?.trim()) {
    const t = row.notes.trim();
    return t.length <= CASE_DETAILS_SNIPPET_LENGTH
      ? t
      : t.slice(0, CASE_DETAILS_SNIPPET_LENGTH) + "...";
  }
  const parts: string[] = [];
  if (row.case_type) parts.push(row.case_type);
  if (row.case_sub_type) parts.push(row.case_sub_type);
  if (row.court_name) parts.push(row.court_name);
  if (parts.length) return parts.join(" · ");
  return "No details";
}

function getCourtDisplay(row: CaseRow): string {
  const courtName = row.court_name?.trim();
  if (courtName) return courtName;

  const tierValue = row.court_tier?.trim();
  if (!tierValue) return "—";

  const tierLabel = COURT_TIERS.find((tier) => tier.value === tierValue)?.label;
  return tierLabel ?? tierValue;
}

type CaseCardProps = {
  caseItem: CaseRow;
  index?: number;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  walkthroughEnabled?: boolean;
  walkthroughContext?: string;
  walkthroughActive?: boolean;
};

function createCaseCardStyles(C: AppColors) {
  return StyleSheet.create({
    cardOuter: {
      paddingHorizontal: 6,
      paddingTop: 2,
      paddingBottom: 6,
      marginBottom: 6,
    },
    card: {
      backgroundColor: C.cream50,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 4,
      elevation: 5,
    },
    compactRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    compactCell: {
      flex: 1,
      minWidth: 0,
    },
    compactCellCenter: {
      alignItems: "center",
    },
    compactCellRight: {
      alignItems: "flex-end",
    },
    compactDateLabel: {
      fontSize: 11,
      color: C.gray50,
      marginBottom: 2,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    compactDateValue: {
      fontSize: 13,
      color: C.black,
      fontWeight: "600",
    },
    compactTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: C.black,
      textAlign: "center",
    },
    compactChevron: {
      marginTop: 2,
      opacity: 0.7,
    },
    expandedBody: {
      marginTop: 2,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    titleWrap: {
      flex: 1,
      minWidth: 0,
      marginRight: 8,
    },
    title: {
      fontSize: 17,
      fontWeight: "700",
      color: C.black,
    },
    detailsButton: {
      flexDirection: "row",
      alignItems: "center",
    },
    collapseButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    collapseButtonCentered: {
      alignSelf: "center",
      marginTop: -2,
      marginBottom: -2,
    },
    detailsButtonText: {
      fontSize: 15,
      color: C.gray50,
      marginRight: 2,
    },
    snippet: {
      fontSize: 14,
      marginBottom: 10,
      lineHeight: 20,
    },
    detailsBlock: {
      marginBottom: 12,
      gap: 4,
    },
    detailText: {
      fontSize: 13,
      color: C.gray50,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    nextDateRow: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      minWidth: 0,
      flexWrap: "wrap",
    },
    nextDateIcon: {
      marginRight: 4,
    },
    nextDateText: {
      fontSize: 13,
      flexShrink: 1,
    },
    nextDateTextOverdue: {
      fontWeight: "700",
    },
    overdueBadge: {
      marginLeft: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: C.themeRed + "22",
      borderWidth: 1,
      borderColor: C.themeRed,
      maxWidth: "100%",
    },
    overdueBadgeText: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.3,
      color: C.themeRed,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
    },
    iconButton: {
      padding: 4,
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
      color: C.pureWhite,
      backgroundColor: C.black + "CC",
      overflow: "hidden",
    },
  });
}

export function CaseCard({
  caseItem,
  index = 0,
  onEdit,
  onDelete,
  walkthroughEnabled = false,
  walkthroughContext = "case-card",
  walkthroughActive = true,
}: CaseCardProps) {
  const router = useRouter();
  const C = useThemePalette();
  const styles = useMemo(() => createCaseCardStyles(C), [C]);
  const title = getCaseDisplayTitle(caseItem);
  const snippet = getCaseDetailsSnippet(caseItem);
  const previousDate = formatCaseDate(caseItem.date_of_filing);
  const nextDate = formatCaseDate(caseItem.next_hearing_date);
  const isOverdue = isCaseOverdue({
    nextHearingDate: caseItem.next_hearing_date,
    updatedAt: caseItem.updated_at,
  });
  const caseNumber = caseItem.case_number?.trim() || "—";
  const courtName = getCourtDisplay(caseItem);
  const proceeding = caseItem.next_status?.trim() || caseItem.current_status?.trim() || "—";
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const copyNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDetails = () => {
    router.push(`/case/${caseItem.id}`);
  };

  const showCopyNotice = (message: string) => {
    setCopyNotice(message);
    if (copyNoticeTimeoutRef.current) clearTimeout(copyNoticeTimeoutRef.current);
    copyNoticeTimeoutRef.current = setTimeout(() => {
      setCopyNotice(null);
      copyNoticeTimeoutRef.current = null;
    }, 1400);
  };

  useEffect(() => {
    return () => {
      if (copyNoticeTimeoutRef.current) clearTimeout(copyNoticeTimeoutRef.current);
    };
  }, []);

  const copyCaseNumber = async () => {
    if (!caseItem.case_number?.trim()) {
      showCopyNotice("No case number");
      return;
    }
    await Clipboard.setStringAsync(caseItem.case_number.trim());
    showCopyNotice("Case number copied");
  };

  return (
    <Animated.View
      style={styles.cardOuter}
      entering={FadeInUp.delay(index * 50).springify()}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify()}
    >
      <Bounceable
        onPress={expanded ? undefined : () => setExpanded(true)}
        activeScale={0.98}
        style={styles.card}
      >
        {!expanded ? (
          <View style={styles.compactRow}>
            <View style={styles.compactCell}>
              <ThemedText style={styles.compactDateLabel}>Previous</ThemedText>
              <ThemedText style={styles.compactDateValue} numberOfLines={1}>
                {previousDate}
              </ThemedText>
            </View>
            <View style={[styles.compactCell, styles.compactCellCenter]}>
              <ThemedText style={styles.compactTitle} numberOfLines={1}>
                {title}
              </ThemedText>
              <MaterialIcons
                name="keyboard-arrow-down"
                size={20}
                color={C.gray50}
                style={styles.compactChevron}
              />
            </View>
            <View style={[styles.compactCell, styles.compactCellRight]}>
              <ThemedText style={styles.compactDateLabel}>Next</ThemedText>
              <ThemedText
                style={[styles.compactDateValue, isOverdue && styles.nextDateTextOverdue]}
                numberOfLines={1}
                lightColor={isOverdue ? C.themeRed : C.black}
                darkColor={isOverdue ? C.themeRed : C.black}
              >
                {nextDate}
              </ThemedText>
            </View>
          </View>
        ) : null}

        {expanded ? (
          <View style={styles.expandedBody}>
            <Bounceable
              style={[styles.collapseButton, styles.collapseButtonCentered]}
              onPress={(event) => {
                event.stopPropagation();
                setExpanded(false);
              }}
              accessibilityLabel="Collapse case card"
            >
              <MaterialIcons name="keyboard-arrow-up" size={20} color={C.gray50} />
            </Bounceable>
            <View style={styles.cardTop}>
              <Bounceable
                style={styles.titleWrap}
                onLongPress={() => Alert.alert("Case title", title, [{ text: "OK" }])}
                accessibilityLabel={title}
                accessibilityHint="Long press to show full title"
                onPress={(event) => event.stopPropagation()}
              >
                <ThemedText
                  style={styles.title}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {title}
                </ThemedText>
              </Bounceable>
              {walkthroughEnabled ? (
                <CopilotStep
                  text="Details opens the full case page so you can review all information."
                  order={5}
                  name={`${walkthroughContext}-details`}
                  active={walkthroughActive}
                >
                  <WalkthroughableView collapsable={false}>
                    <Bounceable
                      style={styles.detailsButton}
                      onPress={(event) => {
                        event.stopPropagation();
                        openDetails();
                      }}
                    >
                      <ThemedText style={styles.detailsButtonText}>Details</ThemedText>
                      <MaterialIcons
                        name="chevron-right"
                        size={20}
                        color={C.gray50}
                      />
                    </Bounceable>
                  </WalkthroughableView>
                </CopilotStep>
              ) : (
                <Bounceable
                  style={styles.detailsButton}
                  onPress={(event) => {
                    event.stopPropagation();
                    openDetails();
                  }}
                >
                  <ThemedText style={styles.detailsButtonText}>Details</ThemedText>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={C.gray50}
                  />
                </Bounceable>
              )}
            </View>
            <ThemedText
              style={styles.snippet}
              numberOfLines={2}
              lightColor={C.gray50}
              darkColor={C.gray50}
            >
              {snippet}
            </ThemedText>
            <View style={styles.detailsBlock}>
              <Pressable
                onLongPress={() => void copyCaseNumber()}
                onPress={(event) => event.stopPropagation()}
                delayLongPress={250}
                accessibilityLabel="Case number. Press and hold to copy"
                accessibilityHint="Long press to copy the case number to clipboard"
              >
                <ThemedText style={styles.detailText} numberOfLines={1}>
                  Case no: {caseNumber}
                </ThemedText>
              </Pressable>
              <ThemedText style={styles.detailText} numberOfLines={1}>
                Court: {courtName}
              </ThemedText>
              <ThemedText style={styles.detailText} numberOfLines={1}>
                Proceeding: {proceeding}
              </ThemedText>
            </View>
            <View style={styles.footer}>
              <View style={styles.nextDateRow}>
                <MaterialIcons
                  name="event"
                  size={18}
                  color={isOverdue ? C.themeRed : C.gray50}
                  style={styles.nextDateIcon}
                />
                <ThemedText
                  style={[styles.nextDateText, isOverdue && styles.nextDateTextOverdue]}
                  lightColor={isOverdue ? C.themeRed : C.gray50}
                  darkColor={isOverdue ? C.themeRed : C.gray50}
                >
                  Next: {nextDate}
                </ThemedText>
                {isOverdue ? (
                  <Bounceable
                    style={styles.overdueBadge}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    onPress={(event) => {
                      event.stopPropagation();
                      router.push(`/case/${caseItem.id}?addProceeding=1`);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Add proceeding to update next hearing"
                  >
                    <ThemedText style={styles.overdueBadgeText}>OVERDUE</ThemedText>
                  </Bounceable>
                ) : null}
              </View>
              <View style={styles.actions}>
                {onDelete ? (
                  walkthroughEnabled ? (
                    <CopilotStep
                      text="Delete removes this case permanently."
                      order={6}
                      name={`${walkthroughContext}-delete`}
                      active={walkthroughActive}
                    >
                      <WalkthroughableView collapsable={false}>
                        <Bounceable
                          onPress={(event) => {
                            event.stopPropagation();
                            onDelete(caseItem.id);
                          }}
                          style={styles.iconButton}
                          hitSlop={8}
                          accessibilityLabel="Delete case"
                        >
                          <MaterialIcons
                            name="delete-outline"
                            size={22}
                            color={C.themeRed}
                          />
                        </Bounceable>
                      </WalkthroughableView>
                    </CopilotStep>
                  ) : (
                    <Bounceable
                      onPress={(event) => {
                        event.stopPropagation();
                        onDelete(caseItem.id);
                      }}
                      style={styles.iconButton}
                      hitSlop={8}
                      accessibilityLabel="Delete case"
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={22}
                        color={C.themeRed}
                      />
                    </Bounceable>
                  )
                ) : null}
                <Bounceable
                  onPress={(event) => {
                    event.stopPropagation();
                    router.push(`/calendar`);
                  }}
                  style={styles.iconButton}
                  hitSlop={8}
                  accessibilityLabel="View next date / calendar"
                >
                  <MaterialIcons name="event" size={22} color={C.gray50} />
                </Bounceable>
                {onEdit ? (
                  walkthroughEnabled ? (
                    <CopilotStep
                      text="Edit lets you update this case information."
                      order={7}
                      name={`${walkthroughContext}-edit`}
                      active={walkthroughActive}
                    >
                      <WalkthroughableView collapsable={false}>
                        <Bounceable
                          onPress={(event) => {
                            event.stopPropagation();
                            onEdit(caseItem.id);
                          }}
                          style={styles.iconButton}
                          hitSlop={8}
                          accessibilityLabel="Edit case"
                        >
                          <MaterialIcons
                            name="edit"
                            size={22}
                            color={C.gray50}
                          />
                        </Bounceable>
                      </WalkthroughableView>
                    </CopilotStep>
                  ) : (
                    <Bounceable
                      onPress={(event) => {
                        event.stopPropagation();
                        onEdit(caseItem.id);
                      }}
                      style={styles.iconButton}
                      hitSlop={8}
                      accessibilityLabel="Edit case"
                    >
                      <MaterialIcons
                        name="edit"
                        size={22}
                        color={C.gray50}
                      />
                    </Bounceable>
                  )
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
        {copyNotice ? (
          <View pointerEvents="none" style={styles.copyToastWrap}>
            <ThemedText style={styles.copyToastText}>{copyNotice}</ThemedText>
          </View>
        ) : null}
      </Bounceable>
    </Animated.View>
  );
}
