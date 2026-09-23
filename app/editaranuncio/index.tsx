import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";

export default function EditarAnuncioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const idProduto = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [nomeProduto, setNomeProduto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [estadoConservacao, setEstadoConservacao] = useState("");

  const [idCategoria, setIdCategoria] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");

  const [statusProduto, setStatusProduto] = useState("");

  const [image, setImage] = useState<any>(null);
  const [imagemAtual, setImagemAtual] = useState("");

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [categoryModalVisible, setCategoryModalVisible] =
    useState(false);

  const opcoesConservacao = [
    "Novo",
    "Semi-novo",
    "Usado",
    "Com defeito / Quebrado",
  ];

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

  function converterCondicaoParaTexto(codigo: string) {
    switch (codigo) {
      case "N":
        return "Novo";
      case "S":
        return "Semi-novo";
      case "U":
        return "Usado";
      case "Q":
        return "Com defeito / Quebrado";
      default:
        return "";
    }
  }

  function converterTextoParaCondicao(texto: string) {
    switch (texto) {
      case "Novo":
        return "N";
      case "Semi-novo":
        return "S";
      case "Usado":
        return "U";
      case "Com defeito / Quebrado":
        return "Q";
      default:
        return "";
    }
  }

  function converterCategoriaParaTexto(id: number) {
    const categoria = categories.find(
      (item) => item.id === Number(id)
    );

    return categoria ? categoria.nome : "";
  }

  useEffect(() => {
    carregarAnuncio();
  }, []);

  async function carregarAnuncio() {
    try {
      if (!idProduto) {
        Alert.alert(
          "Erro",
          "Não foi possível identificar o anúncio."
        );
        router.back();
        return;
      }

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Erro",
          "Sua sessão não foi encontrada."
        );
        router.back();
        return;
      }

      const response = await api.get("/my-products", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const produtos = response.data;

      const produto = produtos.find(
        (item: any) =>
          String(item.id_produto) === String(idProduto)
      );

      if (!produto) {
        Alert.alert(
          "Erro",
          "Anúncio não encontrado ou você não tem permissão para editá-lo."
        );
        router.back();
        return;
      }

      setNomeProduto(produto.nm_produto || "");
      setDescricao(produto.ds_produto || "");

      setEstadoConservacao(
        converterCondicaoParaTexto(produto.st_condicao)
      );

      setIdCategoria(produto.id_categoria);

      setSelectedCategory(
        converterCategoriaParaTexto(produto.id_categoria)
      );

      setStatusProduto(produto.st_status);

      // Carrega a imagem atual
      if (
        produto.images &&
        produto.images.length > 0
      ) {
        const primeiraImagem = produto.images[0];

        if (primeiraImagem?.ds_imagem) {
          const caminhoImagem =
            primeiraImagem.ds_imagem;

const baseUrl =
  api.defaults.baseURL?.replace(
    /\/api\/?$/,
    ""
  ) || "http://127.0.0.1:8000";

const caminhoLimpo = String(caminhoImagem)
  .replace(/^\/+/, "")
  .replace(/^storage\/+/, "");

setImagemAtual(
  caminhoImagem.startsWith("http")
    ? caminhoImagem
    : `${baseUrl}/storage/${caminhoLimpo}`
);
        }
      }
    } catch (error: any) {
      console.log(
        "Erro ao carregar anúncio:",
        error?.response?.data || error
      );

      Alert.alert(
        "Erro",
        "Não foi possível carregar os dados do anúncio."
      );

      router.back();
    } finally {
      setCarregando(false);
    }
  }

  async function pickImage() {
    try {
      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 1,
        });

      if (!result.canceled) {
        setImage(result.assets[0]);
      }
    } catch (error) {
      console.log(
        "Erro ao selecionar imagem:",
        error
      );

      Alert.alert(
        "Erro",
        "Não foi possível selecionar a imagem."
      );
    }
  }

  async function handleSalvar() {
    try {
      if (!idProduto) {
        Alert.alert(
          "Erro",
          "Não foi possível identificar o anúncio."
        );
        return;
      }

      if (!nomeProduto.trim()) {
        Alert.alert(
          "Atenção",
          "Informe o nome do produto."
        );
        return;
      }

      if (!selectedCategory || idCategoria === null) {
        Alert.alert(
          "Atenção",
          "Selecione uma categoria."
        );
        return;
      }

      if (!estadoConservacao) {
        Alert.alert(
          "Atenção",
          "Selecione o estado de conservação."
        );
        return;
      }

      if (!statusProduto) {
        Alert.alert(
          "Erro",
          "Não foi possível identificar o status do anúncio."
        );
        return;
      }

      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Erro",
          "Sua sessão não foi encontrada."
        );
        return;
      }

      setSalvando(true);

      const stCondicao =
        converterTextoParaCondicao(
          estadoConservacao
        );

      /*
       * Se uma nova imagem foi escolhida,
       * usamos FormData para enviar os dados
       * junto com a imagem.
       */
      // Primeiro atualiza os dados do anúncio
await api.put(
  `/products/${idProduto}`,
  {
    id_categoria: idCategoria,
    nm_produto: nomeProduto.trim(),
    ds_produto: descricao.trim() || null,
    st_condicao: stCondicao,
    st_status: statusProduto,
  },
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  }
);

// Se uma nova imagem foi escolhida,
// atualiza a imagem separadamente
if (image) {
  const formData = new FormData();

  if (image.file) {
    formData.append(
      "imagem",
      image.file
    );
  } else if (
    image.uri.startsWith("blob:") ||
    image.uri.startsWith("http")
  ) {
    const response =
      await fetch(image.uri);

    const blob =
      await response.blob();

    formData.append(
      "imagem",
      blob,
      "produto.jpg"
    );
  } else {
    formData.append(
      "imagem",
      {
        uri: image.uri,
        name:
          image.fileName ||
          "produto.jpg",
        type:
          image.mimeType ||
          "image/jpeg",
      } as any
    );
  }

  await api.post(
    `/produtos/${idProduto}/imagem`,
    formData,
    {
      headers: {
        "Content-Type":
          "multipart/form-data",
        Accept: "application/json",
        Authorization:
          `Bearer ${token}`,
      },
    }
  );
}
      alert(
        "Anúncio atualizado com sucesso!"
      );

      router.back();

    } catch (error: any) {
      console.log(
        "Erro ao atualizar anúncio:",
        error?.response?.data || error
      );

      let mensagem =
        "Não foi possível atualizar o anúncio.";

      if (error?.response?.data?.message) {
        mensagem =
          error.response.data.message;
      }

      if (error?.response?.data?.errors) {
        const erros =
          error.response.data.errors;

        const primeiroCampo =
          Object.keys(erros)[0];

        if (
          primeiroCampo &&
          erros[primeiroCampo]?.[0]
        ) {
          mensagem =
            erros[primeiroCampo][0];
        }
      }

      Alert.alert(
        "Erro",
        mensagem
      );
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <SafeAreaView
        style={styles.container}
      >
        <View
          style={styles.loadingContainer}
        >
          <ActivityIndicator
            size="large"
            color="#0099FF"
          />

          <Text
            style={styles.loadingText}
          >
            Carregando anúncio...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
    >
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Feather
            name="arrow-left"
            size={24}
            color="#005386"
          />
        </TouchableOpacity>

        <Text
          style={styles.headerTitle}
        >
          Editar Anúncio
        </Text>

        <View
          style={{ width: 36 }}
        />
      </View>

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* NOME */}
        <Text style={styles.label}>
          Nome do Produto
        </Text>

        <TextInput
          style={styles.input}
          value={nomeProduto}
          onChangeText={
            setNomeProduto
          }
          placeholder="Ex: Placa de Vídeo RTX 3060"
          editable={!salvando}
        />

        {/* CATEGORIA */}
        <Text style={styles.label}>
          Categoria
        </Text>

        <TouchableOpacity
          style={styles.inputPicker}
          onPress={() =>
            !salvando &&
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

        {/* CONDIÇÃO */}
        <Text style={styles.label}>
          Estado de Conservação
        </Text>

        <View
          style={styles.optionsList}
        >
          {opcoesConservacao.map(
            (opcao) => {
              const isSelected =
                estadoConservacao ===
                opcao;

              return (
                <TouchableOpacity
                  key={opcao}
                  style={[
                    styles.optionCard,
                    isSelected &&
                      styles.optionCardSelected,
                  ]}
                  onPress={() =>
                    !salvando &&
                    setEstadoConservacao(
                      opcao
                    )
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {opcao}
                  </Text>

                  <View
                    style={[
                      styles.radioCircle,
                      isSelected &&
                        styles.radioCircleSelected,
                    ]}
                  >
                    {isSelected && (
                      <View
                        style={
                          styles.radioInnerCircle
                        }
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }
          )}
        </View>

        {/* IMAGEM */}
        <Text style={styles.label}>
          Imagem do Produto
        </Text>

        <TouchableOpacity
          style={styles.photosButton}
          activeOpacity={0.8}
          onPress={pickImage}
          disabled={salvando}
        >
          <Feather
            name="image"
            size={22}
            color="#444"
          />

          <Text
            style={
              styles.photosButtonText
            }
          >
            {image
              ? "📷 Trocar imagem"
              : "Alterar imagem"}
          </Text>
        </TouchableOpacity>

        {(image || imagemAtual) && (
          <View
            style={
              styles.imagePreviewContainer
            }
          >
            <Image
              source={{
                uri: image
                  ? image.uri
                  : imagemAtual,
              }}
              style={
                styles.imagePreview
              }
              resizeMode="contain"
            />

            {image && (
              <TouchableOpacity
                style={
                  styles.removeImageButton
                }
                onPress={() =>
                  setImage(null)
                }
                disabled={salvando}
              >
                <Feather
                  name="x"
                  size={20}
                  color="#fff"
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* DESCRIÇÃO */}
        <Text style={styles.label}>
          Descrição
        </Text>

        <TextInput
          style={[
            styles.input,
            styles.textArea,
          ]}
          value={descricao}
          onChangeText={
            setDescricao
          }
          placeholder="Descreva detalhes da sua peça..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!salvando}
        />

        {/* BOTÃO SALVAR */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            salvando &&
              styles.saveButtonDisabled,
          ]}
          onPress={handleSalvar}
          disabled={salvando}
        >
          {salvando ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text
              style={
                styles.saveButtonText
              }
            >
              Salvar Alterações
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL DE CATEGORIA */}
      <Modal
        visible={
          categoryModalVisible
        }
        animationType="slide"
        transparent
        onRequestClose={() =>
          setCategoryModalVisible(false)
        }
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.modalContainer}
          >
            <Text
              style={styles.modalTitle}
            >
              Selecione a Categoria
            </Text>

            {categories.map(
              (item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setSelectedCategory(
                      item.nome
                    );

                    setIdCategoria(
                      item.id
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
              )
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },

  headerButton: {
    padding: 6,
  },

  headerTitle: {
    fontSize: 16,
    fontFamily: "Montserrat_700Bold",
    color: "#005386",
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  label: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#333333",
    marginBottom: 8,
    marginTop: 12,
  },

  input: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333333",
    backgroundColor: "#F9F9F9",
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
    marginBottom: 4,
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

  textArea: {
    height: 100,
    textAlignVertical: "top",
  },

  optionsList: {
    gap: 8,
    marginBottom: 4,
  },

  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    backgroundColor: "#F9F9F9",
  },

  optionCardSelected: {
    backgroundColor: "#E4F8FF",
    borderColor: "#0099FF",
  },

  optionText: {
    fontSize: 14,
    color: "#666666",
    fontFamily: "Montserrat_500Medium",
  },

  optionTextSelected: {
    color: "#005386",
    fontFamily: "Montserrat_700Bold",
  },

  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CCCCCC",
    alignItems: "center",
    justifyContent: "center",
  },

  radioCircleSelected: {
    borderColor: "#0099FF",
  },

  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0099FF",
  },

  photosButton: {
    backgroundColor: "#E2E2E2",
    borderWidth: 1,
    borderColor: "#BCBCBC",
    borderStyle: "dashed",
    borderRadius: 8,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  photosButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#444",
  },

  imagePreviewContainer: {
    position: "relative",
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#0099FF",
    backgroundColor: "#F5F5F5",
    aspectRatio: 16 / 9,
  },

  imagePreview: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E1E1E1",
  },

  removeImageButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor:
      "rgba(255, 0, 0, 0.8)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  saveButton: {
    backgroundColor: "#0099FF",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 30,
  },

  saveButtonDisabled: {
    opacity: 0.7,
  },

  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Montserrat_700Bold",
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#666666",
    fontFamily: "Montserrat_500Medium",
  },

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
    padding: 20,
    paddingBottom: 40,
  },

  modalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#333333",
    marginBottom: 16,
    textAlign: "center",
  },

  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#ECECEC",
  },

  modalItemText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 16,
    color: "#444444",
  },

  modalCloseButton: {
    marginTop: 16,
    backgroundColor: "#F5F5F5",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },

  modalCloseButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#2E70B4",
  },
});
