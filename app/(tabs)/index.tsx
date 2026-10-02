import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Href } from "expo-router";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ImageSourcePropType, ViewStyle } from "react-native";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import api from "../../services/api.js";

const HORIZONTAL_PADDING = 32;

const GRID_GAP = 14;

const PRODUCT_IMAGE_RATIO = 1.4;

const BANNER_HEIGHT = 150;

const AUTO_PLAY_INTERVAL = 4500;

const REQUEST_TIMEOUT = 15000;

const PRODUCTS_CACHE_KEY = "@pecapeca:products_cache_v2";

const CACHE_MAX_AGE = 6 * 60 * 60 * 1000;

type Banner = {
  id: string;
  label: string;
  image: ImageSourcePropType;
  destination: Href | null;
};

const BANNERS: Banner[] = [
  {
    id: "1",
    label: "Anúncio em destaque 1",
    image: require("../../assets/images/anuncio1.png"),
    destination: null,
  },
  {
    id: "2",
    label: "Anúncio em destaque 2",
    image: require("../../assets/images/anuncio2.png"),
    destination: null,
  },
  {
    id: "3",
    label: "Anúncio em destaque 3",
    image: require("../../assets/images/anuncio3.png"),
    destination: null,
  },
];

const CATEGORIES = [
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
] as const;

const CONDITION_NAMES: Record<string, string> = {
  N: "Novo",
  S: "Seminovo",
  U: "Usado",
  Q: "Quebrado",
};
// Sombras próprias para Web, iOS e Android, sem dependências extras.

const HEADER_SHADOW: ViewStyle = Platform.select({
  web: { boxShadow: "0px 5px 16px rgba(0, 83, 134, 0.08)" } as ViewStyle,
  ios: { shadowColor: "#005386", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10 },
  default: { elevation: 4 },
}) ?? {};

const CARD_SHADOW: ViewStyle = Platform.select({
  web: { boxShadow: "0px 4px 14px rgba(0, 83, 134, 0.06)" } as ViewStyle,
  ios: { shadowColor: "#005386", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.07, shadowRadius: 8 },
  default: { elevation: 2 },
}) ?? {};



type ImagemProduto = {
  id_imagem?: number;
  ds_imagem: string;
  nr_ordem?: number;
};

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
  images?: ImagemProduto[];
  imagens?: ImagemProduto[];
  ds_imagem?: string;
}

function getImageUrl(imagePath?: string | null): string | null {
  const path = String(imagePath || "").trim();
  if (!path) return null;
  if (/^(https?:|blob:|data:|file:|content:)/i.test(path)) {
    return path;
  }
  const baseUrl = String(
    api.defaults.baseURL || "http://127.0.0.1:8000/api"
  )
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
  const cleanPath = path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^storage\/+/, "");
  return `${baseUrl}/storage/${cleanPath}`;
}

function getProductImages(item: Produto): string[] {
  const lista =
    Array.isArray(item.images) && item.images.length > 0
      ? item.images
      : Array.isArray(item.imagens)
        ? item.imagens
        : [];
  const urls = [...lista]
    .sort(
      (a, b) =>
        Number(a.nr_ordem || 0) - Number(b.nr_ordem || 0)
    )
    .map((imagem) => getImageUrl(imagem.ds_imagem))
    .filter((url): url is string => Boolean(url))
    .slice(0, 5);
  if (urls.length > 0) return urls;
  const antiga = getImageUrl(item.ds_imagem);
  return antiga ? [antiga] : [];
}

function extractProducts(payload: any): Produto[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload?.produtos)) return payload.produtos;
  throw new Error("A API retornou uma lista de produtos inválida.");
}

function removeDuplicates(list: Produto[]): Produto[] {
  const map = new Map<number, Produto>();
  for (const item of list) {
    if (!item?.id_produto) continue;
    if (!map.has(item.id_produto)) {
      map.set(item.id_produto, item);
    }
  }
  return Array.from(map.values());
}

async function saveCache(products: Produto[]) {
  try {
    await AsyncStorage.setItem(
      PRODUCTS_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        data: products.slice(0, 60),
      })
    );
  } catch {
    // Falha no cache não impede a exibição dos produtos.
  }
}

async function loadCache(): Promise<Produto[] | null> {
  try {
    const raw = await AsyncStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !parsed?.ts ||
      !Array.isArray(parsed.data) ||
      Date.now() - parsed.ts > CACHE_MAX_AGE
    ) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

// ============================================================
// BANNERS

// ============================================================

const BannerCarousel = memo(function BannerCarousel() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(1, width - HORIZONTAL_PADDING);
  const scrollRef = useRef<ScrollView>(null);
  const activeRef = useRef(0);
  const draggingRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const [activeIndex, setActiveIndex] = useState(0);
  const goTo = useCallback(
    (index: number, animated = true) => {
      const validIndex = Math.min(
        Math.max(index, 0),
        BANNERS.length - 1
      );
      activeRef.current = validIndex;
      setActiveIndex(validIndex);
      lastActivityRef.current = Date.now();
      scrollRef.current?.scrollTo({
        x: validIndex * pageWidth,
        animated,
      });
    },
    [pageWidth]
  );
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      goTo(activeRef.current, false);
    });
    return () => cancelAnimationFrame(frame);
  }, [goTo]);
  useFocusEffect(
    useCallback(() => {
      draggingRef.current = false;
      lastActivityRef.current = Date.now();
      const timer = setInterval(() => {
        if (
          BANNERS.length > 1 &&
          !draggingRef.current &&
          Date.now() - lastActivityRef.current >=
            AUTO_PLAY_INTERVAL
        ) {
          goTo((activeRef.current + 1) % BANNERS.length);
        }
      }, 500);
      return () => clearInterval(timer);
    }, [goTo])
  );
  function finishInteraction() {
    draggingRef.current = false;
    lastActivityRef.current = Date.now();
  }
  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ width: pageWidth, height: BANNER_HEIGHT }}
        scrollEventThrottle={16}
        onTouchStart={() => {
          draggingRef.current = true;
        }}
        onTouchEnd={finishInteraction}
        onTouchCancel={finishInteraction}
        onScrollBeginDrag={() => {
          draggingRef.current = true;
        }}
        onScrollEndDrag={finishInteraction}
        onMomentumScrollEnd={finishInteraction}
        onScroll={(event) => {
          lastActivityRef.current = Date.now();
          const index = Math.min(
            Math.max(
              Math.round(
                event.nativeEvent.contentOffset.x / pageWidth
              ),
              0
            ),
            BANNERS.length - 1
          );
          if (index !== activeRef.current) {
            activeRef.current = index;
            setActiveIndex(index);
          }
        }}
      >
        {BANNERS.map((banner) => (
          <View
            key={banner.id}
            style={{ width: pageWidth, paddingHorizontal: 3 }}
          >
            <TouchableOpacity
              style={styles.bannerCard}
              activeOpacity={0.9}
              accessibilityLabel={banner.label}
              onPress={() => {
                if (banner.destination) {
                  router.push(banner.destination);
                }
              }}
            >
              <Image
                source={banner.image}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
      <View style={styles.bannerDots}>
        {BANNERS.map((banner, index) => (
          <TouchableOpacity
            key={banner.id}
            style={styles.bannerDotButton}
            onPress={() => goTo(index)}
            accessibilityLabel={`Mostrar banner ${index + 1}`}
            accessibilityState={{
              selected: index === activeIndex,
            }}
          >
            <View
              style={[
                styles.bannerDot,
                index === activeIndex && styles.bannerDotActive,
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

// ============================================================
// FOTOS E CARDS DE PRODUTOS

// ============================================================

const ProductPhoto = memo(function ProductPhoto({
  uri,
}: {
  uri: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [uri]);
  if (failed) {
    return (
      <View style={styles.productPhotoFallback}>
        <Feather name="image" size={28} color="#005386" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={styles.productImage}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
});

const ProductCard = memo(function ProductCard({
  item,
  cardWidth,
  onPress,
}: {
  item: Produto;
  cardWidth: number;
  onPress: (item: Produto) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [photoWidth, setPhotoWidth] = useState(0);
  const images = useMemo(
    () => getProductImages(item),
    [item]
  );
  const imageSignature = JSON.stringify(images);
  useEffect(() => {
    setActiveIndex(0);
    scrollRef.current?.scrollTo({
      x: 0,
      animated: false,
    });
  }, [item.id_produto, imageSignature, photoWidth]);
  function goToPhoto(index: number) {
    if (
      photoWidth <= 0 ||
      index < 0 ||
      index >= images.length
    ) {
      return;
    }
    setActiveIndex(index);
    scrollRef.current?.scrollTo({
      x: index * photoWidth,
      animated: true,
    });
  }
  function updatePhotoIndex(offsetX: number) {
    if (photoWidth <= 0) return;
    const index = Math.round(offsetX / photoWidth);
    setActiveIndex(
      Math.min(
        Math.max(index, 0),
        Math.max(images.length - 1, 0)
      )
    );
  }
  return (
    <View style={[styles.productCard, { width: cardWidth }]}>
      <View
        style={styles.productGallery}
        onLayout={(event) => {
          const largura = event.nativeEvent.layout.width;
          if (largura > 0) setPhotoWidth(largura);
        }}
      >
        {images.length > 0 && photoWidth > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={styles.productPhotoScroll}
            scrollEventThrottle={16}
            onScroll={(event) => updatePhotoIndex(event.nativeEvent.contentOffset.x)}
            onMomentumScrollEnd={(event) =>
              updatePhotoIndex(
                event.nativeEvent.contentOffset.x
              )
            }
            onScrollEndDrag={(event) =>
              updatePhotoIndex(
                event.nativeEvent.contentOffset.x
              )
            }
          >
            {images.map((uri, index) => (
              <TouchableOpacity
                key={`${uri}-${index}`}
                style={{
                  width: photoWidth,
                  height: photoWidth / PRODUCT_IMAGE_RATIO,
                }}
                onPress={() => onPress(item)}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={`Ver anúncio: ${item.nm_produto}, foto ${index + 1}`}
              >
                <ProductPhoto uri={uri} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity
            style={styles.productPhotoFallback}
            onPress={() => onPress(item)}
            activeOpacity={0.85}
          >
            <Feather name="cpu" size={28} color="#005386" />
          </TouchableOpacity>
        )}
        {images.length > 1 && (
          <>
<View style={styles.productPhotoPagination}>
              {images.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.productPhotoDotButton}
                  onPress={() => goToPhoto(index)}
                  accessibilityLabel={`Mostrar foto ${index + 1}`}
                >
                  <View
                    style={[
                      styles.productPhotoDot,
                      activeIndex === index &&
                        styles.productPhotoDotActive,
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </View>
      <TouchableOpacity
        style={styles.productInfo}
        onPress={() => onPress(item)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`Ver anúncio: ${item.nm_produto}`}
      >
        <Text style={styles.productName} numberOfLines={1}>
          {item.nm_produto}
        </Text>
        <Text style={styles.conditionText} numberOfLines={1}>
          {CONDITION_NAMES[item.st_condicao] || item.st_condicao || "Não informado"}
        </Text>
        <Text style={styles.productDescription} numberOfLines={1}>
          {item.ds_produto?.trim() || "Sem descrição"}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

// ============================================================
// CARREGAMENTO DOS PRODUTOS

// ============================================================

function useProducts() {
  const [products, setProducts] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const requestIdRef = useRef(0);
  const loadedRef = useRef(false);
  const fetchProducts = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = ++requestIdRef.current;
      const atual = () =>
        !signal?.aborted &&
        requestId === requestIdRef.current;
      if (!loadedRef.current) setLoading(true);
      setRefreshing(true);
      setLoadError(false);
      try {
        if (!loadedRef.current) {
          const cached = await loadCache();
          if (!atual()) return;
          if (cached) {
            setProducts(cached);
            loadedRef.current = true;
            setLoading(false);
          }
        }
        const config = {
          timeout: REQUEST_TIMEOUT,
          signal,
        };
        const firstResponse = await api.get("/products", {
          ...config,
          params: { page: 1 },
        });
        if (!atual()) return;
        const payload = firstResponse.data;
        const firstPage = extractProducts(payload);
        const totalPages = Array.isArray(payload)
          ? 1
          : Math.max(1, Number(payload?.last_page) || 1);
        let allProducts = firstPage;
        if (totalPages > 1) {
          const pages = Array.from(
            { length: totalPages - 1 },
            (_, index) => index + 2
          );
          const responses = await Promise.all(
            pages.map(async (page) => {
              const response = await api.get("/products", {
                ...config,
                params: { page },
              });
              return extractProducts(response.data);
            })
          );
          allProducts = [...firstPage, ...responses.flat()];
        }
        if (!atual()) return;
        // Substitui a lista para não manter anúncios antigos
        // que deixaram de estar disponíveis.
        const available = removeDuplicates(allProducts).filter(
          (produto) =>
            !produto.st_status || produto.st_status === "A"
        );
        setProducts(available);
        loadedRef.current = true;
        await saveCache(available);
      } catch (error) {
        if (!atual()) return;
        console.warn("Erro ao carregar produtos:", error);
        setLoadError(true);
      } finally {
        if (atual()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    []
  );
  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void fetchProducts(controller.signal);
      return () => controller.abort();
    }, [fetchProducts])
  );
  const retryLoad = useCallback(() => {
    void fetchProducts();
  }, [fetchProducts]);
  return {
    products,
    loading,
    refreshing,
    loadError,
    retryLoad,
  };
}

// ============================================================
// FOTO DO USUÁRIO

// ============================================================

function useProfileImage() {
  const [profileImage, setProfileImage] =
    useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      const controller = new AbortController();
      async function carregarFoto() {
        try {
          const [storedUser, token] = await Promise.all([
            AsyncStorage.getItem("usuario"),
            AsyncStorage.getItem("token"),
          ]);
          if (!ativo) return;
          if (!storedUser) {
            setProfileImage(null);
            return;
          }
          const user = JSON.parse(storedUser);
          setProfileImage(getImageUrl(user.ds_foto_perfil));
          const idUsuario = user.id_usuario ?? user.id;
          if (!idUsuario || !token) return;
          const response = await api.get(`/users/${idUsuario}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json",
            },
            timeout: REQUEST_TIMEOUT,
            signal: controller.signal,
          });
          if (!ativo) return;
          const updated =
            response.data?.user ||
            response.data?.usuario ||
            response.data;
          if (updated && typeof updated === "object") {
            setProfileImage(
              getImageUrl(updated.ds_foto_perfil)
            );
            await AsyncStorage.setItem(
              "usuario",
              JSON.stringify({ ...user, ...updated })
            );
          }
        } catch {
          // Mantém a foto local se a atualização falhar.
        }
      }
      void carregarFoto();
      return () => {
        ativo = false;
        controller.abort();
      };
    }, [])
  );
  return { profileImage, setProfileImage };
}

// ============================================================
// TELA INICIAL

// ============================================================

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    products,
    loading,
    refreshing,
    loadError,
    retryLoad,
  } = useProducts();
  const { profileImage, setProfileImage } = useProfileImage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<number | null>(null);
  const { columns, cardWidth } = useMemo(() => {
    const cols = width >= 1100 ? 6 : width >= 700 ? 4 : 2;
    return {
      columns: cols,
      cardWidth: Math.max(
        1,
        (width -
          HORIZONTAL_PADDING -
          (cols - 1) * GRID_GAP) /
          cols
      ),
    };
  }, [width]);
  const featuredCardWidth = width >= 700 ? 150 : 140;
  const filteredProducts = useMemo(
    () =>
      selectedCategory === null
        ? products
        : products.filter(
            (produto) =>
              Number(produto.id_categoria) === selectedCategory
          ),
    [products, selectedCategory]
  );
  const featuredProducts = useMemo(
    () => products.slice(0, 10),
    [products]
  );
  const categoryName =
    CATEGORIES.find(
      (categoria) => categoria.id === selectedCategory
    )?.name || "Todos";
  const handleSearch = useCallback(() => {
    router.push({
      pathname: "/resultados",
      params: { search: searchQuery.trim() },
    } as Href);
  }, [router, searchQuery]);
  const openProduct = useCallback(
    (item: Produto) => {
      router.push({
        pathname: "/visuanuncios",
        params: { id: String(item.id_produto) },
      } as Href);
    },
    [router]
  );
  const renderProduct = useCallback(
    ({ item }: { item: Produto }) => (
      <ProductCard
        item={item}
        cardWidth={cardWidth}
        onPress={openProduct}
      />
    ),
    [cardWidth, openProduct]
  );
  const resultCountText = loading
    ? "Carregando produtos..."
    : `${categoryName} · ${filteredProducts.length} ${
        filteredProducts.length === 1 ? "produto" : "produtos"
      }`;
  return (
    <View style={styles.mainContainer}>
      <FlatList<Produto>
        key={`grid-${columns}`}
        data={filteredProducts}
        numColumns={columns}
        keyExtractor={(item) => String(item.id_produto)}
        renderItem={renderProduct}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshing={refreshing}
        onRefresh={retryLoad}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        ListHeaderComponent={
          <>
            <View style={styles.headerContainer}>
              <Image
                source={require("../../assets/images/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <View style={styles.searchContainer}>
                <TouchableOpacity
                  onPress={handleSearch}
                  style={styles.searchButton}
                  accessibilityLabel="Pesquisar peças"
                >
                  <Feather
                    name="search"
                    size={18}
                    color="#005386"
                  />
                </TouchableOpacity>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar no Peça por Peça..."
                  placeholderTextColor="#93A6B5"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Buscar peças"
                />
              </View>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => router.push("/perfil" as Href)}
                accessibilityLabel="Meu perfil"
              >
                {profileImage ? (
                  <Image
                    source={{ uri: profileImage }}
                    style={styles.profileImage}
                    resizeMode="cover"
                    onError={() => setProfileImage(null)}
                  />
                ) : (
                  <Feather
                    name="user"
                    size={20}
                    color="#005386"
                  />
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.featuredSection}>
              <Text style={styles.sectionTitle}>
                Confira os anúncios disponíveis
              </Text>
              <Text style={styles.sectionSubtitle}>
                Veja o que outros usuários estão oferecendo.
              </Text>
              <View style={{ height: 12 }} />
              <BannerCarousel />
            </View>
            <View style={styles.productsSection}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.sectionTitle,
                    styles.titleFlexible,
                  ]}
                >
                  Adicionados recentemente
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    router.push("/resultados" as Href)
                  }
                >
                  <Text style={styles.seeMoreText}>
                    Ver todos
                  </Text>
                </TouchableOpacity>
              </View>
              {loading && featuredProducts.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="#0099FF" />
                </View>
              ) : (
                <FlatList<Produto>
                  data={featuredProducts}
                  horizontal
                  keyExtractor={(item) =>
                    String(item.id_produto)
                  }
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.productListContent}
                  ItemSeparatorComponent={() => (
                    <View style={{ width: 14 }} />
                  )}
                  renderItem={({ item }) => (
                    <ProductCard
                      item={item}
                      cardWidth={featuredCardWidth}
                      onPress={openProduct}
                    />
                  )}
                  initialNumToRender={3}
                  maxToRenderPerBatch={4}
                  windowSize={5}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>
                      {loadError
                        ? "Não foi possível carregar os anúncios."
                        : "Nenhum produto anunciado ainda."}
                    </Text>
                  }
                />
              )}
            </View>
            <Text
              style={[
                styles.sectionTitle,
                styles.exploreTitle,
              ]}
            >
              Explore por categoria
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoriesScrollView}
              contentContainerStyle={styles.categoriesContent}
            >
              {CATEGORIES.map((categoria) => {
                const active =
                  selectedCategory === categoria.id;
                return (
                  <TouchableOpacity
                    key={String(categoria.id)}
                    onPress={() =>
                      setSelectedCategory(categoria.id)
                    }
                    accessibilityState={{ selected: active }}
                    style={[
                      styles.categoryTab,
                      active && styles.activeCategoryTab,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryTabText,
                        active && styles.activeCategoryTabText,
                      ]}
                    >
                      {categoria.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.resultCount}>
              {resultCountText}
            </Text>
            {loadError && products.length > 0 && (
              <TouchableOpacity
                style={styles.refreshWarning}
                onPress={retryLoad}
              >
                <Text style={styles.refreshWarningText}>
                  Não foi possível atualizar os anúncios.
                  Toque para tentar novamente.
                </Text>
              </TouchableOpacity>
            )}
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color="#0099FF"
              />
            </View>
          ) : loadError && products.length === 0 ? (
            <View style={styles.errorContainer}>
              <Feather
                name="wifi-off"
                size={28}
                color="#B0C4D4"
              />
              <Text style={styles.emptyText}>
                Não foi possível carregar os produtos.
              </Text>
              <TouchableOpacity
                onPress={retryLoad}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>
                  Tentar novamente
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              {selectedCategory === null
                ? "Nenhum produto anunciado ainda."
                : "Nenhum produto nesta categoria."}
            </Text>
          )
        }
      />
    </View>
  );
}

// ============================================================
// ESTILOS

// ============================================================

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#f5fafe",
  },

  pageContent: {
    paddingBottom: 32,
  },

  headerContainer: {
    ...HEADER_SHADOW,
    position: "relative",
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF4F8",
    backgroundColor: "#FFFFFF",
  },

  logo: {
    width: 48,
    height: 48,
  },

  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5FBFF",
    height: 40,
    borderRadius: 20,
    marginHorizontal: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#DCEEFA",
  },

  searchButton: {
    justifyContent: "center",
    alignItems: "center",
  },

  searchInput: {
    flex: 1,
    height: 40,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 13,
    color: "#005386",
    marginLeft: 8,
    fontFamily: "Montserrat_400Regular",
    textAlignVertical: "center",
  },

  profileButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5FBFF",
    borderWidth: 1,
    borderColor: "#E4F4FF",
  },

  profileImage: {
    width: "100%",
    height: "100%",
  },

  featuredSection: {
    marginTop: 22,
    paddingHorizontal: 16,
  },

  sectionTitle: {
    fontSize: 16,
    color: "#1E2B36",
    marginBottom: 4,
    fontFamily: "Montserrat_600SemiBold",
  },

  sectionSubtitle: {
    fontSize: 11,
    color: "#8A9BA8",
    fontFamily: "Montserrat_400Regular",
  },

  carouselContainer: {
    width: "100%",
  },

  bannerCard: {
    width: "100%",
    height: BANNER_HEIGHT,
    backgroundColor: "#E4F8FF",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#BDE5FF",
  },

  bannerImage: {
    width: "100%",
    height: "100%",
  },

  bannerDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },

  bannerDotButton: {
    width: 26,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  bannerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C8DCE8",
  },

  bannerDotActive: {
    width: 20,
    backgroundColor: "#0099FF",
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

  titleFlexible: {
    flex: 1,
    marginRight: 12,
    marginBottom: 0,
  },

  seeMoreText: {
    fontSize: 12,
    color: "#0099FF",
    fontFamily: "Montserrat_600SemiBold",
  },

  productListContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },

  productCard: {
    ...CARD_SHADOW,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6EEF5",
  },

  productGallery: {
    width: "100%",
    aspectRatio: PRODUCT_IMAGE_RATIO,
    position: "relative",
    overflow: "hidden",
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    backgroundColor: "#EFF5FA",
  },

  productPhotoScroll: {
    flex: 1,
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  productPhotoFallback: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5FBFF",
  },

  productPhotoPagination: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 2,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  productPhotoDotButton: {
    width: 22,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  productPhotoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D7E6EF",
  },

  productPhotoDotActive: {
    width: 12,
    backgroundColor: "#0099FF",
  },

  productInfo: {
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderBottomLeftRadius: 17,
    borderBottomRightRadius: 17,
  },

  productName: {
    fontSize: 13,
    lineHeight: 18,
    color: "#17344A",
    fontFamily: "Montserrat_600SemiBold",
  },


  conditionText: {
    fontSize: 10,
    lineHeight: 14,
    marginVertical: 3,
    color: "#8A9BA8",
    fontFamily: "Montserrat_400Regular",
  },

  productDescription: {
    fontSize: 11,
    lineHeight: 16,
    color: "#0099FF",
    fontFamily: "Montserrat_400Regular",
  },

  exploreTitle: {
    paddingHorizontal: 16,
  },

  categoriesScrollView: {
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },

  categoriesContent: {
    paddingHorizontal: 16,
    alignItems: "center",
  },

  categoryTab: {
    marginRight: 20,
    paddingVertical: 8,
  },

  activeCategoryTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#0099FF",
  },

  categoryTabText: {
    fontSize: 14,
    color: "#8A9BA8",
    fontFamily: "Montserrat_400Regular",
  },

  activeCategoryTabText: {
    color: "#005386",
    fontFamily: "Montserrat_600SemiBold",
  },

  resultCount: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 16,
    color: "#8A9BA8",
    fontSize: 12,
    fontFamily: "Montserrat_400Regular",
  },

  gridRow: {
    paddingHorizontal: 16,
    gap: GRID_GAP,
    marginBottom: 18,
  },

  loadingContainer: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  errorContainer: {
    alignItems: "center",
    padding: 24,
  },

  retryButton: {
    backgroundColor: "#005386",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 6,
  },

  retryText: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_600SemiBold",
  },

  emptyText: {
    fontSize: 13,
    color: "#99A9B5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
  },

  refreshWarning: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F1FAFF",
  },

  refreshWarningText: {
    color: "#005386",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Montserrat_400Regular",
  },
});