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
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";

const LIMITE_INICIAL = 8;
const TIMEOUT = 15000;
const CACHE_PREFIX = "@pecapeca:perfil_cache_v2:";
const CACHE_MAX_AGE = 30 * 60 * 1000;

type TabType = "anuncios" | "trocados";

type ImagemAPI = {
  id_imagem?: number;
  ds_imagem?: string;
  nr_ordem?: number;
};

type Produto = {
  id_produto: number;
  nm_produto: string;
  ds_produto?: string;
  st_condicao: string;
  st_status: string;
  images?: ImagemAPI[];
  imagens?: ImagemAPI[];
  ds_imagem?: string;
  categoria?: {
    nm_categoria?: string;
  };
  nm_categoria?: string;
};

type Usuario = {
  id_usuario?: number | string;
  id?: number | string;
  nm_usuario?: string;
  ds_usuario?: string;
  ds_foto_perfil?: string | null;
  ds_banner?: string | null;
};

type PerfilCache = {
  ts: number;
  usuario: Usuario;
  anuncios: Produto[];
  trocados: Produto[];
};

type Aviso = {
  titulo: string;
  mensagem: string;
};

const OPCOES_STATUS: {
  codigo: string;
  nome: string;
  icone: React.ComponentProps<typeof Feather>["name"];
  cor: string;
}[] = [
  {
    codigo: "A",
    nome: "Disponível",
    icone: "check-circle",
    cor: "#28A745",
  },
  {
    codigo: "N",
    nome: "Em negociação",
    icone: "clock",
    cor: "#FF9900",
  },
  {
    codigo: "T",
    nome: "Trocado",
    icone: "check",
    cor: "#6C757D",
  },
];

function getImageUrl(caminho?: string | null): string | null {
  const path = String(caminho || "").trim();

  if (!path) return null;

  if (/^(https?:|blob:|data:|file:|content:)/i.test(path)) {
    return path;
  }

  const baseUrl = String(
    api.defaults.baseURL || "http://127.0.0.1:8000/api"
  )
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");

  const normalizado = path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^storage\/+/, "");

  return `${baseUrl}/storage/${normalizado}`;
}

function getConditionLabel(codigo: string) {
  switch (String(codigo || "").toUpperCase()) {
    case "N":
      return "Novo";
    case "S":
      return "Seminovo";
    case "U":
      return "Usado";
    case "Q":
      return "Quebrado";
    default:
      return "Não informado";
  }
}

function extrairProdutos(dados: any): Produto[] {
  if (Array.isArray(dados)) return dados;
  if (Array.isArray(dados?.products)) return dados.products;
  if (Array.isArray(dados?.produtos)) return dados.produtos;
  if (Array.isArray(dados?.data)) return dados.data;

  return [];
}

function extrairImagens(produto: Produto): string[] {
  const lista =
    Array.isArray(produto.images) && produto.images.length > 0
      ? produto.images
      : Array.isArray(produto.imagens)
        ? produto.imagens
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

  const antiga = getImageUrl(produto.ds_imagem);

  return antiga ? [antiga] : [];
}

function mensagemErro(error: any, fallback: string) {
  const erros = error?.response?.data?.errors;
  const primeiro = erros ? Object.values(erros)[0] : undefined;

  if (Array.isArray(primeiro) && primeiro[0]) {
    return String(primeiro[0]);
  }

  return error?.response?.data?.message || fallback;
}

const FotoProduto = memo(function FotoProduto({
  uri,
}: {
  uri: string;
}) {
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    setFalhou(false);
  }, [uri]);

  if (falhou) {
    return (
      <View style={styles.fotoVazia}>
        <Feather name="image" size={30} color="#0099FF" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.productImage}
      resizeMode="cover"
      onError={() => setFalhou(true)}
    />
  );
});

const ProductCard = memo(function ProductCard({
  item,
  largura,
  onOpenOptions,
}: {
  item: Produto;
  largura: number;
  onOpenOptions: (item: Produto) => void;
}) {
  const fotos = useMemo(() => extrairImagens(item), [item]);
  const assinatura = JSON.stringify(fotos);

  const [indice, setIndice] = useState(0);
  const [larguraFoto, setLarguraFoto] = useState(0);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setIndice(0);

    scrollRef.current?.scrollTo({
      x: 0,
      animated: false,
    });
  }, [item.id_produto, assinatura, larguraFoto]);

  function irParaFoto(index: number) {
    if (
      larguraFoto <= 0 ||
      index < 0 ||
      index >= fotos.length
    ) {
      return;
    }

    setIndice(index);

    scrollRef.current?.scrollTo({
      x: index * larguraFoto,
      animated: true,
    });
  }

  function atualizarIndice(offset: number) {
    if (larguraFoto <= 0) return;

    const novo = Math.round(offset / larguraFoto);

    setIndice(
      Math.min(Math.max(novo, 0), Math.max(fotos.length - 1, 0))
    );
  }

  return (
    <View style={[styles.listingCard, { width: largura }]}>
      <View
        style={[styles.galeria, { height: largura }]}
        onLayout={(event) =>
          setLarguraFoto(event.nativeEvent.layout.width)
        }
      >
        {fotos.length > 0 && larguraFoto > 0 ? (
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) =>
              atualizarIndice(event.nativeEvent.contentOffset.x)
            }
            onScrollEndDrag={(event) =>
              atualizarIndice(event.nativeEvent.contentOffset.x)
            }
          >
            {fotos.map((uri, index) => (
              <TouchableOpacity
                key={`${uri}-${index}`}
                style={{
                  width: larguraFoto,
                  height: largura,
                }}
                activeOpacity={0.9}
                onPress={() => onOpenOptions(item)}
                accessibilityLabel={`Foto ${index + 1} de ${item.nm_produto}`}
              >
                <FotoProduto uri={uri} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <TouchableOpacity
            style={styles.fotoVazia}
            onPress={() => onOpenOptions(item)}
          >
            <Feather name="package" size={32} color="#0099FF" />
          </TouchableOpacity>
        )}

        {fotos.length > 1 && (
          <>
            {indice > 0 && (
              <TouchableOpacity
                style={[styles.setaFoto, styles.setaEsquerda]}
                onPress={() => irParaFoto(indice - 1)}
                accessibilityLabel="Foto anterior"
              >
                <Feather
                  name="chevron-left"
                  size={21}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}

            {indice < fotos.length - 1 && (
              <TouchableOpacity
                style={[styles.setaFoto, styles.setaDireita]}
                onPress={() => irParaFoto(indice + 1)}
                accessibilityLabel="Próxima foto"
              >
                <Feather
                  name="chevron-right"
                  size={21}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            )}

            <View style={styles.contadorFoto}>
              <Text style={styles.contadorTexto}>
                {indice + 1}/{fotos.length}
              </Text>
            </View>

            <View style={styles.paginacao}>
              {fotos.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.areaPonto}
                  onPress={() => irParaFoto(index)}
                  accessibilityLabel={`Ver foto ${index + 1}`}
                >
                  <View
                    style={[
                      styles.ponto,
                      indice === index && styles.pontoAtivo,
                    ]}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {item.st_status === "T" && (
          <View style={styles.trocadoBadge}>
            <Text style={styles.trocadoTexto}>Trocado</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.cardInfo}
        onPress={() => onOpenOptions(item)}
        activeOpacity={0.8}
      >
        <Text style={styles.listingTitle} numberOfLines={1}>
          {item.nm_produto}
        </Text>

        <Text style={styles.listingCategory} numberOfLines={1}>
          {item.categoria?.nm_categoria ||
            item.nm_categoria ||
            "Sem categoria"}
        </Text>

        <View style={styles.cardFooterRow}>
          <Text style={styles.listingCondition}>
            {getConditionLabel(item.st_condicao)}
          </Text>

          <Feather
            name="more-vertical"
            size={18}
            color="#005386"
          />
        </View>
      </TouchableOpacity>
    </View>
  );
});

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();

  const larguraCard = Math.max((width - 44) / 2, 100);

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [anuncios, setAnuncios] = useState<Produto[]>([]);
  const [trocados, setTrocados] = useState<Produto[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("anuncios");
  const [limite, setLimite] = useState(LIMITE_INICIAL);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processando, setProcessando] = useState(false);

  const [selectedAd, setSelectedAd] = useState<Produto | null>(null);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const requestIdRef = useRef(0);
  const mutationRef = useRef(false);

  const carregarPerfil = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = ++requestIdRef.current;

      const atual = () =>
        !signal?.aborted &&
        requestId === requestIdRef.current;

      setRefreshing(true);

      try {
        const [token, usuarioTexto] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("usuario"),
        ]);

        if (!atual()) return;

        if (!token || !usuarioTexto) {
          router.replace("/(auth)/login" as any);
          return;
        }

        const usuarioLocal: Usuario = JSON.parse(usuarioTexto);
        const idUsuario =
          usuarioLocal.id_usuario ?? usuarioLocal.id;

        if (!idUsuario) {
          throw new Error("Não foi possível identificar o usuário.");
        }

        const cacheKey = `${CACHE_PREFIX}${idUsuario}`;

        let anunciosAtuais: Produto[] = [];
        let trocadosAtuais: Produto[] = [];

        setUsuario(usuarioLocal);

        try {
          const raw = await AsyncStorage.getItem(cacheKey);

          if (!atual()) return;

          if (raw) {
            const cache: PerfilCache = JSON.parse(raw);

            if (
              cache.ts &&
              Date.now() - cache.ts < CACHE_MAX_AGE
            ) {
              anunciosAtuais = Array.isArray(cache.anuncios)
                ? cache.anuncios
                : [];

              trocadosAtuais = Array.isArray(cache.trocados)
                ? cache.trocados
                : [];

              setUsuario(cache.usuario || usuarioLocal);
              setAnuncios(anunciosAtuais);
              setTrocados(trocadosAtuais);
              setLoading(false);
            }
          }
        } catch {
          // Um cache inválido não impede o carregamento da API.
        }

        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: TIMEOUT,
          signal,
        };

        const [resAnuncios, resTrocados, resUsuario] =
          await Promise.allSettled([
            api.get("/my-products", config),
            api.get("/my-products?status=T", config),
            api.get(`/users/${idUsuario}`, config),
          ]);

        if (!atual()) return;

        let usuarioAtual = usuarioLocal;

        if (resAnuncios.status === "fulfilled") {
          anunciosAtuais = extrairProdutos(
            resAnuncios.value.data
          ).filter((produto) =>
            ["A", "N"].includes(produto.st_status)
          );

          setAnuncios(anunciosAtuais);
        }

        if (resTrocados.status === "fulfilled") {
          trocadosAtuais = extrairProdutos(
            resTrocados.value.data
          ).filter((produto) => produto.st_status === "T");

          setTrocados(trocadosAtuais);
        }

        if (resUsuario.status === "fulfilled") {
          const dados = resUsuario.value.data;
          const usuarioAPI = dados?.user || dados?.usuario || dados;

          if (usuarioAPI && typeof usuarioAPI === "object") {
            usuarioAtual = {
              ...usuarioLocal,
              ...usuarioAPI,
            };

            setUsuario(usuarioAtual);

            await AsyncStorage.setItem(
              "usuario",
              JSON.stringify(usuarioAtual)
            );
          }
        }

        if (!atual()) return;

        const falhaLista =
          resAnuncios.status === "rejected"
            ? resAnuncios.reason
            : resTrocados.status === "rejected"
              ? resTrocados.reason
              : null;

        if (falhaLista) {
          setAviso({
            titulo: "Não foi possível atualizar",
            mensagem: mensagemErro(
              falhaLista,
              "Uma das listas não pôde ser carregada. Tente atualizar novamente."
            ),
          });
        }

        const cache: PerfilCache = {
          ts: Date.now(),
          usuario: usuarioAtual,
          anuncios: anunciosAtuais,
          trocados: trocadosAtuais,
        };

        await AsyncStorage.setItem(
          cacheKey,
          JSON.stringify(cache)
        ).catch(() => {});
      } catch (error: any) {
        if (!atual()) return;

        setAviso({
          titulo: "Erro",
          mensagem: mensagemErro(
            error,
            error?.message || "Não foi possível carregar o perfil."
          ),
        });
      } finally {
        if (atual()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [router]
  );

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();

      void carregarPerfil(controller.signal);

      return () => {
        controller.abort();
      };
    }, [carregarPerfil])
  );

  useEffect(() => {
    setLimite(LIMITE_INICIAL);
  }, [activeTab]);

  const produtos = activeTab === "trocados" ? trocados : anuncios;
  const visiveis = produtos.slice(0, limite);

  const abrirOpcoes = useCallback((produto: Produto) => {
    setSelectedAd(produto);
    setOptionsModalVisible(true);
  }, []);

  function editarAnuncio() {
    if (!selectedAd || selectedAd.st_status === "T") return;

    setOptionsModalVisible(false);

    router.push({
      pathname: "/editaranuncio",
      params: { id: String(selectedAd.id_produto) },
    } as any);
  }

  async function invalidarCache() {
    const idUsuario = usuario?.id_usuario ?? usuario?.id;

    if (idUsuario) {
      await AsyncStorage.removeItem(
        `${CACHE_PREFIX}${idUsuario}`
      );
    }
  }

  async function alterarStatus(codigo: string) {
    if (!selectedAd || mutationRef.current) return;

    mutationRef.current = true;
    setProcessando(true);

    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) throw new Error("Sua sessão não foi encontrada.");

      await api.put(
        `/products/${selectedAd.id_produto}/status`,
        { st_status: codigo },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          timeout: TIMEOUT,
        }
      );

      setStatusModalVisible(false);

      await invalidarCache();
      await carregarPerfil();
    } catch (error: any) {
      setStatusModalVisible(false);

      setAviso({
        titulo: "Erro",
        mensagem: mensagemErro(
          error,
          error?.message || "Não foi possível alterar o status."
        ),
      });
    } finally {
      mutationRef.current = false;
      setProcessando(false);
    }
  }

  async function excluirAnuncio() {
    if (!selectedAd || mutationRef.current) return;

    mutationRef.current = true;
    setProcessando(true);

    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) throw new Error("Sua sessão não foi encontrada.");

      await api.delete(`/products/${selectedAd.id_produto}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        timeout: TIMEOUT,
      });

      const id = selectedAd.id_produto;

      setAnuncios((lista) =>
        lista.filter((produto) => produto.id_produto !== id)
      );

      setTrocados((lista) =>
        lista.filter((produto) => produto.id_produto !== id)
      );

      setDeleteModalVisible(false);
      setSelectedAd(null);

      await invalidarCache();
      await carregarPerfil();
    } catch (error: any) {
      setDeleteModalVisible(false);

      setAviso({
        titulo: "Erro",
        mensagem: mensagemErro(
          error,
          error?.message || "Não foi possível excluir o anúncio."
        ),
      });
    } finally {
      mutationRef.current = false;
      setProcessando(false);
    }
  }

  async function sairDaConta() {
    if (mutationRef.current) return;

    mutationRef.current = true;
    setProcessando(true);

    // Impede uma requisição antiga de restaurar os dados.
    requestIdRef.current += 1;

    try {
      const token = await AsyncStorage.getItem("token");

      if (token) {
        await api
          .post(
            "/logout",
            {},
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
              },
              timeout: TIMEOUT,
            }
          )
          .catch(() => {});
      }

      await invalidarCache();

      await AsyncStorage.multiRemove([
        "token",
        "usuario",
        "@pecapeca:perfil_cache_v1",
      ]);

      setLogoutModalVisible(false);

      router.replace("/(auth)/login" as any);
    } catch {
      setAviso({
        titulo: "Erro",
        mensagem: "Não foi possível encerrar a sessão local.",
      });
    } finally {
      mutationRef.current = false;
      setProcessando(false);
    }
  }

  const banner = getImageUrl(usuario?.ds_banner);
  const fotoPerfil = getImageUrl(usuario?.ds_foto_perfil);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)" as any);
            }
          }}
          accessibilityLabel="Voltar"
        >
          <Feather name="arrow-left" size={24} color="#005386" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Meu perfil</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() =>
              router.push("/perfil/configuracoes" as any)
            }
            accessibilityLabel="Configurações"
          >
            <Feather name="settings" size={22} color="#005386" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setLogoutModalVisible(true)}
            accessibilityLabel="Sair da conta"
          >
            <Feather name="log-out" size={22} color="#005386" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={visiveis}
        numColumns={2}
        keyExtractor={(item) => String(item.id_produto)}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => void carregarPerfil()}
        renderItem={({ item }) => (
          <ProductCard
            item={item}
            largura={larguraCard}
            onOpenOptions={abrirOpcoes}
          />
        )}
        ListHeaderComponent={
          <View>
            <View style={styles.bannerContainer}>
              {banner ? (
                <Image
                  source={{ uri: banner }}
                  style={styles.fullImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <Feather
                    name="image"
                    size={35}
                    color="#0099FF"
                  />
                </View>
              )}
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.avatar}>
                {fotoPerfil ? (
                  <Image
                    source={{ uri: fotoPerfil }}
                    style={styles.fullImage}
                  />
                ) : (
                  <Feather
                    name="user"
                    size={42}
                    color="#005386"
                  />
                )}
              </View>

              <View style={styles.userInfo}>
                <Text style={styles.userName}>
                  {usuario?.nm_usuario || "Usuário"}
                </Text>

                <Text style={styles.description} numberOfLines={3}>
                  {usuario?.ds_usuario || "Descrição não informada"}
                </Text>

                <TouchableOpacity
                  style={styles.editProfileButton}
                  onPress={() =>
                    router.push("/perfil/editarPerfil" as any)
                  }
                >
                  <Feather
                    name="edit-3"
                    size={14}
                    color="#FFFFFF"
                  />
                  <Text style={styles.editProfileText}>
                    Editar perfil
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsContainer}
            >
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "anuncios" && styles.activeTab,
                ]}
                onPress={() => setActiveTab("anuncios")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "anuncios" && styles.activeTabText,
                  ]}
                >
                  Anúncios
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === "trocados" && styles.activeTab,
                ]}
                onPress={() => setActiveTab("trocados")}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab === "trocados" && styles.activeTabText,
                  ]}
                >
                  Anúncios trocados
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.tab}
                onPress={() => router.push("/favoritos" as any)}
              >
                <Text style={styles.tabText}>Favoritos</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#0099FF" />
              <Text style={styles.emptyText}>
                Carregando produtos...
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>
              {activeTab === "trocados"
                ? "Você ainda não possui anúncios trocados."
                : "Você ainda não possui anúncios cadastrados."}
            </Text>
          )
        }
        ListFooterComponent={
          produtos.length > limite ? (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={() =>
                setLimite((valor) => valor + LIMITE_INICIAL)
              }
            >
              <Text style={styles.loadMoreText}>Carregar mais</Text>
              <Feather
                name="chevron-down"
                size={18}
                color="#005386"
              />
            </TouchableOpacity>
          ) : null
        }
      />

      <Modal
        visible={optionsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <View style={styles.bottomOverlay}>
          <View style={styles.bottomModal}>
            <Text style={styles.modalTitle}>
              {selectedAd?.nm_produto || "Anúncio"}
            </Text>

            <Text style={styles.modalSubtitle}>
              Escolha a ação desejada
            </Text>

            {selectedAd?.st_status !== "T" && (
              <TouchableOpacity
                style={styles.optionButton}
                onPress={editarAnuncio}
              >
                <Feather
                  name="edit-3"
                  size={20}
                  color="#005386"
                />
                <Text style={styles.optionText}>
                  Editar anúncio
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.optionButton}
              onPress={() => {
                setOptionsModalVisible(false);
                setStatusModalVisible(true);
              }}
            >
              <Feather name="sliders" size={20} color="#005386" />
              <Text style={styles.optionText}>Alterar status</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionButton, styles.deleteOption]}
              onPress={() => {
                setOptionsModalVisible(false);
                setDeleteModalVisible(true);
              }}
            >
              <Feather name="trash-2" size={20} color="#FF3B30" />
              <Text style={[styles.optionText, styles.deleteText]}>
                Excluir anúncio
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelAction}
              onPress={() => setOptionsModalVisible(false)}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={statusModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!processando) setStatusModalVisible(false);
        }}
      >
        <View style={styles.bottomOverlay}>
          <View style={styles.bottomModal}>
            <Text style={styles.modalTitle}>Alterar status</Text>

            <Text style={styles.modalSubtitle}>
              Selecione a disponibilidade do produto
            </Text>

            {OPCOES_STATUS.map((opcao) => (
              <TouchableOpacity
                key={opcao.codigo}
                style={styles.optionButton}
                onPress={() => void alterarStatus(opcao.codigo)}
                disabled={processando}
              >
                <Feather
                  name={opcao.icone}
                  size={20}
                  color={opcao.cor}
                />
                <Text style={styles.optionText}>
                  {opcao.nome}
                </Text>
              </TouchableOpacity>
            ))}

            {processando && (
              <ActivityIndicator color="#0099FF" />
            )}

            <TouchableOpacity
              style={styles.cancelAction}
              onPress={() => setStatusModalVisible(false)}
              disabled={processando}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!processando) setDeleteModalVisible(false);
        }}
      >
        <View style={styles.centerOverlay}>
          <View style={styles.dialog}>
            <Text style={[styles.modalTitle, styles.deleteText]}>
              Excluir anúncio?
            </Text>

<Text style={styles.dialogMessage}>
  {`Deseja remover o anúncio "${selectedAd?.nm_produto ?? ""}"?`}
</Text>

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setDeleteModalVisible(false)}
                disabled={processando}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, styles.redButton]}
                onPress={() => void excluirAnuncio()}
                disabled={processando}
              >
                {processando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.whiteText}>Excluir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!processando) setLogoutModalVisible(false);
        }}
      >
        <View style={styles.centerOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.modalTitle}>
              Deseja sair da conta?
            </Text>

            <Text style={styles.dialogMessage}>
              Sua sessão atual será encerrada.
            </Text>

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setLogoutModalVisible(false)}
                disabled={processando}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => void sairDaConta()}
                disabled={processando}
              >
                {processando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.whiteText}>Sair</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={aviso !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAviso(null)}
      >
        <View style={styles.centerOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.modalTitle}>
              {aviso?.titulo}
            </Text>

            <Text style={styles.dialogMessage}>
              {aviso?.mensagem}
            </Text>

            <TouchableOpacity
              style={styles.okButton}
              onPress={() => setAviso(null)}
            >
              <Text style={styles.whiteText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    color: "#005386",
    fontSize: 16,
    fontFamily: "Montserrat_700Bold",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  bannerContainer: {
    height: 150,
    marginTop: 15,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#E4F8FF",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
  bannerPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    overflow: "hidden",
    backgroundColor: "#E4F8FF",
    borderWidth: 1.5,
    borderColor: "#0099FF",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  userName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 19,
    color: "#005386",
  },
  description: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: "#777777",
    marginTop: 5,
    lineHeight: 19,
  },
  editProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#0099FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  editProfileText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    color: "#FFFFFF",
    marginLeft: 5,
  },
  tabsContainer: {
    marginVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  tab: {
    marginRight: 22,
    paddingBottom: 10,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#0099FF",
  },
  tabText: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: "#888888",
  },
  activeTabText: {
    fontFamily: "Montserrat_700Bold",
    color: "#005386",
  },
  gridRow: {
    justifyContent: "space-between",
  },
  listingCard: {
    marginBottom: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    overflow: "hidden",
  },
  galeria: {
    width: "100%",
    position: "relative",
    backgroundColor: "#F5FBFF",
    overflow: "hidden",
  },
  productImage: {
    width: "100%",
    height: "100%",
  },
  fotoVazia: {
    flex: 1,
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5FBFF",
  },
  setaFoto: {
    position: "absolute",
    top: "50%",
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    elevation: 3,
  },
  setaEsquerda: {
    left: 5,
  },
  setaDireita: {
    right: 5,
  },
  contadorFoto: {
    position: "absolute",
    right: 7,
    top: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  contadorTexto: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Montserrat_600SemiBold",
  },
  paginacao: {
    position: "absolute",
    bottom: 3,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
  },
  areaPonto: {
    width: 23,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  ponto: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D7E6EF",
  },
  pontoAtivo: {
    width: 13,
    backgroundColor: "#0099FF",
  },
  trocadoBadge: {
    position: "absolute",
    left: 7,
    top: 7,
    borderRadius: 8,
    backgroundColor: "#005386",
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  trocadoTexto: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: "Montserrat_600SemiBold",
  },
  cardInfo: {
    padding: 9,
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
    marginTop: 4,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  listingCondition: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
  },
  loadingBox: {
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Montserrat_400Regular",
    color: "#888888",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F1FAFF",
    borderWidth: 1,
    borderColor: "#DCEEFA",
  },
  loadMoreText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#005386",
  },
  bottomOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  bottomModal: {
    padding: 20,
    paddingBottom: 30,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#005386",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: "#777777",
    textAlign: "center",
    marginBottom: 18,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#F5FBFF",
    marginBottom: 10,
  },
  optionText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
    marginLeft: 12,
  },
  deleteOption: {
    backgroundColor: "#FFF0F0",
  },
  deleteText: {
    color: "#FF3B30",
  },
  cancelAction: {
    alignItems: "center",
    paddingVertical: 12,
  },
  cancelText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
  },
  centerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 24,
  },
  dialogMessage: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#666666",
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  dialogActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#0099FF",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#0099FF",
    alignItems: "center",
    justifyContent: "center",
  },
  redButton: {
    backgroundColor: "#FF3B30",
  },
  whiteText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  okButton: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: "#0099FF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
});