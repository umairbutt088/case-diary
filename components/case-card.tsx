import { Bounceable } from "@/components/ui/bounceable";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { CopilotStep, walkthroughable } from "react-native-copilot";
import { Alert, StyleSheet, View } from "react-native";
import Animated, {
  FadeInUp,
  FadeOut,
  LinearTransition
} from "react-native-reanimated";

import { ThemedText } from "@/components/themed-text";
import { theme } from "@/constants/theme";
import type { CaseRow } from "@/types/case";
import { formatCaseDate, getCaseDisplayTitle } from "@/types/case";

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

type CaseCardProps = {
  caseItem: CaseRow;
  index?: number;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  walkthroughEnabled?: boolean;
  walkthroughContext?: string;
  walkthroughActive?: boolean;
};

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
  const title = getCaseDisplayTitle(caseItem);
  const snippet = getCaseDetailsSnippet(caseItem);
  const nextDate = formatCaseDate(caseItem.next_hearing_date);

  const openDetails = () => {
    router.push(`/case/${caseItem.id}`);
  };

  return (
    <Animated.View
      entering={FadeInUp.delay(index * 50).springify()}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify()}
    >
      <Bounceable
        onPress={openDetails}
        activeScale={0.98}
        style={styles.card}
      >
        <View style={styles.cardTop}>
          <Bounceable
            style={styles.titleWrap}
            onLongPress={() => Alert.alert("Case title", title, [{ text: "OK" }])}
            accessibilityLabel={title}
            accessibilityHint="Long press to show full title"
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
              <WalkthroughableView>
                <View style={styles.detailsButton}>
                  <ThemedText style={styles.detailsButtonText}>Details</ThemedText>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={theme.colors.gray50}
                  />
                </View>
              </WalkthroughableView>
            </CopilotStep>
          ) : (
            <View style={styles.detailsButton}>
              <ThemedText style={styles.detailsButtonText}>Details</ThemedText>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={theme.colors.gray50}
              />
            </View>
          )}
        </View>
        <ThemedText
          style={styles.snippet}
          numberOfLines={2}
          lightColor={theme.colors.gray50}
          darkColor={theme.colors.gray50}
        >
          {snippet}
        </ThemedText>
        <View style={styles.footer}>
          <View style={styles.nextDateRow}>
            <MaterialIcons
              name="event"
              size={18}
              color={theme.colors.gray50}
              style={styles.nextDateIcon}
            />
            <ThemedText
              style={styles.nextDateText}
              lightColor={theme.colors.gray50}
              darkColor={theme.colors.gray50}
            >
              Next: {nextDate}
            </ThemedText>
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
                  <WalkthroughableView>
                    <Bounceable
                      onPress={() => onDelete(caseItem.id)}
                      style={styles.iconButton}
                      hitSlop={8}
                      accessibilityLabel="Delete case"
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={22}
                        color={theme.colors.themeRed}
                      />
                    </Bounceable>
                  </WalkthroughableView>
                </CopilotStep>
              ) : (
                <Bounceable
                  onPress={() => onDelete(caseItem.id)}
                  style={styles.iconButton}
                  hitSlop={8}
                  accessibilityLabel="Delete case"
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={22}
                    color={theme.colors.themeRed}
                  />
                </Bounceable>
              )
            ) : null}
            <Bounceable
              onPress={() => router.push(`/calendar`)}
              style={styles.iconButton}
              hitSlop={8}
              accessibilityLabel="View next date / calendar"
            >
              <MaterialIcons name="event" size={22} color={theme.colors.gray50} />
            </Bounceable>
            {onEdit ? (
              walkthroughEnabled ? (
                <CopilotStep
                  text="Edit lets you update this case information."
                  order={7}
                  name={`${walkthroughContext}-edit`}
                  active={walkthroughActive}
                >
                  <WalkthroughableView>
                    <Bounceable
                      onPress={() => onEdit(caseItem.id)}
                      style={styles.iconButton}
                      hitSlop={8}
                      accessibilityLabel="Edit case"
                    >
                      <MaterialIcons
                        name="edit"
                        size={22}
                        color={theme.colors.gray50}
                      />
                    </Bounceable>
                  </WalkthroughableView>
                </CopilotStep>
              ) : (
                <Bounceable
                  onPress={() => onEdit(caseItem.id)}
                  style={styles.iconButton}
                  hitSlop={8}
                  accessibilityLabel="Edit case"
                >
                  <MaterialIcons
                    name="edit"
                    size={22}
                    color={theme.colors.gray50}
                  />
                </Bounceable>
              )
            ) : null}
          </View>
        </View>
      </Bounceable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.cream50,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow,
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
    color: theme.colors.black,
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailsButtonText: {
    fontSize: 15,
    color: theme.colors.gray50,
    marginRight: 2,
  },
  snippet: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  nextDateRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nextDateIcon: {
    marginRight: 4,
  },
  nextDateText: {
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  iconButton: {
    padding: 4,
  },
});
