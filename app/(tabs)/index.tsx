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
import type { ImageSourcePropType } from "react-native";
import {
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import api from "../../services/api.js";

// ============================================================
// CONSTANTES
// ============================================================

const HORIZONTAL_PADDING = 32;
const GRID_GAP = 12;
const BANNER_HEIGHT = 150;
const AUTO_PLAY_INTERVAL = 4500;
const AUTO_PLAY_TICK = 400;
const CACHE_TIME = 30_000;
const PRODUCTS_CACHE_KEY = "@pecapeca:products_cache_v1";
const CACHE_MAX_AGE = 1000 * 60 * 60 * 6; // 6h

type Banner = {
  id: string;
  label: string;
  image: ImageSourcePropType | null;
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

const BANNERS_LENGTH = BANNERS.length;

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
  S: "Semi-novo",
  U: "Usado",
  Q: "Quebrado",
};

// ============================================================
// TIPOS
// ============================================================

interface Produto {
  id_produto: number;
  id_usuario: number;
  id_categoria: number;
  nm_produto: string;
  ds_produto: string | null;
  st_condicao: string;
  st_status: string;
  user?: { nm_usuario: string };
  images?: { ds_imagem: string }[];
}

// ============================================================
// HELPERS
// ============================================================

function getImageUrl(imagePath?: string | null): string | null {
  const path = String(imagePath || "").trim();
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) return path;

  const baseUrl = (api.defaults?.baseURL || "http://127.0.0.1:8000/api")
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");

  const cleanPath = path.replace(/^\/+/, "").replace(/^storage\/+/, "");
  return `${baseUrl}/storage/${cleanPath}`;
}

function removeDuplicates(list: Produto[]): Produto[] {
  const map = new Map<number, Produto>();
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!map.has(item.id_produto)) map.set(item.id_produto, item);
  }
  return Array.from(map.values());
}

async function saveCache(products: Produto[]) {
  try {
    const payload = { ts: Date.now(), data: products.slice(0, 60) };
    await AsyncStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(payload));
  } catch {}
}

async function loadCache(): Promise<Produto[] | null> {
  try {
    const raw = await AsyncStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - parsed.ts > CACHE_MAX_AGE) return null;
    return parsed.data as Produto[];
  } catch {
    return null;
  }
}

// ============================================================
// SKELETON CARD
// ============================================================

const SkeletonCard = memo(function SkeletonCard({
  width,
}: {
  width: number;
}) {
  return (
    <View style={[styles.productCard, { width }]}>
      <View style={[styles.productImagePlaceholder, styles.skeletonBlock]} />
      <View style={styles.productInfo}>
        <View
          style={[
            styles.skeletonLine,
            { width: "80%", height: 12, marginBottom: 8 },
          ]}
        />
        <View
          style={[
            styles.skeletonLine,
            { width: "50%", height: 10, marginBottom: 6 },
          ]}
        />
        <View style={[styles.skeletonLine, { width: "70%", height: 10 }]} />
      </View>
    </View>
  );
});

// ============================================================
// CARROSSEL
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

  // Prefetch de imagens dos banners
  useEffect(() => {
    BANNERS.forEach((b) => {
      const src = b.image as any;
      if (src?.uri) Image.prefetch(src.uri);
    });
  }, []);

  const goTo = useCallback(
    (index: number, animated = true) => {
      activeRef.current = index;
      setActiveIndex(index);
      lastActivityRef.current = Date.now();
      scrollRef.current?.scrollTo({ x: index * pageWidth, animated });
    },
    [pageWidth]
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => goTo(activeRef.current, false));
    return () => cancelAnimationFrame(frame);
  }, [goTo]);

  useFocusEffect(
    useCallback(() => {
      lastActivityRef.current = Date.now();
      draggingRef.current = false;

      const timer = setInterval(() => {
        if (
          BANNERS_LENGTH > 1 &&
          !draggingRef.current &&
          Date.now() - lastActivityRef.current >= AUTO_PLAY_INTERVAL
        ) {
          goTo((activeRef.current + 1) % BANNERS_LENGTH);
        }
      }, AUTO_PLAY_TICK);

      return () => clearInterval(timer);
    }, [goTo])
  );

  const handleTouchStart = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const handleTouchEnd = useCallback(() => {
    draggingRef.current = false;
    lastActivityRef.current = Date.now();
  }, []);

  const handleScroll = useCallback(
    (event: any) => {
      lastActivityRef.current = Date.now();
      const index = Math.max(
        0,
        Math.min(
          BANNERS_LENGTH - 1,
          Math.round(event.nativeEvent.contentOffset.x / pageWidth)
        )
      );
      if (index !== activeRef.current) {
        activeRef.current = index;
        setActiveIndex(index);
      }
    },
    [pageWidth]
  );

  const scrollStyle = useMemo(
    () => ({ width: pageWidth, height: BANNER_HEIGHT }),
    [pageWidth]
  );

  const itemStyle = useMemo(
    () => ({ width: pageWidth, paddingHorizontal: 3 }),
    [pageWidth]
  );

  return (
    <View style={styles.carouselContainer}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={scrollStyle}
        scrollEventThrottle={16}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onScrollBeginDrag={handleTouchStart}
        onScrollEndDrag={handleTouchEnd}
        onScroll={handleScroll}
        removeClippedSubviews
      >
        {BANNERS.map((banner) => (
          <View key={banner.id} style={itemStyle}>
            <TouchableOpacity
              style={styles.bannerCard}
              activeOpacity={0.9}
              accessibilityRole={banner.destination ? "button" : undefined}
              accessibilityLabel={banner.label}
              onPress={() =>
                banner.destination && router.push(banner.destination)
              }
            >
              {banner.image ? (
                <Image
                  source={banner.image}
                  style={styles.bannerImage}
                  resizeMode="cover"
                  fadeDuration={0}
                />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Feather name="image" size={30} color="#0099FF" />
                  <Text style={styles.bannerPlaceholderText}>
                    {banner.label}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bannerDots}>
        {BANNERS.map((banner, index) => (
          <TouchableOpacity
            key={banner.id}
            onPress={() => goTo(index)}
            style={styles.bannerDotButton}
            accessibilityRole="button"
            accessibilityLabel={`Mostrar anúncio ${index + 1}`}
            accessibilityState={{ selected: index === activeIndex }}
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
// CARD DE PRODUTO
// ============================================================

const ProductCard = memo(function ProductCard({
  item,
  cardWidth,
  onPress,
}: {
  item: Produto;
  cardWidth: number;
  onPress: (item: Produto) => void;
}) {
  const imageUrl = useMemo(
    () => getImageUrl(item.images?.[0]?.ds_imagem),
    [item.images]
  );
  const [failed, setFailed] = useState(false);

  const cardStyle = useMemo(
    () => [styles.productCard, { width: cardWidth }],
    [cardWidth]
  );

  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  const handleImageError = useCallback(() => setFailed(true), []);

  const showImage = imageUrl && !failed;

  return (
    <TouchableOpacity
      style={cardStyle}
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Ver anúncio: ${item.nm_produto}`}
    >
      <View style={styles.productImagePlaceholder}>
        {showImage ? (
          <Image
            source={{ uri: imageUrl! }}
            style={styles.productImage}
            resizeMode="cover"
            onError={handleImageError}
            fadeDuration={150}
          />
        ) : (
          <Feather name="cpu" size={28} color="#005386" />
        )}
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>
          {item.nm_produto}
        </Text>
        <Text style={styles.productSpecs} numberOfLines={1}>
          {CONDITION_NAMES[item.st_condicao] || item.st_condicao}
        </Text>
        <Text style={styles.productPrice} numberOfLines={2}>
          {item.ds_produto || "Sem descrição"}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ============================================================
// HOOK — PRODUTOS
// ============================================================

function useProducts() {
  const [products, setProducts] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retry, setRetry] = useState(0);

  const loadedRef = useRef(false);
  const loadingRef = useRef(false);
  const lastRefreshRef = useRef(0);

  // 1) Carrega do cache INSTANTANEAMENTE
  useEffect(() => {
    let ativo = true;
    (async () => {
      const cached = await loadCache();
      if (!ativo) return;
      if (cached && cached.length > 0) {
        setProducts(cached);
        setLoading(false);
        loadedRef.current = true;
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  // 2) Busca dados frescos (paralelizando páginas)
  const fetchAll = useCallback(async (showLoading: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (showLoading && !loadedRef.current) setLoading(true);
    setLoadError(false);

    try {
      const res1 = await api.get("/products", { params: { page: 1 } });
      const payload1 = res1.data;
      let firstPage: Produto[] = [];

      if (Array.isArray(payload1)) firstPage = payload1;
      else if (Array.isArray(payload1?.data)) firstPage = payload1.data;
      else throw new Error("Formato inesperado de /products");

      setProducts((prev) =>
        loadedRef.current
          ? removeDuplicates([...firstPage, ...prev])
          : removeDuplicates(firstPage)
      );
      loadedRef.current = true;
      lastRefreshRef.current = Date.now();
      setLoading(false);

      const lastPage: number =
        payload1?.last_page ||
        (Array.isArray(payload1?.links)
          ? payload1.links.length - 2
          : 1) ||
        1;

      if (lastPage > 1) {
        const pages = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
        const responses = await Promise.all(
          pages.map((p) =>
            api
              .get("/products", { params: { page: p } })
              .then((r) => r.data?.data ?? [])
              .catch(() => [])
          )
        );

        const rest = responses.flat().filter(Boolean);
        if (rest.length > 0) {
          setProducts((prev) => {
            const merged = removeDuplicates([...prev, ...rest]);
            saveCache(merged);
            return merged;
          });
        } else {
          saveCache(firstPage);
        }
      } else {
        saveCache(firstPage);
      }
    } catch (err) {
      console.error("Erro ao carregar produtos:", err);
      if (!loadedRef.current) setLoadError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(!loadedRef.current);
  }, [retry, fetchAll]);

  useFocusEffect(
    useCallback(() => {
      if (!loadedRef.current) return;
      if (Date.now() - lastRefreshRef.current < CACHE_TIME) return;
      fetchAll(false);
    }, [fetchAll])
  );

  const retryLoad = useCallback(() => setRetry((v) => v + 1), []);

  return { products, loading, loadError, retryLoad };
}

// ============================================================
// HOOK — FOTO DE PERFIL
// ============================================================

function useProfileImage() {
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const storedUser = await AsyncStorage.getItem("usuario");
        if (!storedUser || !ativo) return;

        const user = JSON.parse(storedUser);
        setProfileImage(getImageUrl(user?.ds_foto_perfil));

        if (!user?.id_usuario) return;

        const res = await api.get(`/users/${user.id_usuario}`);
        const updated = res.data?.user || res.data;
        if (!ativo) return;

        setProfileImage(getImageUrl(updated?.ds_foto_perfil));

        if (updated) {
          await AsyncStorage.setItem(
            "usuario",
            JSON.stringify({ ...user, ...updated })
          );
        }
      } catch (err) {
        console.error("Erro foto de perfil:", err);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  return { profileImage, setProfileImage };
}

// ============================================================
// HOME
// ============================================================

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { products, loading, loadError, retryLoad } = useProducts();
  const { profileImage, setProfileImage } = useProfileImage();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const { columns, cardWidth } = useMemo(() => {
    const cols = width >= 1100 ? 4 : width >= 700 ? 3 : 2;
    const w = (width - HORIZONTAL_PADDING - (cols - 1) * GRID_GAP) / cols;
    return { columns: cols, cardWidth: w };
  }, [width]);

  const filteredProducts = useMemo(
    () =>
      selectedCategory === null
        ? products
        : products.filter((p) => Number(p.id_categoria) === selectedCategory),
    [products, selectedCategory]
  );

  const featuredProducts = useMemo(() => products.slice(0, 10), [products]);

  const categoryName = useMemo(
    () => CATEGORIES.find((c) => c.id === selectedCategory)?.name ?? "Todos",
    [selectedCategory]
  );

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

  const goProfile = useCallback(() => router.push("/perfil"), [router]);
  const goSeeAll = useCallback(
    () => router.push("/resultados" as Href),
    [router]
  );
  const clearProfileImg = useCallback(
    () => setProfileImage(null),
    [setProfileImage]
  );

  const renderGridItem = useCallback(
    ({ item }: { item: Produto }) => (
      <ProductCard item={item} cardWidth={cardWidth} onPress={openProduct} />
    ),
    [cardWidth, openProduct]
  );

  const renderFeaturedItem = useCallback(
    ({ item }: { item: Produto }) => (
      <ProductCard item={item} cardWidth={150} onPress={openProduct} />
    ),
    [openProduct]
  );

  const keyExtractor = useCallback(
    (item: Produto) => String(item.id_produto),
    []
  );

  const renderSeparator = useCallback(() => <View style={{ width: 14 }} />, []);

  const listData = useMemo(
    () => (loadError && products.length === 0 ? [] : filteredProducts),
    [loadError, products.length, filteredProducts]
  );

  const showSkeleton = loading && products.length === 0;

  const skeletonData = useMemo(
    () => Array.from({ length: columns * 3 }, (_, i) => ({ id: `sk-${i}` })),
    [columns]
  );

  const resultCountText = useMemo(() => {
    if (showSkeleton) return "Carregando produtos...";
    if (loadError && products.length === 0)
      return "Produtos indisponíveis no momento";
    const plural = filteredProducts.length === 1 ? "produto" : "produtos";
    return `${categoryName} · ${filteredProducts.length} ${plural}`;
  }, [
    showSkeleton,
    loadError,
    products.length,
    categoryName,
    filteredProducts.length,
  ]);

  const ListEmptyComponent = useMemo(() => {
    if (loadError && products.length === 0) {
      return (
        <View style={styles.errorContainer}>
          <Feather name="wifi-off" size={28} color="#B0C4D4" />
          <Text style={styles.emptyText}>
            Não foi possível carregar os produtos.
          </Text>
          <TouchableOpacity
            onPress={retryLoad}
            style={styles.retryButton}
            activeOpacity={0.85}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (loading) return null;
    return (
      <Text style={styles.emptyText}>
        {selectedCategory === null
          ? "Nenhum produto anunciado ainda."
          : "Nenhum produto nesta categoria."}
      </Text>
    );
  }, [loadError, products.length, loading, retryLoad, selectedCategory]);

  const ListHeaderComponent = useMemo(
    () => (
      <>
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
            fadeDuration={0}
          />

          <View style={styles.searchContainer}>
            <TouchableOpacity
              onPress={handleSearch}
              style={styles.searchButton}
              accessibilityRole="button"
              accessibilityLabel="Pesquisar peças"
            >
              <Feather name="search" size={18} color="#005386" />
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
            onPress={goProfile}
            accessibilityRole="button"
            accessibilityLabel="Meu perfil"
            activeOpacity={0.85}
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                style={styles.profileImage}
                resizeMode="cover"
                onError={clearProfileImg}
                fadeDuration={150}
              />
            ) : (
              <Feather name="user" size={20} color="#005386" />
            )}
          </TouchableOpacity>
        </View>

        {/* DESTAQUES */}
        <View style={styles.featuredSection}>
          <Text style={styles.sectionTitle}>
            Confira os Anúncios Disponíveis
          </Text>
          <Text style={styles.sectionSubtitle}>
            Veja o que outros usuários estão oferecendo.
          </Text>
          <View style={{ height: 12 }} />
          <BannerCarousel />
        </View>

        {/* ADICIONADOS RECENTEMENTE */}
        <View style={styles.productsSection}>
          <View style={styles.titleRow}>
            <Text style={[styles.sectionTitle, styles.titleFlexible]}>
              Adicionados Recentemente
            </Text>
            <TouchableOpacity onPress={goSeeAll} activeOpacity={0.7}>
              <Text style={styles.seeMoreText}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {loading && featuredProducts.length === 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productListContent}
              scrollEnabled={false}
            >
              {[0, 1, 2].map((i) => (
                <View key={i} style={{ marginRight: 14 }}>
                  <SkeletonCard width={150} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <FlatList
              data={featuredProducts}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.productListContent}
              ItemSeparatorComponent={renderSeparator}
              renderItem={renderFeaturedItem}
              initialNumToRender={3}
              maxToRenderPerBatch={4}
              windowSize={5}
              removeClippedSubviews
              scrollEventThrottle={16}
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

        {/* CATEGORIAS */}
        <Text style={[styles.sectionTitle, styles.exploreTitle]}>
          Explore por Categoria
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesScrollView}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={String(cat.id)}
                activeOpacity={0.7}
                onPress={() => setSelectedCategory(cat.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.categoryTab,
                  isActive && styles.activeCategoryTab,
                ]}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    isActive && styles.activeCategoryTabText,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.resultCount}>{resultCountText}</Text>
      </>
    ),
    [
      handleSearch,
      searchQuery,
      profileImage,
      goProfile,
      clearProfileImg,
      goSeeAll,
      featuredProducts,
      loading,
      loadError,
      keyExtractor,
      renderSeparator,
      renderFeaturedItem,
      selectedCategory,
      resultCountText,
    ]
  );

  return (
    <View style={styles.mainContainer}>
      <FlatList
        key={`grid-${columns}`}
        data={showSkeleton ? skeletonData : listData}
        numColumns={columns}
        keyExtractor={(item: any) =>
          showSkeleton ? item.id : String(item.id_produto)
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.pageContent}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        renderItem={
          showSkeleton
            ? () => <SkeletonCard width={cardWidth} />
            : (renderGridItem as any)
        }
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={!showSkeleton ? ListEmptyComponent : null}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        updateCellsBatchingPeriod={40}
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
    backgroundColor: "#FFFFFF",
  },

  // =============== HEADER ===============
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 12 : 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    backgroundColor: "#FFFFFF",
  },
  logo: { width: 70, height: 70 },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5FBFF",
    height: 40,
    borderRadius: 20,
    marginLeft: 10,
    marginRight: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#DCEEFA",
  },
  searchButton: { justifyContent: "center", alignItems: "center" },
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
  profileImage: { width: "100%", height: "100%" },

  // =============== SEÇÕES ===============
  featuredSection: { marginTop: 22, paddingHorizontal: 16 },
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

  // =============== CARROSSEL ===============
  carouselContainer: { width: "100%" },
  bannerCard: {
    width: "100%",
    height: BANNER_HEIGHT,
    backgroundColor: "#E4F8FF",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#BDE5FF",
    elevation: 4,
    shadowColor: "#005386",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  bannerImage: { width: "100%", height: "100%" },
  bannerPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1FAFF",
  },
  bannerPlaceholderText: {
    marginTop: 10,
    color: "#005386",
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
  },
  bannerDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  bannerDotButton: {
    width: 24,
    height: 20,
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
    height: 6,
    borderRadius: 3,
    backgroundColor: "#0099FF",
  },

  // =============== PRODUTOS ===============
  productsSection: { marginTop: 25, marginBottom: 30 },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  titleFlexible: { flex: 1, marginRight: 12, marginBottom: 0 },
  seeMoreText: {
    fontSize: 12,
    color: "#0099FF",
    fontFamily: "Montserrat_600SemiBold",
  },
  productListContent: { paddingHorizontal: 16 },
  productCard: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEF3F7",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  productImagePlaceholder: {
    width: "100%",
    aspectRatio: 1.4,
    backgroundColor: "#F5FBFF",
    justifyContent: "center",
    alignItems: "center",
  },
  productImage: { width: "100%", height: "100%" },
  productInfo: { padding: 10, minHeight: 100 },
  productName: {
    fontSize: 13,
    color: "#1E2B36",
    fontFamily: "Montserrat_600SemiBold",
  },
  productSpecs: {
    fontSize: 11,
    color: "#8A9BA8",
    marginVertical: 3,
    fontFamily: "Montserrat_400Regular",
  },
  productPrice: {
    fontSize: 12,
    color: "#0099FF",
    fontFamily: "Montserrat_400Regular",
  },

  // =============== SKELETON ===============
  skeletonBlock: { backgroundColor: "#EAF3FA" },
  skeletonLine: {
    backgroundColor: "#EAF3FA",
    borderRadius: 4,
  },

  // =============== CATEGORIAS ===============
  exploreTitle: { paddingHorizontal: 16 },
  categoriesScrollView: {
    height: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  categoriesContent: {
    paddingHorizontal: 16,
    alignItems: "center",
    height: "100%",
  },
  categoryTab: { marginRight: 20, paddingVertical: 6 },
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

  // =============== GRID ===============
  pageContent: { paddingBottom: 32 },
  gridRow: {
    paddingHorizontal: 16,
    gap: GRID_GAP,
    marginBottom: 14,
  },

  // =============== EMPTY / ERRO ===============
  errorContainer: { alignItems: "center", padding: 24, gap: 8 },
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
});