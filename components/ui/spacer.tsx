import { View } from "react-native";

const RowSpacer = (props: { numberOfSpaces: number }) => {
  const { numberOfSpaces } = props;
  return (
    <View
      style={{
        width: numberOfSpaces * 4,
      }}
    />
  );
};

const ColumnSpacer = (props: { numberOfSpaces: number }) => {
  const { numberOfSpaces } = props;
  return (
    <View
      style={{
        height: numberOfSpaces * 4,
      }}
    />
  );
};

export const Spacer = {
  Row: RowSpacer,
  Column: ColumnSpacer,
};
