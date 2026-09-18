import {
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const itemWidth = (width - 44) / 2;

const API_URL = "http://127.0.0.1:8000";

/* ================================================================
   TIPAGEM DO PRODUTO
================================================================ */

interface Produto {
  id_produto: number;
  id_usuario?: number;
  id_categoria?: number;
  nm_produto?: string;
  ds_produto?: string | null;
  st_condicao?: string;
  st_status?: string;

  categoria?: {
    nm_categoria?: string;
    ds_categoria?: string;
    nome?: string;
  };

  images?: {
    ds_imagem: string;
  }[];

  imagem?: {
    ds_imagem: string;
  };
}

/* ================================================================
   TIPAGEM DO USUÁRIO
================================================================ */

interface UserProfileData {
  id_usuario?: number | string;
  name: string;
  description: string;
  rating: string;
  fotoPerfil: string | null;
  banner: string | null;
}

type TabType = "anuncios" | "trocados";

/* ================================================================
   TELA
================================================================ */

export default function VisualizarPerfilScreen() {
  const router = useRouter();

  const { id } = useLocalSearchParams();

  /* ==============================================================
     USUÁRIO
  ============================================================== */

  const [user, setUser] = useState<UserProfileData>({
    id_usuario: undefined,
    name: "",
    description: "",
    rating: "5.0",
    fotoPerfil: null,
    banner: null,
  });

  /* ==============================================================
     PRODUTOS
  ============================================================== */

  const [userProducts, setUserProducts] = useState<Produto[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  /* ==============================================================
     ABA
  ============================================================== */

  const [activeTab, setActiveTab] =
    useState<TabType>("anuncios");

  /* ==============================================================
     BLOQUEIO
  ============================================================== */

  const [bloqueando, setBloqueando] = useState(false);

  /* ==============================================================
     CARREGAR PERFIL
  ============================================================== */

  useEffect(() => {
    const carregarPerfil = async () => {
      try {
        if (!id) {
          return;
        }

        const token =
          await AsyncStorage.getItem("token");

        const response = await fetch(
          `${API_URL}/api/users/${id}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",

              ...(token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : {}),
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              "Não foi possível carregar o perfil."
          );
        }

        const usuario =
          data?.user ||
          data?.usuario ||
          data?.data ||
          data;

        if (!usuario) {
          return;
        }

        setUser({
          id_usuario:
            usuario?.id_usuario ||
            usuario?.id ||
            id,

          name:
            usuario?.nm_usuario ||
            usuario?.nome ||
            usuario?.name ||
            "Usuário",

          description:
            usuario?.ds_usuario ||
            usuario?.ds_biografia ||
            usuario?.ds_bio ||
            usuario?.biografia ||
            usuario?.bio ||
            "Descrição não informada",

          rating:
            usuario?.rating ||
            usuario?.avaliacao ||
            "5.0",

          fotoPerfil:
            usuario?.ds_foto_perfil ||
            usuario?.ds_foto ||
            usuario?.foto_perfil ||
            usuario?.foto ||
            null,

          banner:
            usuario?.ds_banner ||
            usuario?.banner ||
            null,
        });
      } catch (error) {
        console.error(
          "ERRO AO CARREGAR PERFIL:",
          error
        );
      }
    };

    carregarPerfil();
  }, [id]);

  /* ==============================================================
     CARREGAR PRODUTOS DO USUÁRIO
  ============================================================== */

  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        if (!id) {
          return;
        }

        setLoadingProducts(true);

        const token =
          await AsyncStorage.getItem("token");

        const response = await fetch(
          `${API_URL}/api/users/${id}/products`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",

              ...(token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : {}),
            },
          }
        );

        if (!response.ok) {
          setUserProducts([]);
          return;
        }

        const data = await response.json();

        const produtos =
          Array.isArray(data)
            ? data
            : data?.products ||
              data?.produtos ||
              data?.data ||
              [];

        setUserProducts(produtos);
      } catch (error) {
        console.error(
          "ERRO AO CARREGAR ANÚNCIOS:",
          error
        );

        setUserProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    carregarProdutos();
  }, [id]);

  /* ==============================================================
     BLOQUEAR USUÁRIO
  ============================================================== */

  const bloquearUsuario = () => {
    const idUsuarioBloqueado = Number(
      user.id_usuario || id
    );
  
    if (!idUsuarioBloqueado) {
      Alert.alert(
        "Erro",
        "Não foi possível identificar este usuário."
      );
      return;
    }
  
    console.log(
      "USUÁRIO QUE SERÁ BLOQUEADO:",
      idUsuarioBloqueado
    );
  
    if (Platform.OS === "web") {
      const confirmou = window.confirm(
        `Tem certeza que deseja bloquear ${user.name}?`
      );
  
      if (confirmou) {
        confirmarBloqueio();
      }
  
      return;
    }
  
    Alert.alert(
      "Bloquear usuário",
      `Tem certeza que deseja bloquear ${user.name}?`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Bloquear",
          style: "destructive",
          onPress: confirmarBloqueio,
        },
      ]
    );
  };

  /* ==============================================================
     CONFIRMAR BLOQUEIO
  ============================================================== */

  const confirmarBloqueio = async () => {
    const idUsuarioBloqueado = Number(
      user.id_usuario || id
    );

    if (!idUsuarioBloqueado) {
      Alert.alert(
        "Erro",
        "Não foi possível identificar este usuário."
      );
      return;
    }

    try {
      setBloqueando(true);

      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Erro",
          "Você precisa estar logado para bloquear um usuário."
        );
        return;
      }

      console.log(
        "ENVIANDO BLOQUEIO:",
        idUsuarioBloqueado
      );

      const response = await fetch(
        `${API_URL}/api/bloqueios`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id_usuario_bloqueado:
              idUsuarioBloqueado,
          }),
        }
      );

      const data = await response.json();

      console.log(
        "RESPOSTA BLOQUEIO:",
        response.status,
        data
      );

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Não foi possível bloquear este usuário."
        );
      }

      Alert.alert(
        "Sucesso",
        data?.message ||
          "Usuário bloqueado com sucesso.",
        [
          {
            text: "OK",
            onPress: () => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)");
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error(
        "ERRO AO BLOQUEAR USUÁRIO:",
        error
      );

      Alert.alert(
        "Erro",
        error instanceof Error
          ? error.message
          : "Não foi possível bloquear este usuário."
      );
    } finally {
      setBloqueando(false);
    }
  };

  /* ==============================================================
     URL DA IMAGEM
  ============================================================== */

  const getImageUrl = (
    imagePath?: string | null
  ) => {
    if (!imagePath) {
      return null;
    }

    const path = String(imagePath).trim();

    if (!path) {
      return null;
    }

    if (
      path.startsWith("http://") ||
      path.startsWith("https://")
    ) {
      return path;
    }

    const cleanPath = path
      .replace(/^\/+/, "")
      .replace(/^storage\//, "");

    return `${API_URL}/storage/${cleanPath}`;
  };

  /* ==============================================================
     IMAGENS DO PERFIL
  ============================================================== */

  const fotoPerfilUrl =
    getImageUrl(user.fotoPerfil);

  const bannerUrl =
    getImageUrl(user.banner);

  /* ==============================================================
     CONDIÇÃO DO PRODUTO
  ============================================================== */

  const getConditionLabel = (
    condition: any
  ) => {
    const valor =
      String(condition || "")
        .trim()
        .toUpperCase();

    switch (valor) {
      case "N":
      case "NOVO":
        return "Novo";

      case "S":
      case "SEMI NOVO":
      case "SEMINOVO":
        return "Semi novo";

      case "U":
      case "USADO":
        return "Usado";

      case "Q":
      case "QUEBRADO":
        return "Quebrado";

      default:
        return "Não informado";
    }
  };

  /* ==============================================================
     CONTAGEM
  ============================================================== */

  const anunciosCount =
    userProducts.filter((item) => {
      const status =
        String(
          item?.st_status || ""
        ).toUpperCase();

      return (
        status === "A" ||
        status === "N"
      );
    }).length;

  const trocadosCount =
    userProducts.filter(
      (item) =>
        String(
          item?.st_status || ""
        ).toUpperCase() === "T"
    ).length;

  /* ==============================================================
     PRODUTOS EXIBIDOS
  ============================================================== */

  const displayedProducts =
    activeTab === "trocados"
      ? userProducts.filter(
          (item) =>
            String(
              item?.st_status || ""
            ).toUpperCase() === "T"
        )
      : userProducts.filter((item) => {
          const status =
            String(
              item?.st_status || ""
            ).toUpperCase();

          return (
            status === "A" ||
            status === "N"
          );
        });

  /* ==============================================================
     ABRIR PRODUTO
  ============================================================== */

  const handleOpenProduct = (
    produto: Produto
  ) => {
    const productId =
      produto?.id_produto;

    if (!productId) {
      return;
    }

    const status =
      String(
        produto?.st_status || ""
      ).toUpperCase();

    if (status === "T") {
      return;
    }

    router.push({
      pathname: "/visuanuncios",
      params: {
        id: String(productId),
      },
    } as any);
  };

  /* ==============================================================
     MENSAGEM DE LISTA VAZIA
  ============================================================== */

  const emptyMessage =
    activeTab === "trocados"
      ? `${user.name} ainda não possui anúncios trocados.`
      : `${user.name} ainda não possui anúncios cadastrados.`;

  /* ==============================================================
     RENDER
  ============================================================== */

  return (
    <SafeAreaView
      style={styles.container}
    >
      <StatusBar style="dark" />

      {/* ======================================================
          HEADER
      ====================================================== */}

      <View style={styles.header}>

        {/* BOTÃO VOLTAR */}

        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Feather
            name="arrow-left"
            size={24}
            color="#005386"
          />
        </TouchableOpacity>

        {/* BOTÃO BLOQUEAR */}

        <TouchableOpacity
          onPress={() => {
            console.log(
              "CLIQUEI NO BOTÃO DE BLOQUEAR"
            );

            bloquearUsuario();
          }}
          disabled={bloqueando}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="block-helper"
            size={23}
            color="#D9534F"
          />
        </TouchableOpacity>

      </View>

      {/* ======================================================
          LISTA
      ====================================================== */}

      <FlatList
        data={displayedProducts}

        keyExtractor={(item, index) =>
          String(
            item?.id_produto ||
              index
          )
        }

        numColumns={2}

        columnWrapperStyle={
          styles.gridRow
        }

        contentContainerStyle={
          styles.listContent
        }

        showsVerticalScrollIndicator={
          false
        }

        /* ====================================================
           CABEÇALHO DO PERFIL
        ==================================================== */

        ListHeaderComponent={
          <View>

            {/* BANNER */}

            <View
              style={
                styles.bannerContainer
              }
            >
              {bannerUrl ? (
                <Image
                  source={{
                    uri: bannerUrl,
                  }}
                  style={
                    styles.bannerImage
                  }
                />
              ) : (
                <View
                  style={
                    styles.bannerPlaceholder
                  }
                >
                  <Feather
                    name="image"
                    size={35}
                    color="#0099FF"
                  />
                </View>
              )}
            </View>

            {/* INFORMAÇÕES DO USUÁRIO */}

            <View
              style={
                styles.profileInfoContainer
              }
            >
              {/* FOTO */}

              <View
                style={
                  styles.roundAvatar
                }
              >
                {fotoPerfilUrl ? (
                  <Image
                    source={{
                      uri: fotoPerfilUrl,
                    }}
                    style={
                      styles.profileImage
                    }
                  />
                ) : (
                  <Feather
                    name="user"
                    size={45}
                    color="#005386"
                  />
                )}
              </View>

              {/* NOME E DESCRIÇÃO */}

              <View
                style={
                  styles.userInfoTextContainer
                }
              >
                <Text
                  style={
                    styles.userName
                  }
                >
                  {user.name}
                </Text>

                <View
                  style={
                    styles.addressRow
                  }
                >
                  <Feather
                    name="file-text"
                    size={12}
                    color="#0099FF"
                    style={
                      styles.addressIcon
                    }
                  />

                  <Text
                    style={
                      styles.userSubtext
                    }
                    numberOfLines={2}
                  >
                    {user.description}
                  </Text>
                </View>
              </View>
            </View>

            {/* AVALIAÇÃO */}

            <View
              style={
                styles.ratingContainer
              }
            >
              <View
                style={
                  styles.starsRow
                }
              >
                <Feather
                  name="star"
                  size={18}
                  color="#005386"
                  style={
                    styles.starIcon
                  }
                />

                <Feather
                  name="star"
                  size={18}
                  color="#005386"
                  style={
                    styles.starIcon
                  }
                />

                <Feather
                  name="star"
                  size={18}
                  color="#005386"
                  style={
                    styles.starIcon
                  }
                />

                <Feather
                  name="star"
                  size={18}
                  color="#005386"
                  style={
                    styles.starIcon
                  }
                />

                <Feather
                  name="star"
                  size={18}
                  color="#005386"
                />
              </View>

              <Text
                style={
                  styles.ratingText
                }
              >
                — {user.rating}
              </Text>
            </View>

            {/* ABAS */}

            <View
              style={
                styles.tabsContainer
              }
            >
              {/* ANÚNCIOS */}

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab ===
                    "anuncios" &&
                    styles.activeTab,
                ]}
                onPress={() =>
                  setActiveTab(
                    "anuncios"
                  )
                }
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab ===
                      "anuncios" &&
                      styles.activeTabText,
                  ]}
                >
                  Anúncios ({anunciosCount})
                </Text>
              </TouchableOpacity>

              {/* TROCADOS */}

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  styles.favoriteTabItem,
                  activeTab ===
                    "trocados" &&
                    styles.activeTab,
                ]}
                onPress={() =>
                  setActiveTab(
                    "trocados"
                  )
                }
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab ===
                      "trocados" &&
                      styles.activeTabText,
                  ]}
                >
                  Anúncios trocados ({trocadosCount})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }

        /* ====================================================
           LISTA VAZIA
        ==================================================== */

        ListEmptyComponent={
          loadingProducts ? (
            <ActivityIndicator
              size="large"
              color="#0099FF"
              style={{
                marginTop: 30,
              }}
            />
          ) : (
            <Text
              style={
                styles.emptyText
              }
            >
              {emptyMessage}
            </Text>
          )
        }

        /* ====================================================
           CARD
        ==================================================== */

        renderItem={({
          item,
        }) => {
          const primeiraImagem =
            item?.images?.[0]
              ?.ds_imagem ||
            item?.imagem
              ?.ds_imagem;

          const imagemUrl =
            getImageUrl(
              primeiraImagem
            );

          const categoriaNome =
            item?.categoria
              ?.nm_categoria ||
            item?.categoria
              ?.ds_categoria ||
            item?.categoria
              ?.nome ||
            "Sem categoria";

          const isTrocado =
            String(
              item?.st_status || ""
            ).toUpperCase() === "T";

          return (
            <TouchableOpacity
              style={
                styles.listingCard
              }
              disabled={isTrocado}
              onPress={() => {
                if (!isTrocado) {
                  handleOpenProduct(
                    item
                  );
                }
              }}
              activeOpacity={
                isTrocado ? 1 : 0.8
              }
            >
              {/* IMAGEM */}

              <View
                style={
                  styles.imagePlaceholder
                }
              >
                {imagemUrl ? (
                  <Image
                    source={{
                      uri: imagemUrl,
                    }}
                    style={
                      styles.productImage
                    }
                  />
                ) : (
                  <Feather
                    name="package"
                    size={32}
                    color="#0099FF"
                  />
                )}
              </View>

              {/* TEXTO */}

              <View
                style={
                  styles.textPlaceholderRow
                }
              >
                <Text
                  style={
                    styles.listingTitle
                  }
                  numberOfLines={1}
                >
                  {item?.nm_produto ||
                    "Produto"}
                </Text>

                <Text
                  style={
                    styles.listingCategory
                  }
                  numberOfLines={1}
                >
                  {categoriaNome}
                </Text>

                <View
                  style={
                    styles.cardFooterRow
                  }
                >
                  <Text
                    style={
                      styles.listingPrice
                    }
                  >
                    {getConditionLabel(
                      item?.st_condicao
                    )}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

/* ================================================================
   ESTILOS
================================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },

  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  bannerContainer: {
    width: "100%",
    height: 150,
    marginTop: 15,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#E4F8FF",
  },

  bannerImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  bannerPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E4F8FF",
  },

  profileInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },

  roundAvatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#0099FF",
    elevation: 3,
    overflow: "hidden",
  },

  profileImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  userInfoTextContainer: {
    marginLeft: 16,
    flex: 1,
  },

  userName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 19,
    color: "#005386",
  },

  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },

  addressIcon: {
    marginRight: 4,
  },

  userSubtext: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: "#777777",
    flex: 1,
  },

  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    paddingLeft: 4,
  },

  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  starIcon: {
    marginRight: 4,
  },

  ratingText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
    marginLeft: 8,
  },

  tabsContainer: {
    flexDirection: "row",
    marginVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    paddingBottom: 4,
  },

  tabItem: {
    marginRight: 24,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  favoriteTabItem: {
    marginRight: 8,
  },

  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#0099FF",
  },

  tabText: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: "#888",
  },

  activeTabText: {
    fontFamily: "Montserrat_700Bold",
    color: "#005386",
  },

  gridRow: {
    justifyContent: "space-between",
  },

  listingCard: {
    width: itemWidth,
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
    elevation: 2,
  },

  imagePlaceholder: {
    width: "100%",
    height: itemWidth,
    backgroundColor: "#F5FBFF",
    justifyContent: "center",
    alignItems: "center",
  },

  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },

  textPlaceholderRow: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },

  listingTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#333333",
  },

  listingCategory: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 11,
    color: "#0099FF",
    marginTop: 3,
  },

  cardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
  },

  listingPrice: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
  },

  emptyText: {
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
    color: "#888",
    marginTop: 40,
    fontSize: 14,
  },
});