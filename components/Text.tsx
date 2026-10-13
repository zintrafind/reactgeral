import React from "react";
import {
  Text as RNText,
  TextProps,
} from "react-native";

type Props = TextProps & {
  variant?: "title" | "subtitle" | "body";
};

export function Text({
  variant = "body",
  style,
  ...rest
}: Props) {
  const fontFamily =
    variant === "title"
      ? "Montserrat_700Bold"
      : variant === "subtitle"
      ? "Montserrat_600SemiBold"
      : "Montserrat_400Regular";

  return (
    <RNText
      {...rest}
      style={[
        {
          fontFamily,
          includeFontPadding: false,
        },
        style,
      ]}
    />
  );
}