import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";

const { width } = Dimensions.get("window");
const itemWidth = (width - 44) / 2;

interface UserProfileData {
  id_usuario?: number | string;
  name: string;
  description: string;
  rating: string;
  fotoPerfil: string | null;
  banner: string | null;
}

type TabType = "anuncios" | "trocados" | "favoritos";

export default function ProfileScreen() {
  const router = useRouter();

  const [user, setUser] = useState<UserProfileData>({
    id_usuario: undefined,
    name: "",
    description: "",
    rating: "5.0",
    fotoPerfil: null,
    banner: null,
  });

  // ============================================================
  // ANÚNCIOS
  // ============================================================

  const [userProducts, setUserProducts] = useState<any[]>([]);
  const [tradedProducts, setTradedProducts] = useState<any[]>([]);

  const [loadingProducts, setLoadingProducts] =
    useState(true);

  // ============================================================
  // ABA ATUAL
  // ============================================================

  const [activeTab, setActiveTab] =
    useState<TabType>("anuncios");

  // ============================================================
  // MODAIS
  // ============================================================

  const [logoutModalVisible, setLogoutModalVisible] =
    useState(false);

  const [selectedAd, setSelectedAd] =
    useState<any>(null);

  const [optionsModalVisible, setOptionsModalVisible] =
    useState(false);

  const [deleteModalVisible, setDeleteModalVisible] =
    useState(false);

  const [statusModalVisible, setStatusModalVisible] =
    useState(false);

  // ============================================================
  // URL DAS IMAGENS
  // ============================================================

  function getImageUrl(
    imagePath?: string | null
  ): string | null {
    if (!imagePath) {
      return null;
    }

    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://")
    ) {
      return imagePath;
    }

    const baseUrl =
      api.defaults.baseURL?.replace(
        /\/api\/?$/,
        ""
      ) || "http://127.0.0.1:8000";

    const normalizedPath = imagePath
      .replace(/^\/+/, "")
      .replace(/^storage\/+/, "");

    return `${baseUrl}/storage/${normalizedPath}`;
  }

  // ============================================================
  // CARREGAR AO ENTRAR / VOLTAR PARA A TELA
  // ============================================================

  useFocusEffect(
    useCallback(() => {
      carregarUsuario();
      fetchUserProducts();
      fetchTradedProducts();
    }, [])
  );

  // ============================================================
  // CARREGAR USUÁRIO
  // ============================================================

  async function carregarUsuario() {
    try {
      const dados =
        await AsyncStorage.getItem("usuario");

      if (!dados) {
        console.log(
          "Nenhum usuário encontrado no AsyncStorage."
        );
        return;
      }

      const usuarioStorage =
        JSON.parse(dados);

      console.log(
        "USUARIO DO STORAGE:",
        usuarioStorage
      );

      // ----------------------------------------------------------
      // PRIMEIRO: mostra imediatamente o que estiver no storage
      // ----------------------------------------------------------

      setUser({
        id_usuario:
          usuarioStorage.id_usuario ||
          usuarioStorage.id ||
          undefined,

        name:
          usuarioStorage.nm_usuario ||
          "",

        description:
          usuarioStorage.ds_usuario ||
          "Descrição não informada",

        rating: "5.0",

        fotoPerfil:
          usuarioStorage.ds_foto_perfil ||
          null,

        banner:
          usuarioStorage.ds_banner ||
          null,
      });

      // ----------------------------------------------------------
      // DEPOIS: busca os dados atualizados na API
      // ----------------------------------------------------------

      const idUsuario =
        usuarioStorage.id_usuario ||
        usuarioStorage.id;

      const token =
        await AsyncStorage.getItem("token");

      if (!idUsuario || !token) {
        console.log(
          "ID do usuário ou token não encontrado."
        );
        return;
      }

      try {
        console.log(
          "BUSCANDO USUÁRIO ATUALIZADO:",
          idUsuario
        );

        const response =
          await api.get(
            `/users/${idUsuario}`,
            {
              headers: {
                Accept:
                  "application/json",
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        console.log(
          "USUÁRIO RECEBIDO DA API:",
          response.data
        );

        // --------------------------------------------------------
        // ALGUMAS APIs retornam { user: {...} }
        // e outras retornam diretamente {...}
        // --------------------------------------------------------

        const usuarioAPI =
          response.data?.user ||
          response.data;

        if (!usuarioAPI) {
          console.log(
            "API não retornou os dados do usuário."
          );
          return;
        }

        const usuarioAtualizado = {
          ...usuarioStorage,
          ...usuarioAPI,
        };

        // --------------------------------------------------------
        // ATUALIZA O STORAGE
        // --------------------------------------------------------

        await AsyncStorage.setItem(
          "usuario",
          JSON.stringify(
            usuarioAtualizado
          )
        );

        console.log(
          "USUÁRIO ATUALIZADO NO STORAGE:",
          usuarioAtualizado
        );

        // --------------------------------------------------------
        // ATUALIZA A TELA
        // --------------------------------------------------------

        setUser({
          id_usuario:
            usuarioAtualizado.id_usuario ||
            usuarioAtualizado.id ||
            idUsuario,

          name:
            usuarioAtualizado.nm_usuario ||
            "",

          description:
            usuarioAtualizado.ds_usuario ||
            "Descrição não informada",

          rating: "5.0",

          fotoPerfil:
            usuarioAtualizado.ds_foto_perfil ||
            null,

          banner:
            usuarioAtualizado.ds_banner ||
            null,
        });
      } catch (error: any) {
        console.log(
          "ERRO AO BUSCAR USUÁRIO NA API:",
          error?.response?.status,
          error?.response?.data ||
            error
        );

        // Se a API falhar, mantém os dados do storage.
      }
    } catch (erro) {
      console.log(
        "ERRO AO CARREGAR USUÁRIO:",
        erro
      );
    }
  }

  // ============================================================
  // CARREGAR ANÚNCIOS
  // ============================================================

  async function fetchUserProducts() {
    try {
      setLoadingProducts(true);

      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        console.log(
          "Token não encontrado."
        );
        return;
      }

      const response =
        await api.get(
          "/my-products",
          {
            headers: {
              Accept:
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      console.log(
        "ANÚNCIOS DO PERFIL:",
        response.data
      );

      setUserProducts(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error: any) {
      console.log(
        "ERRO AO CARREGAR ANÚNCIOS:",
        error?.response?.data ||
          error
      );
    } finally {
      setLoadingProducts(false);
    }
  }

  // ============================================================
  // CARREGAR ANÚNCIOS TROCADOS
  // ============================================================

  async function fetchTradedProducts() {
    try {
      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        return;
      }

      const response =
        await api.get(
          "/my-products?status=T",
          {
            headers: {
              Accept:
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      console.log(
        "ANÚNCIOS TROCADOS:",
        response.data
      );

      setTradedProducts(
        Array.isArray(response.data)
          ? response.data
          : []
      );
    } catch (error: any) {
      console.log(
        "ERRO AO CARREGAR ANÚNCIOS TROCADOS:",
        error?.response?.data ||
          error
      );
    }
  }

  // ============================================================
  // CONDIÇÃO DO PRODUTO
  // ============================================================

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

  // ============================================================
  // ABRIR OPÇÕES DO ANÚNCIO
  // ============================================================

  const handleOpenAdOptions = (
    item: any
  ) => {
    setSelectedAd(item);
    setOptionsModalVisible(true);
  };

  // ============================================================
  // EDITAR ANÚNCIO
  // ============================================================

  const handleEditAd = () => {
    if (
      selectedAd?.st_status === "T"
    ) {
      return;
    }

    setOptionsModalVisible(false);

    const productId =
      selectedAd?.id_produto ||
      selectedAd?.id;

    if (!productId) {
      console.log(
        "Produto não encontrado."
      );
      return;
    }

    router.push({
      pathname: "/editaranuncio",
      params: {
        id: String(productId),
      },
    } as any);
  };

  // ============================================================
  // ABRIR EXCLUSÃO
  // ============================================================

  const handleOpenDeleteModal = () => {
    setOptionsModalVisible(false);
    setDeleteModalVisible(true);
  };

  // ============================================================
  // CONFIRMAR EXCLUSÃO
  // ============================================================

  const handleConfirmDelete =
    async () => {
      try {
        const token =
          await AsyncStorage.getItem(
            "token"
          );

        const productId =
          selectedAd?.id_produto ||
          selectedAd?.id;

        console.log(
          "ID QUE SERÁ EXCLUÍDO:",
          productId
        );

        if (!token) {
          console.log(
            "Token não encontrado."
          );
          return;
        }

        if (!productId) {
          console.log(
            "Produto não encontrado."
          );
          return;
        }

        const response =
          await api.delete(
            `/products/${productId}`,
            {
              headers: {
                Accept:
                  "application/json",
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        console.log(
          "RESPOSTA DO DELETE:",
          response.data
        );

        await fetchUserProducts();
        await fetchTradedProducts();
      } catch (error: any) {
        console.log(
          "STATUS DO ERRO:",
          error?.response?.status
        );

        console.log(
          "RESPOSTA DO SERVIDOR:",
          error?.response?.data
        );

        console.log(
          "ERRO COMPLETO:",
          error
        );
      } finally {
        setDeleteModalVisible(false);
        setSelectedAd(null);
      }
    };

  // ============================================================
  // UC18 - ALTERAR STATUS
  // ============================================================

  const handleUpdateStatus =
    async (
      novoStatus: string
    ) => {
      try {
        const token =
          await AsyncStorage.getItem(
            "token"
          );

        const productId =
          selectedAd?.id_produto ||
          selectedAd?.id;

        if (!token) {
          console.log(
            "Token não encontrado."
          );
          return;
        }

        if (!productId) {
          console.log(
            "Produto não encontrado."
          );
          return;
        }

        let statusCodigo = "";

        if (
          novoStatus ===
          "Disponível"
        ) {
          statusCodigo = "A";
        } else if (
          novoStatus ===
          "Em Negociação"
        ) {
          statusCodigo = "N";
        } else if (
          novoStatus === "Trocado"
        ) {
          statusCodigo = "T";
        }

        if (!statusCodigo) {
          console.log(
            "Status inválido."
          );
          return;
        }

        await api.put(
          `/products/${productId}/status`,
          {
            st_status:
              statusCodigo,
          },
          {
            headers: {
              Accept:
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        setStatusModalVisible(
          false
        );

        await fetchUserProducts();
        await fetchTradedProducts();

        console.log(
          `Status do produto ${productId} atualizado para ${statusCodigo}.`
        );
      } catch (error: any) {
        console.log(
          "ERRO AO ALTERAR STATUS:",
          error?.response?.data ||
            error
        );
      }
    };

  // ============================================================
  // LOGOUT
  // ============================================================

  async function sairDaConta() {
    try {
      const token =
        await AsyncStorage.getItem(
          "token"
        );

      if (token) {
        await api.post(
          "/logout",
          {},
          {
            headers: {
              Accept:
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
          }
        );
      }
    } catch (erro) {
      console.log(
        "ERRO AO FAZER LOGOUT:",
        erro
      );
    }

    await AsyncStorage.removeItem(
      "token"
    );

    await AsyncStorage.removeItem(
      "usuario"
    );

    router.replace(
      "/(auth)/login"
    );
  }

  // ============================================================
  // PRODUTOS EXIBIDOS
  // ============================================================

  const displayedProducts =
    activeTab === "trocados"
      ? tradedProducts
      : userProducts;

  // ============================================================
  // TROCA DE ABA
  // ============================================================

  const handleChangeTab = (
    tab: TabType
  ) => {
    if (
      tab === "favoritos"
    ) {
      router.push(
        "/favoritos" as any
      );
      return;
    }

    setActiveTab(tab);
  };

  // ============================================================
  // TEXTO DA LISTA VAZIA
  // ============================================================

  const emptyMessage =
    activeTab === "trocados"
      ? "Você ainda não possui anúncios trocados."
      : "Você ainda não possui anúncios cadastrados.";

  // ============================================================
  // TELA
  // ============================================================

  return (
    <SafeAreaView
      style={styles.container}
    >
      <StatusBar style="dark" />

      {/* HEADER */}

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace(
                "/(tabs)"
              );
            }
          }}
          style={
            styles.headerButton
          }
        >
          <Feather
            name="arrow-left"
            size={24}
            color="#005386"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            router.push(
              "/perfil/configuracoes" as any
            )
          }
          style={
            styles.headerButton
          }
        >
          <Feather
            name="settings"
            size={22}
            color="#005386"
          />
        </TouchableOpacity>
      </View>

      {/* CONTEÚDO */}

      <FlatList
        data={displayedProducts}
        keyExtractor={(item) =>
          String(
            item.id_produto ||
              item.id
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
        ListHeaderComponent={
          <View>
            {/* BANNER */}

            <View
              style={
                styles.bannerContainer
              }
            >
              {getImageUrl(
                user.banner
              ) ? (
                <Image
                  source={{
                    uri:
                      getImageUrl(
                        user.banner
                      )!,
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

            {/* DADOS DO USUÁRIO */}

            <View
              style={
                styles.profileInfoContainer
              }
            >
              <View
                style={
                  styles.roundAvatar
                }
              >
                {getImageUrl(
                  user.fotoPerfil
                ) ? (
                  <Image
                    source={{
                      uri:
                        getImageUrl(
                          user.fotoPerfil
                        )!,
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

                {/* EDITAR PERFIL */}

                <TouchableOpacity
                  style={
                    styles.editProfileButton
                  }
                  onPress={() =>
                    router.push(
                      "/perfil/editarPerfil" as any
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Feather
                    name="edit-3"
                    size={14}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.editProfileText
                    }
                  >
                    Editar perfil
                  </Text>
                </TouchableOpacity>
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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
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
                  handleChangeTab(
                    "anuncios"
                  )
                }
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab ===
                      "anuncios" &&
                      styles.activeTabText,
                  ]}
                >
                  Anúncios
                </Text>
              </TouchableOpacity>

              {/* TROCADOS */}

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  activeTab ===
                    "trocados" &&
                    styles.activeTab,
                ]}
                onPress={() =>
                  handleChangeTab(
                    "trocados"
                  )
                }
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab ===
                      "trocados" &&
                      styles.activeTabText,
                  ]}
                >
                  Anúncios trocados
                </Text>
              </TouchableOpacity>

              {/* FAVORITOS */}

              <TouchableOpacity
                style={[
                  styles.tabItem,
                  styles.favoriteTabItem,
                ]}
                onPress={() =>
                  handleChangeTab(
                    "favoritos"
                  )
                }
              >
                <Text
                  style={
                    styles.tabText
                  }
                >
                  Favoritos
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        }
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
        renderItem={({
          item,
        }) => {
          const imagemUrl =
            item.images &&
            item.images.length > 0
              ? getImageUrl(
                  item.images[0]
                    ?.ds_imagem
                )
              : null;

          const categoriaNome =
            item.categoria
              ?.nm_categoria ||
            "Sem categoria";

          return (
            <TouchableOpacity
              style={
                styles.listingCard
              }
              activeOpacity={0.8}
              onPress={() =>
                handleOpenAdOptions(
                  item
                )
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

              {/* INFORMAÇÕES */}

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
                  {item.nm_produto}
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
                      item.st_condicao
                    )}
                  </Text>

                  <TouchableOpacity
                    style={
                      styles.moreOptionsButton
                    }
                    onPress={() =>
                      handleOpenAdOptions(
                        item
                      )
                    }
                    hitSlop={{
                      top: 10,
                      bottom: 10,
                      left: 10,
                      right: 10,
                    }}
                  >
                    <Feather
                      name="more-vertical"
                      size={18}
                      color="#005386"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* MODAL DE OPÇÕES */}

      <Modal
        animationType="fade"
        transparent
        visible={
          optionsModalVisible
        }
        onRequestClose={() =>
          setOptionsModalVisible(
            false
          )
        }
      >
        <TouchableOpacity
          style={
            styles.adModalOverlay
          }
          activeOpacity={1}
          onPress={() =>
            setOptionsModalVisible(
              false
            )
          }
        >
          <View
            style={
              styles.adModalContent
            }
          >
            <Text
              style={
                styles.adModalTitle
              }
              numberOfLines={1}
            >
              {selectedAd?.nm_produto}
            </Text>

            <Text
              style={
                styles.adModalSubtitle
              }
            >
              Escolha a ação desejada:
            </Text>

            {/* EDITAR */}

            {selectedAd?.st_status !==
              "T" && (
              <TouchableOpacity
                style={
                  styles.adOptionButton
                }
                onPress={
                  handleEditAd
                }
              >
                <Feather
                  name="edit-3"
                  size={20}
                  color="#005386"
                />

                <Text
                  style={
                    styles.adOptionText
                  }
                >
                  Editar Anúncio
                </Text>
              </TouchableOpacity>
            )}

            {/* ALTERAR STATUS */}

            <TouchableOpacity
              style={
                styles.adOptionButton
              }
              onPress={() => {
                setOptionsModalVisible(
                  false
                );

                setStatusModalVisible(
                  true
                );
              }}
            >
              <Feather
                name="sliders"
                size={20}
                color="#005386"
              />

              <Text
                style={
                  styles.adOptionText
                }
              >
                Alterar Status do Item
              </Text>
            </TouchableOpacity>

            {/* EXCLUIR */}

            <TouchableOpacity
              style={[
                styles.adOptionButton,
                styles.adOptionDeleteButton,
              ]}
              onPress={
                handleOpenDeleteModal
              }
            >
              <Feather
                name="trash-2"
                size={20}
                color="#FF3B30"
              />

              <Text
                style={[
                  styles.adOptionText,
                  styles.adOptionDeleteText,
                ]}
              >
                Excluir Anúncio
              </Text>
            </TouchableOpacity>

            {/* CANCELAR */}

            <TouchableOpacity
              style={
                styles.adCancelButton
              }
              onPress={() =>
                setOptionsModalVisible(
                  false
                )
              }
            >
              <Text
                style={
                  styles.adCancelText
                }
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DE STATUS */}

      <Modal
        animationType="fade"
        transparent
        visible={
          statusModalVisible
        }
        onRequestClose={() =>
          setStatusModalVisible(
            false
          )
        }
      >
        <TouchableOpacity
          style={
            styles.adModalOverlay
          }
          activeOpacity={1}
          onPress={() =>
            setStatusModalVisible(
              false
            )
          }
        >
          <View
            style={
              styles.adModalContent
            }
          >
            <Text
              style={
                styles.adModalTitle
              }
            >
              Alterar Status
            </Text>

            <Text
              style={
                styles.adModalSubtitle
              }
            >
              Selecione o estado atual do produto:
            </Text>

            <TouchableOpacity
              style={
                styles.adOptionButton
              }
              onPress={() =>
                handleUpdateStatus(
                  "Disponível"
                )
              }
            >
              <Feather
                name="check-circle"
                size={20}
                color="#28A745"
              />

              <Text
                style={
                  styles.adOptionText
                }
              >
                Disponível
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.adOptionButton
              }
              onPress={() =>
                handleUpdateStatus(
                  "Em Negociação"
                )
              }
            >
              <Feather
                name="clock"
                size={20}
                color="#FF9900"
              />

              <Text
                style={
                  styles.adOptionText
                }
              >
                Em Negociação
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.adOptionButton
              }
              onPress={() =>
                handleUpdateStatus(
                  "Trocado"
                )
              }
            >
              <Feather
                name="x-circle"
                size={20}
                color="#6C757D"
              />

              <Text
                style={
                  styles.adOptionText
                }
              >
                Trocado
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={
                styles.adCancelButton
              }
              onPress={() =>
                setStatusModalVisible(
                  false
                )
              }
            >
              <Text
                style={
                  styles.adCancelText
                }
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DE EXCLUSÃO */}

      <Modal
        animationType="fade"
        transparent
        visible={
          deleteModalVisible
        }
        onRequestClose={() =>
          setDeleteModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalContent
            }
          >
            <Text
              style={
                styles.deleteModalTitle
              }
            >
              Confirmar Exclusão
            </Text>

            <Text
              style={
                styles.deleteModalSubtitle
              }
            >
              Tem certeza que deseja remover o anúncio "
              {selectedAd?.nm_produto}"? Esta ação não pode
              ser desfeita.
            </Text>

            <View
              style={
                styles.modalButtonsRow
              }
            >
              <TouchableOpacity
                style={
                  styles.cancelLogoutButton
                }
                onPress={() =>
                  setDeleteModalVisible(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.cancelLogoutText
                  }
                >
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.confirmDeleteButton
                }
                onPress={
                  handleConfirmDelete
                }
              >
                <Text
                  style={
                    styles.confirmDeleteText
                  }
                >
                  Excluir
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE LOGOUT */}

      <Modal
        animationType="fade"
        transparent
        visible={
          logoutModalVisible
        }
        onRequestClose={() =>
          setLogoutModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalContent
            }
          >
            <Text
              style={
                styles.logoutModalTitle
              }
            >
              Deseja sair da conta?
            </Text>

            <Text
              style={
                styles.logoutModalSubtitle
              }
            >
              Ao confirmar, sua sessão atual será encerrada
              com segurança e você retornará à tela inicial.
            </Text>

            <View
              style={
                styles.modalButtonsRow
              }
            >
              <TouchableOpacity
                style={
                  styles.cancelLogoutButton
                }
                onPress={() =>
                  setLogoutModalVisible(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.cancelLogoutText
                  }
                >
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.confirmLogoutButton
                }
                onPress={async () => {
                  setLogoutModalVisible(
                    false
                  );

                  await sairDaConta();
                }}
              >
                <Text
                  style={
                    styles.confirmLogoutText
                  }
                >
                  Sair
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// ESTILOS
// ============================================================

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
    padding: 6,
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
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    backgroundColor: "#0099FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  editProfileText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
    marginLeft: 5,
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
    marginVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
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
  favoriteIcon: {
    marginRight: 5,
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
  moreOptionsButton: {
    padding: 4,
  },
  emptyText: {
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
    color: "#888",
    marginTop: 40,
    fontSize: 14,
  },
  adModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  adModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  adModalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: "#333333",
  },
  adModalSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: "#777777",
    marginBottom: 16,
    marginTop: 2,
  },
  adOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#F5FBFF",
    marginBottom: 10,
  },
  adOptionText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: "#005386",
    marginLeft: 12,
  },
  adOptionDeleteButton: {
    backgroundColor: "#FFF0F0",
  },
  adOptionDeleteText: {
    color: "#FF3B30",
  },
  adCancelButton: {
    marginTop: 6,
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
  },
  adCancelText: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: "#888888",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 5,
  },
  deleteModalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#FF3B30",
    marginBottom: 8,
    textAlign: "center",
  },
  deleteModalSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  logoutModalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#005386",
    marginBottom: 8,
    textAlign: "center",
  },
  logoutModalSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  cancelLogoutButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0099FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "#fff",
  },
  cancelLogoutText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
  },
  confirmDeleteButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmDeleteText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: "#fff",
  },
  confirmLogoutButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#0099ff",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmLogoutText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: "#fff",
  },
});