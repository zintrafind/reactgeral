import {

  View,

  TextInput,

  TouchableOpacity,

  StyleSheet,

  Modal,

  Image,

} from "react-native";

import { useState } from "react";

import api from "../../services/api";

import { router } from "expo-router";

import {

  AntDesign,

  MaterialIcons,

} from "@expo/vector-icons";

import { Text } from "../../components/Text";

import AsyncStorage from "@react-native-async-storage/async-storage";

export default function Login() {

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  // RECUPERAR SENHA — SOMENTE FRONT-END
  const [recuperarSenhaVisible, setRecuperarSenhaVisible] = useState(false);
  const [etapaRecuperacao, setEtapaRecuperacao] =
    useState<"email" | "codigo" | "novaSenha">("email");
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [codigoRecuperacao, setCodigoRecuperacao] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
  const [erroRecuperacao, setErroRecuperacao] = useState("");

  // ============================================================

  // MODAL DE RESULTADO

  // ============================================================

  const [modalVisible, setModalVisible] = useState(false);

  const [tipoModal, setTipoModal] =

    useState<"sucesso" | "erro">("sucesso");

  const [mensagemModal, setMensagemModal] = useState("");

  // ============================================================

  // FAZER LOGIN

  // ============================================================

  const fazerLogin = async () => {

    try {

      const response = await api.post("/login", {

        email,

        password,

      });

      console.log(response.data);

      // ========================================================

      // SALVAR TOKEN

      // ========================================================

      await AsyncStorage.setItem(

        "token",

        response.data.token

      );

      // ========================================================

      // SALVAR USUÁRIO

      // ========================================================

      await AsyncStorage.setItem(

        "usuario",

        JSON.stringify(response.data.usuario)

      );

      // ========================================================

      // MODAL DE SUCESSO

      // ========================================================

      setTipoModal("sucesso");

      setMensagemModal(

        response.data.message ||

          "Login realizado com sucesso!"

      );

      setModalVisible(true);

    } catch (error: any) {

      console.log("ERRO COMPLETO:", error);

      // ========================================================

      // MENSAGEM DE ERRO

      // ========================================================

      let mensagemErro =

        "Não foi possível realizar o login.";

      if (error.response) {

        mensagemErro =

          error.response.data.message ||

          "E-mail ou senha incorretos.";

      } else if (error.request) {

        mensagemErro =

          "Sem resposta do servidor. Verifique sua conexão e o IP da API.";

      }

      // ========================================================

      // MODAL DE ERRO

      // ========================================================

      setTipoModal("erro");

      setMensagemModal(mensagemErro);

      setModalVisible(true);

    }

  };

  // ============================================================

  // FECHAR MODAL

  // ============================================================

  const fecharModal = () => {

    setModalVisible(false);

    // ==========================================================

    // SE O LOGIN DEU CERTO

    // ==========================================================

    if (tipoModal === "sucesso") {

      router.replace("/(tabs)");

    }

  };

  // ============================================================

  // TELA

  // ============================================================
  // ============================================================
  // RECUPERAR SENHA — FLUXO VISUAL
  // ============================================================

  const abrirRecuperarSenha = () => {
    setEmailRecuperacao(email);
    setCodigoRecuperacao("");
    setNovaSenha("");
    setConfirmarNovaSenha("");
    setErroRecuperacao("");
    setEtapaRecuperacao("email");
    setRecuperarSenhaVisible(true);
  };

  const fecharRecuperarSenha = () => {
    setRecuperarSenhaVisible(false);
    setErroRecuperacao("");
  };

  const continuarRecuperacao = () => {
    setErroRecuperacao("");

    if (etapaRecuperacao === "email") {
      if (!emailRecuperacao.trim() || !emailRecuperacao.includes("@")) {
        setErroRecuperacao("Informe um e-mail válido.");
        return;
      }

      // Somente visual: não consulta a API e não envia e-mail.
      setEtapaRecuperacao("codigo");
      return;
    }

    if (etapaRecuperacao === "codigo") {
      if (codigoRecuperacao.trim().length < 4) {
        setErroRecuperacao("Informe o código de recuperação recebido.");
        return;
      }

      // Somente visual: não valida o código no backend.
      setEtapaRecuperacao("novaSenha");
      return;
    }

    if (novaSenha.length < 8) {
      setErroRecuperacao("A senha deve possuir pelo menos 8 caracteres.");
      return;
    }

    if (novaSenha !== confirmarNovaSenha) {
      setErroRecuperacao("As senhas informadas não coincidem.");
      return;
    }

    // Somente visual: não altera a senha no banco.
    setRecuperarSenhaVisible(false);
    setTipoModal("sucesso");
    setMensagemModal("Senha redefinida com sucesso!");
    setModalVisible(true);
  };


  return (

    <>

      <View style={styles.container}>

        
      {/* ======================================================
          MODAL RECUPERAR SENHA — SOMENTE VISUAL
      ====================================================== */}

      <Modal
        visible={recuperarSenhaVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharRecuperarSenha}
      >
        <View style={styles.modalFundo}>
          <View style={styles.recuperarContainer}>
            <TouchableOpacity
              style={styles.recuperarFechar}
              onPress={fecharRecuperarSenha}
              activeOpacity={0.7}
            >
              <AntDesign name="close" size={20} color="#005386" />
            </TouchableOpacity>

            <View style={styles.recuperarIcone}>
              <AntDesign name="lock" size={30} color="#0099FF" />
            </View>

            <Text style={styles.recuperarTitulo}>
              {etapaRecuperacao === "email"
                ? "Recuperar senha"
                : etapaRecuperacao === "codigo"
                  ? "Código de recuperação"
                  : "Criar nova senha"}
            </Text>

            <Text style={styles.recuperarDescricao}>
              {etapaRecuperacao === "email"
                ? "Informe o e-mail cadastrado na sua conta."
                : etapaRecuperacao === "codigo"
                  ? "Digite o código enviado para o seu e-mail."
                  : "Crie uma nova senha para acessar sua conta."}
            </Text>

            {etapaRecuperacao === "email" && (
              <>
                <Text style={styles.recuperarLabel}>E-mail</Text>
                <View style={styles.recuperarInputBox}>
                  <AntDesign name="mail" size={19} color="#005386" />
                  <TextInput
                    value={emailRecuperacao}
                    onChangeText={setEmailRecuperacao}
                    placeholder="Digite seu e-mail"
                    placeholderTextColor="#777"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={styles.recuperarInput}
                  />
                </View>
              </>
            )}

            {etapaRecuperacao === "codigo" && (
              <>
                <Text style={styles.recuperarLabel}>Código</Text>
                <View style={styles.recuperarInputBox}>
                  <MaterialIcons name="password" size={19} color="#005386" />
                  <TextInput
                    value={codigoRecuperacao}
                    onChangeText={setCodigoRecuperacao}
                    placeholder="Digite o código recebido"
                    placeholderTextColor="#777"
                    keyboardType="number-pad"
                    style={styles.recuperarInput}
                  />
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setErroRecuperacao("Novo código solicitado.")}
                >
                  <Text style={styles.reenviarCodigoText}>Reenviar código</Text>
                </TouchableOpacity>
              </>
            )}

            {etapaRecuperacao === "novaSenha" && (
              <>
                <Text style={styles.recuperarLabel}>Nova senha</Text>
                <View style={styles.recuperarInputBox}>
                  <AntDesign name="lock" size={19} color="#005386" />
                  <TextInput
                    value={novaSenha}
                    onChangeText={setNovaSenha}
                    placeholder="Digite a nova senha"
                    placeholderTextColor="#777"
                    secureTextEntry
                    style={styles.recuperarInput}
                  />
                </View>

                <Text style={styles.recuperarLabel}>Confirmar nova senha</Text>
                <View style={styles.recuperarInputBox}>
                  <AntDesign name="lock" size={19} color="#005386" />
                  <TextInput
                    value={confirmarNovaSenha}
                    onChangeText={setConfirmarNovaSenha}
                    placeholder="Confirme a nova senha"
                    placeholderTextColor="#777"
                    secureTextEntry
                    style={styles.recuperarInput}
                  />
                </View>

                <Text style={styles.requisitosSenha}>
                  A senha deve possuir pelo menos 8 caracteres.
                </Text>
              </>
            )}

            {!!erroRecuperacao && (
              <View style={styles.recuperarErroBox}>
                <MaterialIcons name="error-outline" size={17} color="#E74C3C" />
                <Text style={styles.recuperarErroText}>{erroRecuperacao}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.recuperarBotao}
              onPress={continuarRecuperacao}
              activeOpacity={0.8}
            >
              <Text style={styles.recuperarBotaoTexto}>
                {etapaRecuperacao === "email"
                  ? "Enviar código"
                  : etapaRecuperacao === "codigo"
                    ? "Validar código"
                    : "Redefinir senha"}
              </Text>
            </TouchableOpacity>

            {etapaRecuperacao !== "email" && (
              <TouchableOpacity
                style={styles.recuperarVoltar}
                activeOpacity={0.7}
                onPress={() => {
                  setErroRecuperacao("");
                  setEtapaRecuperacao(
                    etapaRecuperacao === "novaSenha" ? "codigo" : "email",
                  );
                }}
              >
                <Text style={styles.recuperarVoltarText}>Voltar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

{/* ====================================================

            LOGO

        ==================================================== */}

        <Image

          source={require("../../assets/images/logo.png")}

          style={styles.logo}

        />

        {/* ====================================================

            CARD

        ==================================================== */}

        <View style={styles.card}>

          {/* ==================================================

              TÍTULO

          ================================================== */}

          <Text

            style={styles.title}

            variant="title"

          >

            Login

          </Text>

          {/* ==================================================

              EMAIL

          ================================================== */}

          <Text

            style={styles.label}

            variant="subtitle"

          >

            Email

          </Text>

          <View style={styles.inputBox}>

            <AntDesign

              name="mail"

              size={20}

              color="#005386"

            />

            <TextInput

              placeholder="Digite seu email"

              placeholderTextColor="#777"

              style={styles.input}

              value={email}

              onChangeText={setEmail}

              autoCapitalize="none"

              autoCorrect={false}

              keyboardType="email-address"

              textAlignVertical="center"

              includeFontPadding={false}

            />

          </View>

          {/* ==================================================

              SENHA

          ================================================== */}

          <Text

            style={styles.label}

            variant="subtitle"

          >

            Senha

          </Text>

          <View style={styles.inputBox}>

            <AntDesign

              name="lock"

              size={20}

              color="#005386"

            />

            <TextInput

              placeholder="Digite sua senha"

              placeholderTextColor="#777"

              secureTextEntry

              style={styles.input}

              value={password}

              onChangeText={setPassword}

              autoCapitalize="none"

              autoCorrect={false}

              textAlignVertical="center"

              includeFontPadding={false}

            />

          </View>

          <TouchableOpacity
            onPress={abrirRecuperarSenha}
            activeOpacity={0.7}
            style={styles.forgotPasswordButton}
          >
            <Text style={styles.forgotPasswordText}>Esqueci minha senha</Text>
          </TouchableOpacity>

          {/* ==================================================

              BOTÃO ENTRAR

          ================================================== */}

          <TouchableOpacity

            style={styles.button}

            onPress={fazerLogin}

            activeOpacity={0.8}

          >

            <Text

              style={styles.buttonText}

              variant="body"

            >

              Entrar

            </Text>

          </TouchableOpacity>

          {/* ==================================================

              CRIAR CONTA

          ================================================== */}

          <TouchableOpacity

            onPress={() =>

              router.push("/(auth)/register")

            }

            activeOpacity={0.7}

          >

            <Text style={styles.link}>

              Criar conta

            </Text>

          </TouchableOpacity>

        </View>

      </View>

      {/* ======================================================

          MODAL DE RESULTADO

      ====================================================== */}

      <Modal

        visible={modalVisible}

        transparent

        animationType="fade"

        onRequestClose={() =>

          setModalVisible(false)

        }

      >

        <View style={styles.modalFundo}>

          <View style={styles.modalContainer}>

            {/* =================================================

                ÍCONE

            ================================================= */}

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

            {/* =================================================

                TÍTULO

            ================================================= */}

            <Text style={styles.modalTitulo}>

              {tipoModal === "sucesso"

                ? "Login realizado!"

                : "Erro ao realizar login"}

            </Text>

            {/* =================================================

                MENSAGEM

            ================================================= */}

            <Text style={styles.modalMensagem}>

              {mensagemModal}

            </Text>

            {/* =================================================

                BOTÃO

            ================================================= */}

            <TouchableOpacity

              style={[

                styles.modalBotao,

                tipoModal === "sucesso"

                  ? styles.modalBotaoSucesso

                  : styles.modalBotaoErro,

              ]}

              onPress={fecharModal}

              activeOpacity={0.8}

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

// ============================================================

// ESTILOS

// ============================================================

const styles = StyleSheet.create({

  // ==========================================================

  // CONTAINER

  // ==========================================================

  container: {

    flex: 1,

    backgroundColor: "#D8F2FB",

    justifyContent: "center",

    alignItems: "center",

    paddingHorizontal: 20,

  },

  // ==========================================================

  // LOGO

  // ==========================================================

  logo: {

    width: 120,

    height: 120,

    marginBottom: 15,

    resizeMode: "contain",

  },

  // ==========================================================

  // CARD

  // ==========================================================

  card: {

    width: "92%",

    backgroundColor: "#FFFFFF",

    borderRadius: 30,

    padding: 28,

    shadowColor: "#000",

    shadowOffset: {

      width: 0,

      height: 3,

    },

    shadowOpacity: 0.08,

    shadowRadius: 8,

    elevation: 4,

  },

  // ==========================================================

  // TÍTULO

  // ==========================================================

  title: {

    fontSize: 28,

    textAlign: "center",

    marginBottom: 20,

    color: "#555",

    fontFamily: "Montserrat_700Bold",

    includeFontPadding: false,

  },

  // ==========================================================

  // LABEL

  // ==========================================================

  label: {

    marginBottom: 5,

    fontSize: 14,

    color: "#2f5d73",

    fontFamily: "Montserrat_600SemiBold",

    includeFontPadding: false,

  },

  // ==========================================================

  // INPUT BOX

  // ==========================================================

  inputBox: {

    flexDirection: "row",

    alignItems: "center",

    backgroundColor: "#E4F8FF",

    paddingHorizontal: 12,

    borderRadius: 10,

    marginBottom: 10,

    height: 50,

    gap: 10,

  },

  // ==========================================================

  // INPUT

  // ==========================================================

  input: {

    flex: 1,

    height: 50,

    paddingVertical: 0,

    paddingHorizontal: 0,

    color: "#333",

    fontSize: 14,

    fontFamily: "Montserrat_400Regular",

    textAlignVertical: "center",

    includeFontPadding: false,

  },

  // ==========================================================

  // BOTÃO

  // ==========================================================

  button: {

    backgroundColor: "#0099FF",

    padding: 14,

    borderRadius: 10,

    marginTop: 10,

  },

  buttonText: {

    color: "#FFFFFF",

    textAlign: "center",

    fontFamily: "Montserrat_600SemiBold",

    includeFontPadding: false,

  },

  // ==========================================================

  // LINK

  // ==========================================================

  link: {

    textAlign: "center",

    marginTop: 20,

    color: "#0099FF",

    fontFamily: "Montserrat_500Medium",

    includeFontPadding: false,

  },

  // ==========================================================

  // FUNDO DO MODAL

  // ==========================================================
  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginTop: 2,
    marginBottom: 2,
  },

  forgotPasswordText: {
    color: "#0099FF",
    fontSize: 13,
    fontFamily: "Montserrat_500Medium",
    includeFontPadding: false,
  },

  recuperarContainer: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    paddingHorizontal: 25,
    paddingTop: 28,
    paddingBottom: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },

  recuperarFechar: {
    position: "absolute",
    right: 18,
    top: 18,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },

  recuperarIcone: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#E4F8FF",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },

  recuperarTitulo: {
    textAlign: "center",
    color: "#005386",
    fontSize: 21,
    fontFamily: "Montserrat_700Bold",
    marginBottom: 8,
    includeFontPadding: false,
  },

  recuperarDescricao: {
    textAlign: "center",
    color: "#666666",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Montserrat_400Regular",
    marginBottom: 20,
    includeFontPadding: false,
  },

  recuperarLabel: {
    color: "#2f5d73",
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
    marginBottom: 5,
    includeFontPadding: false,
  },

  recuperarInputBox: {
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#E4F8FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },

  recuperarInput: {
    flex: 1,
    height: 50,
    paddingVertical: 0,
    color: "#333333",
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
  },

  recuperarErroBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FFF3F2",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 12,
  },

  recuperarErroText: {
    flex: 1,
    color: "#C0392B",
    fontSize: 12,
    fontFamily: "Montserrat_500Medium",
  },

  recuperarBotao: {
    backgroundColor: "#0099FF",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },

  recuperarBotaoTexto: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Montserrat_700Bold",
  },

  recuperarVoltar: {
    alignItems: "center",
    marginTop: 14,
  },

  recuperarVoltarText: {
    color: "#0099FF",
    fontSize: 13,
    fontFamily: "Montserrat_500Medium",
  },

  reenviarCodigoText: {
    color: "#0099FF",
    fontSize: 12,
    fontFamily: "Montserrat_500Medium",
    textAlign: "right",
    marginTop: -3,
    marginBottom: 12,
  },

  requisitosSenha: {
    color: "#777777",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Montserrat_400Regular",
    marginTop: -4,
    marginBottom: 12,
  },



  modalFundo: {

    flex: 1,

    backgroundColor: "rgba(0, 0, 0, 0.45)",

    justifyContent: "center",

    alignItems: "center",

    paddingHorizontal: 30,

  },

  // ==========================================================

  // CONTAINER DO MODAL

  // ==========================================================

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

  // ==========================================================

  // ÍCONE DO MODAL

  // ==========================================================

  modalIcone: {

    width: 75,

    height: 75,

    borderRadius: 38,

    justifyContent: "center",

    alignItems: "center",

    marginBottom: 18,

  },

  // ==========================================================

  // ÍCONE SUCESSO

  // ==========================================================

  modalIconeSucesso: {

    backgroundColor: "#0099FF",

  },

  // ==========================================================

  // ÍCONE ERRO

  // ==========================================================

  modalIconeErro: {

    backgroundColor: "#E74C3C",

  },

  // ==========================================================

  // TÍTULO DO MODAL

  // ==========================================================

  modalTitulo: {

    fontSize: 21,

    color: "#005386",

    textAlign: "center",

    marginBottom: 10,

    fontFamily: "Montserrat_700Bold",

    includeFontPadding: false,

  },

  // ==========================================================

  // MENSAGEM DO MODAL

  // ==========================================================

  modalMensagem: {

    fontSize: 14,

    color: "#666666",

    textAlign: "center",

    lineHeight: 21,

    marginBottom: 25,

    fontFamily: "Montserrat_400Regular",

    includeFontPadding: false,

  },

  // ==========================================================

  // BOTÃO DO MODAL

  // ==========================================================

  modalBotao: {

    width: "100%",

    borderRadius: 13,

    paddingVertical: 14,

    alignItems: "center",

  },

  // ==========================================================

  // BOTÃO SUCESSO

  // ==========================================================

  modalBotaoSucesso: {

    backgroundColor: "#0099FF",

  },

  // ==========================================================

  // BOTÃO ERRO

  // ==========================================================

  modalBotaoErro: {

    backgroundColor: "#E74C3C",

  },

  // ==========================================================

  // TEXTO DO BOTÃO

  // ==========================================================

  modalBotaoTexto: {

    color: "#FFFFFF",

    fontSize: 15,

    fontFamily: "Montserrat_700Bold",

    includeFontPadding: false,

  },

});