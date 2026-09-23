import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../services/api.js";

const { width } = Dimensions.get("window");

interface Produto {
  id_produto: number;
  id_usuario: number;
  id_categoria: number;
  nm_produto: string;
  ds_produto: string | null;
  st_condicao: string;
  st_status: string;
  user?: {
    nm_usuario: string;
  };
  images?: {
    ds_imagem: string;
  }[];
}

const categories = [
  { id: null, name: "Todos" },
  { id: 1, name: "Hardware" },
  { id: 2, name: "Computador e notebook" },
  { id: 3, name: "Celular e tablet" },
  { id: 4, name: "Memórias e pen drives" },
  { id: 5, name: "Fontes e carregadores" },
  { id: 6, name: "Impressoras e adaptadores" },
  { id: 7, name: "Consoles e videogames" },
  { id: 8, name: "Câmeras" },
  { id: 9, name: "Outros" },
];

const conditionNames: Record<string, string> = {
  N: "Novo",
  S: "Semi-novo",
  U: "Usado",
  Q: "Quebrado",
};

export default function HomeScreen() {
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const banners = [
    {
      id: "1",
      title: "Troque sua GPU Antiga",
      subtitle: "Anúncios verificados pela comunidade",
    },
    {
      id: "2",
      title: "Feira de Componentes",
      subtitle: "Encontre peças raras para o seu setup",
    },
  ];

  const fetchProducts = async () => {
    try {
      setLoading(true);

      const response = await api.get("/products");

      if (Array.isArray(response.data)) {
        setProducts(response.data);
      } else if (Array.isArray(response.data?.data)) {
        setProducts(response.data.data);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Erro ao carregar produtos da Home:", error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProfileImage = async () => {
    try {
      let storedUser = await AsyncStorage.getItem("usuario");

      console.log("USUARIO DO STORAGE:", storedUser);

      if (!storedUser) {
        await new Promise((resolve) => setTimeout(resolve, 500));

        storedUser = await AsyncStorage.getItem("usuario");

        console.log(
          "USUARIO DO STORAGE - SEGUNDA TENTATIVA:",
          storedUser
        );
      }

      if (!storedUser) {
        console.log("USUÁRIO AINDA NÃO ENCONTRADO NO STORAGE");
        setProfileImage(null);
        return;
      }

      const user = JSON.parse(storedUser);

      console.log("USUARIO PARSEADO:", user);

      if (!user?.id_usuario) {
        console.log("ID DO USUÁRIO NÃO ENCONTRADO");
        setProfileImage(null);
        return;
      }

      console.log(
        "BUSCANDO USUÁRIO ATUALIZADO:",
        user.id_usuario
      );

      const response = await api.get(
        `/users/${user.id_usuario}`
      );

      console.log("USUARIO RECEBIDO DA API:", response.data);

      const updatedUser =
        response.data?.user || response.data;

      console.log(
        "CAMINHO DA FOTO:",
        updatedUser?.ds_foto_perfil
      );

      if (!updatedUser?.ds_foto_perfil) {
        console.log("USUÁRIO NÃO POSSUI FOTO");
        setProfileImage(null);
        return;
      }

      const caminho = String(
        updatedUser.ds_foto_perfil
      )
        .replace(/^\/+/, "")
        .replace(/^storage\/+/, "");

      const baseUrl =
        api.defaults.baseURL?.replace(
          /\/api\/?$/,
          ""
        ) || "http://127.0.0.1:8000";

      const urlFoto = `${baseUrl}/storage/${caminho}`;

      console.log("URL FINAL DA FOTO:", urlFoto);

      setProfileImage(urlFoto);
    } catch (error) {
      console.log(
        "ERRO AO CARREGAR FOTO DE PERFIL:",
        error
      );

      setProfileImage(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
      loadProfileImage();
    }, [])
  );

  const handleSearch = () => {
    const search = searchQuery.trim();

    router.push({
      pathname: "/resultados" as any,
      params: {
        search,
      },
    });
  };

  const handleCategory = (
    categoryId: number | null
  ) => {
    router.push({
      pathname: "/resultados" as any,
      params: {
        category:
          categoryId !== null
            ? String(categoryId)
            : "",
      },
    });
  };

  const getImageUrl = (
    imagePath?: string | null
  ) => {
    if (!imagePath) {
      return null;
    }

    const path = String(imagePath).trim();

    if (!path) {
      return null;
    }

    if (
      path.startsWith("http://") ||
      path.startsWith("https://")
    ) {
      return path;
    }

    const baseUrl =
      api.defaults.baseURL?.replace(
        /\/api\/?$/,
        ""
      ) || "http://127.0.0.1:8000";

    const cleanPath = path
      .replace(/^\/+/, "")
      .replace(/^storage\/+/, "");

    return `${baseUrl}/storage/${cleanPath}`;
  };

  const handleOpenProduct = (
    produto: Produto
  ) => {
    router.push({
      pathname: "/visuanuncios",
      params: {
        id: String(produto.id_produto),
      },
    } as any);
  };

  return (
    <View style={styles.mainContainer}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerContainer}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
          />

          <View style={styles.searchContainer}>
            <TouchableOpacity
              onPress={handleSearch}
              activeOpacity={0.7}
              style={styles.searchButton}
            >
              <Feather
                name="search"
                size={18}
                color="#005386"
              />
            </TouchableOpacity>

<TextInput
  style={styles.searchInput}
  placeholder="Buscar peças, marcas..."
  placeholderTextColor="#888"
  value={searchQuery}
  onChangeText={setSearchQuery}
  onSubmitEditing={handleSearch}
  returnKeyType="search"
  autoCapitalize="none"
  autoCorrect={false}
  textAlignVertical="center"
  includeFontPadding={false}
/>
          </View>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push("/perfil")}
          >
            {profileImage ? (
              <Image
                source={{
                  uri: profileImage,
                }}
                style={styles.profileImage}
                resizeMode="cover"
                onError={(e) => {
                  console.log(
                    "ERRO AO ABRIR FOTO:",
                    e.nativeEvent.error
                  );
                }}
              />
            ) : (
              <Feather
                name="user"
                size={22}
                color="#333"
              />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScrollView}
          contentContainerStyle={
            styles.categoriesContent
          }
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={String(category.id)}
              style={[
                styles.categoryTab,
                category.id === null &&
                  styles.activeCategoryTab,
              ]}
              onPress={() =>
                handleCategory(category.id)
              }
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryTabText,
                  category.id === null &&
                    styles.activeCategoryTabText,
                ]}
              >
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.featuredSection}>
          <Text style={styles.sectionTitle}>
            Destaques da Semana
          </Text>

          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={
              styles.carouselContent
            }
          >
            {banners.map((banner) => (
              <View
                key={banner.id}
                style={styles.bannerCard}
              >
                <View style={styles.bannerBadge}>
                  <Text style={styles.badgeText}>
                    PROMO
                  </Text>
                </View>

                <Text style={styles.bannerTitle}>
                  {banner.title}
                </Text>

                <Text style={styles.bannerSubtitle}>
                  {banner.subtitle}
                </Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.dotsContainer}>
            <View
              style={[
                styles.dot,
                styles.activeDot,
              ]}
            />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>
        </View>

        <View style={styles.productsSection}>
          <View style={styles.titleRow}>
            <Text style={styles.sectionTitle}>
              Adicionados Recentemente
            </Text>

            <TouchableOpacity
              onPress={() =>
                router.push(
                  "/resultados" as any
                )
              }
              activeOpacity={0.7}
            >
              <Text style={styles.seeMoreText}>
                Ver todos
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#0099FF"
              style={styles.loading}
            />
          ) : (
            <FlatList
              data={products}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) =>
                String(item.id_produto)
              }
              contentContainerStyle={
                styles.productListContent
              }
              nestedScrollEnabled
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  Nenhum produto anunciado
                  ainda.
                </Text>
              }
              renderItem={({
                item,
              }: {
                item: Produto;
              }) => {
                const imagemUrl =
                  getImageUrl(
                    item.images?.[0]
                      ?.ds_imagem
                  );

                return (
                  <TouchableOpacity
                    style={
                      styles.productCard
                    }
                    onPress={() =>
                      handleOpenProduct(
                        item
                      )
                    }
                    activeOpacity={0.85}
                  >
                    <View
                      style={
                        styles.productImagePlaceholder
                      }
                    >
                      {imagemUrl ? (
                        <Image
                          source={{
                            uri: imagemUrl,
                          }}
                          style={
                            styles.productImage
                          }
                          resizeMode="cover"
                          onError={(
                            error
                          ) => {
                            console.log(
                              "Erro ao carregar imagem:",
                              imagemUrl,
                              error
                                .nativeEvent
                            );
                          }}
                        />
                      ) : (
                        <Feather
                          name="cpu"
                          size={28}
                          color="#005386"
                        />
                      )}
                    </View>

                    <View
                      style={
                        styles.productInfo
                      }
                    >
                      <Text
                        style={
                          styles.productName
                        }
                        numberOfLines={1}
                      >
                        {item.nm_produto}
                      </Text>

                      <Text
                        style={
                          styles.productSpecs
                        }
                        numberOfLines={1}
                      >
                        {conditionNames[
                          item.st_condicao
                        ] ||
                          item.st_condicao}
                      </Text>

                      <Text
                        style={
                          styles.productPrice
                        }
                        numberOfLines={2}
                      >
                        {item.ds_produto ||
                          "Sem descrição"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },

  logo: {
    width: 75,
    height: 75,
    resizeMode: "contain",
  },

  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    height: 38,
    borderRadius: 19,
    marginLeft: 12,
    marginRight: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#0099FF",
  },

  searchButton: {
    justifyContent: "center",
    alignItems: "center",
  },

searchInput: {
  flex: 1,
  height: 38,
  paddingVertical: 0,
  paddingHorizontal: 0,
  fontSize: 13,
  color: "#333333",
  marginLeft: 8,
  fontFamily: "Montserrat_400Regular",
  textAlignVertical: "center",
},

  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  profileImage: {
    width: "100%",
    height: "100%",
  },

  categoriesScrollView: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },

  categoriesContent: {
    paddingHorizontal: 16,
    alignItems: "center",
    height: "100%",
  },

  categoryTab: {
    marginRight: 20,
    paddingVertical: 6,
  },

  activeCategoryTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#0099FF",
  },

  categoryTabText: {
    fontSize: 14,
    color: "#777777",
    fontFamily: "Montserrat_400Regular",
  },

  activeCategoryTabText: {
    color: "#005386",
    fontFamily: "Montserrat_600SemiBold",
  },

  featuredSection: {
    marginTop: 20,
    paddingHorizontal: 16,
  },

  sectionTitle: {
    fontSize: 16,
    color: "#333333",
    marginBottom: 12,
    fontFamily: "Montserrat_700Bold",
  },

  carousel: {
    width: width - 32,
    height: 160,
  },

  carouselContent: {
    alignItems: "stretch",
  },

  bannerCard: {
    width: width - 32,
    height: 160,
    backgroundColor: "#E4F8FF",
    borderRadius: 16,
    padding: 20,
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#0099FF",
    elevation: 3,
  },

  bannerBadge: {
    backgroundColor: "#005386",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 10,
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Montserrat_700Bold",
  },

  bannerTitle: {
    fontSize: 20,
    color: "#333333",
    fontFamily: "Montserrat_700Bold",
  },

  bannerSubtitle: {
    fontSize: 13,
    color: "#777777",
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
  },

  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EEEEEE",
    marginHorizontal: 4,
  },

  activeDot: {
    backgroundColor: "#0099FF",
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  productsSection: {
    marginTop: 25,
    marginBottom: 30,
  },

  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  seeMoreText: {
    fontSize: 12,
    color: "#0099FF",
    fontFamily: "Montserrat_600SemiBold",
  },

  loading: {
    marginVertical: 20,
  },

  productListContent: {
    paddingHorizontal: 16,
  },

  productCard: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    marginRight: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
    elevation: 2,
  },

  productImagePlaceholder: {
    width: "100%",
    height: 100,
    backgroundColor: "#F5FBFF",
    justifyContent: "center",
    alignItems: "center",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  productInfo: {
    padding: 8,
  },

  productName: {
    fontSize: 13,
    color: "#333333",
    fontFamily: "Montserrat_600SemiBold",
  },

  productSpecs: {
    fontSize: 11,
    color: "#777777",
    marginVertical: 2,
    fontFamily: "Montserrat_400Regular",
  },

  productPrice: {
    fontSize: 12,
    color: "#0099FF",
    fontFamily: "Montserrat_400Regular",
  },

  emptyText: {
    fontSize: 13,
    color: "#999999",
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontFamily: "Montserrat_400Regular",
  },
});
