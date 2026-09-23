import { Feather } from "@expo/vector-icons";
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from "@expo-google-fonts/montserrat";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Slot, useRouter, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useRef, useState } from "react";

export default function Layout() {
  const [loaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const [showSplash, setShowSplash] = useState(true);
  const [checkingSession, setCheckingSession] = useState(true);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    if (!loaded) {
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        setShowSplash(false);
      });
    }, 1800);

    return () => {
      clearTimeout(timer);
    };
  }, [loaded]);

  useEffect(() => {
    if (!loaded || showSplash) {
      return;
    }

    const verificarSessao = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const primeiroSegmento = segments[0];

        if (primeiroSegmento === "(auth)") {
          setCheckingSession(false);
          return;
        }

        if (!token) {
          router.replace("/login");
          return;
        }

        setCheckingSession(false);
      } catch (error) {
        console.log("Erro ao verificar sessão:", error);
        router.replace("/login");
      }
    };

    verificarSessao();
  }, [loaded, showSplash, segments]);

  if (!loaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="small"
          color="#0099FF"
        />
      </View>
    );
  }

  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <Animated.Image
          source={require("../assets/images/logogrande.png")}
          style={[
            styles.splashLogo,
            {
              opacity: opacity,
              transform: [
                {
                  scale: scale,
                },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </View>
    );
  }

  if (checkingSession) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="small"
          color="#0099FF"
        />
      </View>
    );
  }

  const primeiroSegmento = segments[0];

  const estaNoAuth =
    primeiroSegmento === "(auth)";

  const pathnameAtual =
    segments.join("/");

  const isHome =
    pathnameAtual === "(tabs)" ||
    pathnameAtual === "(tabs)/index";

  const isAnnounce =
    pathnameAtual === "(tabs)/announce";

  const isMensagens =
    pathnameAtual === "mensagens";

  const isTrocas =
    pathnameAtual === "trocas";

  const isPerfil =
    pathnameAtual === "perfil";

  const showNavigation =
    !estaNoAuth &&
    (
      isHome ||
      isAnnounce ||
      isMensagens ||
      isTrocas ||
      isPerfil
    );

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Slot />
      </View>

      {showNavigation && (
        <View
          style={[
            styles.bottomNav,
            {
              height: 60 + insets.bottom,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          <TouchableOpacity
            style={styles.navItem}
            onPress={() =>
              router.replace("/(tabs)")
            }
            activeOpacity={0.7}
          >
            <Feather
              name="home"
              size={24}
              color={
                isHome
                  ? "#005386"
                  : "#777777"
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() =>
              router.push("/mensagens")
            }
            activeOpacity={0.7}
          >
            <Feather
              name="message-square"
              size={24}
              color={
                isMensagens
                  ? "#005386"
                  : "#777777"
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItemCenter}
            onPress={() =>
              router.push(
                "/(tabs)/announce"
              )
            }
            activeOpacity={0.8}
          >
            <Feather
              name="plus"
              size={26}
              color="#FFFFFF"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() =>
              router.push("/trocas")
            }
            activeOpacity={0.7}
          >
            <Feather
              name="repeat"
              size={24}
              color={
                isTrocas
                  ? "#005386"
                  : "#777777"
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() =>
              router.push("/perfil")
            }
            activeOpacity={0.7}
          >
            <Feather
              name="user"
              size={24}
              color={
                isPerfil
                  ? "#005386"
                  : "#777777"
              }
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  splashContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  splashLogo: {
    width: 280,
    height: 280,
  },

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    flex: 1,
  },

  bottomNav: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },

  navItem: {
    flex: 1,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
  },

  navItemCenter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0099FF",
    justifyContent: "center",
    alignItems: "center",
  },
});