import React from "react";
import { Text as RNText, TextProps } from "react-native";

type Props = TextProps & {
  variant?: "title" | "subtitle" | "body";
};

export function Text({ variant = "body", style, ...rest }: Props) {
  let fontFamily = "Montserrat_400Regular";

  if (variant === "title") {
    fontFamily = "Montserrat_700Bold";
  }

  if (variant === "subtitle") {
    fontFamily = "Montserrat_600SemiBold";
  }

  return <RNText {...rest} style={[{ fontFamily }, style]} />;
}