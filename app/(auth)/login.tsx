import {
    Image,
    Modal,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
 
import { useRef, useState } from "react";
 
import { router } from "expo-router";
import api from "../../services/api";
 
import {
    AntDesign,
    MaterialIcons,
} from "@expo/vector-icons";
 
import { Text } from "../../components/Text";
 
import AsyncStorage from "@react-native-async-storage/async-storage";
 
export default function Login() { 
  const [email, setEmail] = useState(""); 
  const [password, setPassword] = useState(""); 
  const [loginSuccessful, setLoginSuccessful] = useState(false);
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<1 | 2 | 3>(1);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryInfoMessage, setRecoveryInfoMessage] = useState("");
  const recoveryRequestRef = useRef(false);
 
  // ============================================================ 
  // MODAL DE RESULTADO 
  // ============================================================ 
 
  const [modalVisible, setModalVisible] = useState(false); 
 
  const [tipoModal, setTipoModal] = 
    useState<"sucesso" | "erro">("sucesso"); 
 
  const [mensagemModal, setMensagemModal] = useState(""); 

  const limparRecuperacao = () => {
    setRecoveryVisible(false);
    setRecoveryStep(1);
    setRecoveryEmail("");
    setRecoveryCode("");
    setNewPassword("");
    setPasswordConfirmation("");
    setRecoveryLoading(false);
    recoveryRequestRef.current = false;
    setRecoveryError("");
    setRecoveryInfoMessage("");
  };

  const abrirRecuperacao = () => {
    setRecoveryEmail(email.trim());
    setRecoveryCode("");
    setNewPassword("");
    setPasswordConfirmation("");
    setRecoveryError("");
    setRecoveryInfoMessage("");
    setRecoveryVisible(true);
  };

  const enviarCodigo = async () => {
    if (recoveryRequestRef.current) return;
    const emailRecuperacao = recoveryEmail.trim();
    if (!emailRecuperacao) {
      setRecoveryError("Informe seu e-mail.");
      return;
    }

    recoveryRequestRef.current = true;
    setRecoveryLoading(true);
    setRecoveryError("");
    try {
      const response = await api.post("/forgot-password", {
        email: emailRecuperacao,
      });
      setRecoveryEmail(emailRecuperacao);
      setRecoveryStep(2);
      setRecoveryCode("");
      setRecoveryError("");
      setRecoveryInfoMessage(response.data?.message || "Código de recuperação enviado para o seu e-mail.");
    } catch (error: any) {
      setRecoveryError(
        error?.response?.data?.message || "Não foi possível enviar o código. Verifique sua conexão."
      );
    } finally {
      recoveryRequestRef.current = false;
      setRecoveryLoading(false);
    }
  };

  const validarCodigo = async () => {
    if (recoveryRequestRef.current) return;
    if (!/^\d{6}$/.test(recoveryCode)) {
      setRecoveryError("Informe o código de 6 dígitos recebido por e-mail.");
      return;
    }

    recoveryRequestRef.current = true;
    setRecoveryLoading(true);
    setRecoveryError("");
    try {
      await api.post("/verify-reset-code", {
        email: recoveryEmail.trim(),
        code: recoveryCode,
      });
      setRecoveryStep(3);
    } catch (error: any) {
      setRecoveryError(
        error?.response?.data?.message || "Não foi possível validar o código."
      );
    } finally {
      recoveryRequestRef.current = false;
      setRecoveryLoading(false);
    }
  };

  const redefinirSenha = async () => {
    if (recoveryRequestRef.current) return;
    if (!newPassword || !passwordConfirmation) {
      setRecoveryError("Preencha e confirme a nova senha.");
      return;
    }

    recoveryRequestRef.current = true;
    setRecoveryLoading(true);
    setRecoveryError("");
    try {
      const response = await api.post("/reset-password", {
        email: recoveryEmail.trim(),
        code: recoveryCode,
        password: newPassword,
        password_confirmation: passwordConfirmation,
      });

      const successMessage = response.data?.message || "Senha redefinida com sucesso.";
      setEmail(recoveryEmail.trim());
      setPassword("");
      setLoginSuccessful(false);
      limparRecuperacao();
      setTipoModal("sucesso");
      setMensagemModal(`${successMessage} Faça login com sua nova senha.`);
      setModalVisible(true);
    } catch (error: any) {
      const mensagem = error?.response?.data?.message || "Não foi possível redefinir a senha.";
      setRecoveryError(mensagem);
      if (mensagem.toLocaleLowerCase("pt-BR").includes("código de recuperação")) {
        setRecoveryStep(2);
        setRecoveryCode("");
      }
    } finally {
      recoveryRequestRef.current = false;
      setRecoveryLoading(false);
    }
  };
 
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
      setLoginSuccessful(true);
 
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
      setLoginSuccessful(false);
 
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
 
    if (loginSuccessful) { 
      router.replace("/(tabs)"); 
    } 
  }; 
 
  // ============================================================ 
  // TELA 
  // ============================================================ 
 
  return ( 
    <> 
      <View style={styles.container}> 
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

          <TouchableOpacity
            onPress={abrirRecuperacao}
            activeOpacity={0.7}
          >
            <Text style={styles.forgotPasswordLink}>Esqueci minha senha</Text>
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
                ? loginSuccessful ? "Login realizado!" : "Senha redefinida!" 
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
                  ? loginSuccessful ? "Continuar" : "Voltar ao login" 
                  : "Tentar novamente"} 
              </Text> 
            </TouchableOpacity> 
          </View> 
        </View> 
      </Modal> 

      <Modal
        visible={recoveryVisible}
        transparent
        animationType="fade"
        onRequestClose={limparRecuperacao}
      >
        <View style={styles.modalFundo}>
          <View style={styles.recoveryModalContainer}>
            <TouchableOpacity
              style={styles.recoveryCloseButton}
              onPress={limparRecuperacao}
              disabled={recoveryLoading}
              accessibilityLabel="Fechar recuperação de senha"
            >
              <AntDesign name="close" size={20} color="#005386" />
            </TouchableOpacity>

            <Text style={styles.recoveryTitle}>Recuperar senha</Text>
            <Text style={styles.recoveryDescription}>
              {recoveryStep === 1
                ? "Informe o e-mail cadastrado para receber um código."
                : recoveryStep === 2
                  ? "Digite o código enviado para seu e-mail"
                  : "Defina uma nova senha para sua conta."}
            </Text>

            {recoveryStep === 1 ? (
              <>
                <Text style={styles.label}>E-mail</Text>
                <View style={styles.inputBox}>
                  <AntDesign name="mail" size={20} color="#005386" />
                  <TextInput
                    placeholder="Digite seu e-mail"
                    placeholderTextColor="#777"
                    style={styles.input}
                    value={recoveryEmail}
                    onChangeText={setRecoveryEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />
                </View>
              </>
            ) : null}

            {recoveryStep === 2 ? (
              <>
                <Text style={styles.recoveryEmailText}>{recoveryEmail}</Text>
                <TextInput
                  style={styles.recoveryCodeInput}
                  placeholder="000000"
                  placeholderTextColor="#93A6B5"
                  value={recoveryCode}
                  onChangeText={(value) => {
                    setRecoveryCode(value.replace(/\D/g, "").slice(0, 6));
                    setRecoveryError("");
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  textContentType="oneTimeCode"
                  accessibilityLabel="Código de recuperação de seis dígitos"
                />
                <TouchableOpacity
                  onPress={() => void enviarCodigo()}
                  disabled={recoveryLoading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.recoveryLink}>Reenviar código</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {recoveryStep === 3 ? (
              <>
                <Text style={styles.label}>Nova senha</Text>
                <View style={styles.inputBox}>
                  <AntDesign name="lock" size={20} color="#005386" />
                  <TextInput
                    placeholder="Mínimo de 8 caracteres"
                    placeholderTextColor="#777"
                    secureTextEntry
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                  />
                </View>
                <Text style={styles.label}>Confirmar nova senha</Text>
                <View style={styles.inputBox}>
                  <AntDesign name="lock" size={20} color="#005386" />
                  <TextInput
                    placeholder="Digite novamente a nova senha"
                    placeholderTextColor="#777"
                    secureTextEntry
                    style={styles.input}
                    value={passwordConfirmation}
                    onChangeText={setPasswordConfirmation}
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                  />
                </View>
              </>
            ) : null}

            {recoveryInfoMessage ? (
              <Text style={styles.recoveryInfoMessage}>{recoveryInfoMessage}</Text>
            ) : null}

            {recoveryError ? (
              <Text style={styles.recoveryError} accessibilityRole="alert">
                {recoveryError}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.button,
                styles.recoverySubmitButton,
                recoveryLoading && styles.recoveryButtonDisabled,
              ]}
              onPress={() => {
                if (recoveryStep === 1) void enviarCodigo();
                else if (recoveryStep === 2) void validarCodigo();
                else void redefinirSenha();
              }}
              disabled={recoveryLoading}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {recoveryLoading
                  ? "Aguarde..."
                  : recoveryStep === 1
                    ? "Enviar código"
                    : recoveryStep === 2
                      ? "Validar código"
                      : "Redefinir senha"}
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

  forgotPasswordLink: {
    textAlign: "center",
    marginTop: 14,
    color: "#005386",
    fontSize: 13,
    fontFamily: "Montserrat_500Medium",
    includeFontPadding: false,
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

  recoveryModalContainer: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    paddingHorizontal: 25,
    paddingTop: 30,
    paddingBottom: 25,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },

  recoveryCloseButton: {
    position: "absolute",
    right: 16,
    top: 14,
    zIndex: 1,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  recoveryTitle: {
    marginTop: 8,
    marginBottom: 8,
    color: "#005386",
    fontSize: 21,
    textAlign: "center",
    fontFamily: "Montserrat_700Bold",
  },

  recoveryDescription: {
    marginBottom: 18,
    color: "#666666",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
  },

  recoveryEmailText: {
    marginBottom: 12,
    color: "#2f5d73",
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Montserrat_500Medium",
  },

  recoveryCodeInput: {
    height: 54,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#C8E6F1",
    backgroundColor: "#E4F8FF",
    color: "#005386",
    fontSize: 24,
    letterSpacing: 6,
    textAlign: "center",
    fontFamily: "Montserrat_600SemiBold",
  },

  recoveryLink: {
    marginTop: 5,
    marginBottom: 7,
    color: "#0099FF",
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
  },

  recoveryInfoMessage: {
    marginTop: 4,
    marginBottom: 8,
    color: "#237A45",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
  },

  recoveryError: {
    marginTop: 4,
    marginBottom: 8,
    color: "#B42318",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
  },

  recoverySubmitButton: {
    marginTop: 12,
  },

  recoveryButtonDisabled: {
    opacity: 0.6,
  },
}); 