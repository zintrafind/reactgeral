import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../services/api.js";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useRef, useState } from "react";

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

const LIMITE_IMAGENS = 5;

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function AnnounceScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const [successModalVisible, setSuccessModalVisible] =
    useState(false);

  const [errorModalVisible, setErrorModalVisible] =
    useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [categoryModalVisible, setCategoryModalVisible] =
    useState(false);

  const [selectedCategory, setSelectedCategory] =
    useState("");

  const [conditionModalVisible, setConditionModalVisible] =
    useState(false);

  const [selectedCondition, setSelectedCondition] =
    useState("");

  // ============================================================
  // IMAGENS
  // ============================================================

  const [images, setImages] = useState<any[]>([]);
  const [imagemAtual, setImagemAtual] = useState(0);

  const carouselRef = useRef<ScrollView>(null);

  // ============================================================
  // CATEGORIAS
  // ============================================================

  const categories = [
    { id: 1, nome: "Hardware" },
    { id: 2, nome: "Computador e notebook" },
    { id: 3, nome: "Celular e tablet" },
    { id: 4, nome: "Memórias e pen drives" },
    { id: 5, nome: "Fontes e carregadores" },
    { id: 6, nome: "Impressoras e adaptadores" },
    { id: 7, nome: "Consoles e videogames" },
    { id: 8, nome: "Câmeras" },
    { id: 9, nome: "Outros" },
  ];

  // ============================================================
  // CONDIÇÕES
  // ============================================================

  const conditionOptions = [
    "Novo",
    "Seminovo",
    "Usado",
    "Quebrado",
  ];

  // ============================================================
  // SELECIONAR IMAGENS
  // ============================================================

  async function pickImages() {
    const quantidadeDisponivel =
      LIMITE_IMAGENS - images.length;

    if (quantidadeDisponivel <= 0) {
      setErrorMessage(
        `Você pode adicionar no máximo ${LIMITE_IMAGENS} imagens por anúncio.`
      );

      setErrorModalVisible(true);

      return;
    }

    try {
      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: true,
          selectionLimit: quantidadeDisponivel,
          quality: 1,
        });

      if (!result.canceled) {
        const novasImagens = result.assets || [];

        setImages((imagensAnteriores) => {
          const todasImagens = [
            ...imagensAnteriores,
            ...novasImagens,
          ];

          return todasImagens.slice(
            0,
            LIMITE_IMAGENS
          );
        });
      }
    } catch (error) {
      console.log(
        "Erro ao selecionar imagens:",
        error
      );

      setErrorMessage(
        "Não foi possível selecionar as imagens."
      );

      setErrorModalVisible(true);
    }
  }

  // ============================================================
  // REMOVER IMAGEM
  // ============================================================

  function removerImagem(index: number) {
    const novasImagens = images.filter(
      (_, imageIndex) => imageIndex !== index
    );

    setImages(novasImagens);

    let novoIndice = imagemAtual;

    if (novasImagens.length === 0) {
      novoIndice = 0;
    } else if (
      imagemAtual >= novasImagens.length
    ) {
      novoIndice = novasImagens.length - 1;
    }

    setImagemAtual(novoIndice);

    setTimeout(() => {
      carouselRef.current?.scrollTo({
        x: novoIndice * (SCREEN_WIDTH - 40),
        animated: true,
      });
    }, 100);
  }

  // ============================================================
  // CONTROLAR SLIDE
  // ============================================================

  function handleScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) {
    const largura = SCREEN_WIDTH - 40;

    const indice = Math.round(
      event.nativeEvent.contentOffset.x / largura
    );

    setImagemAtual(indice);
  }

  // ============================================================
  // IR PARA IMAGEM ANTERIOR
  // ============================================================

  function imagemAnterior() {
    if (imagemAtual <= 0) {
      return;
    }

    const novoIndice = imagemAtual - 1;

    carouselRef.current?.scrollTo({
      x: novoIndice * (SCREEN_WIDTH - 40),
      animated: true,
    });

    setImagemAtual(novoIndice);
  }

  // ============================================================
  // IR PARA PRÓXIMA IMAGEM
  // ============================================================

  function proximaImagem() {
    if (imagemAtual >= images.length - 1) {
      return;
    }

    const novoIndice = imagemAtual + 1;

    carouselRef.current?.scrollTo({
      x: novoIndice * (SCREEN_WIDTH - 40),
      animated: true,
    });

    setImagemAtual(novoIndice);
  }

async function handlePublish() {
  if (loading) return;

  if (
    !title.trim() ||
    !selectedCategory ||
    !selectedCondition
  ) {
    setErrorMessage(
      "Preencha o título, a categoria e a condição da peça."
    );
    setErrorModalVisible(true);
    return;
  }

  if (images.length === 0) {
    setErrorMessage(
      "Adicione pelo menos uma imagem do produto."
    );
    setErrorModalVisible(true);
    return;
  }

  if (images.length > LIMITE_IMAGENS) {
    setErrorMessage(
      `Você pode adicionar no máximo ${LIMITE_IMAGENS} imagens.`
    );
    setErrorModalVisible(true);
    return;
  }

  const limiteBytes = 5 * 1024 * 1024;

  const imagemMuitoGrande = images.some(
    (image) =>
      (image.file?.size ?? image.fileSize ?? 0) >
      limiteBytes
  );

  if (imagemMuitoGrande) {
    setErrorMessage(
      "Cada imagem deve ter no máximo 5 MB."
    );
    setErrorModalVisible(true);
    return;
  }

  setLoading(true);

  try {
    const token =
      (await AsyncStorage.getItem("token")) ||
      (await AsyncStorage.getItem("userToken"));

    if (!token) {
      setErrorMessage(
        "Entre na sua conta para publicar um anúncio."
      );
      setErrorModalVisible(true);
      return;
    }

    const categoryFound = categories.find(
      (cat) => cat.nome === selectedCategory
    );

    if (!categoryFound) {
      setErrorMessage(
        "Selecione uma categoria válida."
      );
      setErrorModalVisible(true);
      return;
    }

    const conditionMap: Record<string, string> = {
      Novo: "N",
      Seminovo: "S",
      Usado: "U",
      Quebrado: "Q",
    };

    const stCondicao =
      conditionMap[selectedCondition];

    if (!stCondicao) {
      setErrorMessage(
        "Selecione uma condição válida."
      );
      setErrorModalVisible(true);
      return;
    }

    const formData = new FormData();

    formData.append(
      "id_categoria",
      String(categoryFound.id)
    );

    formData.append(
      "nm_produto",
      title.trim()
    );

    formData.append(
      "ds_produto",
      description.trim()
    );

    formData.append(
      "st_condicao",
      stCondicao
    );

    formData.append(
      "st_status",
      "A"
    );

    // ========================================================
    // ENVIAR TODAS AS IMAGENS
    // ========================================================

    for (const [index, image] of images.entries()) {
      const nomeArquivo =
        image.fileName ||
        `produto-${index + 1}.jpg`;

      if (image.file) {
        // Expo Web: arquivo selecionado pelo navegador.
        formData.append(
          "imagens[]",
          image.file
        );
      } else if (
        image.uri.startsWith("blob:") ||
        image.uri.startsWith("http") ||
        image.uri.startsWith("data:")
      ) {
        // Converte a URI em um arquivo para envio.
        const response = await fetch(image.uri);
        const blob = await response.blob();

        if (blob.size > limiteBytes) {
          throw new Error(
            `A imagem ${index + 1} ultrapassa o limite de 5 MB.`
          );
        }

        formData.append(
          "imagens[]",
          blob,
          nomeArquivo
        );
      } else {
        // Expo Go: arquivo local do celular.
        formData.append(
          "imagens[]",
          {
            uri: image.uri,
            name: nomeArquivo,
            type:
              image.mimeType ||
              "image/jpeg",
          } as any
        );
      }
    }

    // ========================================================
    // PUBLICAR PRODUTO
    // ========================================================

    await api.post(
      "/products",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // ========================================================
    // LIMPAR FORMULÁRIO
    // ========================================================

    setTitle("");
    setDescription("");
    setSelectedCategory("");
    setSelectedCondition("");
    setImages([]);
    setImagemAtual(0);

    carouselRef.current?.scrollTo({
      x: 0,
      animated: false,
    });

    setSuccessModalVisible(true);
  } catch (error: any) {
    console.log(
      "ERRO SERVIDOR LARAVEL:",
      error.response?.data || error.message
    );

    const errosValidacao =
      error.response?.data?.errors;

    const mensagensValidacao = errosValidacao
      ? Object.values(errosValidacao)
          .flat()
          .join("\n")
      : "";

    const message =
      mensagensValidacao ||
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Não foi possível publicar o anúncio.";

    setErrorMessage(message);
    setErrorModalVisible(true);
  } finally {
    setLoading(false);
  }
}

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ====================================================== */}
      {/* TÍTULO */}
      {/* ====================================================== */}

      <Text style={styles.mainTitle}>
        Anunciar
      </Text>

      <Text style={styles.mainSubtitle}>
        Preencha as informações para trocar seu componente.
      </Text>

      {/* ====================================================== */}
      {/* TÍTULO DO ANÚNCIO */}
      {/* ====================================================== */}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Título do Anúncio
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Ex: Placa de Vídeo GTX 1660 Super"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
          maxLength={60}
        />
      </View>

      {/* ====================================================== */}
      {/* CATEGORIA */}
      {/* ====================================================== */}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Categoria
        </Text>

        <TouchableOpacity
          style={styles.inputPicker}
          onPress={() =>
            setCategoryModalVisible(true)
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
              "Selecione uma categoria"}
          </Text>

          <Feather
            name="chevron-down"
            size={18}
            color="#005386"
          />
        </TouchableOpacity>
      </View>

      {/* ====================================================== */}
      {/* ESTADO DE CONSERVAÇÃO */}
      {/* ====================================================== */}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Estado de Conservação
        </Text>

        <TouchableOpacity
          style={styles.inputPicker}
          onPress={() =>
            setConditionModalVisible(true)
          }
          activeOpacity={0.7}
        >
          <Text
            style={
              selectedCondition
                ? styles.inputText
                : styles.inputPlaceholder
            }
          >
            {selectedCondition ||
              "Selecione o estado da peça"}
          </Text>

          <Feather
            name="chevron-down"
            size={18}
            color="#888"
          />
        </TouchableOpacity>
      </View>

      {/* ====================================================== */}
      {/* IMAGENS DO PRODUTO */}
      {/* ====================================================== */}

      <View style={styles.fieldGroup}>
        <View style={styles.imagesTitleRow}>
          <Text style={styles.label}>
            Imagens do Produto
          </Text>

          <Text style={styles.imageCounterTop}>
            {images.length}/{LIMITE_IMAGENS}
          </Text>
        </View>

        {/* BOTÃO ADICIONAR */}

        <TouchableOpacity
          style={[
            styles.photosButton,

            images.length >= LIMITE_IMAGENS &&
              styles.photosButtonDisabled,
          ]}
          activeOpacity={0.8}
          onPress={pickImages}
          disabled={
            images.length >= LIMITE_IMAGENS
          }
        >
          <Feather
            name={
              images.length === 0
                ? "image"
                : "plus"
            }
            size={22}
            color={
              images.length >= LIMITE_IMAGENS
                ? "#999"
                : "#444"
            }
          />

          <Text
            style={[
              styles.photosButtonText,

              images.length >=
                LIMITE_IMAGENS && {
                color: "#999",
              },
            ]}
          >
            {images.length === 0
              ? "Adicionar Fotos da Peça"
              : images.length >=
                  LIMITE_IMAGENS
                ? "Limite de Fotos Atingido"
                : "Adicionar Mais Fotos"}
          </Text>
        </TouchableOpacity>

        {/* ==================================================== */}
        {/* CARROSSEL */}
        {/* ==================================================== */}

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
                scrollEventThrottle={16}
              >
                {images.map(
                  (item, index) => (
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

                      {/* PRIMEIRA FOTO */}

                      {index === 0 && (
                        <View
                          style={
                            styles.mainImageBadge
                          }
                        >
                          <Feather
                            name="star"
                            size={13}
                            color="#FFFFFF"
                          />

                          <Text
                            style={
                              styles.mainImageText
                            }
                          >
                            Foto principal
                          </Text>
                        </View>
                      )}

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
                        activeOpacity={0.8}
                      >
                        <Feather
                          name="x"
                          size={20}
                          color="#fff"
                        />
                      </TouchableOpacity>
                    </View>
                  )
                )}
              </ScrollView>

              {/* SETA ESQUERDA */}

              {imagemAtual > 0 && (
                <TouchableOpacity
                  style={[
                    styles.carouselArrow,
                    styles.carouselArrowLeft,
                  ]}
                  onPress={
                    imagemAnterior
                  }
                  activeOpacity={0.8}
                >
                  <Feather
                    name="chevron-left"
                    size={26}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              )}

              {/* SETA DIREITA */}

              {imagemAtual <
                images.length - 1 && (
                <TouchableOpacity
                  style={[
                    styles.carouselArrow,
                    styles.carouselArrowRight,
                  ]}
                  onPress={
                    proximaImagem
                  }
                  activeOpacity={0.8}
                >
                  <Feather
                    name="chevron-right"
                    size={26}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              )}

              {/* CONTADOR SOBRE A FOTO */}

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
                  {imagemAtual + 1} /{" "}
                  {images.length}
                </Text>
              </View>
            </View>

            {/* BOLINHAS */}

            {images.length > 1 && (
              <View
                style={
                  styles.pagination
                }
              >
                {images.map(
                  (_, index) => (
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

            <Text
              style={
                styles.imagesHelpText
              }
            >
              Você pode adicionar até{" "}
              {LIMITE_IMAGENS} imagens.
              Arraste para o lado para
              visualizar as fotos.
            </Text>
          </>
        )}
      </View>

      {/* ====================================================== */}
      {/* DESCRIÇÃO */}
      {/* ====================================================== */}

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Descrição Detalhada
        </Text>

        <TextInput
          style={[
            styles.input,
            styles.textArea,
          ]}
          placeholder="Descreva o tempo de uso, defeitos (se houver) ou o que aceita na troca..."
          placeholderTextColor="#888"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          maxLength={500}
        />
      </View>

      {/* ====================================================== */}
      {/* PUBLICAR */}
      {/* ====================================================== */}

      <TouchableOpacity
        style={[
          styles.publishButton,
          loading && {
            opacity: 0.7,
          },
        ]}
        activeOpacity={0.8}
        onPress={handlePublish}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator
            color="#fff"
            size="small"
          />
        ) : (
          <Text
            style={
              styles.publishButtonText
            }
          >
            Publicar Anúncio
          </Text>
        )}
      </TouchableOpacity>

      {/* ====================================================== */}
      {/* MODAL CATEGORIA */}
      {/* ====================================================== */}

      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setCategoryModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View
            style={styles.modalContainer}
          >
            <Text
              style={styles.modalTitle}
            >
              Selecione a Categoria
            </Text>

            {categories.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.modalItem}
                onPress={() => {
                  setSelectedCategory(
                    item.nome
                  );

                  setCategoryModalVisible(
                    false
                  );
                }}
              >
                <Text
                  style={
                    styles.modalItemText
                  }
                >
                  {item.nome}
                </Text>
              </TouchableOpacity>
            ))}

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
      {/* MODAL CONDIÇÃO */}
      {/* ====================================================== */}

      <Modal
        visible={
          conditionModalVisible
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setConditionModalVisible(
            false
          )
        }
      >
        <View style={styles.modalOverlay}>
          <View
            style={styles.modalContainer}
          >
            <Text
              style={styles.modalTitle}
            >
              Estado de Conservação
            </Text>

            {conditionOptions.map(
              (item) => (
                <TouchableOpacity
                  key={item}
                  style={
                    styles.modalItem
                  }
                  onPress={() => {
                    setSelectedCondition(
                      item
                    );

                    setConditionModalVisible(
                      false
                    );
                  }}
                >
                  <Text
                    style={
                      styles.modalItemText
                    }
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              )
            )}

            <TouchableOpacity
              style={
                styles.modalCloseButton
              }
              onPress={() =>
                setConditionModalVisible(
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
      {/* MODAL SUCESSO */}
      {/* ====================================================== */}

      <Modal
        animationType="fade"
        transparent={true}
        visible={
          successModalVisible
        }
        onRequestClose={() =>
          setSuccessModalVisible(false)
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
            <Text
              style={
                styles.logoutModalTitle
              }
            >
              Anúncio publicado!
            </Text>

            <Text
              style={
                styles.logoutModalSubtitle
              }
            >
              Sua peça foi cadastrada com
              sucesso e já está disponível
              para visualização no
              aplicativo.
            </Text>

            <View
              style={
                styles.modalButtonsRowSingle
              }
            >
              <TouchableOpacity
                style={
                  styles.confirmLogoutButton
                }
                onPress={() => {
                  setSuccessModalVisible(
                    false
                  );

                  router.replace("/");
                }}
              >
                <Text
                  style={
                    styles.confirmLogoutText
                  }
                >
                  OK
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ====================================================== */}
      {/* MODAL ERRO */}
      {/* ====================================================== */}

      <Modal
        animationType="fade"
        transparent={true}
        visible={errorModalVisible}
        onRequestClose={() =>
          setErrorModalVisible(false)
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
            <Text
              style={[
                styles.logoutModalTitle,
                {
                  color: "#E53935",
                },
              ]}
            >
              Anúncio não publicado
            </Text>

            <Text
              style={
                styles.logoutModalSubtitle
              }
            >
              {errorMessage}
            </Text>

            <View
              style={
                styles.modalButtonsRowSingle
              }
            >
              <TouchableOpacity
                style={[
                  styles.confirmLogoutButton,
                  {
                    backgroundColor:
                      "#E53935",
                  },
                ]}
                onPress={() =>
                  setErrorModalVisible(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.confirmLogoutText
                  }
                >
                  Entendi
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  content: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  mainTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 26,
    color: "#005386",
    marginBottom: 4,
  },

  mainSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: "#666",
    marginBottom: 24,
    lineHeight: 20,
  },

  fieldGroup: {
    marginBottom: 4,
  },

  label: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: "#333",
    marginBottom: 8,
  },

  input: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#0099FF",
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#333333",
    marginBottom: 16,
  },

  inputPicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#0099FF",
    marginBottom: 16,
  },

  inputText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#333",
  },

  inputPlaceholder: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#777777",
  },

  // ==========================================================
  // IMAGENS
  // ==========================================================

  imagesTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  imageCounterTop: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#005386",
    marginBottom: 8,
  },

  photosButton: {
    backgroundColor: "#e2e2e2",
    borderWidth: 1,
    borderColor: "#bcbcbc",
    borderStyle: "dashed",
    borderRadius: 8,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    flexDirection: "row",
    gap: 8,
  },

  photosButtonDisabled: {
    backgroundColor: "#eeeeee",
    borderColor: "#cccccc",
  },

  photosButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#444",
  },

  carouselContainer: {
    position: "relative",
    width: SCREEN_WIDTH - 40,
    height: 230,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f2f2f2",
    borderWidth: 1,
    borderColor: "#0099FF",
  },

  imageSlide: {
    width: SCREEN_WIDTH - 40,
    height: 230,
    position: "relative",
    backgroundColor: "#eeeeee",
  },

  imagePreview: {
    width: "100%",
    height: "100%",
    backgroundColor: "#e1e1e1",
  },

  removeImageButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor:
      "rgba(229, 57, 53, 0.9)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  mainImageBadge: {
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

  mainImageText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
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
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },

  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4,
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

  imagesHelpText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
    textAlign: "center",
    marginTop: 5,
    marginBottom: 16,
  },

  // ==========================================================
  // DESCRIÇÃO
  // ==========================================================

  textArea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  // ==========================================================
  // PUBLICAR
  // ==========================================================

  publishButton: {
    backgroundColor: "#005386",
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    elevation: 2,
  },

  publishButtonText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: "#fff",
  },

  // ==========================================================
  // MODAIS
  // ==========================================================

  modalOverlay: {
    flex: 1,
    backgroundColor:
      "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },

  modalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },

  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#ececec",
  },

  modalItemText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 16,
    color: "#444",
  },

  modalCloseButton: {
    marginTop: 16,
    backgroundColor: "#f5f5f5",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  modalCloseButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#2e70b4",
  },

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
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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

  modalButtonsRowSingle: {
    flexDirection: "row",
    width: "100%",
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