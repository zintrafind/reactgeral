import {
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";

import api from "../../services/api";

import {
  AntDesign,
  MaterialIcons,
} from "@expo/vector-icons";

export default function EditarPerfil() {

  // ============================================================
  // ESTADOS
  // ============================================================

  const [idUsuario, setIdUsuario] = useState<number | null>(null);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const [fotoPerfil, setFotoPerfil] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [banner, setBanner] =
    useState<ImagePicker.ImagePickerAsset | null>(null);

  const [fotoPerfilAntiga, setFotoPerfilAntiga] =
    useState<string | null>(null);

  const [bannerAntigo, setBannerAntigo] =
    useState<string | null>(null);

  // ============================================================
  // MODAL DE RESULTADO
  // ============================================================

  const [modalResultado, setModalResultado] = useState(false);

  const [tipoModal, setTipoModal] =
    useState<"sucesso" | "erro">("sucesso");

  const [mensagemModal, setMensagemModal] =
    useState("");

  // ============================================================
  // CARREGAR USUÁRIO
  // ============================================================

  useEffect(() => {
    carregarUsuario();
  }, []);

  async function carregarUsuario() {

    try {

      const dados =
        await AsyncStorage.getItem("usuario");

      if (!dados) {
        return;
      }

      const usuario =
        JSON.parse(dados);

      // ========================================================
      // DADOS BÁSICOS
      // ========================================================

      setIdUsuario(
        usuario.id_usuario
      );

      setNome(
        usuario.nm_usuario ?? ""
      );

      setDescricao(
        usuario.ds_usuario ?? ""
      );

      // ========================================================
      // FOTO DE PERFIL ANTIGA
      // ========================================================

      if (usuario.ds_foto_perfil) {

        const foto =
          usuario.ds_foto_perfil;

        if (foto.startsWith("http")) {

          setFotoPerfilAntiga(
            foto
          );

        } else {

          setFotoPerfilAntiga(
            `http://127.0.0.1:8000/storage/${foto}`
          );

        }

      } else {

        setFotoPerfilAntiga(null);

      }

      // ========================================================
      // BANNER ANTIGO
      // ========================================================

      if (usuario.ds_banner) {

        const bannerSalvo =
          usuario.ds_banner;

        if (
          bannerSalvo.startsWith("http")
        ) {

          setBannerAntigo(
            bannerSalvo
          );

        } else {

          setBannerAntigo(
            `http://127.0.0.1:8000/storage/${bannerSalvo}`
          );

        }

      } else {

        setBannerAntigo(null);

      }

      console.log(
        "Usuário carregado:",
        usuario
      );

      console.log(
        "Foto antiga:",
        usuario.ds_foto_perfil
      );

      console.log(
        "Banner antigo:",
        usuario.ds_banner
      );

    } catch (erro) {

      console.log(
        "Erro ao carregar usuário:",
        erro
      );

    }

  }

  // ============================================================
  // ESCOLHER FOTO DE PERFIL
  // ============================================================

  async function escolherFotoPerfil() {

    try {

      const permissao =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (!permissao.granted) {

        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso à galeria para escolher sua foto de perfil."
        );

        return;

      }

      const resultado =
        await ImagePicker.launchImageLibraryAsync({

          mediaTypes: ["images"],

          allowsEditing: true,

          aspect: [1, 1],

          quality: 0.8,

        });

      if (!resultado.canceled) {

        const imagem =
          resultado.assets[0];

        console.log(
          "Nova foto de perfil selecionada:",
          imagem.uri
        );

        setFotoPerfil(
          imagem
        );

      }

    } catch (erro) {

      console.log(
        "Erro ao escolher foto:",
        erro
      );

      Alert.alert(
        "Erro",
        "Não foi possível selecionar a foto."
      );

    }

  }

  // ============================================================
  // ESCOLHER BANNER
  // ============================================================

  async function escolherBanner() {

    try {

      const permissao =
        await ImagePicker
          .requestMediaLibraryPermissionsAsync();

      if (!permissao.granted) {

        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso à galeria para escolher seu banner."
        );

        return;

      }

      const resultado =
        await ImagePicker.launchImageLibraryAsync({

          mediaTypes: ["images"],

          allowsEditing: true,

          aspect: [3, 1],

          quality: 0.8,

        });

      if (!resultado.canceled) {

        const imagem =
          resultado.assets[0];

        console.log(
          "Novo banner selecionado:",
          imagem.uri
        );

        setBanner(
          imagem
        );

      }

    } catch (erro) {

      console.log(
        "Erro ao escolher banner:",
        erro
      );

      Alert.alert(
        "Erro",
        "Não foi possível selecionar o banner."
      );

    }

  }

  // ============================================================
  // SALVAR ALTERAÇÕES
  // ============================================================

  async function salvarAlteracoes() {

    try {

      if (!idUsuario) {

        setTipoModal("erro");

        setMensagemModal(
          "Não foi possível identificar o usuário."
        );

        setModalResultado(true);

        return;

      }

      const formData =
        new FormData();

      // ========================================================
      // NOME
      // ========================================================

      formData.append(
        "nm_usuario",
        nome
      );

      // ========================================================
      // DESCRIÇÃO
      // ========================================================

      formData.append(
        "ds_usuario",
        descricao
      );

      // ========================================================
      // FOTO DE PERFIL
      // ========================================================

      if (fotoPerfil) {

        const response =
          await fetch(
            fotoPerfil.uri
          );

        const blob =
          await response.blob();

        formData.append(
          "ds_foto_perfil",
          blob,
          fotoPerfil.fileName ??
            `foto_perfil_${idUsuario}.jpg`
        );

      }

      // ========================================================
      // BANNER
      // ========================================================

      if (banner) {

        const response =
          await fetch(
            banner.uri
          );

        const blob =
          await response.blob();

        formData.append(
          "ds_banner",
          blob,
          banner.fileName ??
            `banner_${idUsuario}.jpg`
        );

      }

      // ========================================================
      // MÉTODO PUT
      // ========================================================

      formData.append(
        "_method",
        "PUT"
      );

      console.log(
        "Enviando alterações do perfil..."
      );

      // ========================================================
      // ENVIA PARA O LARAVEL
      // ========================================================

      const resposta =
        await api.post(
          `/users/${idUsuario}`,
          formData,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },
          }
        );

      // ========================================================
      // USUÁRIO ATUALIZADO
      // ========================================================

      const usuarioAtualizado =
        resposta.data.usuario;

      console.log(
        "Usuário atualizado pela API:",
        usuarioAtualizado
      );

      // ========================================================
      // ATUALIZA AS IMAGENS NA PRÓPRIA TELA
      // ========================================================

      if (
        usuarioAtualizado.ds_foto_perfil
      ) {

        const foto =
          usuarioAtualizado.ds_foto_perfil;

        setFotoPerfilAntiga(
          foto.startsWith("http")
            ? foto
            : `http://127.0.0.1:8000/storage/${foto}`
        );

      }

      if (
        usuarioAtualizado.ds_banner
      ) {

        const bannerSalvo =
          usuarioAtualizado.ds_banner;

        setBannerAntigo(
          bannerSalvo.startsWith("http")
            ? bannerSalvo
            : `http://127.0.0.1:8000/storage/${bannerSalvo}`
        );

      }

      // ========================================================
      // SALVA NO ASYNC STORAGE
      // ========================================================

      await AsyncStorage.setItem(
        "usuario",
        JSON.stringify(
          usuarioAtualizado
        )
      );

      console.log(
        "Usuário salvo no AsyncStorage:",
        usuarioAtualizado
      );

      // ========================================================
      // MODAL DE SUCESSO
      // ========================================================

      setTipoModal(
        "sucesso"
      );

      setMensagemModal(
        "Suas informações foram atualizadas com sucesso."
      );

      setModalResultado(
        true
      );

    } catch (erro: any) {

      console.log(
        "Erro ao atualizar perfil:",
        erro
      );

      console.log(
        "Resposta da API:",
        erro?.response?.data
      );

      // ========================================================
      // MODAL DE ERRO
      // ========================================================

      setTipoModal(
        "erro"
      );

      if (
        erro?.response?.status === 422
      ) {

        setMensagemModal(
          "Verifique as informações preenchidas e as imagens selecionadas."
        );

      } else {

        setMensagemModal(
          "Não foi possível atualizar seu perfil. Tente novamente."
        );

      }

      setModalResultado(
        true
      );

    }

  }

  // ============================================================
  // FECHAR MODAL
  // ============================================================

  function fecharModal() {

    setModalResultado(
      false
    );

    // ==========================================================
    // SE DEU CERTO → VOLTA PARA O PERFIL
    // ==========================================================

    if (
      tipoModal === "sucesso"
    ) {

      router.replace(
        "/perfil" as any
      );

    }

  }

  // ============================================================
  // TELA
  // ============================================================

  return (

    <>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={
          styles.container
        }
      >

        {/* =====================================================
            VOLTAR
        ===================================================== */}

        <TouchableOpacity
          onPress={() =>
            router.replace("/perfil")
          }
          style={styles.back}
        >

          <AntDesign
            name="left"
            size={22}
            color="#005386"
          />

        </TouchableOpacity>


        {/* =====================================================
            TÍTULO
        ===================================================== */}

        <Text
          style={styles.titulo}
        >
          Editar Perfil
        </Text>


        {/* =====================================================
            FOTO DE PERFIL
        ===================================================== */}

        <TouchableOpacity
          style={styles.foto}
          onPress={escolherFotoPerfil}
        >

          {
            fotoPerfil ? (

              <Image
                source={{
                  uri: fotoPerfil.uri,
                }}
                style={
                  styles.fotoImagem
                }
              />

            ) : fotoPerfilAntiga ? (

              <Image
                source={{
                  uri: fotoPerfilAntiga,
                }}
                style={
                  styles.fotoImagem
                }
              />

            ) : (

              <MaterialIcons
                name="person"
                size={50}
                color="#005386"
              />

            )
          }

        </TouchableOpacity>


        {/* =====================================================
            TEXTO FOTO
        ===================================================== */}

        <TouchableOpacity
          onPress={
            escolherFotoPerfil
          }
        >

          <Text
            style={styles.fotoText}
          >
            Alterar Foto de Perfil
          </Text>

        </TouchableOpacity>


        {/* =====================================================
            BANNER
        ===================================================== */}

        <TouchableOpacity
          style={styles.banner}
          onPress={escolherBanner}
        >

          {
            banner ? (

              <Image
                source={{
                  uri: banner.uri,
                }}
                style={
                  styles.bannerImagem
                }
                resizeMode="cover"
              />

            ) : bannerAntigo ? (

              <Image
                source={{
                  uri: bannerAntigo,
                }}
                style={
                  styles.bannerImagem
                }
                resizeMode="cover"
              />

            ) : (

              <>

                <MaterialIcons
                  name="add-photo-alternate"
                  size={35}
                  color="#005386"
                />

                <Text
                  style={
                    styles.bannerText
                  }
                >
                  Alterar Banner
                </Text>

              </>

            )
          }

        </TouchableOpacity>


        {/* =====================================================
            NOME
        ===================================================== */}

        <Text
          style={styles.label}
        >
          Nome de usuário
        </Text>


        <TextInput
          style={styles.input}
          placeholder="Digite seu nome"
          placeholderTextColor="#777"
          value={nome}
          onChangeText={setNome}
        />


        {/* =====================================================
            DESCRIÇÃO
        ===================================================== */}

        <Text
          style={styles.label}
        >
          Descrição
        </Text>


        <TextInput
          style={styles.inputGrande}
          placeholder="Sobre você..."
          placeholderTextColor="#777"
          multiline
          value={descricao}
          onChangeText={
            setDescricao
          }
        />


        {/* =====================================================
            SALVAR
        ===================================================== */}

        <TouchableOpacity
          style={styles.botao}
          onPress={
            salvarAlteracoes
          }
        >

          <Text
            style={styles.botaoTexto}
          >
            Salvar Alterações
          </Text>

        </TouchableOpacity>

      </ScrollView>


      {/* ========================================================
          MODAL DE RESULTADO
      ======================================================== */}

      <Modal
        visible={modalResultado}
        transparent
        animationType="fade"
        onRequestClose={() =>
          fecharModal()
        }
      >

        <View
          style={styles.modalFundo}
        >

          <View
            style={styles.modalContainer}
          >

            {/* ==================================================
                ÍCONE
            ================================================== */}

            <View
              style={[
                styles.modalIcone,
                tipoModal === "sucesso"
                  ? styles.modalIconeSucesso
                  : styles.modalIconeErro,
              ]}
            >

              <MaterialIcons
                name={
                  tipoModal === "sucesso"
                    ? "check"
                    : "close"
                }
                size={42}
                color="#FFFFFF"
              />

            </View>


            {/* ==================================================
                TÍTULO
            ================================================== */}

            <Text
              style={styles.modalTitulo}
            >

              {
                tipoModal === "sucesso"
                  ? "Perfil atualizado!"
                  : "Não foi possível atualizar"
              }

            </Text>


            {/* ==================================================
                MENSAGEM
            ================================================== */}

            <Text
              style={styles.modalMensagem}
            >
              {mensagemModal}
            </Text>


            {/* ==================================================
                BOTÃO
            ================================================== */}

            <TouchableOpacity
              style={[
                styles.modalBotao,
                tipoModal === "sucesso"
                  ? styles.modalBotaoSucesso
                  : styles.modalBotaoErro,
              ]}
              onPress={
                fecharModal
              }
            >

              <Text
                style={styles.modalBotaoTexto}
              >

                {
                  tipoModal === "sucesso"
                    ? "Continuar"
                    : "Tentar novamente"
                }

              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>

    </>

  );

}


// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({

  container: {
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 25,
    paddingTop: 50,
    paddingBottom: 80,
  },

  // ==========================================================
  // VOLTAR
  // ==========================================================

  back: {
    marginBottom: 20,
  },

  // ==========================================================
  // TÍTULO
  // ==========================================================

  titulo: {
    fontSize: 26,
    color: "#005386",
    marginBottom: 30,
    fontFamily: "Montserrat_700Bold",
  },

  // ==========================================================
  // FOTO
  // ==========================================================

  foto: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#E4F8FF",
    borderWidth: 3,
    borderColor: "#0099FF",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    overflow: "hidden",
  },

  fotoImagem: {
    width: "100%",
    height: "100%",
  },

  fotoText: {
    textAlign: "center",
    marginTop: 10,
    marginBottom: 25,
    color: "#005386",
    fontFamily: "Montserrat_600SemiBold",
  },

  // ==========================================================
  // BANNER
  // ==========================================================

  banner: {
    height: 130,
    backgroundColor: "#BDEFFF",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 25,
    overflow: "hidden",
  },

  bannerImagem: {
    width: "100%",
    height: "100%",
  },

  bannerText: {
    color: "#005386",
    marginTop: 5,
    fontFamily: "Montserrat_600SemiBold",
  },

  // ==========================================================
  // CAMPOS
  // ==========================================================

  label: {
    color: "#005386",
    marginBottom: 6,
    fontFamily: "Montserrat_600SemiBold",
  },

  input: {
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#0099FF",
    paddingHorizontal: 15,
    marginBottom: 18,
    color: "#333333",
    fontFamily: "Montserrat_400Regular",
  },

  inputGrande: {
    height: 110,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "#0099FF",
    padding: 15,
    marginBottom: 18,
    textAlignVertical: "top",
    color: "#333333",
    fontFamily: "Montserrat_400Regular",
  },

  // ==========================================================
  // BOTÃO
  // ==========================================================

  botao: {
    backgroundColor: "#0099FF",
    borderRadius: 12,
    padding: 16,
    marginTop: 10,
    marginBottom: 30,
  },

  botaoTexto: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Montserrat_700Bold",
  },

  // ==========================================================
  // MODAL
  // ==========================================================

  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 30,
  },

  modalContainer: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 25,
    alignItems: "center",

    // sombra Android
    elevation: 10,

    // sombra iOS
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },

  modalIcone: {
    width: 75,
    height: 75,
    borderRadius: 38,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  modalIconeSucesso: {
    backgroundColor: "#0099FF",
  },

  modalIconeErro: {
    backgroundColor: "#E74C3C",
  },

  modalTitulo: {
    fontSize: 21,
    color: "#005386",
    textAlign: "center",
    marginBottom: 10,
    fontFamily: "Montserrat_700Bold",
  },

  modalMensagem: {
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 25,
    fontFamily: "Montserrat_400Regular",
  },

  modalBotao: {
    width: "100%",
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
  },

  modalBotaoSucesso: {
    backgroundColor: "#0099FF",
  },

  modalBotaoErro: {
    backgroundColor: "#E74C3C",
  },

  modalBotaoTexto: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Montserrat_700Bold",
  },

});