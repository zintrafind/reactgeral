import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import api from "../../services/api";

const { width } = Dimensions.get("window");

const itemWidth = (width - 44) / 2;

export default function FavoritosScreen() {
  const router = useRouter();

  const [favoritos, setFavoritos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ============================================================
  // CARREGAR FAVORITOS
  // ============================================================

  const carregarFavoritos = async () => {
    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        setFavoritos([]);
        return;
      }

      const response = await api.get("/favoritos", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("FAVORITOS CARREGADOS:", response.data);

      const dados = Array.isArray(response.data)
        ? response.data
        : response.data?.favoritos ||
          response.data?.data ||
          [];

      setFavoritos(dados);
    } catch (error: any) {
      console.log(
        "ERRO AO CARREGAR FAVORITOS:",
        error?.response?.data || error
      );

      setFavoritos([]);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CARREGAR SEMPRE QUE A TELA RECEBER FOCO
  // ============================================================

  useFocusEffect(
    useCallback(() => {
      carregarFavoritos();
    }, [])
  );

  // ============================================================
  // MONTAR URL DA IMAGEM
  // ============================================================

const getImageUrl = (imagePath?: string | null) => {
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

  const baseUrl =
    api.defaults.baseURL?.replace(
      /\/api\/?$/,
      ""
    ) || "http://127.0.0.1:8000";

  const cleanPath = path
    .replace(/^\/+/, "")
    .replace(/^storage\/+/, "");

  return `${baseUrl}/storage/${cleanPath}`;
};

  // ============================================================
  // CONDIÇÃO DO PRODUTO
  // ============================================================

  const getConditionLabel = (condition: any) => {
    const valor = String(condition || "")
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

  // ============================================================
  // REMOVER DOS FAVORITOS
  // ============================================================

  const removerFavorito = async (idProduto: number) => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        return;
      }

      await api.delete(`/favoritos/${idProduto}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Remove imediatamente da tela
      setFavoritos((listaAtual) =>
        listaAtual.filter(
          (item) =>
            Number(item.id_produto) !== Number(idProduto)
        )
      );
    } catch (error: any) {
      console.log(
        "ERRO AO REMOVER FAVORITO:",
        error?.response?.data || error
      );
    }
  };

  // ============================================================
  // ABRIR PRODUTO
  // ============================================================

  const abrirProduto = (idProduto: number) => {
    router.push({
      pathname: "/visuanuncios",
      params: {
        id: String(idProduto),
      },
    } as any);
  };

  // ============================================================
  // RENDERIZAR ITEM
  // ============================================================

  const renderFavorito = ({ item }: { item: any }) => {
    const productId = item.id_produto;

    const nomeProduto =
      item.nm_produto || "Produto sem nome";

    const categoria =
      item.nm_categoria ||
      item.categoria?.nm_categoria ||
      "Sem categoria";

    const imagemPath =
      item.ds_imagem ||
      item.imagem ||
      item.image ||
      item.images?.[0]?.ds_imagem ||
      item.produto?.images?.[0]?.ds_imagem ||
      null;

    const imagemUrl = getImageUrl(imagemPath);

    return (
      <TouchableOpacity
        style={styles.listingCard}
        activeOpacity={0.85}
        onPress={() => abrirProduto(productId)}
      >
        {/* ====================================================
            IMAGEM
        ==================================================== */}

        <View style={styles.imagePlaceholder}>
          {imagemUrl ? (
            <Image
              source={{
                uri: imagemUrl,
              }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <Feather
              name="package"
              size={38}
              color="#0099FF"
            />
          )}

          {/* CORAÇÃO */}

          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(event) => {
              event.stopPropagation();

              removerFavorito(Number(productId));
            }}
            hitSlop={{
              top: 10,
              bottom: 10,
              left: 10,
              right: 10,
            }}
          >
            <Ionicons
              name="heart"
              size={20}
              color="#FF0000"
            />
          </TouchableOpacity>
        </View>

        {/* ====================================================
            INFORMAÇÕES
        ==================================================== */}

        <View style={styles.textContainer}>
          <Text
            style={styles.listingTitle}
            numberOfLines={1}
          >
            {nomeProduto}
          </Text>

          <Text
            style={styles.listingCategory}
            numberOfLines={1}
          >
            {categoria}
          </Text>

          {/* CONDIÇÃO */}

          <Text style={styles.listingCondition}>
            {getConditionLabel(item.st_condicao)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // ============================================================
  // TELA
  // ============================================================

  return (
    <View style={styles.container}>
      {/* ======================================================
          HEADER
      ====================================================== */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          style={styles.backBtn}
        >
          <Feather
            name="arrow-left"
            size={24}
            color="#005386"
          />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>
            Favoritos
          </Text>
        </View>

        <View style={styles.headerButtonPlaceholder} />
      </View>

      {/* ======================================================
          LISTA
      ====================================================== */}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#0099FF"
          />

          <Text style={styles.loadingText}>
            Carregando favoritos...
          </Text>
        </View>
      ) : favoritos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons
              name="heart-outline"
              size={45}
              color="#0099FF"
            />
          </View>

          <Text style={styles.emptyTitle}>
            Nenhum favorito ainda
          </Text>

          <Text style={styles.emptyText}>
            Os itens que você favoritar
            aparecerão aqui.
          </Text>

          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => router.replace("/")}
          >
            <Feather
              name="search"
              size={17}
              color="#FFFFFF"
            />

            <Text style={styles.exploreButtonText}>
              Explorar itens
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favoritos}
          keyExtractor={(item, index) =>
            String(
              item.id_favorito ||
                item.id_produto ||
                index
            )
          }
          renderItem={renderFavorito}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  // ==========================================================
  // HEADER
  // ==========================================================

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

  // CORRIGIDO:
  // O componente usa styles.backBtn, então ele precisa
  // existir dentro do StyleSheet.

  backBtn: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },

  headerButton: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },

  headerButtonPlaceholder: {
    width: 38,
    height: 38,
  },

  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#005386",
    marginLeft: 7,
  },

  // ==========================================================
  // LISTA
  // ==========================================================

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 30,
  },

  gridRow: {
    justifyContent: "space-between",
  },

  // ==========================================================
  // CARD
  // ==========================================================

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

  // ==========================================================
  // IMAGEM
  // ==========================================================

  imagePlaceholder: {
    width: "100%",
    height: itemWidth,
    backgroundColor: "#F5FBFF",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  // ==========================================================
  // CORAÇÃO DO CARD
  // ==========================================================

  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },

  // ==========================================================
  // INFORMAÇÕES
  // ==========================================================

  textContainer: {
    paddingHorizontal: 9,
    paddingVertical: 9,
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

  listingCondition: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
    marginTop: 3,
  },

  // ==========================================================
  // LOADING
  // ==========================================================

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  loadingText: {
    marginTop: 12,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#777777",
  },

  // ==========================================================
  // LISTA VAZIA
  // ==========================================================

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 35,
  },

  emptyIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#005386",
    textAlign: "center",
  },

  emptyText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#777777",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },

  exploreButton: {
    marginTop: 22,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#0099FF",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  exploreButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
    marginLeft: 7,
  },
});