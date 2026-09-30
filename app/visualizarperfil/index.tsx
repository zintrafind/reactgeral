import {
  Feather,
  MaterialCommunityIcons,
} from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { StatusBar } from "expo-status-bar";

import React, {
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import api from "../../services/api";

const { width } =
  Dimensions.get("window");

const itemWidth =
  (width - 44) / 2;

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

type TabType =
  | "anuncios"
  | "trocados";

/* ================================================================
   TELA
================================================================ */

export default function VisualizarPerfilScreen() {
  const router = useRouter();

  const { id } =
    useLocalSearchParams();

  const idParametro =
    Array.isArray(id)
      ? id[0]
      : id;

  /* ==============================================================
     USUÁRIO LOGADO
  ============================================================== */

  const [
    idUsuarioLogado,
    setIdUsuarioLogado,
  ] = useState<
    number | null
  >(null);

  const [
    usuarioLogadoCarregado,
    setUsuarioLogadoCarregado,
  ] = useState(false);

  /* ==============================================================
     USUÁRIO DO PERFIL
  ============================================================== */

  const [
    user,
    setUser,
  ] =
    useState<UserProfileData>({
      id_usuario:
        undefined,

      name: "",

      description: "",

      rating: "5.0",

      fotoPerfil: null,

      banner: null,
    });

  /* ==============================================================
     VERIFICAR SE É O PRÓPRIO PERFIL
  ============================================================== */

  const idPerfilVisualizado =
    Number(
      user.id_usuario ||
        idParametro ||
        0
    );

  const isOwnProfile =
    idUsuarioLogado !==
      null &&
    idPerfilVisualizado ===
      idUsuarioLogado;

  /* ==============================================================
     PRODUTOS
  ============================================================== */

  const [
    userProducts,
    setUserProducts,
  ] =
    useState<Produto[]>([]);

  const [
    loadingProducts,
    setLoadingProducts,
  ] = useState(true);

  /* ==============================================================
     ABA
  ============================================================== */

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<TabType>(
      "anuncios"
    );

  /* ==============================================================
     BLOQUEIO
  ============================================================== */

  const [
    bloqueando,
    setBloqueando,
  ] = useState(false);

  const [
    modalBloqueioVisivel,
    setModalBloqueioVisivel,
  ] = useState(false);

  /* ==============================================================
     CARREGAR USUÁRIO LOGADO
  ============================================================== */

  useEffect(() => {
    const carregarUsuarioLogado =
      async () => {
        try {
          const usuarioStorage =
            await AsyncStorage.getItem(
              "usuario"
            );

          if (
            !usuarioStorage
          ) {
            return;
          }

          const parsed =
            JSON.parse(
              usuarioStorage
            );

          const usuario =
            parsed?.user ||
            parsed?.usuario ||
            parsed?.data ||
            parsed;

          const idLogado =
            usuario?.id_usuario ||
            usuario?.id ||
            null;

          if (idLogado) {
            setIdUsuarioLogado(
              Number(
                idLogado
              )
            );
          }
        } catch (
          error
        ) {
          console.error(
            "ERRO AO CARREGAR USUÁRIO LOGADO:",
            error
          );
        } finally {
          setUsuarioLogadoCarregado(
            true
          );
        }
      };

    carregarUsuarioLogado();
  }, []);

  /* ==============================================================
     CARREGAR PERFIL
  ============================================================== */

  useEffect(() => {
    const carregarPerfil =
      async () => {
        try {
          if (
            !idParametro
          ) {
            return;
          }

          const token =
            await AsyncStorage.getItem(
              "token"
            );

          const response =
            await api.get(
              `/users/${idParametro}`,
              {
                headers: {
                  Accept:
                    "application/json",

                  ...(token
                    ? {
                        Authorization: `Bearer ${token}`,
                      }
                    : {}),
                },
              }
            );

          const data =
            response.data;

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
              idParametro,

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
        } catch (
          error: any
        ) {
          console.error(
            "ERRO AO CARREGAR PERFIL:",
            error
          );
        }
      };

    carregarPerfil();
  }, [idParametro]);

  /* ==============================================================
     CARREGAR PRODUTOS DO USUÁRIO
  ============================================================== */

  useEffect(() => {
    const carregarProdutos =
      async () => {
        try {
          if (
            !idParametro
          ) {
            return;
          }

          setLoadingProducts(
            true
          );

          const token =
            await AsyncStorage.getItem(
              "token"
            );

          const response =
            await api.get(
              `/users/${idParametro}/products`,
              {
                headers: {
                  Accept:
                    "application/json",

                  ...(token
                    ? {
                        Authorization: `Bearer ${token}`,
                      }
                    : {}),
                },
              }
            );

          const data =
            response.data;

          const produtos =
            Array.isArray(
              data
            )
              ? data
              : data?.products ||
                data?.produtos ||
                data?.data ||
                [];

          setUserProducts(
            produtos
          );
        } catch (
          error
        ) {
          console.error(
            "ERRO AO CARREGAR ANÚNCIOS:",
            error
          );

          setUserProducts(
            []
          );
        } finally {
          setLoadingProducts(
            false
          );
        }
      };

    carregarProdutos();
  }, [idParametro]);

  /* ==============================================================
     ABRIR MODAL DE BLOQUEIO
  ============================================================== */

  const bloquearUsuario =
    () => {
      if (
        isOwnProfile
      ) {
        return;
      }

      const idUsuarioBloqueado =
        Number(
          user.id_usuario ||
            idParametro
        );

      if (
        !idUsuarioBloqueado
      ) {
        Alert.alert(
          "Erro",
          "Não foi possível identificar este usuário."
        );

        return;
      }

      setModalBloqueioVisivel(
        true
      );
    };

  /* ==============================================================
     FECHAR MODAL
  ============================================================== */

  const fecharModalBloqueio =
    () => {
      if (
        bloqueando
      ) {
        return;
      }

      setModalBloqueioVisivel(
        false
      );
    };

  /* ==============================================================
     CONFIRMAR BLOQUEIO
  ============================================================== */

  const confirmarBloqueio =
    async () => {
      if (
        isOwnProfile
      ) {
        setModalBloqueioVisivel(
          false
        );

        return;
      }

      const idUsuarioBloqueado =
        Number(
          user.id_usuario ||
            idParametro
        );

      if (
        !idUsuarioBloqueado
      ) {
        Alert.alert(
          "Erro",
          "Não foi possível identificar este usuário."
        );

        return;
      }

      try {
        setBloqueando(
          true
        );

        const token =
          await AsyncStorage.getItem(
            "token"
          );

        if (!token) {
          setModalBloqueioVisivel(
            false
          );

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

        const response =
          await api.post(
            "/bloqueios",
            {
              id_usuario_bloqueado:
                idUsuarioBloqueado,
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

        const data =
          response.data;

        console.log(
          "RESPOSTA BLOQUEIO:",
          response.status,
          data
        );

        setModalBloqueioVisivel(
          false
        );

        Alert.alert(
          "Usuário bloqueado",
          data?.message ||
            "Usuário bloqueado com sucesso.",
          [
            {
              text: "OK",

              onPress:
                () => {
                  if (
                    router.canGoBack()
                  ) {
                    router.back();
                  } else {
                    router.replace(
                      "/(tabs)"
                    );
                  }
                },
            },
          ]
        );
      } catch (
        error: any
      ) {
        console.error(
          "ERRO AO BLOQUEAR USUÁRIO:",
          error
        );

        const mensagem =
          error?.response
            ?.data
            ?.message ||
          error?.message ||
          "Não foi possível bloquear este usuário.";

        Alert.alert(
          "Erro",
          mensagem
        );
      } finally {
        setBloqueando(
          false
        );
      }
    };

  /* ==============================================================
     DENUNCIAR USUÁRIO
  ============================================================== */

  const denunciarUsuario =
    () => {
      if (
        isOwnProfile
      ) {
        return;
      }

      const idUsuarioDenunciado =
        user.id_usuario ||
        idParametro;

      if (
        !idUsuarioDenunciado
      ) {
        Alert.alert(
          "Erro",
          "Não foi possível identificar este usuário."
        );

        return;
      }

      router.push({
        pathname:
          "/denuncia",

        params: {
          id: String(
            idUsuarioDenunciado
          ),

          nome:
            user.name,
        },
      } as any);
    };

  /* ==============================================================
     URL DA IMAGEM
  ============================================================== */

  const getImageUrl = (
    imagePath?:
      | string
      | null
  ): string | null => {
    if (!imagePath) {
      return null;
    }

    const path =
      String(
        imagePath
      ).trim();

    if (!path) {
      return null;
    }

    if (
      path.startsWith(
        "http://"
      ) ||
      path.startsWith(
        "https://"
      )
    ) {
      return path;
    }

    const baseUrl =
      api.defaults.baseURL?.replace(
        /\/api\/?$/,
        ""
      ) ||
      "http://127.0.0.1:8000";

    const cleanPath =
      path
        .replace(
          /^\/+/,
          ""
        )
        .replace(
          /^storage\/+/,
          ""
        );

    return `${baseUrl}/storage/${cleanPath}`;
  };

  /* ==============================================================
     IMAGENS DO PERFIL
  ============================================================== */

  const fotoPerfilUrl =
    getImageUrl(
      user.fotoPerfil
    );

  const bannerUrl =
    getImageUrl(
      user.banner
    );

  /* ==============================================================
     CONDIÇÃO DO PRODUTO
  ============================================================== */

  const getConditionLabel =
    (
      condition: any
    ) => {
      const valor =
        String(
          condition ||
            ""
        )
          .trim()
          .toUpperCase();

      switch (
        valor
      ) {
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
    userProducts.filter(
      (item) => {
        const status =
          String(
            item?.st_status ||
              ""
          ).toUpperCase();

        return (
          status ===
            "A" ||
          status ===
            "N"
        );
      }
    ).length;

  const trocadosCount =
    userProducts.filter(
      (item) =>
        String(
          item?.st_status ||
            ""
        ).toUpperCase() ===
        "T"
    ).length;

  /* ==============================================================
     PRODUTOS EXIBIDOS
  ============================================================== */

  const displayedProducts =
    activeTab ===
    "trocados"
      ? userProducts.filter(
          (item) =>
            String(
              item?.st_status ||
                ""
            ).toUpperCase() ===
            "T"
        )
      : userProducts.filter(
          (item) => {
            const status =
              String(
                item?.st_status ||
                  ""
              ).toUpperCase();

            return (
              status ===
                "A" ||
              status ===
                "N"
            );
          }
        );

  /* ==============================================================
     ABRIR PRODUTO
  ============================================================== */

  const handleOpenProduct =
    (
      produto: Produto
    ) => {
      const productId =
        produto?.id_produto;

      if (
        !productId
      ) {
        return;
      }

      const status =
        String(
          produto?.st_status ||
            ""
        ).toUpperCase();

      if (
        status === "T"
      ) {
        return;
      }

      router.push({
        pathname:
          "/visuanuncios",

        params: {
          id: String(
            productId
          ),
        },
      } as any);
    };

  /* ==============================================================
     MENSAGEM DA LISTA VAZIA
  ============================================================== */

  const emptyMessage =
    activeTab ===
    "trocados"
      ? `${user.name} ainda não possui anúncios trocados.`
      : `${user.name} ainda não possui anúncios cadastrados.`;

  /* ==============================================================
     RENDER
  ============================================================== */

  return (
    <SafeAreaView
      style={
        styles.container
      }
    >
      <StatusBar
        style="dark"
      />

      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <View
        style={
          styles.header
        }
      >
        {/* VOLTAR */}

        <TouchableOpacity
          onPress={() => {
            if (
              router.canGoBack()
            ) {
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
          activeOpacity={
            0.7
          }
        >
          <Feather
            name="arrow-left"
            size={24}
            color="#005386"
          />
        </TouchableOpacity>

        {/* ==================================================== */}
        {/* DENÚNCIA E BLOQUEIO */}
        {/* ==================================================== */}

        {usuarioLogadoCarregado &&
        !isOwnProfile ? (
          <View
            style={
              styles.headerActions
            }
          >
            {/* DENUNCIAR */}

            <TouchableOpacity
              onPress={
                denunciarUsuario
              }
              style={
                styles.headerButton
              }
              activeOpacity={
                0.7
              }
            >
              <Feather
                name="flag"
                size={21}
                color="#D97706"
              />
            </TouchableOpacity>

            {/* BLOQUEAR */}

            <TouchableOpacity
              onPress={
                bloquearUsuario
              }
              disabled={
                bloqueando
              }
              style={[
                styles.headerButton,

                bloqueando &&
                  styles.headerButtonDisabled,
              ]}
              activeOpacity={
                0.7
              }
            >
              {bloqueando ? (
                <ActivityIndicator
                  size="small"
                  color="#D9534F"
                />
              ) : (
                <MaterialCommunityIcons
                  name="block-helper"
                  size={23}
                  color="#D9534F"
                />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View
            style={
              styles.headerPlaceholder
            }
          />
        )}
      </View>

      {/* ====================================================== */}
      {/* LISTA */}
      {/* ====================================================== */}

      <FlatList
        data={
          displayedProducts
        }
        keyExtractor={(
          item,
          index
        ) =>
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

        /* CABEÇALHO */
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

            {/* PERFIL */}

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

                {/* DESCRIÇÃO SEM ÍCONE */}

                <View
                  style={
                    styles.addressRow
                  }
                >
                  <Text
                    style={
                      styles.userSubtext
                    }
                    numberOfLines={
                      2
                    }
                  >
                    {
                      user.description
                    }
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
                —{" "}
                {user.rating}
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
                activeOpacity={
                  0.7
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
                  Anúncios (
                  {
                    anunciosCount
                  }
                  )
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
                activeOpacity={
                  0.7
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
                  Anúncios
                  trocados (
                  {
                    trocadosCount
                  }
                  )
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        }

        /* LISTA VAZIA */
        ListEmptyComponent={
          loadingProducts ? (
            <ActivityIndicator
              size="large"
              color="#0099FF"
              style={{
                marginTop:
                  30,
              }}
            />
          ) : (
            <Text
              style={
                styles.emptyText
              }
            >
              {
                emptyMessage
              }
            </Text>
          )
        }

        /* CARD */
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
              item?.st_status ||
                ""
            ).toUpperCase() ===
            "T";

          return (
            <TouchableOpacity
              style={
                styles.listingCard
              }
              disabled={
                isTrocado
              }
              onPress={() => {
                if (
                  !isTrocado
                ) {
                  handleOpenProduct(
                    item
                  );
                }
              }}
              activeOpacity={
                isTrocado
                  ? 1
                  : 0.8
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
                  numberOfLines={
                    1
                  }
                >
                  {item?.nm_produto ||
                    "Produto"}
                </Text>

                <Text
                  style={
                    styles.listingCategory
                  }
                  numberOfLines={
                    1
                  }
                >
                  {
                    categoriaNome
                  }
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

      {/* ====================================================== */}
      {/* MODAL DE BLOQUEIO */}
      {/* ====================================================== */}

      {!isOwnProfile && (
        <Modal
          visible={
            modalBloqueioVisivel
          }
          transparent
          animationType="fade"
          onRequestClose={
            fecharModalBloqueio
          }
        >
          <View
            style={
              styles.modalOverlay
            }
          >
            <View
              style={
                styles.blockModal
              }
            >
              {/* ÍCONE */}

              <View
                style={
                  styles.blockModalIcon
                }
              >
                <MaterialCommunityIcons
                  name="block-helper"
                  size={32}
                  color="#D9534F"
                />
              </View>

              {/* TÍTULO */}

              <Text
                style={
                  styles.blockModalTitle
                }
              >
                Bloquear
                usuário
              </Text>

              {/* DESCRIÇÃO */}

              <Text
                style={
                  styles.blockModalDescription
                }
              >
                Você deseja
                bloquear este
                usuário?
              </Text>

              {/* USUÁRIO */}

              <View
                style={
                  styles.blockUserContainer
                }
              >
                {fotoPerfilUrl ? (
                  <Image
                    source={{
                      uri: fotoPerfilUrl,
                    }}
                    style={
                      styles.blockUserAvatar
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.blockUserAvatarFallback
                    }
                  >
                    <Feather
                      name="user"
                      size={21}
                      color="#005386"
                    />
                  </View>
                )}

                <View
                  style={
                    styles.blockUserInfo
                  }
                >
                  <Text
                    style={
                      styles.blockUserName
                    }
                    numberOfLines={
                      1
                    }
                  >
                    {
                      user.name
                    }
                  </Text>

                  <Text
                    style={
                      styles.blockUserHint
                    }
                  >
                    Este usuário
                    será
                    bloqueado.
                  </Text>
                </View>
              </View>

              {/* AVISO */}

              <View
                style={
                  styles.blockNotice
                }
              >
                <Feather
                  name="info"
                  size={18}
                  color="#005386"
                />

                <Text
                  style={
                    styles.blockNoticeText
                  }
                >
                  Após bloquear
                  este usuário,
                  as interações
                  entre vocês
                  poderão ser
                  limitadas.
                </Text>
              </View>

              {/* BOTÕES */}

              <View
                style={
                  styles.blockModalActions
                }
              >
                <TouchableOpacity
                  style={[
                    styles.blockCancelButton,

                    bloqueando &&
                      styles.blockButtonDisabled,
                  ]}
                  onPress={
                    fecharModalBloqueio
                  }
                  disabled={
                    bloqueando
                  }
                  activeOpacity={
                    0.7
                  }
                >
                  <Text
                    style={
                      styles.blockCancelText
                    }
                  >
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.blockConfirmButton,

                    bloqueando &&
                      styles.blockButtonDisabled,
                  ]}
                  onPress={
                    confirmarBloqueio
                  }
                  disabled={
                    bloqueando
                  }
                  activeOpacity={
                    0.7
                  }
                >
                  {bloqueando ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="block-helper"
                      size={18}
                      color="#FFFFFF"
                    />
                  )}

                  <Text
                    style={
                      styles.blockConfirmText
                    }
                  >
                    {bloqueando
                      ? "Bloqueando..."
                      : "Sim, bloquear"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

/* ================================================================
   ESTILOS
================================================================ */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,

      backgroundColor:
        "#FFFFFF",
    },

    /* ============================================================
       HEADER
    ============================================================ */

    header: {
      height: 60,

      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      paddingHorizontal:
        16,

      backgroundColor:
        "#FFFFFF",

      borderBottomWidth:
        1,

      borderBottomColor:
        "#EEEEEE",
    },

    headerButton: {
      width: 40,

      height: 40,

      justifyContent:
        "center",

      alignItems:
        "center",
    },

    headerActions: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 4,
    },

    headerPlaceholder: {
      width: 84,

      height: 40,
    },

    headerButtonDisabled:
      {
        opacity: 0.5,
      },

    /* ============================================================
       LISTA
    ============================================================ */

    listContent: {
      paddingHorizontal:
        16,

      paddingBottom:
        30,
    },

    /* ============================================================
       BANNER
    ============================================================ */

    bannerContainer: {
      width: "100%",

      height: 150,

      marginTop: 15,

      borderRadius:
        14,

      overflow:
        "hidden",

      backgroundColor:
        "#E4F8FF",
    },

    bannerImage: {
      width: "100%",

      height: "100%",

      resizeMode:
        "cover",
    },

    bannerPlaceholder:
      {
        width: "100%",

        height: "100%",

        justifyContent:
          "center",

        alignItems:
          "center",

        backgroundColor:
          "#E4F8FF",
      },

    /* ============================================================
       PERFIL
    ============================================================ */

    profileInfoContainer:
      {
        flexDirection:
          "row",

        alignItems:
          "center",

        marginTop: 15,
      },

    roundAvatar: {
      width: 86,

      height: 86,

      borderRadius:
        43,

      backgroundColor:
        "#E4F8FF",

      justifyContent:
        "center",

      alignItems:
        "center",

      borderWidth:
        1.5,

      borderColor:
        "#0099FF",

      elevation: 3,

      overflow:
        "hidden",
    },

    profileImage: {
      width: "100%",

      height: "100%",

      resizeMode:
        "cover",
    },

    userInfoTextContainer:
      {
        marginLeft: 16,

        flex: 1,
      },

    userName: {
      fontFamily:
        "Montserrat_700Bold",

      fontSize: 19,

      color: "#005386",
    },

    addressRow: {
      flexDirection:
        "row",

      alignItems:
        "center",

      marginTop: 4,
    },

    /*
     * addressIcon foi removido
     * porque não existe mais
     * o ícone file-text.
     */

    userSubtext: {
      fontFamily:
        "Montserrat_400Regular",

      fontSize: 13,

      color: "#777777",

      flex: 1,
    },

    /* ============================================================
       AVALIAÇÃO
    ============================================================ */

    ratingContainer: {
      flexDirection:
        "row",

      alignItems:
        "center",

      marginTop: 15,

      paddingLeft: 4,
    },

    starsRow: {
      flexDirection:
        "row",

      alignItems:
        "center",
    },

    starIcon: {
      marginRight: 4,
    },

    ratingText: {
      fontFamily:
        "Montserrat_600SemiBold",

      fontSize: 14,

      color: "#005386",

      marginLeft: 8,
    },

    /* ============================================================
       ABAS
    ============================================================ */

    tabsContainer: {
      flexDirection:
        "row",

      marginVertical:
        20,

      borderBottomWidth:
        1,

      borderBottomColor:
        "#EEEEEE",

      paddingBottom: 4,
    },

    tabItem: {
      marginRight: 24,

      paddingBottom: 8,

      flexDirection:
        "row",

      alignItems:
        "center",
    },

    favoriteTabItem:
      {
        marginRight: 8,
      },

    activeTab: {
      borderBottomWidth:
        2,

      borderBottomColor:
        "#0099FF",
    },

    tabText: {
      fontFamily:
        "Montserrat_500Medium",

      fontSize: 14,

      color: "#888888",
    },

    activeTabText: {
      fontFamily:
        "Montserrat_700Bold",

      color: "#005386",
    },

    /* ============================================================
       GRID
    ============================================================ */

    gridRow: {
      justifyContent:
        "space-between",
    },

    listingCard: {
      width:
        itemWidth,

      marginBottom: 20,

      backgroundColor:
        "#FFFFFF",

      borderRadius:
        14,

      borderWidth: 1,

      borderColor:
        "#EEEEEE",

      overflow:
        "hidden",

      elevation: 2,
    },

    imagePlaceholder: {
      width: "100%",

      height:
        itemWidth,

      backgroundColor:
        "#F5FBFF",

      justifyContent:
        "center",

      alignItems:
        "center",
    },

    productImage: {
      width: "100%",

      height: "100%",

      resizeMode:
        "cover",
    },

    textPlaceholderRow:
      {
        marginTop: 8,

        paddingHorizontal:
          8,

        paddingBottom:
          8,
      },

    listingTitle: {
      fontFamily:
        "Montserrat_600SemiBold",

      fontSize: 13,

      color: "#333333",
    },

    listingCategory:
      {
        fontFamily:
          "Montserrat_500Medium",

        fontSize: 11,

        color: "#0099FF",

        marginTop: 3,
      },

    cardFooterRow: {
      flexDirection:
        "row",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      marginTop: 3,
    },

    listingPrice: {
      fontFamily:
        "Montserrat_400Regular",

      fontSize: 11,

      color: "#777777",
    },

    emptyText: {
      textAlign:
        "center",

      fontFamily:
        "Montserrat_400Regular",

      color: "#888888",

      marginTop: 40,

      fontSize: 14,
    },

    /* ============================================================
       MODAL BLOQUEIO
    ============================================================ */

    modalOverlay: {
      flex: 1,

      backgroundColor:
        "rgba(0, 0, 0, 0.50)",

      justifyContent:
        "center",

      alignItems:
        "center",

      paddingHorizontal:
        24,
    },

    blockModal: {
      width: "100%",

      maxWidth: 390,

      backgroundColor:
        "#FFFFFF",

      borderRadius:
        20,

      padding: 24,

      elevation: 10,

      shadowColor:
        "#000000",

      shadowOpacity:
        0.2,

      shadowRadius:
        12,

      shadowOffset: {
        width: 0,

        height: 5,
      },
    },

    blockModalIcon: {
      width: 66,

      height: 66,

      borderRadius:
        33,

      backgroundColor:
        "#FFF1F0",

      justifyContent:
        "center",

      alignItems:
        "center",

      alignSelf:
        "center",

      marginBottom:
        16,
    },

    blockModalTitle: {
      fontFamily:
        "Montserrat_700Bold",

      fontSize: 19,

      color: "#333333",

      textAlign:
        "center",
    },

    blockModalDescription:
      {
        fontFamily:
          "Montserrat_400Regular",

        fontSize: 14,

        color: "#666666",

        textAlign:
          "center",

        marginTop: 8,
      },

    /* ============================================================
       USUÁRIO NO MODAL
    ============================================================ */

    blockUserContainer:
      {
        flexDirection:
          "row",

        alignItems:
          "center",

        backgroundColor:
          "#F8FAFB",

        borderRadius:
          12,

        padding: 12,

        marginTop: 18,

        borderWidth: 1,

        borderColor:
          "#EEEEEE",
      },

    blockUserAvatar: {
      width: 44,

      height: 44,

      borderRadius:
        22,

      backgroundColor:
        "#E4F8FF",
    },

    blockUserAvatarFallback:
      {
        width: 44,

        height: 44,

        borderRadius:
          22,

        backgroundColor:
          "#E4F8FF",

        justifyContent:
          "center",

        alignItems:
          "center",
      },

    blockUserInfo: {
      flex: 1,

      marginLeft: 12,
    },

    blockUserName: {
      fontFamily:
        "Montserrat_600SemiBold",

      fontSize: 14,

      color: "#005386",
    },

    blockUserHint: {
      fontFamily:
        "Montserrat_400Regular",

      fontSize: 11,

      color: "#777777",

      marginTop: 2,
    },

    /* ============================================================
       AVISO DO MODAL
    ============================================================ */

    blockNotice: {
      flexDirection:
        "row",

      alignItems:
        "flex-start",

      backgroundColor:
        "#F0F8FF",

      borderRadius:
        10,

      padding: 12,

      marginTop: 14,

      gap: 8,
    },

    blockNoticeText: {
      flex: 1,

      fontFamily:
        "Montserrat_400Regular",

      fontSize: 11,

      lineHeight: 17,

      color: "#005386",
    },

    /* ============================================================
       BOTÕES MODAL
    ============================================================ */

    blockModalActions:
      {
        flexDirection:
          "row",

        gap: 10,

        marginTop: 22,
      },

    blockCancelButton:
      {
        flex: 1,

        minHeight: 48,

        borderRadius:
          10,

        borderWidth: 1,

        borderColor:
          "#D8E3EB",

        backgroundColor:
          "#FFFFFF",

        justifyContent:
          "center",

        alignItems:
          "center",

        paddingHorizontal:
          10,
      },

    blockCancelText: {
      fontFamily:
        "Montserrat_600SemiBold",

      fontSize: 13,

      color: "#005386",

      textAlign:
        "center",
    },

    blockConfirmButton:
      {
        flex: 1.2,

        minHeight: 48,

        borderRadius:
          10,

        backgroundColor:
          "#D9534F",

        flexDirection:
          "row",

        justifyContent:
          "center",

        alignItems:
          "center",

        paddingHorizontal:
          10,

        gap: 6,
      },

    blockConfirmText: {
      fontFamily:
        "Montserrat_600SemiBold",

      fontSize: 13,

      color: "#FFFFFF",

      textAlign:
        "center",

      flexShrink: 1,
    },

    blockButtonDisabled:
      {
        opacity: 0.6,
      },
  });