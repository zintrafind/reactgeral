import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../services/api";

export default function AlterarDadosPessoais() {
  const [email, setEmail] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");

  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);

  const [modalResultado, setModalResultado] = useState(false);
  const [tipoModal, setTipoModal] = useState<"sucesso" | "erro">("sucesso");
  const [mensagemModal, setMensagemModal] = useState("");

  /*
   * Carrega o e-mail atual do usuário.
   */
  useEffect(() => {
    carregarDadosUsuario();
  }, []);

  const carregarDadosUsuario = async () => {
    try {
      const usuarioSalvo = await AsyncStorage.getItem("usuario");

      if (!usuarioSalvo) {
        return;
      }

      const usuario = JSON.parse(usuarioSalvo);

      if (usuario.email) {
        setEmail(usuario.email);
      }
    } catch (error) {
      console.log("Erro ao carregar dados do usuário:", error);
    }
  };

  /*
   * Exibe o modal de resultado.
   */
  const mostrarResultado = (
    tipo: "sucesso" | "erro",
    mensagem: string
  ) => {
    setTipoModal(tipo);
    setMensagemModal(mensagem);
    setModalResultado(true);
  };

  /*
   * Fecha o modal.
   */
  const fecharModal = () => {
    setModalResultado(false);

    if (tipoModal === "sucesso") {
      router.back();
    }
  };

  /*
   * Salva e-mail e/ou nova senha.
   */
  const salvarAlteracoes = async () => {
    try {
      if (!email.trim()) {
        mostrarResultado(
          "erro",
          "Informe um endereço de e-mail."
        );
        return;
      }

      /*
       * Se o usuário começou a alterar a senha,
       * todos os campos de senha devem ser preenchidos.
       */
      const alterandoSenha =
        senhaAtual.length > 0 ||
        novaSenha.length > 0 ||
        confirmarSenha.length > 0;

      if (alterandoSenha) {
        if (!senhaAtual) {
          mostrarResultado(
            "erro",
            "Informe sua senha atual."
          );
          return;
        }

        if (!novaSenha) {
          mostrarResultado(
            "erro",
            "Informe a nova senha."
          );
          return;
        }

        if (!confirmarSenha) {
          mostrarResultado(
            "erro",
            "Confirme a nova senha."
          );
          return;
        }

        if (novaSenha !== confirmarSenha) {
          mostrarResultado(
            "erro",
            "A confirmação da nova senha não corresponde."
          );
          return;
        }

        if (novaSenha.length < 8) {
          mostrarResultado(
            "erro",
            "A nova senha deve possuir pelo menos 8 caracteres."
          );
          return;
        }

        if (senhaAtual === novaSenha) {
          mostrarResultado(
            "erro",
            "A nova senha deve ser diferente da senha atual."
          );
          return;
        }
      }

      const token = await AsyncStorage.getItem("token");
      const usuarioSalvo = await AsyncStorage.getItem("usuario");

      if (!token || !usuarioSalvo) {
        mostrarResultado(
          "erro",
          "Não foi possível identificar o usuário."
        );
        return;
      }

      const usuario = JSON.parse(usuarioSalvo);

      /*
       * AJUSTE A ROTA DE ACORDO COM SUA API.
       *
       * O frontend já está preparado para enviar:
       * - email
       * - senha_atual
       * - password
       * - password_confirmation
       */
      const dados: any = {
        email: email.trim(),
      };

      if (alterandoSenha) {
        dados.senha_atual = senhaAtual;
        dados.password = novaSenha;
        dados.password_confirmation = confirmarSenha;
      }

      const response = await api.put(
        `/users/${usuario.id_usuario}/dados-pessoais`,
        dados,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      /*
       * Atualiza o e-mail salvo localmente.
       */
      const usuarioAtualizado = {
        ...usuario,
        email: response.data?.usuario?.email ?? email.trim(),
      };

      await AsyncStorage.setItem(
        "usuario",
        JSON.stringify(usuarioAtualizado)
      );

      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");

      mostrarResultado(
        "sucesso",
        "Seus dados pessoais foram atualizados com sucesso."
      );
    } catch (error: any) {
      console.log(
        "Erro ao atualizar dados pessoais:",
        error?.response?.data || error
      );

      const mensagem =
        error?.response?.data?.message ||
        "Ocorreu um erro ao atualizar seus dados pessoais.";

      mostrarResultado("erro", mensagem);
    }
  };

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* VOLTAR */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.back}
        >
          <AntDesign
            name="left"
            size={22}
            color="#005386"
          />
        </TouchableOpacity>

        {/* TÍTULO */}
        <Text style={styles.titulo}>
          Dados Pessoais
        </Text>

        <Text style={styles.subtitulo}>
          Altere seu e-mail ou senha de acesso.
        </Text>

        {/* E-MAIL */}
        <Text style={styles.label}>
          E-mail
        </Text>

        <View style={styles.inputContainer}>
          <MaterialIcons
            name="email"
            size={21}
            color="#005386"
            style={styles.iconeInput}
          />

          <TextInput
            style={styles.inputComIcone}
            placeholder="Digite seu e-mail"
            placeholderTextColor="#777"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* DIVISOR */}
        <View style={styles.divisor}>
          <View style={styles.linha} />

          <Text style={styles.divisorTexto}>
            Alterar senha
          </Text>

          <View style={styles.linha} />
        </View>

        <Text style={styles.avisoSenha}>
          Para alterar sua senha, informe primeiro a senha atual.
        </Text>

        {/* SENHA ATUAL */}
        <Text style={styles.label}>
          Senha atual
        </Text>

        <View style={styles.inputContainer}>
          <MaterialIcons
            name="lock-outline"
            size={22}
            color="#005386"
            style={styles.iconeInput}
          />

          <TextInput
            style={styles.inputSenha}
            placeholder="Digite sua senha atual"
            placeholderTextColor="#777"
            value={senhaAtual}
            onChangeText={setSenhaAtual}
            secureTextEntry={!mostrarSenhaAtual}
            autoCapitalize="none"
          />

          <TouchableOpacity
            onPress={() =>
              setMostrarSenhaAtual(!mostrarSenhaAtual)
            }
            style={styles.botaoOlho}
          >
            <MaterialIcons
              name={
                mostrarSenhaAtual
                  ? "visibility"
                  : "visibility-off"
              }
              size={22}
              color="#005386"
            />
          </TouchableOpacity>
        </View>

        {/* NOVA SENHA */}
        <Text style={styles.label}>
          Nova senha
        </Text>

        <View style={styles.inputContainer}>
          <MaterialIcons
            name="star-outline"
            size={22}
            color="#005386"
            style={styles.iconeInput}
          />

          <TextInput
            style={styles.inputSenha}
            placeholder="Digite a nova senha"
            placeholderTextColor="#777"
            value={novaSenha}
            onChangeText={setNovaSenha}
            secureTextEntry={!mostrarNovaSenha}
            autoCapitalize="none"
          />

          <TouchableOpacity
            onPress={() =>
              setMostrarNovaSenha(!mostrarNovaSenha)
            }
            style={styles.botaoOlho}
          >
            <MaterialIcons
              name={
                mostrarNovaSenha
                  ? "visibility"
                  : "visibility-off"
              }
              size={22}
              color="#005386"
            />
          </TouchableOpacity>
        </View>

        {/* CONFIRMAR NOVA SENHA */}
        <Text style={styles.label}>
          Confirmar nova senha
        </Text>

        <View style={styles.inputContainer}>
          <MaterialIcons
            name="autorenew"
            size={22}
            color="#005386"
            style={styles.iconeInput}
          />

          <TextInput
            style={styles.inputSenha}
            placeholder="Digite novamente a nova senha"
            placeholderTextColor="#777"
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
            secureTextEntry={!mostrarConfirmarSenha}
            autoCapitalize="none"
          />

          <TouchableOpacity
            onPress={() =>
              setMostrarConfirmarSenha(
                !mostrarConfirmarSenha
              )
            }
            style={styles.botaoOlho}
          >
            <MaterialIcons
              name={
                mostrarConfirmarSenha
                  ? "visibility"
                  : "visibility-off"
              }
              size={22}
              color="#005386"
            />
          </TouchableOpacity>
        </View>

        {/* BOTÃO */}
        <TouchableOpacity
          style={styles.botao}
          onPress={salvarAlteracoes}
        >
          <Text style={styles.botaoTexto}>
            Salvar Alterações
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* MODAL DE RESULTADO */}
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
                ? "Dados atualizados!"
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
    marginBottom: 8,
    fontFamily: "Montserrat_700Bold",
  },

  subtitulo: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 30,
    lineHeight: 21,
    fontFamily: "Montserrat_400Regular",
  },

  label: {
    color: "#005386",
    marginBottom: 7,
    fontFamily: "Montserrat_600SemiBold",
  },

  inputContainer: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#0099FF",
    marginBottom: 20,
    paddingHorizontal: 15,
  },

  iconeInput: {
    marginRight: 10,
  },

  inputComIcone: {
    flex: 1,
    height: "100%",
    color: "#333333",
    fontFamily: "Montserrat_400Regular",
  },

  inputSenha: {
    flex: 1,
    height: "100%",
    color: "#333333",
    fontFamily: "Montserrat_400Regular",
  },

  botaoOlho: {
    paddingLeft: 10,
    paddingVertical: 10,
  },

  divisor: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    marginBottom: 15,
  },

  linha: {
    flex: 1,
    height: 1,
    backgroundColor: "#D6D6D6",
  },

  divisorTexto: {
    color: "#005386",
    marginHorizontal: 12,
    fontFamily: "Montserrat_600SemiBold",
  },

  avisoSenha: {
    fontSize: 13,
    color: "#666666",
    marginBottom: 20,
    lineHeight: 19,
    fontFamily: "Montserrat_400Regular",
  },

  botao: {
    backgroundColor: "#0099FF",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
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