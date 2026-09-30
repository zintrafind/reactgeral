import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "../../services/api";

// ============================================================
// CONSTANTES
// ============================================================

const { width } = Dimensions.get("window");
const ITEM_WIDTH = (width - 44) / 2;
const CACHE_PERFIL = 30_000;
const TEMPO_LIMITE_REQUISICAO = 15000;
const LIMITE_INICIAL = 8;
const PERFIL_CACHE_KEY = "@pecapeca:perfil_cache_v1";
const PERFIL_CACHE_MAX_AGE = 1000 * 60 * 30; // 30min

type TabType = "anuncios" | "trocados" | "favoritos";

interface UserProfileData {
  id_usuario?: number | string;
  name: string;
  description: string;
  rating: string;
  fotoPerfil: string | null;
  banner: string | null;
}

// ============================================================
// HELPERS
// ============================================================

function getImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  const path = String(imagePath).trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  const baseUrl = String(
    api.defaults?.baseURL || "http://127.0.0.1:8000/api"
  )
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");

  const normalized = path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^storage\/+/, "");

  return `${baseUrl}/storage/${normalized}`;
}

function getConditionLabel(condition: any): string {
  const v = String(condition || "").trim().toUpperCase();
  switch (v) {
    case "N":
    case "NOVO":
      return "Novo";
    case "S":
    case "SEMI NOVO":
    case "SEMINOVO":
      return "Semi novo";
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

// ============================================================
// CACHE
// ============================================================

async function savePerfilCache(data: {
  user: UserProfileData;
  userProducts: any[];
  tradedProducts: any[];
}) {
  try {
    await AsyncStorage.setItem(
      PERFIL_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        ...data,
        userProducts: data.userProducts.slice(0, 50),
        tradedProducts: data.tradedProducts.slice(0, 50),
      })
    );
  } catch {}
}

async function loadPerfilCache() {
  try {
    const raw = await AsyncStorage.getItem(PERFIL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts) return null;
    if (Date.now() - parsed.ts > PERFIL_CACHE_MAX_AGE) return null;
    return parsed as {
      user: UserProfileData;
      userProducts: any[];
      tradedProducts: any[];
    };
  } catch {
    return null;
  }
}

// ============================================================
// SKELETON
// ============================================================

const SkeletonCard = memo(function SkeletonCard() {
  return (
    <View style={styles.listingCard}>
      <View style={[styles.imagePlaceholder, styles.skeletonBlock]} />
      <View style={styles.textPlaceholderRow}>
        <View
          style={[
            styles.skeletonLine,
            { width: "75%", height: 12, marginBottom: 6 },
          ]}
        />
        <View style={[styles.skeletonLine, { width: "50%", height: 10 }]} />
      </View>
    </View>
  );
});

// ============================================================
// CARD DE PRODUTO (memoizado)
// ============================================================

const ProductCard = memo(function ProductCard({
  item,
  onOpenOptions,
}: {
  item: any;
  onOpenOptions: (item: any) => void;
}) {
  const imagemUrl = useMemo(
    () =>
      item.images && item.images.length > 0
        ? getImageUrl(item.images[0]?.ds_imagem)
        : null,
    [item.images]
  );

  const [failed, setFailed] = useState(false);
  const showImage = imagemUrl && !failed;

  const handlePress = useCallback(
    () => onOpenOptions(item),
    [onOpenOptions, item]
  );

  return (
    <TouchableOpacity
      style={styles.listingCard}
      activeOpacity={0.8}
      onPress={handlePress}
    >
      <View style={styles.imagePlaceholder}>
        {showImage ? (
          <Image
            source={{ uri: imagemUrl! }}
            style={styles.productImage}
            onError={() => setFailed(true)}
            fadeDuration={150}
          />
        ) : (
          <Feather name="package" size={32} color="#0099FF" />
        )}
      </View>

      <View style={styles.textPlaceholderRow}>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {item.nm_produto}
        </Text>

        <Text style={styles.listingCategory} numberOfLines={1}>
          {item.categoria?.nm_categoria || "Sem categoria"}
        </Text>

        <View style={styles.cardFooterRow}>
          <Text style={styles.listingPrice}>
            {getConditionLabel(item.st_condicao)}
          </Text>

          <TouchableOpacity
            style={styles.moreOptionsButton}
            onPress={handlePress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="more-vertical" size={18} color="#005386" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ============================================================
// HOOK — PERFIL
// ============================================================

function usePerfil() {
  const [user, setUser] = useState<UserProfileData>({
    id_usuario: undefined,
    name: "",
    description: "",
    rating: "5.0",
    fotoPerfil: null,
    banner: null,
  });
  const [userProducts, setUserProducts] = useState<any[]>([]);
  const [tradedProducts, setTradedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const tokenRef = useRef<string | null>(null);
  const usuarioStorageRef = useRef<any>(null);
  const carregandoRef = useRef(false);
  const ultimaAtualizacaoRef = useRef(0);
  const loadedRef = useRef(false);

  // ─── Carrega cache na montagem ────────────────────────
  useEffect(() => {
    let ativo = true;
    (async () => {
      const cached = await loadPerfilCache();
      if (!ativo || !cached) return;

      setUser(cached.user);
      setUserProducts(cached.userProducts || []);
      setTradedProducts(cached.tradedProducts || []);
      setLoading(false);
      loadedRef.current = true;
    })();

    return () => {
      ativo = false;
    };
  }, []);

  // ─── Token helper (CORRIGIDO — sem recursão) ──────────
  const obterToken = useCallback(async (): Promise<string | null> => {
    if (tokenRef.current) return tokenRef.current;
    const token = await AsyncStorage.getItem("token");
    tokenRef.current = token;
    return token;
  }, []);

  // ─── Carrega dados (cache-first + SWR) ────────────────
  const carregarPerfil = useCallback(
    async (mostrarLoading = false, forcar = false, signal?: AbortSignal) => {
      if (carregandoRef.current) return;

      if (
        !forcar &&
        loadedRef.current &&
        Date.now() - ultimaAtualizacaoRef.current < CACHE_PERFIL
      ) {
        return;
      }

      carregandoRef.current = true;
      if (mostrarLoading && !loadedRef.current) setLoading(true);

      try {
        // Token e usuário em paralelo
        let token = tokenRef.current;
        let usuarioStorage = usuarioStorageRef.current;

        if (!token || !usuarioStorage) {
          const [tokenStorage, usuarioTexto] = await Promise.all([
            token ? Promise.resolve(token) : AsyncStorage.getItem("token"),
            usuarioStorage
              ? Promise.resolve(JSON.stringify(usuarioStorage))
              : AsyncStorage.getItem("usuario"),
          ]);

          token = tokenStorage;
          tokenRef.current = tokenStorage;

          if (!usuarioStorage && usuarioTexto) {
            try {
              usuarioStorage = JSON.parse(usuarioTexto);
              usuarioStorageRef.current = usuarioStorage;
            } catch {}
          }
        }

        if (signal?.aborted) return;

        // Mostra dados locais IMEDIATAMENTE
        if (usuarioStorage) {
          setUser({
            id_usuario:
              usuarioStorage.id_usuario || usuarioStorage.id || undefined,
            name: usuarioStorage.nm_usuario || "",
            description:
              usuarioStorage.ds_usuario || "Descrição não informada",
            rating: "5.0",
            fotoPerfil: usuarioStorage.ds_foto_perfil || null,
            banner: usuarioStorage.ds_banner || null,
          });
        }

        if (!token) {
          setLoading(false);
          return;
        }

        const idUsuario =
          usuarioStorage?.id_usuario || usuarioStorage?.id;

        // Requisições em paralelo
        const reqs: Promise<any>[] = [
          api.get("/my-products", {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            signal,
            timeout: TEMPO_LIMITE_REQUISICAO,
          }),
          api.get("/my-products?status=T", {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            signal,
            timeout: TEMPO_LIMITE_REQUISICAO,
          }),
        ];

        if (idUsuario) {
          reqs.push(
            api.get(`/users/${idUsuario}`, {
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
              },
              signal,
              timeout: TEMPO_LIMITE_REQUISICAO,
            })
          );
        }

        const resultados = await Promise.allSettled(reqs);

        if (signal?.aborted) return;

        // Anúncios
        if (resultados[0]?.status === "fulfilled") {
          const d = resultados[0].value.data;
          setUserProducts(
            Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []
          );
        }

        // Trocados
        if (resultados[1]?.status === "fulfilled") {
          const d = resultados[1].value.data;
          setTradedProducts(
            Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []
          );
        }

        // Usuário atualizado
        if (resultados[2]?.status === "fulfilled" && usuarioStorage) {
          const usuarioAPI =
            resultados[2].value.data?.user || resultados[2].value.data;

          if (usuarioAPI) {
            const atualizado = { ...usuarioStorage, ...usuarioAPI };
            usuarioStorageRef.current = atualizado;

            setUser({
              id_usuario:
                atualizado.id_usuario ||
                atualizado.id ||
                idUsuario,
              name: atualizado.nm_usuario || "",
              description:
                atualizado.ds_usuario || "Descrição não informada",
              rating: "5.0",
              fotoPerfil: atualizado.ds_foto_perfil || null,
              banner: atualizado.ds_banner || null,
            });

            void AsyncStorage.setItem(
              "usuario",
              JSON.stringify(atualizado)
            );
          }
        }

        loadedRef.current = true;
        ultimaAtualizacaoRef.current = Date.now();

        // Salva cache
        setUserProducts((up) => {
          setTradedProducts((tp) => {
            void savePerfilCache({
              user: usuarioStorage,
              userProducts: up,
              tradedProducts: tp,
            });
            return tp;
          });
          return up;
        });
      } catch (error) {
        if (!signal?.aborted) {
          console.warn("Erro ao carregar perfil:", error);
        }
      } finally {
        carregandoRef.current = false;
        setLoading(false);
      }
    },
    []
  );

  // ─── Primeiro fetch ────────────────────────────────────
  useEffect(() => {
    const ctrl = new AbortController();
    carregarPerfil(true, true, ctrl.signal);
    return () => ctrl.abort();
  }, [carregarPerfil]);

  // ─── Refresh em foco (throttled) ──────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!loadedRef.current) return;
      if (Date.now() - ultimaAtualizacaoRef.current < CACHE_PERFIL) return;

      const ctrl = new AbortController();
      carregarPerfil(false, false, ctrl.signal);
      return () => ctrl.abort();
    }, [carregarPerfil])
  );

  // ─── Helpers de mutação local ─────────────────────────
  const removerProdutoLocal = useCallback((id: number) => {
    setUserProducts((prev) => {
      const novas = prev.filter(
        (p) => Number(p.id_produto || p.id) !== Number(id)
      );
      setTradedProducts((tp) => {
        void savePerfilCache({
          user: usuarioStorageRef.current,
          userProducts: novas,
          tradedProducts: tp,
        });
        return tp;
      });
      return novas;
    });
  }, []);

  const atualizarStatusLocal = useCallback((id: number, status: string) => {
    setUserProducts((prev) => {
      const novas = prev.map((p) =>
        Number(p.id_produto || p.id) === Number(id)
          ? { ...p, st_status: status }
          : p
      );
      setTradedProducts((tp) => {
        void savePerfilCache({
          user: usuarioStorageRef.current,
          userProducts: novas,
          tradedProducts: tp,
        });
        return tp;
      });
      return novas;
    });
  }, []);

  const recarregar = useCallback(() => {
    ultimaAtualizacaoRef.current = 0;
    carregarPerfil(false, true);
  }, [carregarPerfil]);

  return {
    user,
    userProducts,
    tradedProducts,
    loading,
    obterToken,
    recarregar,
    removerProdutoLocal,
    atualizarStatusLocal,
  };
}

// ============================================================
// TELA
// ============================================================

export default function ProfileScreen() {
  const router = useRouter();

  const {
    user,
    userProducts,
    tradedProducts,
    loading,
    obterToken,
    recarregar,
    removerProdutoLocal,
    atualizarStatusLocal,
  } = usePerfil();

  const [activeTab, setActiveTab] = useState<TabType>("anuncios");
  const [limiteVisivel, setLimiteVisivel] = useState(LIMITE_INICIAL);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [selectedAd, setSelectedAd] = useState<any>(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    setLimiteVisivel(LIMITE_INICIAL);
  }, [activeTab]);

  // ─── Produtos exibidos ────────────────────────────────
  const displayedProducts = useMemo(
    () => (activeTab === "trocados" ? tradedProducts : userProducts),
    [activeTab, tradedProducts, userProducts]
  );

  const produtosVisiveis = useMemo(
    () => displayedProducts.slice(0, limiteVisivel),
    [displayedProducts, limiteVisivel]
  );

  const temMais = displayedProducts.length > limiteVisivel;

  // ─── Handlers ─────────────────────────────────────────
  const handleOpenAdOptions = useCallback((item: any) => {
    setSelectedAd(item);
    setOptionsModalVisible(true);
  }, []);

  const handleEditAd = useCallback(() => {
    if (selectedAd?.st_status === "T") return;

    setOptionsModalVisible(false);
    const productId = selectedAd?.id_produto || selectedAd?.id;
    if (!productId) return;

    router.push({
      pathname: "/editaranuncio",
      params: { id: String(productId) },
    } as any);
  }, [selectedAd, router]);

  const handleOpenDeleteModal = useCallback(() => {
    setOptionsModalVisible(false);
    setDeleteModalVisible(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (processando) return;
    setProcessando(true);

    const productId = selectedAd?.id_produto || selectedAd?.id;

    try {
      const token = await obterToken();
      if (!token || !productId) return;

      // Otimista: remove da UI imediatamente
      removerProdutoLocal(productId);

      await api.delete(`/products/${productId}`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        timeout: TEMPO_LIMITE_REQUISICAO,
      });

      recarregar();
    } catch (error: any) {
      // Reverte
      recarregar();
      console.warn(
        "Erro ao excluir:",
        error?.response?.data || error?.message
      );
    } finally {
      setProcessando(false);
      setDeleteModalVisible(false);
      setSelectedAd(null);
    }
  }, [selectedAd, obterToken, removerProdutoLocal, recarregar, processando]);

  const handleUpdateStatus = useCallback(
    async (novoStatus: string) => {
      if (processando) return;
      setProcessando(true);

      const productId = selectedAd?.id_produto || selectedAd?.id;

      const codigoMap: Record<string, string> = {
        Disponível: "A",
        "Em Negociação": "N",
        Trocado: "T",
      };
      const statusCodigo = codigoMap[novoStatus];

      try {
        const token = await obterToken();
        if (!token || !productId || !statusCodigo) return;

        // Otimista
        atualizarStatusLocal(productId, statusCodigo);

        await api.put(
          `/products/${productId}/status`,
          { st_status: statusCodigo },
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            timeout: TEMPO_LIMITE_REQUISICAO,
          }
        );

        recarregar();
      } catch (error: any) {
        recarregar();
        console.warn(
          "Erro ao alterar status:",
          error?.response?.data || error?.message
        );
      } finally {
        setProcessando(false);
        setStatusModalVisible(false);
      }
    },
    [selectedAd, obterToken, atualizarStatusLocal, recarregar, processando]
  );

  const sairDaConta = useCallback(async () => {
    try {
      const token = await obterToken();
      if (token) {
        await api
          .post(
            "/logout",
            {},
            {
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${token}`,
              },
            }
          )
          .catch(() => {});
      }
    } catch {}

    await AsyncStorage.multiRemove(["token", "usuario"]);
    router.replace("/(auth)/login");
  }, [obterToken, router]);

  const handleChangeTab = useCallback(
    (tab: TabType) => {
      if (tab === "favoritos") {
        router.push("/favoritos" as any);
        return;
      }
      setActiveTab(tab);
    },
    [router]
  );

  const carregarMais = useCallback(
    () => setLimiteVisivel((v) => v + LIMITE_INICIAL),
    []
  );

  // ─── Empty message ────────────────────────────────────
  const emptyMessage = useMemo(
    () =>
      activeTab === "trocados"
        ? "Você ainda não possui anúncios trocados."
        : "Você ainda não possui anúncios cadastrados.",
    [activeTab]
  );

  // ─── Render Item ──────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <ProductCard item={item} onOpenOptions={handleOpenAdOptions} />
    ),
    [handleOpenAdOptions]
  );

  const keyExtractor = useCallback(
    (item: any) => String(item.id_produto || item.id),
    []
  );

  // ─── Header (memoizado) ───────────────────────────────
  const ListHeader = useMemo(
    () => (
      <View>
        {/* BANNER */}
        <View style={styles.bannerContainer}>
          {getImageUrl(user.banner) ? (
            <Image
              source={{ uri: getImageUrl(user.banner)! }}
              style={styles.bannerImage}
              fadeDuration={150}
            />
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Feather name="image" size={35} color="#0099FF" />
            </View>
          )}
        </View>

        {/* DADOS DO USUÁRIO */}
        <View style={styles.profileInfoContainer}>
          <View style={styles.roundAvatar}>
            {getImageUrl(user.fotoPerfil) ? (
              <Image
                source={{ uri: getImageUrl(user.fotoPerfil)! }}
                style={styles.profileImage}
                fadeDuration={150}
              />
            ) : (
              <Feather name="user" size={45} color="#005386" />
            )}
          </View>

          <View style={styles.userInfoTextContainer}>
            <Text style={styles.userName}>{user.name || "Usuário"}</Text>

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

            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() => router.push("/perfil/editarPerfil" as any)}
              activeOpacity={0.7}
            >
              <Feather name="edit-3" size={14} color="#FFFFFF" />
              <Text style={styles.editProfileText}>Editar perfil</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AVALIAÇÃO */}
        <View style={styles.ratingContainer}>
          <View style={styles.starsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Feather
                key={i}
                name="star"
                size={18}
                color="#005386"
                style={i < 4 ? styles.starIcon : undefined}
              />
            ))}
          </View>
          <Text style={styles.ratingText}>— {user.rating}</Text>
        </View>

        {/* ABAS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
        >
          {(
            [
              ["anuncios", "Anúncios"],
              ["trocados", "Anúncios trocados"],
              ["favoritos", "Favoritos"],
            ] as const
          ).map(([key, label]) => {
            const isActive = activeTab === key;
            const isFav = key === "favoritos";
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.tabItem,
                  isFav && styles.favoriteTabItem,
                  isActive && styles.activeTab,
                ]}
                onPress={() => handleChangeTab(key)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tabText, isActive && styles.activeTabText]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    ),
    [user, activeTab, handleChangeTab, router]
  );

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)");
          }}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={24} color="#005386" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/perfil/configuracoes" as any)}
          style={styles.headerButton}
        >
          <Feather name="settings" size={22} color="#005386" />
        </TouchableOpacity>
      </View>

      {/* CONTEÚDO */}
      <FlatList
        data={loading && userProducts.length === 0 ? [] : produtosVisiveis}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        renderItem={renderItem}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== "web"}
        ListEmptyComponent={
          loading && userProducts.length === 0 ? (
            <View style={styles.skeletonGrid}>
              <View style={styles.gridRow}>
                <SkeletonCard />
                <SkeletonCard />
              </View>
              <View style={styles.gridRow}>
                <SkeletonCard />
                <SkeletonCard />
              </View>
            </View>
          ) : (
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          )
        }
        ListFooterComponent={
          temMais ? (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={carregarMais}
              activeOpacity={0.8}
            >
              <Text style={styles.loadMoreText}>
                Ver mais ({displayedProducts.length - limiteVisivel})
              </Text>
              <Feather name="chevron-down" size={16} color="#005386" />
            </TouchableOpacity>
          ) : null
        }
      />

      {/* MODAL DE OPÇÕES */}
      <Modal
        animationType="fade"
        transparent
        visible={optionsModalVisible}
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.adModalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <View style={styles.adModalContent}>
            <Text style={styles.adModalTitle} numberOfLines={1}>
              {selectedAd?.nm_produto}
            </Text>
            <Text style={styles.adModalSubtitle}>
              Escolha a ação desejada:
            </Text>

            {selectedAd?.st_status !== "T" && (
              <TouchableOpacity
                style={styles.adOptionButton}
                onPress={handleEditAd}
              >
                <Feather name="edit-3" size={20} color="#005386" />
                <Text style={styles.adOptionText}>Editar Anúncio</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.adOptionButton}
              onPress={() => {
                setOptionsModalVisible(false);
                setStatusModalVisible(true);
              }}
            >
              <Feather name="sliders" size={20} color="#005386" />
              <Text style={styles.adOptionText}>Alterar Status do Item</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.adOptionButton, styles.adOptionDeleteButton]}
              onPress={handleOpenDeleteModal}
            >
              <Feather name="trash-2" size={20} color="#FF3B30" />
              <Text style={[styles.adOptionText, styles.adOptionDeleteText]}>
                Excluir Anúncio
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.adCancelButton}
              onPress={() => setOptionsModalVisible(false)}
            >
              <Text style={styles.adCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DE STATUS */}
      <Modal
        animationType="fade"
        transparent
        visible={statusModalVisible}
        onRequestClose={() => setStatusModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.adModalOverlay}
          activeOpacity={1}
          onPress={() => setStatusModalVisible(false)}
        >
          <View style={styles.adModalContent}>
            <Text style={styles.adModalTitle}>Alterar Status</Text>
            <Text style={styles.adModalSubtitle}>
              Selecione o estado atual do produto:
            </Text>

            {[
              ["Disponível", "check-circle", "#28A745"],
              ["Em Negociação", "clock", "#FF9900"],
              ["Trocado", "x-circle", "#6C757D"],
            ].map(([label, icon, color]) => (
              <TouchableOpacity
                key={label}
                style={styles.adOptionButton}
                onPress={() => handleUpdateStatus(label)}
                disabled={processando}
              >
                <Feather name={icon as any} size={20} color={color} />
                <Text style={styles.adOptionText}>{label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.adCancelButton}
              onPress={() => setStatusModalVisible(false)}
              disabled={processando}
            >
              <Text style={styles.adCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL DE EXCLUSÃO */}
      <Modal
        animationType="fade"
        transparent
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.deleteModalTitle}>Confirmar Exclusão</Text>
            <Text style={styles.deleteModalSubtitle}>
              Tem certeza que deseja remover o anúncio "{selectedAd?.nm_produto}
              "? Esta ação não pode ser desfeita.
            </Text>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.cancelLogoutButton}
                onPress={() => setDeleteModalVisible(false)}
                disabled={processando}
              >
                <Text style={styles.cancelLogoutText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmDeleteButton}
                onPress={handleConfirmDelete}
                disabled={processando}
              >
                {processando ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmDeleteText}>Excluir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DE LOGOUT (oculto, caso queira usar depois) */}
      <Modal
        animationType="fade"
        transparent
        visible={logoutModalVisible}
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.logoutModalTitle}>Deseja sair da conta?</Text>
            <Text style={styles.logoutModalSubtitle}>
              Ao confirmar, sua sessão atual será encerrada com segurança.
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

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

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
  headerButton: { padding: 6 },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },

  // ============ BANNER ============
  bannerContainer: {
    width: "100%",
    height: 150,
    marginTop: 15,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#E4F8FF",
  },
  bannerImage: { width: "100%", height: "100%" },
  bannerPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E4F8FF",
  },

  // ============ PERFIL ============
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
    elevation: 3,
    overflow: "hidden",
  },
  profileImage: { width: "100%", height: "100%" },
  userInfoTextContainer: { marginLeft: 16, flex: 1 },
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
  addressIcon: { marginRight: 4 },
  userSubtext: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: "#777777",
    flex: 1,
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    backgroundColor: "#0099FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  editProfileText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
    marginLeft: 5,
  },

  // ============ AVALIAÇÃO ============
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    paddingLeft: 4,
  },
  starsRow: { flexDirection: "row", alignItems: "center" },
  starIcon: { marginRight: 4 },
  ratingText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
    marginLeft: 8,
  },

  // ============ ABAS ============
  tabsContainer: {
    marginVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 4,
  },
  tabItem: {
    marginRight: 24,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  favoriteTabItem: { marginRight: 8 },
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

  // ============ GRID ============
  gridRow: {
    justifyContent: "space-between",
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
  },
  productImage: { width: "100%", height: "100%" },
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
  listingCategory: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 11,
    color: "#0099FF",
    marginTop: 3,
  },
  cardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 3,
  },
  listingPrice: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
  },
  moreOptionsButton: { padding: 4 },

  // ============ SKELETON ============
  skeletonGrid: { gap: 0 },
  skeletonBlock: { backgroundColor: "#EAF3FA" },
  skeletonLine: { backgroundColor: "#EAF3FA", borderRadius: 4 },

  // ============ EMPTY ============
  emptyText: {
    textAlign: "center",
    fontFamily: "Montserrat_400Regular",
    color: "#888",
    marginTop: 40,
    fontSize: 14,
  },

  // ============ LOAD MORE ============
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
    gap: 6,
  },
  loadMoreText: {
    fontSize: 13,
    color: "#005386",
    fontFamily: "Montserrat_600SemiBold",
  },

  // ============ MODAIS ============
  adModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  adModalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  adModalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: "#333333",
  },
  adModalSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: "#777777",
    marginBottom: 16,
    marginTop: 2,
  },
  adOptionButton: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#F5FBFF",
    marginBottom: 10,
  },
  adOptionText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 15,
    color: "#005386",
    marginLeft: 12,
  },
  adOptionDeleteButton: { backgroundColor: "#FFF0F0" },
  adOptionDeleteText: { color: "#FF3B30" },
  adCancelButton: {
    marginTop: 6,
    paddingVertical: 10,
    width: "100%",
    alignItems: "center",
  },
  adCancelText: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: "#888888",
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
  },
  deleteModalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#FF3B30",
    marginBottom: 8,
    textAlign: "center",
  },
  deleteModalSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#666666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
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
  confirmDeleteButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmDeleteText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: "#fff",
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