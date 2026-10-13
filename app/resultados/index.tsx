import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import api from "../../services/api";

/* ============================================================
    TIPOS
============================================================ */
type Product = {
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
};

type Category = {
  id: number | null;
  name: string;
};

type Condition = {
  id: string | null;
  name: string;
};

/* ============================================================
    CATEGORIAS
============================================================ */
const categories: Category[] = [
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

/* ============================================================
    CONDIÇÕES
============================================================ */
const conditions: Condition[] = [
  { id: null, name: "Todos" },
  { id: "N", name: "Novo" },
  { id: "S", name: "Semi-novo" },
  { id: "U", name: "Usado" },
  { id: "Q", name: "Quebrado" },
];

/* ============================================================
    NOMES DAS CONDIÇÕES
============================================================ */
const conditionNames: Record<string, string> = {
  N: "Novo",
  S: "Semi-novo",
  U: "Usado",
  Q: "Quebrado",
};

/* ============================================================
    TELA
============================================================ */
export default function ResultadosScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const columns = width >= 1100 ? 4 : width >= 700 ? 3 : 2;
  const cardWidth = (width - 32 - (columns - 1) * 12) / columns;
  
  const categoryButtonWidth = Math.max(1, Math.floor((width - 72) / 3));

  const params = useLocalSearchParams<{
    search?: string;
    category?: string;
    condition?: string;
  }>();

  /* ==========================================================
     ESTADOS
  ========================================================== */
  const [searchQuery, setSearchQuery] = useState(
    typeof params.search === "string" ? params.search : ""
  );
  const [selectedCategory, setSelectedCategory] = useState<number | null>(
    params.category ? Number(params.category) : null
  );
  const [selectedCondition, setSelectedCondition] = useState<string | null>(
    typeof params.condition === "string" ? params.condition : null
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [tempCategory, setTempCategory] = useState<number | null>(
    selectedCategory
  );
  const [tempCondition, setTempCondition] = useState<string | null>(
    selectedCondition
  );

  /* ==========================================================
     BUSCAR PRODUTOS
  ========================================================== */
  const fetchProducts = useCallback(
    async (
      search: string = searchQuery,
      category: number | null = selectedCategory,
      condition: string | null = selectedCondition
    ) => {
      try {
        setLoading(true);
        const requestParams: Record<string, string | number> = {};
        if (search.trim()) {
          requestParams.search = search.trim();
        }
        if (category !== null) {
          requestParams.category = category;
        }
        if (condition !== null) {
          requestParams.condition = condition;
        }
        const response = await api.get("/products", {
          params: requestParams,
          headers: {
            Accept: "application/json",
          },
        });
        if (Array.isArray(response.data)) {
          setProducts(response.data);
        } else if (Array.isArray(response.data?.products)) {
          setProducts(response.data.products);
        } else if (Array.isArray(response.data?.data)) {
          setProducts(response.data.data);
        } else {
          setProducts([]);
        }
      } catch (error: any) {
        console.error(
          "Erro ao buscar produtos:",
          error?.response?.data || error
        );
        setProducts([]);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, selectedCategory, selectedCondition]
  );

  /* ==========================================================
     CARREGAMENTO INICIAL
  ========================================================== */
  useEffect(() => {
    const initialSearch =
      typeof params.search === "string" ? params.search : "";
    const initialCategory = params.category
      ? Number(params.category)
      : null;
    const initialCondition =
      typeof params.condition === "string"
        ? params.condition
        : null;
    setSearchQuery(initialSearch);
    setSelectedCategory(initialCategory);
    setSelectedCondition(initialCondition);
    fetchProducts(
      initialSearch,
      initialCategory,
      initialCondition
    );
  }, []);

  /* ==========================================================
     PESQUISA
  ========================================================== */
  const handleSearch = () => {
    Keyboard.dismiss();
    fetchProducts(
      searchQuery,
      selectedCategory,
      selectedCondition
    );
  };

  /* ==========================================================
     ABRIR FILTROS
  ========================================================== */
  const openFilters = () => {
    setTempCategory(selectedCategory);
    setTempCondition(selectedCondition);
    setFiltersVisible(true);
  };

  /* ==========================================================
     APLICAR FILTROS
  ========================================================== */
  const applyFilters = () => {
    setSelectedCategory(tempCategory);
    setSelectedCondition(tempCondition);
    setFiltersVisible(false);
    fetchProducts(
      searchQuery,
      tempCategory,
      tempCondition
    );
  };

  /* ==========================================================
     LIMPAR FILTROS
  ========================================================== */
  const clearFilters = () => {
    setSelectedCategory(null);
    setSelectedCondition(null);
    setTempCategory(null);
    setTempCondition(null);
    setFiltersVisible(false);
    fetchProducts(
      searchQuery,
      null,
      null
    );
  };

  /* ==========================================================
     LIMPAR BUSCA
  ========================================================== */
  const clearSearch = () => {
    setSearchQuery("");
    fetchProducts(
      "",
      selectedCategory,
      selectedCondition
    );
  };

  /* ==========================================================
     URL DA IMAGEM
  ========================================================== */
  const getImageUrl = (imagePath?: string | null) => {
    if (!imagePath) {
      return null;
    }
    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://")
    ) {
      return imagePath;
    }
    const baseUrl =
      api.defaults.baseURL?.replace(/\/api\/?$/, "") ||
      "http://127.0.0.1:8000";
    const normalizedPath = imagePath
      .replace(/^\/+/, "")
      .replace(/^storage\/+/, "");
    return `${baseUrl}/storage/${normalizedPath}`;
  };

  /* ==========================================================
     CATEGORIA ATUAL
  ========================================================== */
  const selectedCategoryName = useMemo(() => {
    if (selectedCategory === null) return null;
    const category = categories.find(
      (item) => item.id === selectedCategory
    );
    return category?.name || null;
  }, [selectedCategory]);

  /* ==========================================================
     CONDIÇÃO ATUAL
  ========================================================== */
  const selectedConditionName = useMemo(() => {
    if (!selectedCondition) {
      return null;
    }
    return conditionNames[selectedCondition] || null;
  }, [selectedCondition]);

  /* ==========================================================
     QUANTIDADE DE FILTROS
  ========================================================== */
  const activeFilterCount =
    (selectedCategory !== null ? 1 : 0) +
    (selectedCondition !== null ? 1 : 0);

  /* ==========================================================
     ABRIR VISUALIZAÇÃO DO ANÚNCIO
  ========================================================== */
  const handleProductPress = (productId: number) => {
    router.push({
      pathname: "/visuanuncios",
      params: {
        id: String(productId),
      },
    });
  };

  /* ==========================================================
     CARD DO PRODUTO
  ========================================================== */
  const renderProduct = ({
    item,
  }: {
    item: Product;
  }) => {
    const imagePath = item.images?.[0]?.ds_imagem;
    const imageUrl = getImageUrl(imagePath);
    return (
      <TouchableOpacity
        style={[styles.productCard, { width: cardWidth }]}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Ver anúncio: ${item.nm_produto}`}
        onPress={() => handleProductPress(item.id_produto)}
      >
        <View style={styles.imageWrapper}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Feather name="cpu" size={28} color="#005386" />
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{item.nm_produto}</Text>
          <Text style={styles.productSpecs} numberOfLines={1}>
            {conditionNames[item.st_condicao] || item.st_condicao}
          </Text>
          <Text style={styles.productDescription} numberOfLines={2}>
            {item.ds_produto || "Sem descrição"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  /* ==========================================================
     TELA
  ========================================================== */
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)");
            }
          }}
          style={styles.backButton}
          activeOpacity={0.75}
        >
          <Feather
            name="arrow-left"
            size={21}
            color="#005386"
          />
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            placeholder="Buscar no Peça por Peça..."
            placeholderTextColor="#98A3AA"
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={clearSearch}
              style={styles.clearSearchButton}
              activeOpacity={0.7}
            >
              <Feather
                name="x"
                size={17}
                color="#8A959D"
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleSearch}
            style={styles.searchButton}
            activeOpacity={0.8}
          >
            <Feather
              name="search"
              size={18}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ÁREA PRINCIPAL */}
      <View style={styles.content}>
        {/* CONTROLES */}
        <View style={styles.controlRow}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>Peças encontradas</Text>
            <Text style={styles.resultsText}>
              {loading ? "Buscando..." : `${products.length} ${products.length === 1 ? "resultado" : "resultados"}`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={openFilters}
            style={[
              styles.filterButton,
              activeFilterCount > 0 &&
                styles.filterButtonActive,
            ]}
            activeOpacity={0.8}
          >
            <Feather
              name="sliders"
              size={17}
              color={
                activeFilterCount > 0
                  ? "#FFFFFF"
                  : "#005386"
              }
            />
            <Text
              style={[
                styles.filterButtonText,
                activeFilterCount > 0 &&
                  styles.filterButtonTextActive,
              ]}
            >
              Filtros
            </Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterCounter}>
                <Text style={styles.filterCounterText}>
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* FILTROS ATIVOS */}
        {(selectedCategoryName ||
          selectedConditionName) && (
          <ScrollView
            style={{ flexGrow: 0, flexShrink: 0 }}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={
              styles.activeFiltersContainer
            }
          >
            {selectedCategoryName && (
              <View style={styles.activeFilterTag}>
                <Feather
                  name="grid"
                  size={12}
                  color="#005386"
                />
                <Text
                  style={styles.activeFilterTagText}
                  numberOfLines={1}
                >
                  {selectedCategoryName}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCategory(null);
                    fetchProducts(
                      searchQuery,
                      null,
                      selectedCondition
                    );
                  }}
                >
                  <Feather
                    name="x"
                    size={13}
                    color="#005386"
                  />
                </TouchableOpacity>
              </View>
            )}
            {selectedConditionName && (
              <View style={styles.activeFilterTag}>
                <Feather
                  name="tag"
                  size={12}
                  color="#005386"
                />
                <Text
                  style={styles.activeFilterTagText}
                >
                  {selectedConditionName}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCondition(null);
                    fetchProducts(
                      searchQuery,
                      selectedCategory,
                      null
                    );
                  }}
                >
                  <Feather
                    name="x"
                    size={13}
                    color="#005386"
                  />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity
              onPress={clearFilters}
              style={styles.clearAllFilters}
            >
              <Text style={styles.clearAllFiltersText}>
                Limpar
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* RESULTADOS */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingIcon}>
              <ActivityIndicator
                size="small"
                color="#005386"
              />
            </View>
            <Text style={styles.loadingTitle}>
              Buscando peças
            </Text>
            <Text style={styles.loadingText}>
              Aguarde um momento...
            </Text>
          </View>
        ) : (
          <FlatList
            key={`products-${columns}`}
            numColumns={columns}
            columnWrapperStyle={styles.gridRow}
            keyboardShouldPersistTaps="handled"
            data={products}
            keyExtractor={(item) =>
              String(item.id_produto)
            }
            renderItem={renderProduct}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={
              products.length === 0
                ? styles.emptyContainer
                : styles.productsList
            }
            ListEmptyComponent={
              <View style={styles.emptyContent}>
                <View style={styles.emptyIcon}>
                  <Feather
                    name="search"
                    size={34}
                    color="#005386"
                  />
                </View>
                <Text style={styles.emptyTitle}>
                  Nenhuma peça encontrada
                </Text>
                <Text style={styles.emptyText}>
                  Não encontramos peças que
                  correspondam à sua pesquisa
                  ou aos filtros selecionados.
                </Text>
                {(selectedCategory !== null ||
                  selectedCondition !== null ||
                  searchQuery.length > 0) && (
                  <TouchableOpacity
                    onPress={() => {
                      setSearchQuery("");
                      setSelectedCategory(null);
                      setSelectedCondition(null);
                      fetchProducts(
                        "",
                        null,
                        null
                      );
                    }}
                    style={styles.emptyButton}
                    activeOpacity={0.8}
                  >
                    <Feather
                      name="refresh-cw"
                      size={15}
                      color="#FFFFFF"
                    />
                    <Text style={styles.emptyButtonText}>
                      Ver todas as peças
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            }
          />
        )}
      </View>

      {/* MODAL DE FILTROS */}
      <Modal
        visible={filtersVisible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setFiltersVisible(false)
        }
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() =>
              setFiltersVisible(false)
            }
          />
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  Filtros
                </Text>
                <Text style={styles.modalSubtitle}>
                  Encontre exatamente o que procura
                </Text>
              </View>
              <TouchableOpacity
                onPress={() =>
                  setFiltersVisible(false)
                }
                style={styles.modalClose}
                activeOpacity={0.75}
              >
                <Feather
                  name="x"
                  size={20}
                  color="#555"
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                styles.modalContent
              }
            >
              {/* CATEGORIA */}
              <View style={styles.modalSection}>
                <View style={styles.modalSectionHeader}>
                  <View
                    style={styles.modalIconContainer}
                  >
                    <Feather
                      name="tag"
                      size={17}
                      color="#005386"
                    />
                  </View>
                  <View>
                    <Text
                      style={
                        styles.modalSectionTitle
                      }
                    >
                      Categoria
                    </Text>
                    <Text
                      style={
                        styles.modalSectionSubtitle
                      }
                    >
                      Qual tipo de peça você procura?
                    </Text>
                  </View>
                </View>
                <View style={styles.optionsGrid}>
                  {categories.map((category) => {
                    const isSelected =
                      tempCategory === category.id;
                    const isAll = category.id === null;
                    return (
                      <TouchableOpacity
                        key={String(category.id)}
                        onPress={() =>
                          setTempCategory(
                            category.id
                          )
                        }
                        style={[
                          styles.optionCard,
                          {
                            width: isAll ? "100%" : categoryButtonWidth,
                          },
                          isSelected && styles.optionCardSelected,
                        ]}
                        activeOpacity={0.8}
                      >
                        <Text
                          numberOfLines={2}
                          style={[
                            styles.optionText,
                            isSelected &&
                              styles.optionTextSelected,
                          ]}
                        >
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* CONDIÇÃO */}
              <View style={styles.modalSection}>
                <View style={styles.modalSectionHeader}>
                  <View
                    style={styles.modalIconContainer}
                  >
                    <Feather
                      name="grid"
                      size={17}
                      color="#005386"
                    />
                  </View>
                  <View>
                    <Text
                      style={
                        styles.modalSectionTitle
                      }
                    >
                      Estado de conservação
                    </Text>
                    <Text
                      style={
                        styles.modalSectionSubtitle
                      }
                    >
                      Escolha o estado da peça
                    </Text>
                  </View>
                </View>
                <View style={styles.conditionOptions}>
                  {conditions.map((condition) => {
                    const isSelected =
                      tempCondition === condition.id;
                    return (
                      <TouchableOpacity
                        key={String(condition.id)}
                        onPress={() =>
                          setTempCondition(
                            condition.id
                          )
                        }
                        style={[
                          styles.conditionOption,
                          isSelected &&
                            styles.conditionOptionSelected,
                        ]}
                        activeOpacity={0.8}
                      >
                        <View
                          style={[
                            styles.radio,
                            isSelected &&
                              styles.radioSelected,
                          ]}
                        >
                          {isSelected && (
                            <View
                              style={
                                styles.radioInner
                              }
                            />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.conditionOptionText,
                            isSelected &&
                              styles.conditionOptionTextSelected,
                          ]}
                        >
                          {condition.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* RODAPÉ DO MODAL */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={() => {
                  setTempCategory(null);
                  setTempCondition(null);
                }}
                style={styles.modalClearButton}
                activeOpacity={0.8}
              >
                <Text
                  style={
                    styles.modalClearButtonText
                  }
                >
                  Limpar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyFilters}
                style={styles.applyButton}
                activeOpacity={0.85}
              >
                <Text style={styles.applyButtonText}>
                  Aplicar filtros
                </Text>
                <Feather
                  name="arrow-right"
                  size={17}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ============================================================
    ESTILOS
============================================================ */
const styles = StyleSheet.create({
  gridRow: { gap: 12, marginBottom: 14 },
  productSpecs: {
    fontFamily: "Montserrat_400Regular", fontSize: 11,
    color: "#777777", marginVertical: 2,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F4",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F2F8FB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  searchContainer: {
    flex: 1,
    minWidth: 0,
    height: 46,
    paddingLeft: 12,
    paddingRight: 4,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#005386",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: "#333333",
  },
  clearSearchButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#005386",
    alignItems: "center",
    justifyContent: "center",
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 7,
  },
  filterButton: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDE7EC",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  filterButtonActive: {
    backgroundColor: "#005386",
    borderColor: "#005386",
  },
  filterButtonText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 12,
    color: "#005386",
  },
  filterButtonTextActive: {
    color: "#FFFFFF",
  },
  filterCounter: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  filterCounterText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    color: "#005386",
  },
  activeFiltersContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 7,
  },
  activeFilterTag: {
    height: 30,
    paddingHorizontal: 9,
    borderRadius: 9,
    backgroundColor: "#EAF7FD",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  activeFilterTagText: {
    maxWidth: 150,
    fontFamily: "Montserrat_700Bold",
    fontSize: 10,
    color: "#005386",
  },
  clearAllFilters: {
    height: 30,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  clearAllFiltersText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 10,
    color: "#7B858B",
  },
  resultsHeader: {
    flex: 1,
    marginRight: 12,
  },
  resultsTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: "#333A3F",
  },
  resultsText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#8B969D",
    marginTop: 2,
  },
  productsList: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 30,
  },
  productCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
    elevation: 2,
  },
  imageWrapper: {
    width: "100%",
    aspectRatio: 1.4,
    backgroundColor: "#F5FBFF",
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5FBFF",
  },
  productInfo: {
    padding: 10,
    minHeight: 100,
  },
  productName: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#333333",
  },
  productDescription: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: "#0099FF",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 80,
  },
  loadingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EAF7FD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  loadingTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: "#333A3F",
  },
  loadingText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#8A959D",
    marginTop: 4,
  },
  // Estilos da Lista Vazia adicionados
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  emptyContent: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#EAF7FD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: "#333A3F",
    textAlign: "center",
    marginBottom: 6,
  },
  emptyText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: "#8A959D",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyButton: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#005386",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  emptyButtonText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
  // Estilos do Modal de Filtros
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#DDDDDD",
    alignSelf: "center",
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F4",
  },
  modalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#333333",
  },
  modalSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
  },
  modalClose: {
    padding: 5,
  },
  modalContent: {
    padding: 20,
  },
  modalSection: {
    marginBottom: 20,
  },
  modalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  modalIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#EAF7FD",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSectionTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: "#333333",
  },
  modalSectionSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#888888",
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionCard: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  optionCardSelected: {
    backgroundColor: "#EAF7FD",
    borderColor: "#005386",
  },
  optionText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: "#555555",
    textAlign: "center",
  },
  optionTextSelected: {
    fontFamily: "Montserrat_700Bold",
    color: "#005386",
  },
  conditionOptions: {
    gap: 8,
  },
  conditionOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FAFAFA",
  },
  conditionOptionSelected: {
    backgroundColor: "#EAF7FD",
    borderColor: "#005386",
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#AAAAAA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  radioSelected: {
    borderColor: "#005386",
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#005386",
  },
  conditionOptionText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: "#555555",
  },
  conditionOptionTextSelected: {
    fontFamily: "Montserrat_700Bold",
    color: "#005386",
  },
  modalFooter: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F4",
  },
  modalClearButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    alignItems: "center",
    justifyContent: "center",
  },
  modalClearButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#666666",
  },
  applyButton: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#005386",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyButtonText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});