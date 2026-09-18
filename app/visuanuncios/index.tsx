import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";

const { width } = Dimensions.get("window");

const API_URL = "http://127.0.0.1:8000";

export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const [solicitandoTroca, setSolicitandoTroca] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [meusProdutos, setMeusProdutos] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );

  const [favoritado, setFavoritado] = useState(false);
  const [carregandoFavorito, setCarregandoFavorito] = useState(false);

  // =========================================================
  // URL DAS IMAGENS
  // =========================================================

  const getImageUrl = (imagePath?: string | null) => {
    if (!imagePath) return null;

    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://")
    ) {
      return imagePath;
    }

    return `${API_URL}/storage/${imagePath}`;
  };

  // =========================================================
  // CONDIÇÃO DO PRODUTO
  // =========================================================

  const getCondicaoTexto = (condicao?: string) => {
    switch (condicao) {
      case "N":
        return "Novo";

      case "S":
        return "Seminovo";

      case "U":
        return "Usado";

      case "Q":
        return "Quebrado";

      default:
        return "Não informado";
    }
  };

  // =========================================================
  // BUSCAR PRODUTO
  // =========================================================

  useEffect(() => {
    buscarProduto();
  }, [id]);

  const buscarProduto = async () => {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/products/${id}`);

      if (!response.ok) {
        throw new Error("Não foi possível carregar o produto.");
      }

      const data = await response.json();

      console.log("🔥 PRODUTO DETALHADO:", JSON.stringify(data, null, 2));

      setProduct(data);

      verificarFavorito(data);
    } catch (error) {
      console.error("Erro ao buscar produto:", error);

      Alert.alert(
        "Erro",
        "Não foi possível carregar os dados do produto."
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // VERIFICAR FAVORITO
  // =========================================================

  const verificarFavorito = async (produtoAtual: any) => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token || !produtoAtual?.id_produto) {
        return;
      }

      const response = await fetch(`${API_URL}/api/favoritos`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      const favoritos = Array.isArray(data)
        ? data
        : data?.favoritos || data?.data || [];

      const encontrado = favoritos.some(
        (item: any) =>
          Number(item.id_produto) === Number(produtoAtual.id_produto) ||
          Number(item.produto?.id_produto) ===
            Number(produtoAtual.id_produto)
      );

      setFavoritado(encontrado);
    } catch (error) {
      console.error("Erro ao verificar favorito:", error);
    }
  };

  // =========================================================
  // FAVORITAR / DESFAVORITAR
  // =========================================================

  const handleFavorito = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Atenção",
          "Você precisa estar logado para favoritar um produto."
        );
        return;
      }

      if (!product?.id_produto) {
        return;
      }

      setCarregandoFavorito(true);

      if (favoritado) {
        const response = await fetch(
          `${API_URL}/api/favoritos/${product.id_produto}`,
          {
            method: "DELETE",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error("Erro ao remover dos favoritos.");
        }

        setFavoritado(false);
      } else {
        const response = await fetch(`${API_URL}/api/favoritos`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id_produto: Number(product.id_produto),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.log("Erro favorito:", errorText);

          throw new Error("Erro ao adicionar aos favoritos.");
        }

        setFavoritado(true);
      }
    } catch (error) {
      console.error("Erro favorito:", error);

      Alert.alert(
        "Erro",
        "Não foi possível atualizar os favoritos."
      );
    } finally {
      setCarregandoFavorito(false);
    }
  };

  // =========================================================
  // SOLICITAR TROCA
  // =========================================================

  const handleSolicitarTroca = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Atenção",
          "Você precisa estar logado para solicitar uma troca."
        );
        return;
      }

      if (!product?.id_produto) {
        return;
      }

      setSolicitandoTroca(true);

      const meusProdutosResponse = await fetch(
        `${API_URL}/api/my-products`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!meusProdutosResponse.ok) {
        const errorText = await meusProdutosResponse.text();

        console.log(
          "Erro ao buscar meus produtos:",
          errorText
        );

        throw new Error(
          "Não foi possível carregar seus produtos."
        );
      }

      const meusProdutosData = await meusProdutosResponse.json();

      console.log(
        "🔥 6 - MEUS PRODUTOS:",
        JSON.stringify(meusProdutosData, null, 2)
      );

      const produtos = Array.isArray(meusProdutosData)
        ? meusProdutosData
        : meusProdutosData?.products ||
          meusProdutosData?.produtos ||
          [];

      const produtosDisponiveis = produtos.filter(
        (item: any) =>
          item.st_status === "A" &&
          Number(item.id_produto) !== Number(product.id_produto)
      );

      if (produtosDisponiveis.length === 0) {
        Alert.alert(
          "Sem produtos disponíveis",
          "Você não possui outros produtos disponíveis para oferecer em uma troca."
        );

        return;
      }

      setMeusProdutos(produtosDisponiveis);
      setSelectedProductId(null);
      setModalVisible(true);
    } catch (error) {
      console.error("Erro ao solicitar troca:", error);

      Alert.alert(
        "Erro",
        "Não foi possível carregar seus produtos."
      );
    } finally {
      setSolicitandoTroca(false);
    }
  };

  // =========================================================
  // CONFIRMAR PROPOSTA
  // =========================================================

  const handleConfirmarTroca = async () => {
    try {
      if (!selectedProductId) {
        Alert.alert(
          "Atenção",
          "Selecione um produto para oferecer."
        );
        return;
      }

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Atenção",
          "Você precisa estar logado para realizar uma troca."
        );
        return;
      }

      const response = await fetch(`${API_URL}/api/propostas`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id_produto_desejado: Number(product.id_produto),
          id_produto_oferecido: Number(selectedProductId),
        }),
      });

      const data = await response.json();

      console.log(
        "🔥 RESPOSTA PROPOSTA:",
        JSON.stringify(data, null, 2)
      );

      if (!response.ok) {
        throw new Error(
          data?.message || "Não foi possível enviar a proposta."
        );
      }

      setModalVisible(false);
      setSelectedProductId(null);

      Alert.alert(
        "Sucesso",
        "Sua proposta de troca foi enviada!"
      );

      router.push("/trocas" as any);
    } catch (error: any) {
      console.error("Erro ao confirmar troca:", error);

      Alert.alert(
        "Erro",
        error?.message ||
          "Não foi possível enviar a proposta de troca."
      );
    }
  };

  // =========================================================
  // VISUALIZAR PERFIL DO VENDEDOR
  // =========================================================

  const handleVisualizarPerfil = () => {
    const idUsuario =
      product?.user?.id_usuario ??
      product?.user?.id ??
      product?.id_usuario ??
      product?.user_id;

    if (!idUsuario) {
      Alert.alert(
        "Erro",
        "Não foi possível identificar o usuário."
      );
      return;
    }

    router.push(
      `/visualizarperfil?id=${idUsuario}` as any
    );
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#0099FF"
        />

        <Text style={styles.loadingText}>
          Carregando produto...
        </Text>
      </View>
    );
  }

  // =========================================================
  // PRODUTO NÃO ENCONTRADO
  // =========================================================

  if (!product) {
    return (
      <View style={styles.loadingContainer}>
        <Feather
          name="package"
          size={50}
          color="#CCCCCC"
        />

        <Text style={styles.loadingText}>
          Produto não encontrado.
        </Text>
      </View>
    );
  }

  const images = product.images || [];

  const fotoPerfil =
    product?.user?.ds_foto_perfil ||
    product?.user?.ds_foto;

  const fotoPerfilUrl = getImageUrl(fotoPerfil);

  // =========================================================
  // TELA
  // =========================================================

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ================================================= */}
        {/* CABEÇALHO */}
        {/* ================================================= */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <Feather
              name="arrow-left"
              size={23}
              color="#005386"
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Detalhes do anúncio
          </Text>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleFavorito}
            disabled={carregandoFavorito}
          >
            {carregandoFavorito ? (
              <ActivityIndicator
                size="small"
                color="#0099FF"
              />
            ) : (
              <Ionicons
                name={
                  favoritado
                    ? "heart"
                    : "heart-outline"
                }
                size={25}
                color={
                  favoritado
                    ? "#0099FF"
                    : "#005386"
                }
              />
            )}
          </TouchableOpacity>
        </View>

        {/* ================================================= */}
        {/* IMAGENS DO PRODUTO */}
        {/* ================================================= */}

        <View style={styles.imageSection}>
          {images.length > 0 ? (
            <>
              <FlatList
                data={images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(
                  item: any,
                  index
                ) =>
                  String(
                    item.id_imagem_produto ??
                      item.id ??
                      index
                  )
                }
                onMomentumScrollEnd={(event) => {
                  const index = Math.round(
                    event.nativeEvent.contentOffset.x /
                      width
                  );

                  setActiveImageIndex(index);
                }}
                renderItem={({ item }) => {
                  const imagemUrl = getImageUrl(
                    item.ds_imagem
                  );

                  return (
                    <View style={styles.imageWrapper}>
                      {imagemUrl ? (
                        <Image
                          source={{
                            uri: imagemUrl,
                          }}
                          style={styles.productImage}
                          resizeMode="contain"
                        />
                      ) : (
                        <Feather
                          name="package"
                          size={60}
                          color="#CCCCCC"
                        />
                      )}
                    </View>
                  );
                }}
              />

              {images.length > 1 && (
                <View style={styles.pagination}>
                  {images.map(
                    (_: any, index: number) => (
                      <View
                        key={index}
                        style={[
                          styles.paginationDot,
                          index ===
                            activeImageIndex &&
                            styles.paginationDotActive,
                        ]}
                      />
                    )
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={styles.noImageContainer}>
              <Feather
                name="package"
                size={60}
                color="#CCCCCC"
              />

              <Text style={styles.noImageText}>
                Sem imagem
              </Text>
            </View>
          )}
        </View>

        {/* ================================================= */}
        {/* INFORMAÇÕES DO PRODUTO */}
        {/* ================================================= */}

        <View style={styles.productInfo}>
          <Text style={styles.productTitle}>
            {product.nm_produto}
          </Text>

          {product.categoria?.nm_categoria && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {product.categoria.nm_categoria}
              </Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Feather
                name="check-circle"
                size={17}
                color="#0099FF"
              />

              <Text style={styles.infoText}>
                {getCondicaoTexto(
                  product.st_condicao
                )}
              </Text>
            </View>
          </View>

          {product.ds_produto && (
            <>
              <Text style={styles.sectionTitle}>
                Descrição
              </Text>

              <Text style={styles.description}>
                {product.ds_produto}
              </Text>
            </>
          )}
        </View>

        {/* ================================================= */}
        {/* VENDEDOR */}
        {/* ================================================= */}

        {product.user && (
          <View style={styles.sellerSection}>
            <Text style={styles.sectionTitle}>
              Anunciante
            </Text>

            <TouchableOpacity
              style={styles.sellerCard}
              activeOpacity={0.7}
              onPress={handleVisualizarPerfil}
            >
              <View style={styles.sellerImageContainer}>
                {fotoPerfilUrl ? (
                  <Image
                    source={{
                      uri: fotoPerfilUrl,
                    }}
                    style={styles.userProfileImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Feather
                    name="user"
                    size={22}
                    color="#0099FF"
                  />
                )}
              </View>

              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>
                  {product.user.nm_usuario}
                </Text>

                <Text style={styles.sellerAction}>
                  Visualizar perfil
                </Text>
              </View>

              <Feather
                name="chevron-right"
                size={22}
                color="#0099FF"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* ================================================= */}
        {/* BOTÃO TROCA */}
        {/* ================================================= */}

        <View style={styles.exchangeSection}>
          <TouchableOpacity
            style={styles.exchangeButton}
            activeOpacity={0.8}
            onPress={handleSolicitarTroca}
            disabled={solicitandoTroca}
          >
            {solicitandoTroca ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <>
                <Feather
                  name="repeat"
                  size={20}
                  color="#FFFFFF"
                />

                <Text style={styles.exchangeButtonText}>
                  Solicitar troca
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* =================================================== */}
      {/* MODAL DE SOLICITAR TROCA */}
      {/* =================================================== */}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() =>
          setModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          {/* FUNDO CLICÁVEL */}

          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() =>
              setModalVisible(false)
            }
          />

          {/* CONTEÚDO */}

          <View style={styles.modalContent}>
            {/* =========================================== */}
            {/* CABEÇALHO DO MODAL */}
            {/* =========================================== */}

            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() =>
                  setModalVisible(false)
                }
                style={styles.modalBackButton}
              >
                <Feather
                  name="arrow-left"
                  size={22}
                  color="#005386"
                />
              </TouchableOpacity>

              <Text
                style={styles.modalHeaderTitle}
              >
                Solicitar Troca
              </Text>

              <View style={styles.modalHeaderSpacer} />
            </View>

            {/* =========================================== */}
            {/* LISTA */}
            {/* =========================================== */}

            <FlatList
              data={meusProdutos}
              keyExtractor={(item) =>
                String(item.id_produto)
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                styles.modalListContent
              }
              ListHeaderComponent={
                <View>
                  {/* ===================================== */}
                  {/* PRODUTO DESEJADO */}
                  {/* ===================================== */}

                  <View
                    style={
                      styles.targetProductCard
                    }
                  >
                    <View
                      style={
                        styles.targetImageContainer
                      }
                    >
                      {(() => {
                        const imagemProduto =
                          product?.images?.[0]
                            ?.ds_imagem;

                        const imagemUrl =
                          getImageUrl(
                            imagemProduto
                          );

                        if (imagemUrl) {
                          return (
                            <Image
                              source={{
                                uri: imagemUrl,
                              }}
                              style={
                                styles.targetProductImage
                              }
                              resizeMode="cover"
                            />
                          );
                        }

                        return (
                          <Feather
                            name="package"
                            size={22}
                            color="#0099FF"
                          />
                        );
                      })()}
                    </View>

                    <View
                      style={styles.targetInfo}
                    >
                      <Text
                        style={
                          styles.targetLabel
                        }
                      >
                        Você deseja:
                      </Text>

                      <Text
                        style={
                          styles.targetTitle
                        }
                        numberOfLines={1}
                      >
                        {product.nm_produto}
                      </Text>

                      <Text
                        style={
                          styles.targetCondition
                        }
                      >
                        {getCondicaoTexto(
                          product.st_condicao
                        )}
                      </Text>
                    </View>
                  </View>

                  {/* ===================================== */}
                  {/* DIVISÓRIA */}
                  {/* ===================================== */}

                  <View
                    style={styles.modalDivider}
                  />

                  {/* ===================================== */}
                  {/* TÍTULO DOS PRODUTOS DO USUÁRIO */}
                  {/* ===================================== */}

                  <Text
                    style={
                      styles.modalSectionTitle
                    }
                  >
                    Selecione o item que você vai
                    oferecer:
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected =
                  selectedProductId ===
                  String(item.id_produto);

                const imagemProduto =
                  item.images?.[0]?.ds_imagem ||
                  item.imagens?.[0]?.ds_imagem ||
                  item.ds_imagem ||
                  item.imagem;

                const imagemUrl =
                  getImageUrl(imagemProduto);

                return (
                  <TouchableOpacity
                    style={[
                      styles.myProductCard,
                      isSelected &&
                        styles.myProductCardSelected,
                    ]}
                    activeOpacity={0.7}
                    onPress={() =>
                      setSelectedProductId(
                        String(
                          item.id_produto
                        )
                      )
                    }
                  >
                    {/* FOTO DO PRODUTO */}

                    <View
                      style={
                        styles.myProductImageContainer
                      }
                    >
                      {imagemUrl ? (
                        <Image
                          source={{
                            uri: imagemUrl,
                          }}
                          style={
                            styles.myProductImage
                          }
                          resizeMode="cover"
                        />
                      ) : (
                        <Feather
                          name="package"
                          size={22}
                          color="#0099FF"
                        />
                      )}
                    </View>

                    {/* INFORMAÇÕES */}

                    <View
                      style={styles.myProductInfo}
                    >
                      <Text
                        style={
                          styles.myProductTitle
                        }
                        numberOfLines={1}
                      >
                        {item.nm_produto}
                      </Text>

                      <Text
                        style={
                          styles.myProductCondition
                        }
                      >
                        {getCondicaoTexto(
                          item.st_condicao
                        )}
                      </Text>
                    </View>

                    {/* CHECKBOX */}

                    <View
                      style={[
                        styles.checkbox,
                        isSelected &&
                          styles.checkboxSelected,
                      ]}
                    >
                      {isSelected && (
                        <Feather
                          name="check"
                          size={13}
                          color="#FFFFFF"
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            {/* =========================================== */}
            {/* RODAPÉ */}
            {/* =========================================== */}

            <View
              style={
                styles.modalFooterContainer
              }
            >
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  !selectedProductId &&
                    styles.confirmButtonDisabled,
                ]}
                activeOpacity={0.8}
                disabled={!selectedProductId}
                onPress={handleConfirmarTroca}
              >
                <Text
                  style={
                    styles.confirmButtonText
                  }
                >
                  Confirmar Proposta
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =============================================================
// ESTILOS
// =============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  scrollContent: {
    paddingBottom: 30,
  },

  // ===========================================================
  // LOADING
  // ===========================================================

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  loadingText: {
    marginTop: 12,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#777777",
  },

  // ===========================================================
  // HEADER
  // ===========================================================

  header: {
    height: 62,
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

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: "#005386",
  },

  // ===========================================================
  // IMAGENS
  // ===========================================================

  imageSection: {
    width: "100%",
    height: width * 0.82,
    backgroundColor: "#F8F8F8",
  },

  imageWrapper: {
    width: width,
    height: width * 0.82,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F8F8",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  noImageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  noImageText: {
    marginTop: 8,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: "#999999",
  },

  pagination: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#CCCCCC",
    marginHorizontal: 3,
  },

  paginationDotActive: {
    width: 20,
    backgroundColor: "#0099FF",
  },

  // ===========================================================
  // PRODUTO
  // ===========================================================

  productInfo: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  productTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 22,
    color: "#005386",
    marginBottom: 10,
  },

  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E4F8FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },

  categoryText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    color: "#0099FF",
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },

  infoItem: {
    flexDirection: "row",
    alignItems: "center",
  },

  infoText: {
    marginLeft: 7,
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: "#555555",
  },

  sectionTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: "#005386",
    marginBottom: 10,
  },

  description: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: "#555555",
  },

  // ===========================================================
  // VENDEDOR
  // ===========================================================

  sellerSection: {
    paddingHorizontal: 20,
    marginTop: 25,
  },

  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FCFF",
    borderWidth: 1,
    borderColor: "#E1F3FF",
    borderRadius: 12,
    padding: 12,
  },

  sellerImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  userProfileImage: {
    width: "100%",
    height: "100%",
  },

  sellerInfo: {
    flex: 1,
    marginLeft: 12,
  },

  sellerName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: "#005386",
  },

  sellerAction: {
    marginTop: 3,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#0099FF",
  },

  // ===========================================================
  // TROCA
  // ===========================================================

  exchangeSection: {
    paddingHorizontal: 20,
    marginTop: 25,
  },

  exchangeButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: "#0099FF",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  exchangeButtonText: {
    marginLeft: 8,
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },

  // ===========================================================
  // MODAL
  // ===========================================================

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },

  modalBackdropTouch: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  modalContent: {
    width: "100%",
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },

  // ===========================================================
  // HEADER MODAL
  // ===========================================================

  modalHeader: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },

  modalBackButton: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },

  modalHeaderTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: "#005386",
  },

  modalHeaderSpacer: {
    width: 30,
  },

  // ===========================================================
  // LISTA DO MODAL
  // ===========================================================

  modalListContent: {
    padding: 20,
    paddingBottom: 20,
  },

  // ===========================================================
  // PRODUTO DESEJADO
  // ===========================================================

  targetProductCard: {
    flexDirection: "row",
    backgroundColor: "#E4F8FF",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0099FF",
  },

  targetImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  targetProductImage: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
  },

  targetInfo: {
    marginLeft: 10,
    flex: 1,
  },

  targetLabel: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#005386",
    marginBottom: 2,
  },

  targetTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
    color: "#005386",
  },

  targetCondition: {
    marginTop: 3,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#0099FF",
  },

  // ===========================================================
  // DIVISÓRIA
  // ===========================================================

  modalDivider: {
    height: 1,
    backgroundColor: "#EEEEEE",
    marginVertical: 14,
  },

  modalSectionTitle: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#005386",
    marginBottom: 10,
  },

  // ===========================================================
  // PRODUTOS DO USUÁRIO
  // ===========================================================

  myProductCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    marginBottom: 8,
  },

  myProductCardSelected: {
    borderColor: "#0099FF",
    backgroundColor: "#E4F8FF",
  },

  myProductImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },

  myProductImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },

  myProductInfo: {
    marginLeft: 10,
    flex: 1,
  },

  myProductTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#333333",
  },

  myProductCondition: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
  },

  // ===========================================================
  // CHECKBOX
  // ===========================================================

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#CCCCCC",
    justifyContent: "center",
    alignItems: "center",
  },

  checkboxSelected: {
    backgroundColor: "#0099FF",
    borderColor: "#0099FF",
  },

  // ===========================================================
  // RODAPÉ MODAL
  // ===========================================================

  modalFooterContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    backgroundColor: "#FFFFFF",
  },

  confirmButton: {
    backgroundColor: "#0099FF",
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  confirmButtonDisabled: {
    backgroundColor: "#B3E5FF",
  },

  confirmButtonText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
});