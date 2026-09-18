import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";

const { width } = Dimensions.get("window");
const itemWidth = (width - 44) / 2;

interface UserProfileData {
  name: string;
  description: string;
  rating: string;
}

interface ProdutoImagem {
  ds_imagem: string;
}

interface Produto {
  id_produto: number;
  nm_produto: string;
  st_condicao: string;
  images?: ProdutoImagem[];
}

export default function ProfileScreen() {
  const router = useRouter();
  
  const [user, setUser] = useState<UserProfileData>({
    name: "",
    description: "",
    rating: "5.0",
  });

  // 🌟 Estados para os produtos da API e controle de carregamento
  const [userProducts, setUserProducts] = useState<Produto[]>([]);  const [loadingProducts, setLoadingProducts] = useState(true);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // 🌟 Carrega as informações do usuário e os produtos sempre que a tela ganha foco
  useFocusEffect(
    useCallback(() => {
      carregarUsuario();
      fetchUserProducts();
    }, [])
  );

  async function carregarUsuario() {
    try {
      const dados = await AsyncStorage.getItem("usuario");
      if (dados) {
        const usuario = JSON.parse(dados);
        setUser({
          name: usuario.nm_usuario || "",
          description: usuario.ds_usuario || "Descrição não informada",
          rating: "5.0",
        });
      }
    } catch (erro) {
      console.log("Erro ao carregar usuário:", erro);
    }
  }

  // 🌟 Busca os produtos reais cadastrados pelo usuário logado no Laravel
  async function fetchUserProducts() {
    try {
      setLoadingProducts(true);
      const token = await AsyncStorage.getItem("token");

      const response = await api.get("/my-products", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUserProducts(response.data);
    } catch (error) {
      console.log("Erro ao carregar anúncios do usuário:", error);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function sairDaConta() {
    try {
      const token = await AsyncStorage.getItem("token");
      await api.post(
        "/logout",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (erro) {
      console.log("Erro ao fazer logout:", erro);
    }

    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("usuario");
    router.replace("/(auth)/login");
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* 1. HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="arrow-left" size={24} color="#005386" />         
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={() => setLogoutModalVisible(true)} 
          style={styles.headerButton}
        >
          <Feather name="log-out" size={22} color="#E53935" />         
        </TouchableOpacity>
      </View>

      {/* MAIN PROFILE CONTENT */}
      <FlatList
        data={userProducts}
        keyExtractor={(item) => String(item.id_produto)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        
        ListHeaderComponent={(
          <View>
            {/* 2. USER DATA */}
            <View style={styles.profileInfoContainer}>
              <View style={styles.roundAvatar}>
                <Feather name="user" size={45} color="#005386" />
              </View>

              <View style={styles.userInfoTextContainer}>
                <Text style={styles.userName}>{user.name}</Text>
                
                <View style={styles.addressRow}>
                  <Feather
                    name="file-text"
                    size={12}
                    color="#0099FF"
                    style={styles.addressIcon}
                  />
                  <Text style={styles.userSubtext} numberOfLines={2}>
                    {user.description}
                  </Text>
                </View>
              </View>
            </View>

            {/* 3. RATING SYSTEM */}
            <View style={styles.ratingContainer}>
              <View style={styles.starsRow}>
                <Feather name="star" size={18} color="#005386" style={styles.starIcon} />
                <Feather name="star" size={18} color="#005386" style={styles.starIcon} />
                <Feather name="star" size={18} color="#005386" style={styles.starIcon} />
                <Feather name="star" size={18} color="#005386" style={styles.starIcon} />
                <Feather name="star" size={18} color="#005386" />
              </View>
              <Text style={styles.ratingText}>— {user.rating}</Text>
            </View>

            {/* 4. INTERNAL TABS */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
              {["Anúncios"].map((tab, index) => (
                <TouchableOpacity key={index} style={[styles.tabItem, index === 0 && styles.activeTab]}>
                  <Text style={[styles.tabText, index === 0 && styles.activeTabText]}>{tab}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        ListEmptyComponent={
          loadingProducts ? (
            <ActivityIndicator size="large" color="#0099FF" style={{ marginTop: 30 }} />
          ) : (
            <Text style={styles.emptyText}>Você ainda não possui anúncios cadastrados.</Text>
          )
        }
        
        renderItem={({ item }) => {
          // Trata a URL da imagem vinda do Laravel Storage
          const baseURL = api.defaults.baseURL ?? "";

          const imagemUrl =
  item.images && item.images.length > 0
    ? `${baseURL.replace("/api", "")}/storage/${item.images[0].ds_imagem}`
    : null;

          return (
            <View style={styles.listingCard}>
              <View style={styles.imagePlaceholder}>
                {imagemUrl ? (
                  <Image source={{ uri: imagemUrl }} style={styles.productImage} />
                ) : (
                  <Feather name="package" size={32} color="#0099FF" />
                )}
              </View>
              <View style={styles.textPlaceholderRow}>
                <Text style={styles.listingTitle} numberOfLines={1}>{item.nm_produto}</Text>
                <Text style={styles.listingPrice} numberOfLines={1}>
                  {item.st_condicao === 'N' ? 'Novo' : 'Usado'}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* LOGOUT CONFIRMATION MODAL */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={logoutModalVisible}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.logoutModalTitle}>Deseja sair da conta?</Text>
            <Text style={styles.logoutModalSubtitle}>
              Ao confirmar, sua sessão atual será encerrada com segurança e você retornará à tela inicial.
            </Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity 
                style={styles.cancelLogoutButton} 
                onPress={() => setLogoutModalVisible(false)}
              >
                <Text style={styles.cancelLogoutText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.confirmLogoutButton} 
                onPress={async () => {
                  setLogoutModalVisible(false);
                  await sairDaConta();
                }}
              >
                <Text style={styles.confirmLogoutText}>Sair</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  headerButton: {
    padding: 6,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  profileInfoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },
  roundAvatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#0099FF",
    shadowColor: "#0099FF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  userInfoTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 19,
    color: "#005386",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  addressIcon: {
    marginRight: 4,
  },
  userSubtext: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: "#777777",
    flex: 1,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    paddingLeft: 4,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  starIcon: {
    marginRight: 4,
  },
  ratingText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
    marginLeft: 8,
  },
  tabsContainer: {
    marginVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 4,
  },
  tabItem: {
    marginRight: 24,
    paddingBottom: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#0099FF",
  },
  tabText: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: "#888",
  },
  activeTabText: {
    fontFamily: "Montserrat_700Bold",
    color: "#005386",
  },
  gridRow: {
    justifyContent: "space-between",
  },
  listingCard: {
    width: itemWidth,
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  imagePlaceholder: {
    width: "100%",
    height: itemWidth,
    backgroundColor: "#F5FBFF",
    justifyContent: "center",
    alignItems: "center",
  },
  productImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  textPlaceholderRow: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  listingTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#333333",
  },
  listingPrice: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
    marginTop: 2,
  },
  emptyText: {
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
    color: "#888",
    marginTop: 40,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
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
  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  cancelLogoutButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0099FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    backgroundColor: "#fff",
  },
  cancelLogoutText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
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