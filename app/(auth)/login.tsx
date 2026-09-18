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

  // ============================================================
  // MODAL DE RESULTADO
  // ============================================================

  const [modalVisible, setModalVisible] =
    useState(false);

  const [tipoModal, setTipoModal] =
    useState<"sucesso" | "erro">("sucesso");

  const [mensagemModal, setMensagemModal] =
    useState("");


  // ============================================================
  // FAZER LOGIN
  // ============================================================

  const fazerLogin = async () => {

    try {

      const response = await api.post(
        "/login",
        {
          email,
          password,
        }
      );

      console.log(
        response.data
      );


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
        JSON.stringify(
          response.data.usuario
        )
      );


      // ========================================================
      // MODAL DE SUCESSO
      // ========================================================

      setTipoModal(
        "sucesso"
      );

      setMensagemModal(
        response.data.message ||
        "Login realizado com sucesso!"
      );

      setModalVisible(
        true
      );

    } catch (error: any) {

      console.log(
        "ERRO COMPLETO:",
        error
      );


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

      setTipoModal(
        "erro"
      );

      setMensagemModal(
        mensagemErro
      );

      setModalVisible(
        true
      );

    }

  };


  // ============================================================
  // FECHAR MODAL
  // ============================================================

  const fecharModal = () => {

    setModalVisible(
      false
    );


    // ==========================================================
    // SE O LOGIN DEU CERTO
    // ==========================================================

    if (
      tipoModal === "sucesso"
    ) {

      router.replace(
        "/(tabs)"
      );

    }

  };


  // ============================================================
  // TELA
  // ============================================================

  return (
    <>

      <View
        style={styles.container}
      >

        {/* ====================================================
            LOGO
        ==================================================== */}

        <Image
          source={require(
            "../../assets/images/logo.png"
          )}
          style={styles.logo}
        />


        {/* ====================================================
            CARD
        ==================================================== */}

        <View
          style={styles.card}
        >

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


          <View
            style={styles.inputBox}
          >

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
              keyboardType="email-address"
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


          <View
            style={styles.inputBox}
          >

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
            />

          </View>


          {/* ==================================================
              BOTÃO ENTRAR
          ================================================== */}

          <TouchableOpacity
            style={styles.button}
            onPress={fazerLogin}
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
              router.push(
                "/(auth)/register"
              )
            }
          >

            <Text
              style={styles.link}
            >
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

        <View
          style={styles.modalFundo}
        >

          <View
            style={styles.modalContainer}
          >

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

            <Text
              style={styles.modalTitulo}
            >

              {
                tipoModal === "sucesso"
                  ? "Login realizado!"
                  : "Erro ao realizar login"
              }

            </Text>


            {/* =================================================
                MENSAGEM
            ================================================= */}

            <Text
              style={styles.modalMensagem}
            >
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
  },


  // ==========================================================
  // LABEL
  // ==========================================================

  label: {
    marginBottom: 5,
    fontSize: 14,
    color: "#2f5d73",
    fontFamily: "Montserrat_600SemiBold",
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
    color: "#333",
    fontFamily: "Montserrat_400Regular",
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
  },


  // ==========================================================
  // LINK
  // ==========================================================

  link: {
    textAlign: "center",
    marginTop: 20,
    color: "#0099FF",
    fontFamily: "Montserrat_500Medium",
  },


  // ==========================================================
  // FUNDO DO MODAL
  // ==========================================================

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
  },

});