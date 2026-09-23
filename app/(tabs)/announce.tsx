import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../../services/api.js";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";

import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AnnounceScreen() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

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

  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState("");

  const conditionOptions = [
    "Novo",
    "Seminovo",
    "Usado",
    "Quebrado",
  ];

  const [image, setImage] = useState<any>(null);

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0]);
    }
  }

  async function handlePublish() {
    if (!title || !selectedCategory || !selectedCondition) {
      setErrorMessage(
        "Preencha pelo menos o título, a categoria e a condição da peça."
      );
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);

    try {
      const token =
        (await AsyncStorage.getItem("token")) ||
        (await AsyncStorage.getItem("userToken"));

      const categoryFound = categories.find(
        (cat) => cat.nome === selectedCategory
      );

      const id_categoria = categoryFound
        ? categoryFound.id
        : 1;

      const conditionMap: Record<string, string> = {
        Novo: "N",
        Seminovo: "S",
        Usado: "U",
        Quebrado: "Q",
      };

      const stCondicao =
        conditionMap[selectedCondition] || "U";

      const formData = new FormData();

      formData.append(
        "id_categoria",
        String(id_categoria)
      );

      formData.append(
        "nm_produto",
        title
      );

      formData.append(
        "ds_produto",
        description || ""
      );

      formData.append(
        "st_condicao",
        stCondicao
      );

      formData.append(
        "st_status",
        "A"
      );

      if (image) {
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
      }

      await api.post(
        "/products",
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
            Accept:
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      setTitle("");
      setDescription("");
      setSelectedCategory("");
      setSelectedCondition("");
      setImage(null);

      setSuccessModalVisible(true);
    } catch (error: any) {
      console.log(
        "ERRO SERVIDOR LARAVEL:",
        error.response?.data ||
          error.message
      );

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
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
      {/* TÍTULO DA TELA */}
      <Text style={styles.mainTitle}>
        Anunciar
      </Text>

      <Text style={styles.mainSubtitle}>
        Preencha as informações para trocar seu componente.
      </Text>

      {/* Título do Anúncio */}
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

      {/* Categoria */}
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

      {/* Estado de Conservação */}
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

      {/* Imagens do Produto */}
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Imagens do Produto
        </Text>

        <TouchableOpacity
          style={styles.photosButton}
          activeOpacity={0.8}
          onPress={pickImage}
        >
          <Feather
            name="image"
            size={22}
            color="#444"
          />

          <Text style={styles.photosButtonText}>
            {image
              ? "📷 Trocar imagem"
              : "Adicionar Fotos da Peça"}
          </Text>
        </TouchableOpacity>

        {image && (
          <View
            style={
              styles.imagePreviewContainer
            }
          >
            <Image
              source={{ uri: image.uri }}
              style={styles.imagePreview}
              resizeMode="contain"
            />

            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() =>
                setImage(null)
              }
            >
              <Feather
                name="x"
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Descrição Detalhada */}
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

      {/* Botão Publicar */}
      <TouchableOpacity
        style={[
          styles.publishButton,
          loading && { opacity: 0.7 },
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
            style={styles.publishButtonText}
          >
            Publicar Anúncio
          </Text>
        )}
      </TouchableOpacity>

      {/* Modal Categoria */}
      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setCategoryModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
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

      {/* Modal Condição */}
      <Modal
        visible={conditionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() =>
          setConditionModalVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              Estado de Conservação
            </Text>

            {conditionOptions.map(
              (item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.modalItem}
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

      {/* Modal de sucesso */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={successModalVisible}
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
              Sua peça foi cadastrada com sucesso e já está disponível para visualização no aplicativo.
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

      {/* Modal de erro */}
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
                { color: "#E53935" },
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
    backgroundColor: "#f5f5f5",
    aspectRatio: 16 / 9,
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
    backgroundColor: "rgba(255, 0, 0, 0.8)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  textArea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: "top",
  },

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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
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
