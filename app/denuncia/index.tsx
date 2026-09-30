import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import api from "../../services/api";

const LIMITE_IMAGENS = 3;

const { width: SCREEN_WIDTH } =
  Dimensions.get("window");

/* ================================================================
   URL DA IMAGEM
================================================================ */

function getImageUrl(
  imagePath?: string | null
): string | null {
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
    ) ||
    "http://127.0.0.1:8000";

  const cleanPath = path
    .replace(/^\/+/, "")
    .replace(/^storage\/+/, "");

  return `${baseUrl}/storage/${cleanPath}`;
}

/* ================================================================
   TELA
================================================================ */

export default function DenunciaScreen() {
  const router = useRouter();

  const params = useLocalSearchParams();

  /* ==============================================================
     USUÁRIO DENUNCIADO
  ============================================================== */

  const idUsuario = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const nomeUsuarioParam = Array.isArray(
    params.nome
  )
    ? params.nome[0]
    : params.nome;

  const [nomeUsuario, setNomeUsuario] =
    useState(
      nomeUsuarioParam || "Usuário"
    );

  const [fotoUsuario, setFotoUsuario] =
    useState<string | null>(null);

  /* ==============================================================
     FORMULÁRIO
  ============================================================== */

  const [
    selectedCategory,
    setSelectedCategory,
  ] = useState("");

  const [description, setDescription] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  /* ==============================================================
     MODAIS
  ============================================================== */

  const [
    categoryModalVisible,
    setCategoryModalVisible,
  ] = useState(false);

  const [
    successModalVisible,
    setSuccessModalVisible,
  ] = useState(false);

  const [
    errorModalVisible,
    setErrorModalVisible,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /* ==============================================================
     IMAGENS
  ============================================================== */

  const [images, setImages] =
    useState<any[]>([]);

  const [
    imagemAtual,
    setImagemAtual,
  ] = useState(0);

  const carouselRef =
    useRef<ScrollView>(null);

  /* ==============================================================
     CATEGORIAS
  ============================================================== */

  const categories = [
    {
      id: 1,
      nome: "Comportamento ofensivo",
      descricao:
        "Insultos, ofensas ou comportamento inadequado.",
    },

    {
      id: 2,
      nome: "Assédio",
      descricao:
        "Mensagens insistentes, intimidação ou perseguição.",
    },

    {
      id: 3,
      nome: "Golpe ou fraude",
      descricao:
        "Tentativa de golpe, fraude ou negociação suspeita.",
    },

    {
      id: 4,
      nome: "Conteúdo impróprio",
      descricao:
        "Conteúdo ofensivo, inadequado ou proibido.",
    },

    {
      id: 5,
      nome: "Spam",
      descricao:
        "Mensagens repetitivas ou conteúdo indesejado.",
    },

    {
      id: 6,
      nome: "Problema durante a negociação",
      descricao:
        "Problemas relacionados à negociação ou troca.",
    },

    {
      id: 7,
      nome: "Outro",
      descricao:
        "Outro motivo que não está listado acima.",
    },
  ];

  /* ==============================================================
     CARREGAR USUÁRIO DENUNCIADO
  ============================================================== */

  useEffect(() => {
    let ativo = true;

    async function carregarUsuario() {
      try {
        if (!idUsuario) {
          return;
        }

        const token =
          await AsyncStorage.getItem(
            "token"
          );

        const response = await api.get(
          `/users/${idUsuario}`,
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

        if (!ativo) {
          return;
        }

        const data = response.data;

        const usuario =
          data?.user ||
          data?.usuario ||
          data?.data ||
          data;

        if (!usuario) {
          return;
        }

        /* NOME */

        const nome =
          usuario?.nm_usuario ||
          usuario?.nome ||
          usuario?.name ||
          nomeUsuarioParam ||
          "Usuário";

        setNomeUsuario(nome);

        /* FOTO */

        const foto =
          usuario?.ds_foto_perfil ||
          usuario?.ds_foto ||
          usuario?.foto_perfil ||
          usuario?.foto ||
          null;

        setFotoUsuario(
          getImageUrl(foto)
        );
      } catch (error: any) {
        console.log(
          "Erro ao carregar usuário denunciado:",
          error?.response?.data ||
            error
        );
      }
    }

    carregarUsuario();

    return () => {
      ativo = false;
    };
  }, [idUsuario, nomeUsuarioParam]);

  /* ==============================================================
     SELECIONAR IMAGENS
  ============================================================== */

  async function pickImages() {
    const quantidadeDisponivel =
      LIMITE_IMAGENS -
      images.length;

    if (
      quantidadeDisponivel <= 0
    ) {
      setErrorMessage(
        `Você pode adicionar no máximo ${LIMITE_IMAGENS} imagens como evidência.`
      );

      setErrorModalVisible(true);

      return;
    }

    try {
      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: [
              "images",
            ],

            allowsMultipleSelection:
              true,

            selectionLimit:
              quantidadeDisponivel,

            quality: 0.9,
          }
        );

      if (!result.canceled) {
        const novasImagens =
          result.assets || [];

        setImages(
          (
            imagensAnteriores
          ) => {
            const todasImagens = [
              ...imagensAnteriores,
              ...novasImagens,
            ];

            return todasImagens.slice(
              0,
              LIMITE_IMAGENS
            );
          }
        );
      }
    } catch (error) {
      console.log(
        "Erro ao selecionar imagens:",
        error
      );

      setErrorMessage(
        "Não foi possível selecionar as imagens."
      );

      setErrorModalVisible(
        true
      );
    }
  }

  /* ==============================================================
     REMOVER IMAGEM
  ============================================================== */

  function removerImagem(
    index: number
  ) {
    const novasImagens =
      images.filter(
        (_, imageIndex) =>
          imageIndex !== index
      );

    setImages(novasImagens);

    let novoIndice =
      imagemAtual;

    if (
      novasImagens.length === 0
    ) {
      novoIndice = 0;
    } else if (
      imagemAtual >=
      novasImagens.length
    ) {
      novoIndice =
        novasImagens.length - 1;
    }

    setImagemAtual(
      novoIndice
    );

    setTimeout(() => {
      carouselRef.current?.scrollTo(
        {
          x:
            novoIndice *
            (SCREEN_WIDTH - 40),

          animated: true,
        }
      );
    }, 100);
  }

  /* ==============================================================
     CONTROLAR CARROSSEL
  ============================================================== */

  function handleScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) {
    const largura =
      SCREEN_WIDTH - 40;

    const indice =
      Math.round(
        event.nativeEvent
          .contentOffset.x /
          largura
      );

    setImagemAtual(indice);
  }

  /* ==============================================================
     IMAGEM ANTERIOR
  ============================================================== */

  function imagemAnterior() {
    if (imagemAtual <= 0) {
      return;
    }

    const novoIndice =
      imagemAtual - 1;

    carouselRef.current?.scrollTo(
      {
        x:
          novoIndice *
          (SCREEN_WIDTH - 40),

        animated: true,
      }
    );

    setImagemAtual(
      novoIndice
    );
  }

  /* ==============================================================
     PRÓXIMA IMAGEM
  ============================================================== */

  function proximaImagem() {
    if (
      imagemAtual >=
      images.length - 1
    ) {
      return;
    }

    const novoIndice =
      imagemAtual + 1;

    carouselRef.current?.scrollTo(
      {
        x:
          novoIndice *
          (SCREEN_WIDTH - 40),

        animated: true,
      }
    );

    setImagemAtual(
      novoIndice
    );
  }

  /* ==============================================================
     ENVIAR DENÚNCIA
  ============================================================== */

  async function handleDenunciar() {
    if (!idUsuario) {
      setErrorMessage(
        "Não foi possível identificar o usuário denunciado."
      );

      setErrorModalVisible(true);

      return;
    }

    if (!selectedCategory) {
      setErrorMessage(
        "Selecione o motivo da denúncia."
      );

      setErrorModalVisible(true);

      return;
    }

    if (!description.trim()) {
      setErrorMessage(
        "Descreva o que aconteceu para que possamos entender a denúncia."
      );

      setErrorModalVisible(true);

      return;
    }

    if (
      description.trim()
        .length < 10
    ) {
      setErrorMessage(
        "Forneça um pouco mais de detalhes sobre o ocorrido."
      );

      setErrorModalVisible(true);

      return;
    }

    try {
      setLoading(true);

      /*
       * ========================================================
       * FUTURA INTEGRAÇÃO COM O LARAVEL
       * ========================================================
       *
       * Depois o backend poderá receber:
       *
       * idUsuario
       * selectedCategory
       * description
       * images
       *
       * Exemplo:
       *
       * POST /denuncias
       *
       * id_usuario_denunciado
       * categoria
       * descricao
       * imagens
       *
       * Por enquanto esta tela está
       * somente preparada no Front.
       * ========================================================
       */

      console.log(
        "DENÚNCIA PREPARADA:",
        {
          id_usuario_denunciado:
            idUsuario,

          nome_usuario:
            nomeUsuario,

          categoria:
            selectedCategory,

          descricao:
            description,

          imagens:
            images,
        }
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            500
          )
      );

      setSuccessModalVisible(
        true
      );
    } catch (error) {
      console.log(
        "Erro ao preparar denúncia:",
        error
      );

      setErrorMessage(
        "Não foi possível registrar a denúncia."
      );

      setErrorModalVisible(
        true
      );
    } finally {
      setLoading(false);
    }
  }

  /* ==============================================================
     VOLTAR
  ============================================================== */

  function voltar() {
    if (
      router.canGoBack()
    ) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  /* ==============================================================
     INTERFACE
  ============================================================== */

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      {/* ====================================================== */}
      {/* HEADER */}
      {/* ====================================================== */}

      <View
        style={styles.header}
      >
        <TouchableOpacity
          style={
            styles.headerButton
          }
          onPress={voltar}
          activeOpacity={0.7}
        >
          <Feather
            name="arrow-left"
            size={24}
            color="#005386"
          />
        </TouchableOpacity>

        <Text
          style={
            styles.headerTitle
          }
        >
          Denunciar Usuário
        </Text>

        <View
          style={
            styles.headerPlaceholder
          }
        />
      </View>

      <ScrollView
        style={
          styles.container
        }
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* ==================================================== */}
        {/* TÍTULO */}
        {/* ==================================================== */}

        <Text
          style={
            styles.mainTitle
          }
        >
          Fazer uma denúncia
        </Text>

        <Text
          style={
            styles.mainSubtitle
          }
        >
          Informe o motivo da
          denúncia e descreva o que
          aconteceu.
        </Text>

        {/* ==================================================== */}
        {/* USUÁRIO DENUNCIADO */}
        {/* ==================================================== */}

        <View
          style={
            styles.reportedUserCard
          }
        >
          {/* FOTO REAL */}

          {fotoUsuario ? (
            <Image
              source={{
                uri: fotoUsuario,
              }}
              style={
                styles.reportedUserPhoto
              }
              resizeMode="cover"
            />
          ) : (
            <View
              style={
                styles.reportedUserIcon
              }
            >
              <Feather
                name="user"
                size={23}
                color="#005386"
              />
            </View>
          )}

          {/* NOME */}

          <View
            style={
              styles.reportedUserInfo
            }
          >
            <Text
              style={
                styles.reportedUserLabel
              }
            >
              Usuário denunciado
            </Text>

            <Text
              style={
                styles.reportedUserName
              }
              numberOfLines={1}
            >
              {nomeUsuario}
            </Text>
          </View>

          <Feather
            name="flag"
            size={20}
            color="#D9534F"
          />
        </View>

        {/* ==================================================== */}
        {/* AVISO */}
        {/* ==================================================== */}

        <View
          style={
            styles.noticeCard
          }
        >
          <Feather
            name="info"
            size={19}
            color="#005386"
          />

          <Text
            style={
              styles.noticeText
            }
          >
            Utilize a denúncia para
            relatar comportamentos
            ou situações
            inadequadas. Se
            possível, forneça
            detalhes e evidências.
          </Text>
        </View>

        {/* ==================================================== */}
        {/* CATEGORIA */}
        {/* ==================================================== */}

        <View
          style={
            styles.fieldGroup
          }
        >
          <Text
            style={styles.label}
          >
            Motivo da denúncia
          </Text>

          <TouchableOpacity
            style={
              styles.inputPicker
            }
            onPress={() =>
              setCategoryModalVisible(
                true
              )
            }
            activeOpacity={0.7}
          >
            <Text
              style={
                selectedCategory
                  ? styles.inputText
                  : styles.inputPlaceholder
              }
            >
              {selectedCategory ||
                "Selecione o motivo"}
            </Text>

            <Feather
              name="chevron-down"
              size={18}
              color="#005386"
            />
          </TouchableOpacity>
        </View>

        {/* ==================================================== */}
        {/* DESCRIÇÃO */}
        {/* ==================================================== */}

        <View
          style={
            styles.fieldGroup
          }
        >
          <View
            style={
              styles.labelRow
            }
          >
            <Text
              style={
                styles.label
              }
            >
              Descreva o ocorrido
            </Text>

            <Text
              style={
                styles.characterCounter
              }
            >
              {description.length}
              /500
            </Text>
          </View>

          <TextInput
            style={[
              styles.input,
              styles.textArea,
            ]}
            placeholder="Conte o que aconteceu e forneça informações que possam ajudar na análise da denúncia..."
            placeholderTextColor="#888888"
            multiline
            numberOfLines={6}
            value={description}
            onChangeText={
              setDescription
            }
            maxLength={500}
            textAlignVertical="top"
          />
        </View>

        {/* ==================================================== */}
        {/* IMAGENS */}
        {/* ==================================================== */}

        <View
          style={
            styles.fieldGroup
          }
        >
          <View
            style={
              styles.imagesTitleRow
            }
          >
            <View>
              <Text
                style={
                  styles.label
                }
              >
                Evidências
              </Text>

              <Text
                style={
                  styles.optionalText
                }
              >
                Opcional
              </Text>
            </View>

            <Text
              style={
                styles.imageCounterTop
              }
            >
              {images.length}/
              {LIMITE_IMAGENS}
            </Text>
          </View>

          {/* ADICIONAR */}

          <TouchableOpacity
            style={[
              styles.photosButton,

              images.length >=
                LIMITE_IMAGENS &&
                styles.photosButtonDisabled,
            ]}
            activeOpacity={0.8}
            onPress={pickImages}
            disabled={
              images.length >=
              LIMITE_IMAGENS
            }
          >
            <Feather
              name={
                images.length ===
                0
                  ? "image"
                  : "plus"
              }
              size={22}
              color={
                images.length >=
                LIMITE_IMAGENS
                  ? "#999999"
                  : "#005386"
              }
            />

            <View
              style={
                styles.photoButtonTexts
              }
            >
              <Text
                style={[
                  styles.photosButtonText,

                  images.length >=
                    LIMITE_IMAGENS && {
                    color:
                      "#999999",
                  },
                ]}
              >
                {images.length ===
                0
                  ? "Adicionar evidências"
                  : images.length >=
                      LIMITE_IMAGENS
                    ? "Limite de imagens atingido"
                    : "Adicionar mais imagens"}
              </Text>

              <Text
                style={
                  styles.photosButtonSubtext
                }
              >
                Fotos podem ajudar
                na análise da
                denúncia
              </Text>
            </View>
          </TouchableOpacity>

          {/* ================================================== */}
          {/* CARROSSEL */}
          {/* ================================================== */}

          {images.length > 0 && (
            <>
              <View
                style={
                  styles.carouselContainer
                }
              >
                <ScrollView
                  ref={carouselRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={
                    false
                  }
                  onMomentumScrollEnd={
                    handleScrollEnd
                  }
                  scrollEventThrottle={
                    16
                  }
                >
                  {images.map(
                    (
                      item,
                      index
                    ) => (
                      <View
                        key={`${item.uri}-${index}`}
                        style={
                          styles.imageSlide
                        }
                      >
                        <Image
                          source={{
                            uri: item.uri,
                          }}
                          style={
                            styles.imagePreview
                          }
                          resizeMode="cover"
                        />

                        {/* EVIDÊNCIA */}

                        <View
                          style={
                            styles.evidenceBadge
                          }
                        >
                          <Feather
                            name="paperclip"
                            size={13}
                            color="#FFFFFF"
                          />

                          <Text
                            style={
                              styles.evidenceBadgeText
                            }
                          >
                            Evidência{" "}
                            {index +
                              1}
                          </Text>
                        </View>

                        {/* REMOVER */}

                        <TouchableOpacity
                          style={
                            styles.removeImageButton
                          }
                          onPress={() =>
                            removerImagem(
                              index
                            )
                          }
                          activeOpacity={
                            0.8
                          }
                        >
                          <Feather
                            name="x"
                            size={20}
                            color="#FFFFFF"
                          />
                        </TouchableOpacity>
                      </View>
                    )
                  )}
                </ScrollView>

                {/* ESQUERDA */}

                {imagemAtual >
                  0 && (
                  <TouchableOpacity
                    style={[
                      styles.carouselArrow,
                      styles.carouselArrowLeft,
                    ]}
                    onPress={
                      imagemAnterior
                    }
                    activeOpacity={
                      0.8
                    }
                  >
                    <Feather
                      name="chevron-left"
                      size={26}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                )}

                {/* DIREITA */}

                {imagemAtual <
                  images.length -
                    1 && (
                  <TouchableOpacity
                    style={[
                      styles.carouselArrow,
                      styles.carouselArrowRight,
                    ]}
                    onPress={
                      proximaImagem
                    }
                    activeOpacity={
                      0.8
                    }
                  >
                    <Feather
                      name="chevron-right"
                      size={26}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                )}

                {/* CONTADOR */}

                <View
                  style={
                    styles.slideCounter
                  }
                >
                  <Text
                    style={
                      styles.slideCounterText
                    }
                  >
                    {imagemAtual +
                      1}{" "}
                    /{" "}
                    {images.length}
                  </Text>
                </View>
              </View>

              {/* BOLINHAS */}

              {images.length >
                1 && (
                <View
                  style={
                    styles.pagination
                  }
                >
                  {images.map(
                    (
                      _,
                      index
                    ) => (
                      <View
                        key={index}
                        style={[
                          styles.paginationDot,

                          index ===
                            imagemAtual &&
                            styles.paginationDotActive,
                        ]}
                      />
                    )
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* ==================================================== */}
        {/* ENVIAR DENÚNCIA */}
        {/* ==================================================== */}

        <TouchableOpacity
          style={[
            styles.reportButton,

            loading && {
              opacity: 0.7,
            },
          ]}
          activeOpacity={0.8}
          onPress={
            handleDenunciar
          }
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator
              color="#FFFFFF"
              size="small"
            />
          ) : (
            <>
              <Feather
                name="flag"
                size={18}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.reportButtonText
                }
              >
                Enviar Denúncia
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text
          style={
            styles.footerHelpText
          }
        >
          As denúncias devem ser
          utilizadas de forma
          responsável.
        </Text>
      </ScrollView>

      {/* ====================================================== */}
      {/* MODAL DE CATEGORIA */}
      {/* ====================================================== */}

      <Modal
        visible={
          categoryModalVisible
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setCategoryModalVisible(
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
              styles.modalContainer
            }
          >
            <View
              style={
                styles.modalHandle
              }
            />

            <Text
              style={
                styles.modalTitle
              }
            >
              Motivo da denúncia
            </Text>

            <Text
              style={
                styles.modalSubtitle
              }
            >
              Escolha a opção que
              melhor representa o
              que aconteceu.
            </Text>

            {categories.map(
              (item) => {
                const selecionado =
                  selectedCategory ===
                  item.nome;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.modalItem,

                      selecionado &&
                        styles.modalItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedCategory(
                        item.nome
                      );

                      setCategoryModalVisible(
                        false
                      );
                    }}
                    activeOpacity={
                      0.7
                    }
                  >
                    <View
                      style={
                        styles.modalItemContent
                      }
                    >
                      <Text
                        style={[
                          styles.modalItemText,

                          selecionado &&
                            styles.modalItemTextSelected,
                        ]}
                      >
                        {item.nome}
                      </Text>

                      <Text
                        style={
                          styles.modalItemDescription
                        }
                      >
                        {
                          item.descricao
                        }
                      </Text>
                    </View>

                    {selecionado && (
                      <Feather
                        name="check-circle"
                        size={20}
                        color="#0099FF"
                      />
                    )}
                  </TouchableOpacity>
                );
              }
            )}

            <TouchableOpacity
              style={
                styles.modalCloseButton
              }
              onPress={() =>
                setCategoryModalVisible(
                  false
                )
              }
            >
              <Text
                style={
                  styles.modalCloseButtonText
                }
              >
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ====================================================== */}
      {/* MODAL DE SUCESSO */}
      {/* ====================================================== */}

      <Modal
        animationType="fade"
        transparent
        visible={
          successModalVisible
        }
        onRequestClose={() =>
          setSuccessModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.profileModalOverlay
          }
        >
          <View
            style={
              styles.profileModalContent
            }
          >
            <View
              style={
                styles.successIcon
              }
            >
              <Feather
                name="check"
                size={30}
                color="#FFFFFF"
              />
            </View>

            <Text
              style={
                styles.successModalTitle
              }
            >
              Denúncia registrada
            </Text>

            <Text
              style={
                styles.successModalSubtitle
              }
            >
              A denúncia foi
              preparada com sucesso.
              Quando a integração
              com o sistema estiver
              pronta, ela será
              encaminhada para
              análise.
            </Text>

            <TouchableOpacity
              style={
                styles.successButton
              }
              onPress={() => {
                setSuccessModalVisible(
                  false
                );

                if (
                  router.canGoBack()
                ) {
                  router.back();
                } else {
                  router.replace(
                    "/"
                  );
                }
              }}
            >
              <Text
                style={
                  styles.successButtonText
                }
              >
                Entendi
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ====================================================== */}
      {/* MODAL DE ERRO */}
      {/* ====================================================== */}

      <Modal
        animationType="fade"
        transparent
        visible={
          errorModalVisible
        }
        onRequestClose={() =>
          setErrorModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.profileModalOverlay
          }
        >
          <View
            style={
              styles.profileModalContent
            }
          >
            <View
              style={
                styles.errorIcon
              }
            >
              <Feather
                name="alert-triangle"
                size={29}
                color="#E53935"
              />
            </View>

            <Text
              style={
                styles.errorModalTitle
              }
            >
              Não foi possível
              continuar
            </Text>

            <Text
              style={
                styles.errorModalSubtitle
              }
            >
              {errorMessage}
            </Text>

            <TouchableOpacity
              style={
                styles.errorButton
              }
              onPress={() =>
                setErrorModalVisible(
                  false
                )
              }
            >
              <Text
                style={
                  styles.errorButtonText
                }
              >
                Entendi
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ================================================================
   ESTILOS
================================================================ */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  /* ============================================================
     HEADER
  ============================================================ */

  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },

  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },

  headerTitle: {
    fontFamily:
      "Montserrat_700Bold",
    fontSize: 16,
    color: "#005386",
  },

  headerPlaceholder: {
    width: 40,
  },

  /* ============================================================
     TÍTULOS
  ============================================================ */

  mainTitle: {
    fontFamily:
      "Montserrat_700Bold",
    fontSize: 25,
    color: "#005386",
    marginBottom: 4,
  },

  mainSubtitle: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 13,
    color: "#666666",
    marginBottom: 20,
    lineHeight: 20,
  },

  /* ============================================================
     USUÁRIO DENUNCIADO
  ============================================================ */

  reportedUserCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5FBFF",
    borderWidth: 1,
    borderColor: "#D9EFFC",
    borderRadius: 14,
    padding: 13,
    marginBottom: 14,
  },

  /* FOTO REAL */

  reportedUserPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E4F8FF",
  },

  /* FALLBACK SEM FOTO */

  reportedUserIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
  },

  reportedUserInfo: {
    flex: 1,
    marginLeft: 11,
  },

  reportedUserLabel: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 10,
    color: "#777777",
  },

  reportedUserName: {
    fontFamily:
      "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
    marginTop: 2,
  },

  /* ============================================================
     AVISO
  ============================================================ */

  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0F8FF",
    padding: 12,
    borderRadius: 10,
    marginBottom: 22,
    gap: 9,
  },

  noticeText: {
    flex: 1,
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 11,
    color: "#005386",
    lineHeight: 18,
  },

  /* ============================================================
     CAMPOS
  ============================================================ */

  fieldGroup: {
    marginBottom: 5,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  label: {
    fontFamily:
      "Montserrat_600SemiBold",
    fontSize: 15,
    color: "#333333",
    marginBottom: 8,
  },

  characterCounter: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 11,
    color: "#888888",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#0099FF",
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 14,
    color: "#333333",
    marginBottom: 16,
  },

  textArea: {
    height: 135,
    paddingTop: 12,
    paddingBottom: 12,
    textAlignVertical: "top",
  },

  inputPicker: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#0099FF",
    marginBottom: 18,
  },

  inputText: {
    flex: 1,
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 14,
    color: "#333333",
    marginRight: 8,
  },

  inputPlaceholder: {
    flex: 1,
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 14,
    color: "#777777",
    marginRight: 8,
  },

  /* ============================================================
     IMAGENS
  ============================================================ */

  imagesTitleRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "flex-start",
  },

  optionalText: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 10,
    color: "#888888",
    marginTop: -5,
    marginBottom: 8,
  },

  imageCounterTop: {
    fontFamily:
      "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#005386",
    marginTop: 2,
  },

  photosButton: {
    backgroundColor: "#F5FBFF",
    borderWidth: 1,
    borderColor: "#9ED6F7",
    borderStyle: "dashed",
    borderRadius: 10,
    minHeight: 65,
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: "row",
  },

  photosButtonDisabled: {
    backgroundColor: "#EEEEEE",
    borderColor: "#CCCCCC",
  },

  photoButtonTexts: {
    flex: 1,
    marginLeft: 10,
  },

  photosButtonText: {
    fontFamily:
      "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#005386",
  },

  photosButtonSubtext: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 10,
    color: "#777777",
    marginTop: 2,
  },

  carouselContainer: {
    position: "relative",
    width: SCREEN_WIDTH - 40,
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F2F2F2",
    borderWidth: 1,
    borderColor: "#0099FF",
  },

  imageSlide: {
    width: SCREEN_WIDTH - 40,
    height: 220,
    position: "relative",
    backgroundColor: "#EEEEEE",
  },

  imagePreview: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E1E1E1",
  },

  evidenceBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor:
      "rgba(0, 83, 134, 0.90)",
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  evidenceBadgeText: {
    fontFamily:
      "Montserrat_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
  },

  removeImageButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor:
      "rgba(229, 57, 53, 0.90)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  carouselArrow: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor:
      "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
  },

  carouselArrowLeft: {
    left: 10,
  },

  carouselArrowRight: {
    right: 10,
  },

  slideCounter: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor:
      "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },

  slideCounterText: {
    fontFamily:
      "Montserrat_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 15,
    gap: 6,
  },

  paginationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#CCCCCC",
  },

  paginationDotActive: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#005386",
  },

  /* ============================================================
     BOTÃO DENUNCIAR
  ============================================================ */

  reportButton: {
    backgroundColor: "#D9534F",
    borderRadius: 8,
    minHeight: 50,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
    gap: 8,
    elevation: 2,
  },

  reportButtonText: {
    fontFamily:
      "Montserrat_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },

  footerHelpText: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 10,
    color: "#888888",
    textAlign: "center",
    marginTop: 10,
  },

  /* ============================================================
     MODAL CATEGORIA
  ============================================================ */

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 35,
  },

  modalHandle: {
    width: 45,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D3D3D3",
    alignSelf: "center",
    marginBottom: 15,
  },

  modalTitle: {
    fontFamily:
      "Montserrat_700Bold",
    fontSize: 18,
    color: "#333333",
    marginBottom: 4,
    textAlign: "center",
  },

  modalSubtitle: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 11,
    lineHeight: 17,
    color: "#777777",
    textAlign: "center",
    marginBottom: 15,
  },

  modalItem: {
    minHeight: 59,
    borderBottomWidth: 1,
    borderBottomColor: "#ECECEC",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 9,
  },

  modalItemSelected: {
    backgroundColor: "#F5FBFF",
  },

  modalItemContent: {
    flex: 1,
    marginRight: 10,
  },

  modalItemText: {
    fontFamily:
      "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#444444",
  },

  modalItemTextSelected: {
    color: "#005386",
  },

  modalItemDescription: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 10,
    color: "#777777",
    marginTop: 3,
    lineHeight: 15,
  },

  modalCloseButton: {
    marginTop: 16,
    backgroundColor: "#F5F5F5",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  modalCloseButtonText: {
    fontFamily:
      "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#2E70B4",
  },

  /* ============================================================
     MODAIS DE RESULTADO
  ============================================================ */

  profileModalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  profileModalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  successIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#0099FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  successModalTitle: {
    fontFamily:
      "Montserrat_700Bold",
    fontSize: 18,
    color: "#005386",
    textAlign: "center",
    marginBottom: 8,
  },

  successModalSubtitle: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#666666",
    textAlign: "center",
    marginBottom: 22,
  },

  successButton: {
    width: "100%",
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#0099FF",
    justifyContent: "center",
    alignItems: "center",
  },

  successButtonText: {
    fontFamily:
      "Montserrat_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },

  errorIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#FFF1F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  errorModalTitle: {
    fontFamily:
      "Montserrat_700Bold",
    fontSize: 18,
    color: "#E53935",
    textAlign: "center",
    marginBottom: 8,
  },

  errorModalSubtitle: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#666666",
    textAlign: "center",
    marginBottom: 22,
  },

  errorButton: {
    width: "100%",
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: "#E53935",
    justifyContent: "center",
    alignItems: "center",
  },

  errorButtonText: {
    fontFamily:
      "Montserrat_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
});