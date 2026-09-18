import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";

import {
  AntDesign,
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";

export default function Configuracoes() {
  const [usuario, setUsuario] = useState<any>(null);

  // Modal de excluir conta
  const [modalExcluir, setModalExcluir] = useState(false);

  // Estado enquanto a conta está sendo excluída
  const [excluindo, setExcluindo] = useState(false);

  // Modal de logout
  const [modalLogout, setModalLogout] = useState(false);

  // Estado enquanto está saindo da conta
  const [saindo, setSaindo] = useState(false);

  // ============================================================
  // CARREGAR USUÁRIO
  // ============================================================

  useEffect(() => {
    carregarUsuario();
  }, []);

  async function carregarUsuario() {
    try {
      const dados = await AsyncStorage.getItem("usuario");

      if (dados) {
        const usuarioSalvo = JSON.parse(dados);

        console.log("Usuário carregado:", usuarioSalvo);

        setUsuario(usuarioSalvo);
      }
    } catch (erro) {
      console.log("Erro ao carregar usuário:", erro);
    }
  }

  // ============================================================
  // ABRIR CONFIRMAÇÃO DE EXCLUSÃO
  // ============================================================

  function abrirConfirmacaoExclusao() {
    console.log("BOTÃO EXCLUIR CONTA CLICADO");

    setModalExcluir(true);
  }

  // ============================================================
  // EXCLUIR CONTA
  // ============================================================

  async function excluirConta() {
    if (!usuario?.id_usuario) {
      console.log("ERRO: id_usuario não encontrado.");

      setModalExcluir(false);

      Alert.alert(
        "Erro",
        "Não foi possível identificar o usuário."
      );

      return;
    }

    try {
      setExcluindo(true);

      console.log(
        "Excluindo usuário:",
        usuario.id_usuario
      );

      const token = await AsyncStorage.getItem("token");

      const resposta = await fetch(
        `http://127.0.0.1:8000/api/users/${usuario.id_usuario}`,
        {
          method: "DELETE",

          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",

            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
        }
      );

      const dados = await resposta.json();

      console.log("Resposta da API:", dados);

      // ========================================================
      // ERRO NA API
      // ========================================================

      if (!resposta.ok) {
        console.log(
          "Erro ao excluir conta:",
          dados?.message
        );

        setExcluindo(false);
        setModalExcluir(false);

        Alert.alert(
          "Erro",
          dados?.message ||
            "Não foi possível excluir sua conta."
        );

        return;
      }

      // ========================================================
      // EXCLUSÃO REALIZADA
      // ========================================================

      console.log(
        "Conta excluída com sucesso!"
      );

      // Remove os dados da sessão
      await AsyncStorage.removeItem("usuario");
      await AsyncStorage.removeItem("token");

      // Limpa usuário da tela
      setUsuario(null);

      setExcluindo(false);
      setModalExcluir(false);

      // Volta para o login
      router.replace("/(auth)/login" as any);

    } catch (erro) {
      console.log(
        "Erro ao conectar com a API:",
        erro
      );

      setExcluindo(false);
      setModalExcluir(false);

      Alert.alert(
        "Erro",
        "Não foi possível conectar ao servidor."
      );
    }
  }

  // ============================================================
  // ABRIR CONFIRMAÇÃO DE LOGOUT
  // ============================================================

  function abrirConfirmacaoLogout() {
    console.log("BOTÃO SAIR DA CONTA CLICADO");

    setModalLogout(true);
  }

  // ============================================================
  // SAIR DA CONTA
  // ============================================================

  async function sairDaConta() {
    try {
      setSaindo(true);

      const token = await AsyncStorage.getItem("token");

      console.log("Realizando logout...");

      // Tenta encerrar a sessão no Laravel
      if (token) {
        try {
          await fetch(
            "http://127.0.0.1:8000/api/logout",
            {
              method: "POST",

              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          );
        } catch (erro) {
          console.log(
            "Erro ao comunicar logout com a API:",
            erro
          );
        }
      }

      // Remove os dados locais independentemente
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("usuario");

      console.log("Sessão encerrada.");

      setSaindo(false);
      setModalLogout(false);

      // Vai para o login
      router.replace("/(auth)/login" as any);

    } catch (erro) {
      console.log(
        "Erro ao sair da conta:",
        erro
      );

      setSaindo(false);
      setModalLogout(false);

      Alert.alert(
        "Erro",
        "Não foi possível sair da conta."
      );
    }
  }

  return (
    <View style={styles.container}>

      {/* =====================================================
          CONTEÚDO ROLÁVEL
      ===================================================== */}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* =====================================================
            VOLTAR
        ===================================================== */}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
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

        <Text style={styles.title}>
          Configurações
        </Text>

        {/* =====================================================
            EDITAR PERFIL
        ===================================================== */}

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() =>
            router.push(
              "/perfil/editarPerfil" as any
            )
          }
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="person-outline"
            size={24}
            color="#005386"
          />

          <Text style={styles.menuText}>
            Editar Perfil
          </Text>

          <AntDesign
            name="right"
            size={18}
            color="#0099FF"
          />
        </TouchableOpacity>

        {/* =====================================================
            ALTERAR SENHA
        ===================================================== */}

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name="lock-outline"
            size={24}
            color="#005386"
          />

          <Text style={styles.menuText}>
            Alterar Senha
          </Text>

          <AntDesign
            name="right"
            size={18}
            color="#0099FF"
          />
        </TouchableOpacity>

        {/* =====================================================
            NOTIFICAÇÕES
        ===================================================== */}

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color="#005386"
          />

          <Text style={styles.menuText}>
            Configuração de Notificações
          </Text>

          <AntDesign
            name="right"
            size={18}
            color="#0099FF"
          />
        </TouchableOpacity>

        {/* =====================================================
            HISTÓRICO DE TROCAS
        ===================================================== */}

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
        >
          <FontAwesome5
            name="exchange-alt"
            size={20}
            color="#005386"
          />

          <Text style={styles.menuText}>
            Histórico de Trocas
          </Text>

          <AntDesign
            name="right"
            size={18}
            color="#0099FF"
          />
        </TouchableOpacity>

        {/* =====================================================
            PEÇAS FAVORITAS
        ===================================================== */}

<TouchableOpacity
  style={styles.menuItem}
  onPress={() => router.push("/favoritos")}
  activeOpacity={0.7}
>
  <AntDesign
    name="star"
    size={22}
    color="#005386"
  />

  <Text style={styles.menuText}>
    Peças Favoritas
  </Text>

  <AntDesign
    name="right"
    size={18}
    color="#0099FF"
  />
</TouchableOpacity>

        {/* =====================================================
            USUÁRIOS BLOQUEADOS
        ===================================================== */}

<TouchableOpacity
  style={styles.menuItem}
  onPress={() =>
    router.push(
      "/perfil/usuariosBloqueados" as any
    )
  }
>
  <Ionicons
    name="ban-outline"
    size={23}
    color="#005386"
  />

  <Text style={styles.menuText}>
    Usuários Bloqueados
  </Text>

  <AntDesign
    name="right"
    size={18}
    color="#0099FF"
  />
</TouchableOpacity>

        {/* =====================================================
            AJUDA
        ===================================================== */}

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.7}
        >
          <Feather
            name="help-circle"
            size={23}
            color="#005386"
          />

          <Text style={styles.menuText}>
            Ajuda
          </Text>

          <AntDesign
            name="right"
            size={18}
            color="#0099FF"
          />
        </TouchableOpacity>

        {/* =====================================================
            SAIR DA CONTA
        ===================================================== */}

        <Pressable
          style={({ pressed }) => [
            styles.menuItem,
            pressed && styles.logoutButtonPressed,
          ]}
          onPress={abrirConfirmacaoLogout}
        >
          <MaterialIcons
            name="logout"
            size={23}
            color="#005386"
          />

          <Text style={styles.logoutText}>
            Sair da Conta
          </Text>

          <AntDesign
            name="right"
            size={18}
            color="#0099FF"
          />
        </Pressable>

        {/* =====================================================
            EXCLUIR CONTA
            SEMPRE POR ÚLTIMO
        ===================================================== */}

        <Pressable
          style={({ pressed }) => [
            styles.menuItem,
            styles.deleteMenuItem,
            pressed && styles.deleteButtonPressed,
          ]}
          onPress={abrirConfirmacaoExclusao}
        >
          <MaterialIcons
            name="delete-outline"
            size={23}
            color="#E53935"
          />

          <Text style={styles.deleteText}>
            Excluir Conta
          </Text>
        </Pressable>

      </ScrollView>

      {/* =====================================================
          MODAL — SAIR DA CONTA
      ===================================================== */}

      <Modal
        visible={modalLogout}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!saindo) {
            setModalLogout(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>

          <View style={styles.modalContainer}>

            {/* ÍCONE */}

            <View style={styles.logoutModalIcon}>
              <MaterialIcons
                name="logout"
                size={34}
                color="#005386"
              />
            </View>

            {/* TÍTULO */}

            <Text style={styles.modalTitle}>
              Sair da conta
            </Text>

            {/* TEXTO */}

            <Text style={styles.modalText}>
              Tem certeza que deseja sair
              da sua conta?
            </Text>

            {/* BOTÕES */}

            <View style={styles.modalButtons}>

              {/* CANCELAR */}

              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
                disabled={saindo}
                onPress={() => {
                  setModalLogout(false);
                }}
              >
                <Text
                  style={styles.cancelButtonText}
                >
                  Cancelar
                </Text>
              </Pressable>

              {/* SAIR */}

              <Pressable
                style={({ pressed }) => [
                  styles.logoutConfirmButton,
                  pressed && styles.buttonPressed,
                ]}
                disabled={saindo}
                onPress={sairDaConta}
              >
                <Text
                  style={styles.logoutConfirmButtonText}
                >
                  {saindo
                    ? "Saindo..."
                    : "Sair"}
                </Text>
              </Pressable>

            </View>

          </View>
        </View>
      </Modal>

      {/* =====================================================
          MODAL — EXCLUIR CONTA
      ===================================================== */}

      <Modal
        visible={modalExcluir}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!excluindo) {
            setModalExcluir(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>

          <View style={styles.modalContainer}>

            {/* ÍCONE */}

            <View style={styles.modalIcon}>
              <MaterialIcons
                name="delete-outline"
                size={34}
                color="#E53935"
              />
            </View>

            {/* TÍTULO */}

            <Text style={styles.modalTitle}>
              Excluir conta
            </Text>

            {/* TEXTO */}

            <Text style={styles.modalText}>
              Tem certeza que deseja
              excluir sua conta?
            </Text>

            {/* AVISO */}

            <Text style={styles.modalWarning}>
              Esta ação não poderá ser
              desfeita.
            </Text>

            {/* BOTÕES */}

            <View style={styles.modalButtons}>

              {/* CANCELAR */}

              <Pressable
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.buttonPressed,
                ]}
                disabled={excluindo}
                onPress={() => {
                  console.log(
                    "Exclusão cancelada."
                  );

                  setModalExcluir(false);
                }}
              >
                <Text
                  style={styles.cancelButtonText}
                >
                  Cancelar
                </Text>
              </Pressable>

              {/* EXCLUIR */}

              <Pressable
                style={({ pressed }) => [
                  styles.confirmButton,
                  pressed && styles.buttonPressed,
                ]}
                disabled={excluindo}
                onPress={excluirConta}
              >
                <Text
                  style={styles.confirmButtonText}
                >
                  {excluindo
                    ? "Excluindo..."
                    : "Excluir"}
                </Text>
              </Pressable>

            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  // ==========================================================
  // SCROLL
  // ==========================================================

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingHorizontal: 25,
    paddingTop: 50,
    paddingBottom: 40,
  },

  // ==========================================================
  // VOLTAR
  // ==========================================================

  backButton: {
    marginBottom: 20,
    alignSelf: "flex-start",
    padding: 3,
  },

  // ==========================================================
  // TÍTULO
  // ==========================================================

  title: {
    fontSize: 28,
    color: "#005386",
    marginBottom: 35,
    fontFamily: "Montserrat_700Bold",
  },

  // ==========================================================
  // ITENS DO MENU
  // ==========================================================

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    minHeight: 60,
  },

  menuText: {
    flex: 1,
    marginLeft: 15,
    color: "#333333",
    fontSize: 16,
    fontFamily: "Montserrat_400Regular",
  },

  // ==========================================================
  // LOGOUT
  // ==========================================================

  logoutText: {
    flex: 1,
    marginLeft: 15,
    color: "#005386",
    fontSize: 16,
    fontFamily: "Montserrat_600SemiBold",
  },

  logoutButtonPressed: {
    opacity: 0.5,
  },

  // ==========================================================
  // EXCLUIR
  // ==========================================================

  deleteMenuItem: {
    marginTop: 5,
    borderBottomWidth: 0,
    paddingBottom: 20,
  },

  deleteText: {
    flex: 1,
    marginLeft: 15,
    fontSize: 16,
    color: "#E53935",
    fontFamily: "Montserrat_600SemiBold",
  },

  deleteButtonPressed: {
    opacity: 0.5,
  },

  // ==========================================================
  // MODAIS
  // ==========================================================

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 25,
  },

  modalContainer: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
  },

  // ==========================================================
  // ÍCONE EXCLUIR
  // ==========================================================

  modalIcon: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#FFEAEA",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  // ==========================================================
  // ÍCONE LOGOUT
  // ==========================================================

  logoutModalIcon: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  // ==========================================================
  // TÍTULO MODAL
  // ==========================================================

  modalTitle: {
    fontSize: 21,
    color: "#333333",
    fontFamily: "Montserrat_700Bold",
    marginBottom: 12,
    textAlign: "center",
  },

  // ==========================================================
  // TEXTO MODAL
  // ==========================================================

  modalText: {
    fontSize: 15,
    color: "#555555",
    fontFamily: "Montserrat_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },

  // ==========================================================
  // AVISO EXCLUSÃO
  // ==========================================================

  modalWarning: {
    fontSize: 14,
    color: "#E53935",
    fontFamily: "Montserrat_600SemiBold",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 25,
  },

  // ==========================================================
  // BOTÕES DO MODAL
  // ==========================================================

  modalButtons: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    marginTop: 25,
  },

  // ==========================================================
  // CANCELAR
  // ==========================================================

  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CCCCCC",
    alignItems: "center",
    justifyContent: "center",
  },

  cancelButtonText: {
    fontSize: 15,
    color: "#555555",
    fontFamily: "Montserrat_600SemiBold",
  },

  // ==========================================================
  // BOTÃO CONFIRMAR EXCLUSÃO
  // ==========================================================

  confirmButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
  },

  confirmButtonText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: "Montserrat_600SemiBold",
  },

  // ==========================================================
  // BOTÃO CONFIRMAR LOGOUT
  // ==========================================================

  logoutConfirmButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#005386",
    alignItems: "center",
    justifyContent: "center",
  },

  logoutConfirmButtonText: {
    fontSize: 15,
    color: "#FFFFFF",
    fontFamily: "Montserrat_600SemiBold",
  },

  // ==========================================================
  // EFEITO AO PRESSIONAR
  // ==========================================================

  buttonPressed: {
    opacity: 0.6,
  },

});