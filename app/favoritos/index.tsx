import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AppState,
  type AppStateStatus,
  Dimensions,
  FlatList,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import api from "../../services/api";

// ============================================================
// CONSTANTES
// ============================================================

const { width } = Dimensions.get("window");

const ITEM_WIDTH = (width - 44) / 2;
const CACHE_FAVORITOS = 30_000;
const TEMPO_LIMITE_REQUISICAO = 15000;
const LIMITE_INICIAL = 8;

// Nova chave para não reutilizar o cache antigo com apenas uma foto.
const FAVORITOS_CACHE_KEY = "@pecapeca:favoritos_cache_v2";
const FAVORITOS_CACHE_MAX_AGE = 1000 * 60 * 30;

// ============================================================
// HELPERS
// ============================================================

function getImageUrl(
  imagePath?: string | null
): string | null {
  if (!imagePath) return null;

  const path = String(imagePath).trim();

  if (!path) return null;

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const baseUrl = String(
    api.defaults?.baseURL ||
      "http://127.0.0.1:8000/api"
  )
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");

  const cleanPath = path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^storage\/+/, "");

  return `${baseUrl}/storage/${cleanPath}`;
}

function getConditionLabel(condition: any): string {
  const value = String(condition || "")
    .trim()
    .toUpperCase();

  switch (value) {
    case "N":
    case "NOVO":
      return "Novo";

    case "S":
    case "SEMI NOVO":
    case "SEMINOVO":
      return "Seminovo";

    case "U":
    case "USADO":
      return "Usado";

    case "Q":
    case "QUEBRADO":
      return "Quebrado";

    default:
      return "Não informado";
  }
}

function extrairImagens(item: any): string[] {
  const listas = [
    item.images,
    item.imagens,
    item.produto?.images,
  ];

  const lista = listas.find(
    (valor) =>
      Array.isArray(valor) &&
      valor.length > 0
  );

  const caminhos = lista
    ? [...lista]
        .sort(
          (a, b) =>
            Number(a?.nr_ordem ?? 0) -
            Number(b?.nr_ordem ?? 0)
        )
        .map((imagem) =>
          typeof imagem === "string"
            ? imagem
            : imagem?.ds_imagem
        )
    : [
        item.ds_imagem ||
          item.imagem ||
          item.image,
      ];

  return caminhos
    .map((caminho) => getImageUrl(caminho))
    .filter(
      (url): url is string => Boolean(url)
    )
    .slice(0, 5);
}

// ============================================================
// CACHE
// ============================================================

async function saveFavoritosCache(
  favoritos: any[]
) {
  try {
    await AsyncStorage.setItem(
      FAVORITOS_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        data: favoritos.slice(0, 100),
      })
    );
  } catch {
    // Falha no cache não impede a utilização da tela.
  }
}

async function loadFavoritosCache(): Promise<
  any[] | null
> {
  try {
    const raw = await AsyncStorage.getItem(
      FAVORITOS_CACHE_KEY
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      !parsed?.ts ||
      !Array.isArray(parsed?.data)
    ) {
      return null;
    }

    if (
      Date.now() - parsed.ts >
      FAVORITOS_CACHE_MAX_AGE
    ) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

// ============================================================
// SKELETON
// ============================================================

const SkeletonCard = memo(
  function SkeletonCard() {
    return (
      <View style={styles.listingCard}>
        <View
          style={[
            styles.imagePlaceholder,
            styles.skeletonBlock,
          ]}
        />

        <View style={styles.textContainer}>
          <View
            style={[
              styles.skeletonLine,
              {
                width: "75%",
                height: 12,
                marginBottom: 6,
              },
            ]}
          />

          <View
            style={[
              styles.skeletonLine,
              {
                width: "50%",
                height: 10,
                marginBottom: 6,
              },
            ]}
          />

          <View
            style={[
              styles.skeletonLine,
              {
                width: "40%",
                height: 10,
              },
            ]}
          />
        </View>
      </View>
    );
  }
);

// ============================================================
// FOTO INDIVIDUAL
// ============================================================

const FotoProduto = memo(
  function FotoProduto({
    uri,
  }: {
    uri: string;
  }) {
    const [falhou, setFalhou] =
      useState(false);

    useEffect(() => {
      setFalhou(false);
    }, [uri]);

    if (falhou) {
      return (
        <Feather
          name="package"
          size={38}
          color="#0099FF"
        />
      );
    }

    return (
      <Image
        source={{ uri }}
        style={styles.productImage}
        resizeMode="cover"
        onError={() => setFalhou(true)}
        fadeDuration={150}
      />
    );
  }
);

// ============================================================
// CARD COM CARROSSEL
// ============================================================

const FavoritoCard = memo(
  function FavoritoCard({
    item,
    onPress,
    onRemove,
  }: {
    item: any;
    onPress: (id: number) => void;
    onRemove: (id: number) => void;
  }) {
    const produto = item.produto || item;

    const productId = Number(
      item.id_produto || produto.id_produto
    );

    const imagens = useMemo(
      () => extrairImagens(item),
      [item]
    );

    const [indice, setIndice] = useState(0);

    const [largura, setLargura] = useState(
      ITEM_WIDTH - 2
    );

    const carouselRef =
      useRef<ScrollView>(null);

    const assinaturaImagens =
      imagens.join("|");

    useEffect(() => {
      setIndice(0);

      carouselRef.current?.scrollTo({
        x: 0,
        animated: false,
      });
    }, [
      productId,
      assinaturaImagens,
      largura,
    ]);

    const abrir = () => {
      if (
        Number.isFinite(productId) &&
        productId > 0
      ) {
        onPress(productId);
      }
    };

    const navegar = (
      novoIndice: number,
      event?: any
    ) => {
      event?.stopPropagation?.();

      if (
        novoIndice < 0 ||
        novoIndice >= imagens.length
      ) {
        return;
      }

      carouselRef.current?.scrollTo({
        x: novoIndice * largura,
        animated: true,
      });

      setIndice(novoIndice);
    };

    return (
      <View style={styles.listingCard}>
        <View
          style={styles.imagePlaceholder}
          onLayout={(event) => {
            const novaLargura =
              event.nativeEvent.layout.width;

            if (novaLargura > 0) {
              setLargura(novaLargura);
            }
          }}
        >
          {imagens.length > 0 ? (
            <ScrollView
              ref={carouselRef}
              horizontal
              pagingEnabled
              directionalLockEnabled
              showsHorizontalScrollIndicator={
                false
              }
              style={styles.carousel}
              scrollEventThrottle={16}
              onScroll={(event) => {
                const atual = Math.round(
                  event.nativeEvent
                    .contentOffset.x / largura
                );

                setIndice(
                  Math.max(
                    0,
                    Math.min(
                      imagens.length - 1,
                      atual
                    )
                  )
                );
              }}
            >
              {imagens.map((uri, index) => (
                <TouchableOpacity
                  key={`${uri}-${index}`}
                  style={[
                    styles.imageSlide,
                    { width: largura },
                  ]}
                  activeOpacity={0.9}
                  onPress={abrir}
                  accessibilityLabel={
                    `Abrir anúncio, foto ${index + 1}`
                  }
                >
                  <FotoProduto uri={uri} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity
              style={styles.emptyImage}
              onPress={abrir}
            >
              <Feather
                name="package"
                size={38}
                color="#0099FF"
              />
            </TouchableOpacity>
          )}

          {/* REMOVER DOS FAVORITOS */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={(event) => {
              event.stopPropagation?.();
              onRemove(productId);
            }}
            accessibilityLabel={
              "Remover dos favoritos"
            }
          >
            <Ionicons
              name="heart"
              size={20}
              color="#FF0000"
            />
          </TouchableOpacity>

          {imagens.length > 1 && (
            <>
              {/* FOTO ANTERIOR */}
              {indice > 0 && (
                <TouchableOpacity
                  style={[
                    styles.carouselArrow,
                    styles.arrowLeft,
                  ]}
                  onPress={(event) =>
                    navegar(indice - 1, event)
                  }
                  accessibilityLabel={
                    "Foto anterior"
                  }
                >
                  <Feather
                    name="chevron-left"
                    size={21}
                    color="#005386"
                  />
                </TouchableOpacity>
              )}

              {/* PRÓXIMA FOTO */}
              {indice <
                imagens.length - 1 && (
                <TouchableOpacity
                  style={[
                    styles.carouselArrow,
                    styles.arrowRight,
                  ]}
                  onPress={(event) =>
                    navegar(indice + 1, event)
                  }
                  accessibilityLabel={
                    "Próxima foto"
                  }
                >
                  <Feather
                    name="chevron-right"
                    size={21}
                    color="#005386"
                  />
                </TouchableOpacity>
              )}

              {/* CONTADOR */}
              <View
                style={styles.photoCounter}
                pointerEvents="none"
              >
                <Text
                  style={
                    styles.photoCounterText
                  }
                >
                  {indice + 1}/
                  {imagens.length}
                </Text>
              </View>

              {/* INDICADORES */}
              <View style={styles.photoDots}>
                {imagens.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.dotTouch}
                    onPress={(event) =>
                      navegar(index, event)
                    }
                    accessibilityLabel={
                      `Ver foto ${index + 1}`
                    }
                  >
                    <View
                      style={[
                        styles.dot,
                        index === indice &&
                          styles.dotActive,
                      ]}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* INFORMAÇÕES DO PRODUTO */}
        <TouchableOpacity
          style={styles.textContainer}
          onPress={abrir}
          activeOpacity={0.8}
        >
          <Text
            style={styles.listingTitle}
            numberOfLines={1}
          >
            {produto.nm_produto ||
              "Produto sem nome"}
          </Text>

          <Text
            style={styles.listingCategory}
            numberOfLines={1}
          >
            {item.nm_categoria ||
              produto.categoria?.nm_categoria ||
              "Sem categoria"}
          </Text>

          <Text
            style={styles.listingCondition}
          >
            {getConditionLabel(
              produto.st_condicao
            )}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
);

// ============================================================
// HOOK DE FAVORITOS
// ============================================================

function useFavoritos() {
  const [favoritos, setFavoritos] =
    useState<any[]>([]);

  const [loading, setLoading] =
    useState(true);

  const favoritosRef = useRef<any[]>([]);
  const tokenRef = useRef<string | null>(
    null
  );

  const carregandoRef = useRef(false);
  const ultimaAtualizacaoRef = useRef(0);
  const loadedRef = useRef(false);

  const appStateRef =
    useRef<AppStateStatus>(
      AppState.currentState
    );

  useEffect(() => {
    favoritosRef.current = favoritos;
  }, [favoritos]);

  useEffect(() => {
    const sub = AppState.addEventListener(
      "change",
      (state) => {
        appStateRef.current = state;
      }
    );

    return () => sub.remove();
  }, []);

  // Carrega o cache local.
  useEffect(() => {
    let ativo = true;

    (async () => {
      const cached =
        await loadFavoritosCache();

      if (
        !ativo ||
        !cached ||
        cached.length === 0
      ) {
        return;
      }

      favoritosRef.current = cached;
      setFavoritos(cached);
      setLoading(false);
      loadedRef.current = true;
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const obterToken = useCallback(
    async (): Promise<string | null> => {
      if (tokenRef.current) {
        return tokenRef.current;
      }

      const token =
        await AsyncStorage.getItem("token");

      tokenRef.current = token;

      return token;
    },
    []
  );

  const carregarFavoritos = useCallback(
    async (
      mostrarLoading = false,
      forcar = false,
      signal?: AbortSignal
    ) => {
      if (carregandoRef.current) return;

      if (
        !forcar &&
        loadedRef.current &&
        Date.now() -
          ultimaAtualizacaoRef.current <
          CACHE_FAVORITOS
      ) {
        return;
      }

      carregandoRef.current = true;

      if (
        mostrarLoading &&
        !loadedRef.current
      ) {
        setLoading(true);
      }

      try {
        const token = await obterToken();

        if (signal?.aborted) return;

        if (!token) {
          setFavoritos([]);
          favoritosRef.current = [];
          setLoading(false);
          return;
        }

        const response = await api.get(
          "/favoritos",
          {
            headers: {
              Accept: "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            signal,
            timeout:
              TEMPO_LIMITE_REQUISICAO,
          }
        );

        if (signal?.aborted) return;

        const dados = Array.isArray(
          response.data
        )
          ? response.data
          : response.data?.favoritos ||
            response.data?.data ||
            [];

        const lista = Array.isArray(dados)
          ? dados
          : [];

        setFavoritos(lista);
        favoritosRef.current = lista;
        loadedRef.current = true;

        ultimaAtualizacaoRef.current =
          Date.now();

        saveFavoritosCache(lista);
      } catch (error: any) {
        if (signal?.aborted) return;

        if (
          !loadedRef.current &&
          favoritosRef.current.length === 0
        ) {
          console.warn(
            "Erro ao carregar favoritos:",
            error?.response?.data ||
              error?.message
          );
        }
      } finally {
        carregandoRef.current = false;
        setLoading(false);
      }
    },
    [obterToken]
  );

  // Primeira consulta à API.
  useEffect(() => {
    const ctrl = new AbortController();

    carregarFavoritos(
      true,
      true,
      ctrl.signal
    );

    return () => ctrl.abort();
  }, [carregarFavoritos]);

  // Atualiza ao retornar à tela.
  useFocusEffect(
    useCallback(() => {
      if (!loadedRef.current) return;

      if (
        Date.now() -
          ultimaAtualizacaoRef.current <
        CACHE_FAVORITOS
      ) {
        return;
      }

      if (
        appStateRef.current !== "active"
      ) {
        return;
      }

      const ctrl = new AbortController();

      carregarFavoritos(
        false,
        false,
        ctrl.signal
      );

      return () => ctrl.abort();
    }, [carregarFavoritos])
  );

  // Remove o favorito da tela e confirma na API.
  const removerFavorito = useCallback(
    async (idProduto: number) => {
      if (
        !Number.isFinite(idProduto) ||
        idProduto <= 0
      ) {
        return;
      }

      const anterior =
        favoritosRef.current;

      const semEste = anterior.filter(
        (item) =>
          Number(item.id_produto) !==
          idProduto
      );

      favoritosRef.current = semEste;
      setFavoritos(semEste);
      saveFavoritosCache(semEste);

      try {
        const token = await obterToken();

        if (!token) {
          throw new Error("Sem token");
        }

        await api.delete(
          `/favoritos/${idProduto}`,
          {
            headers: {
              Accept: "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            timeout:
              TEMPO_LIMITE_REQUISICAO,
          }
        );
      } catch (error: any) {
        favoritosRef.current = anterior;
        setFavoritos(anterior);
        saveFavoritosCache(anterior);

        console.warn(
          "Erro ao remover favorito:",
          error?.response?.data ||
            error?.message
        );
      }
    },
    [obterToken]
  );

  return {
    favoritos,
    loading,
    removerFavorito,
  };
}

// ============================================================
// TELA
// ============================================================

export default function FavoritosScreen() {
  const router = useRouter();

  const {
    favoritos,
    loading,
    removerFavorito,
  } = useFavoritos();

  const [limiteVisivel, setLimiteVisivel] =
    useState(LIMITE_INICIAL);

  const favoritosVisiveis = useMemo(
    () =>
      favoritos.slice(0, limiteVisivel),
    [favoritos, limiteVisivel]
  );

  const temMais =
    favoritos.length > limiteVisivel;

  const abrirProduto = useCallback(
    (idProduto: number) => {
      router.push({
        pathname: "/visuanuncios",
        params: {
          id: String(idProduto),
        },
      } as any);
    },
    [router]
  );

  const handleRemove = useCallback(
    (id: number) => removerFavorito(id),
    [removerFavorito]
  );

  const carregarMais = useCallback(
    () =>
      setLimiteVisivel(
        (valor) =>
          valor + LIMITE_INICIAL
      ),
    []
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, [router]);

  const keyExtractor = useCallback(
    (item: any, index: number) =>
      String(
        item.id_favorito ||
          item.id_produto ||
          index
      ),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <FavoritoCard
        item={item}
        onPress={abrirProduto}
        onRemove={handleRemove}
      />
    ),
    [abrirProduto, handleRemove]
  );

  const showSkeleton =
    loading && favoritos.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
        >
          <Feather
            name="arrow-left"
            size={24}
            color="#005386"
          />
        </TouchableOpacity>

        <View
          style={
            styles.headerTitleContainer
          }
        >
          <Text style={styles.headerTitle}>
            Favoritos
          </Text>
        </View>

        <View
          style={
            styles.headerButtonPlaceholder
          }
        />
      </View>

      {showSkeleton ? (
        <View
          style={styles.skeletonContainer}
        >
          <View style={styles.gridRow}>
            <SkeletonCard />
            <SkeletonCard />
          </View>

          <View style={styles.gridRow}>
            <SkeletonCard />
            <SkeletonCard />
          </View>
        </View>
      ) : favoritos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={styles.emptyIconContainer}
          >
            <Ionicons
              name="heart-outline"
              size={45}
              color="#0099FF"
            />
          </View>

          <Text style={styles.emptyTitle}>
            Nenhum favorito ainda
          </Text>

          <Text style={styles.emptyText}>
            Os itens que você favoritar
            aparecerão aqui.
          </Text>

          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() =>
              router.replace("/")
            }
            activeOpacity={0.85}
          >
            <Feather
              name="search"
              size={17}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.exploreButtonText
              }
            >
              Explorar itens
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={favoritosVisiveis}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={
            styles.gridRow
          }
          contentContainerStyle={
            styles.listContent
          }
          showsVerticalScrollIndicator={
            false
          }
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={
            Platform.OS !== "web"
          }
          ListFooterComponent={
            temMais ? (
              <TouchableOpacity
                style={
                  styles.loadMoreButton
                }
                onPress={carregarMais}
                activeOpacity={0.8}
              >
                <Text
                  style={
                    styles.loadMoreText
                  }
                >
                  Ver mais (
                  {favoritos.length -
                    limiteVisivel}
                  )
                </Text>

                <Feather
                  name="chevron-down"
                  size={16}
                  color="#005386"
                />
              </TouchableOpacity>
            ) : null
          }
        />
      )}
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

  backBtn: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },

  headerButtonPlaceholder: {
    width: 38,
    height: 38,
  },

  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  headerTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#005386",
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 30,
  },

  gridRow: {
    justifyContent: "space-between",
    paddingHorizontal: 0,
  },

  skeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  skeletonBlock: {
    backgroundColor: "#EAF3FA",
  },

  skeletonLine: {
    backgroundColor: "#EAF3FA",
    borderRadius: 4,
  },

  listingCard: {
    width: ITEM_WIDTH,
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
    elevation: 2,
  },

  imagePlaceholder: {
    width: "100%",
    height: ITEM_WIDTH,
    backgroundColor: "#F5FBFF",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  productImage: {
    width: "100%",
    height: "100%",
  },

  carousel: {
    width: "100%",
    height: "100%",
  },

  imageSlide: {
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  emptyImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },

  carouselArrow: {
    position: "absolute",
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor:
      "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },

  arrowLeft: {
    left: 5,
  },

  arrowRight: {
    right: 5,
  },

  photoCounter: {
    position: "absolute",
    top: 8,
    left: 8,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 4,
    backgroundColor:
      "rgba(0,83,134,0.8)",
  },

  photoCounterText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily:
      "Montserrat_600SemiBold",
  },

  photoDots: {
    position: "absolute",
    bottom: 5,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },

  dotTouch: {
    width: 22,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },

  dotActive: {
    width: 12,
    backgroundColor: "#0099FF",
  },

  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    zIndex: 3,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },

  textContainer: {
    paddingHorizontal: 9,
    paddingVertical: 9,
  },

  listingTitle: {
    fontFamily:
      "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#333333",
  },

  listingCategory: {
    fontFamily:
      "Montserrat_500Medium",
    fontSize: 11,
    color: "#0099FF",
    marginTop: 3,
  },

  listingCondition: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
    marginTop: 3,
  },

  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F1FAFF",
    borderWidth: 1,
    borderColor: "#DCEEFA",
    marginTop: 8,
    marginHorizontal: 16,
    gap: 6,
  },

  loadMoreText: {
    fontSize: 13,
    color: "#005386",
    fontFamily:
      "Montserrat_600SemiBold",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 35,
  },

  emptyIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },

  emptyTitle: {
    fontFamily:
      "Montserrat_700Bold",
    fontSize: 18,
    color: "#005386",
    textAlign: "center",
  },

  emptyText: {
    fontFamily:
      "Montserrat_400Regular",
    fontSize: 14,
    color: "#777777",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },

  exploreButton: {
    marginTop: 22,
    height: 46,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#0099FF",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  exploreButtonText: {
    fontFamily:
      "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
    marginLeft: 7,
  },
});