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
import { AntDesign, MaterialIcons } from "@expo/vector-icons";

export default function EditarPerfil() {
  const [idUsuario, setIdUsuario] = useState<number | null>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fotoPerfil, setFotoPerfil] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [banner, setBanner] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fotoPerfilAntiga, setFotoPerfilAntiga] = useState<string | null>(null);
  const [bannerAntigo, setBannerAntigo] = useState<string | null>(null);
  const [modalResultado, setModalResultado] = useState(false);
  const [tipoModal, setTipoModal] = useState<"sucesso" | "erro">("sucesso");
  const [mensagemModal, setMensagemModal] = useState("");

  function getImageUrl(imagePath?: string | null): string | null {
    if (!imagePath) return null;

    const path = String(imagePath).trim();
    if (!path) return null;

    if (path.startsWith("http://") || path.startsWith("https://")) {
      return path;
    }

    const baseUrl =
      api.defaults.baseURL?.replace(/\/api\/?$/, "") ||
      "http://127.0.0.1:8000";

    const normalizedPath = path
      .replace(/^\/+/, "")
      .replace(/^storage\/+/, "");

    return `${baseUrl}/storage/${normalizedPath}`;
  }

  useEffect(() => {
    carregarUsuario();
  }, []);

  async function carregarUsuario() {
    try {
      const dados = await AsyncStorage.getItem("usuario");

      if (!dados) {
        setTipoModal("erro");
        setMensagemModal("Não foi possível encontrar os dados do usuário.");
        setModalResultado(true);
        return;
      }

      const usuario = JSON.parse(dados);

      setIdUsuario(Number(usuario.id_usuario));
      setNome(usuario.nm_usuario ?? "");
      setDescricao(usuario.ds_usuario ?? "");

      if (usuario.ds_foto_perfil) {
        setFotoPerfilAntiga(getImageUrl(usuario.ds_foto_perfil));
      } else {
        setFotoPerfilAntiga(null);
      }

      if (usuario.ds_banner) {
        setBannerAntigo(getImageUrl(usuario.ds_banner));
      } else {
        setBannerAntigo(null);
      }

      console.log("Usuário carregado:", usuario);
    } catch (erro) {
      console.log("Erro ao carregar usuário:", erro);
    }
  }

  async function escolherFotoPerfil() {
    try {
      const permissao =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissao.granted) {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso à galeria para escolher sua foto de perfil."
        );
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!resultado.canceled) {
        const imagem = resultado.assets[0];
        setFotoPerfil(imagem);
        console.log("Nova foto:", imagem.uri);
      }
    } catch (erro) {
      console.log("Erro ao escolher foto:", erro);
      Alert.alert("Erro", "Não foi possível selecionar a foto.");
    }
  }

  async function escolherBanner() {
    try {
      const permissao =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissao.granted) {
        Alert.alert(
          "Permissão necessária",
          "Precisamos de acesso à galeria para escolher seu banner."
        );
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [3, 1],
        quality: 0.8,
      });

      if (!resultado.canceled) {
        const imagem = resultado.assets[0];
        setBanner(imagem);
        console.log("Novo banner:", imagem.uri);
      }
    } catch (erro) {
      console.log("Erro ao escolher banner:", erro);
      Alert.alert("Erro", "Não foi possível selecionar o banner.");
    }
  }

  async function salvarAlteracoes() {
    try {
      if (!idUsuario) {
        setTipoModal("erro");
        setMensagemModal("Não foi possível identificar o usuário.");
        setModalResultado(true);
        return;
      }

      const token = await AsyncStorage.getItem("token");

      const formData = new FormData();

      formData.append("nm_usuario", nome);
      formData.append("ds_usuario", descricao);

      if (fotoPerfil) {
        const nomeArquivo =
          fotoPerfil.fileName || `foto_perfil_${idUsuario}.jpg`;

        const tipoArquivo =
          fotoPerfil.mimeType || "image/jpeg";

        formData.append("ds_foto_perfil", {
          uri: fotoPerfil.uri,
          name: nomeArquivo,
          type: tipoArquivo,
        } as any);
      }

      if (banner) {
        const nomeArquivo =
          banner.fileName || `banner_${idUsuario}.jpg`;

        const tipoArquivo =
          banner.mimeType || "image/jpeg";

        formData.append("ds_banner", {
          uri: banner.uri,
          name: nomeArquivo,
          type: tipoArquivo,
        } as any);
      }

      formData.append("_method", "PUT");

      console.log("=================================");
      console.log("ATUALIZANDO PERFIL");
      console.log("ID:", idUsuario);
      console.log("Nome:", nome);
      console.log("Descrição:", descricao);
      console.log("Foto:", fotoPerfil?.uri);
      console.log("Banner:", banner?.uri);
      console.log("=================================");

      const resposta = await api.post(
        `/users/${idUsuario}`,
        formData,
        {
          headers: {
            Accept: "application/json",
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
        }
      );

      console.log("Status da API:", resposta.status);
      console.log("Resposta da API:", resposta.data);

      const dadosResposta = resposta.data;

      const usuarioAtualizado =
        dadosResposta?.usuario ||
        dadosResposta?.user ||
        dadosResposta?.data ||
        dadosResposta;

      const usuarioAnterior = JSON.parse(
        (await AsyncStorage.getItem("usuario")) || "{}"
      );

      const usuarioFinal = {
        ...usuarioAnterior,
        ...(typeof usuarioAtualizado === "object"
          ? usuarioAtualizado
          : {}),
        id_usuario: idUsuario,
        nm_usuario: nome,
        ds_usuario: descricao,
      };

      if (usuarioFinal.ds_foto_perfil) {
        setFotoPerfilAntiga(
          getImageUrl(usuarioFinal.ds_foto_perfil)
        );
      }

      if (usuarioFinal.ds_banner) {
        setBannerAntigo(
          getImageUrl(usuarioFinal.ds_banner)
        );
      }

      setNome(usuarioFinal.nm_usuario ?? nome);
      setDescricao(usuarioFinal.ds_usuario ?? descricao);

      await AsyncStorage.setItem(
        "usuario",
        JSON.stringify(usuarioFinal)
      );

      setFotoPerfil(null);
      setBanner(null);

      setTipoModal("sucesso");
      setMensagemModal(
        "Suas informações foram atualizadas com sucesso."
      );
      setModalResultado(true);
    } catch (erro: any) {
      console.log("=================================");
      console.log("ERRO AO ATUALIZAR PERFIL");
      console.log("Mensagem:", erro?.message);
      console.log("Status:", erro?.response?.status);
      console.log("Resposta:", erro?.response?.data);
      console.log("=================================");

      setTipoModal("erro");

      if (erro?.response?.status === 401) {
        setMensagemModal(
          "Sua sessão expirou. Faça login novamente."
        );
      } else if (erro?.response?.status === 404) {
        setMensagemModal(
          "Usuário não encontrado."
        );
      } else if (erro?.response?.status === 422) {
        const errosValidacao =
          erro?.response?.data?.errors;

        if (errosValidacao) {
          const mensagens = Object.values(
            errosValidacao
          )
            .flat()
            .join("\n");

          setMensagemModal(mensagens);
        } else {
          setMensagemModal(
            erro?.response?.data?.message ||
              "Verifique as informações preenchidas."
          );
        }
      } else {
        setMensagemModal(
          erro?.response?.data?.message ||
            "Não foi possível atualizar seu perfil. Tente novamente."
        );
      }

      setModalResultado(true);
    }
  }

  function fecharModal() {
    setModalResultado(false);

    if (tipoModal === "sucesso") {
      router.replace("/perfil");
    }
  }

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        <TouchableOpacity
          onPress={() => router.replace("/perfil")}
          style={styles.back}
        >
          <AntDesign
            name="left"
            size={22}
            color="#005386"
          />
        </TouchableOpacity>

        <Text style={styles.titulo}>
          Editar Perfil
        </Text>

        <TouchableOpacity
          style={styles.foto}
          onPress={escolherFotoPerfil}
        >
          {fotoPerfil ? (
            <Image
              source={{ uri: fotoPerfil.uri }}
              style={styles.fotoImagem}
            />
          ) : fotoPerfilAntiga ? (
            <Image
              source={{ uri: fotoPerfilAntiga }}
              style={styles.fotoImagem}
            />
          ) : (
            <MaterialIcons
              name="person"
              size={50}
              color="#005386"
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={escolherFotoPerfil}>
          <Text style={styles.fotoText}>
            Alterar Foto de Perfil
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.banner}
          onPress={escolherBanner}
        >
          {banner ? (
            <Image
              source={{ uri: banner.uri }}
              style={styles.bannerImagem}
              resizeMode="cover"
            />
          ) : bannerAntigo ? (
            <Image
              source={{ uri: bannerAntigo }}
              style={styles.bannerImagem}
              resizeMode="cover"
            />
          ) : (
            <>
              <MaterialIcons
                name="add-photo-alternate"
                size={35}
                color="#005386"
              />
              <Text style={styles.bannerText}>
                Alterar Banner
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>
          Nome de usuário
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Digite seu nome"
          placeholderTextColor="#777"
          value={nome}
          onChangeText={setNome}
        />

        <Text style={styles.label}>
          Descrição
        </Text>

        <TextInput
          style={styles.inputGrande}
          placeholder="Sobre você..."
          placeholderTextColor="#777"
          multiline
          value={descricao}
          onChangeText={setDescricao}
        />

        <TouchableOpacity
          style={styles.botao}
          onPress={salvarAlteracoes}
        >
          <Text style={styles.botaoTexto}>
            Salvar Alterações
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={modalResultado}
        transparent
        animationType="fade"
        onRequestClose={fecharModal}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalContainer}>
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

            <Text style={styles.modalTitulo}>
              {tipoModal === "sucesso"
                ? "Perfil atualizado!"
                : "Não foi possível atualizar"}
            </Text>

            <Text style={styles.modalMensagem}>
              {mensagemModal}
            </Text>

            <TouchableOpacity
              style={[
                styles.modalBotao,
                tipoModal === "sucesso"
                  ? styles.modalBotaoSucesso
                  : styles.modalBotaoErro,
              ]}
              onPress={fecharModal}
            >
              <Text style={styles.modalBotaoTexto}>
                {tipoModal === "sucesso"
                  ? "Continuar"
                  : "Tentar novamente"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 25,
    paddingTop: 50,
    paddingBottom: 80,
  },
  back: {
    marginBottom: 20,
  },
  titulo: {
    fontSize: 26,
    color: "#005386",
    marginBottom: 30,
    fontFamily: "Montserrat_700Bold",
  },
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
    elevation: 10,
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