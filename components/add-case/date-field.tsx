import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, View } from "react-native";

import { FormField } from "@/components/add-case/form-field";
import { FormInput } from "@/components/ui/form-input";
import { theme } from "@/constants/theme";

type Props = {
  label: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function DateField({
  label,
  required,
  value,
  onChange,
  placeholder = "e.g. 15 Nov 2025",
}: Props) {
  return (
    <FormField label={label} required={required}>
      <View style={styles.inputRow}>
        <FormInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          style={styles.input}
        />
        <MaterialIcons
          name="event"
          size={22}
          color={theme.colors.gray50}
          style={styles.icon}
        />
      </View>
    </FormField>
  );
}

const styles = StyleSheet.create({
  inputRow: {
    position: "relative",
  },
  input: {
    paddingRight: 44,
  },
  icon: {
    position: "absolute",
    right: 12,
    top: 14,
  },
});
