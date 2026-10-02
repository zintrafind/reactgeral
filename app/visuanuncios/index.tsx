import { Feather, Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";

// =========================================================
// TIPOS
// =========================================================
type GalleryPhoto = { key: string; uri: string };
type GalleryHandle = { goToIndex: (index: number, animated?: boolean) => void };
type GalleryProps = {
  photos: GalleryPhoto[];
  initialIndex?: number;
  fullscreen?: boolean;
  onIndexChange?: (index: number) => void;
  onOpen?: () => void;
  stageHeight?: number;
};

const THUMB_SIZE = 62;
const THUMB_GAP = 8;

// Breakpoint: a partir daqui vira layout de 2 colunas no web
const DESKTOP_BREAKPOINT = 1024;
// Largura máxima do conteúdo inteiro em desktop (para não esticar em telas ultra-wide)
const DESKTOP_MAX_WIDTH = 1440;
// Largura máxima do conteúdo em mobile/tablet
const MOBILE_MAX_WIDTH = 760;

const clampPhotoIndex = (index: number, count: number) =>
  Math.max(0, Math.min(Math.round(index), Math.max(0, count - 1)));

// =========================================================
// IMAGEM COM FEEDBACK DE LOAD / ERRO
// =========================================================
function GalleryImage({
  uri,
  thumbnail = false,
  dark = false,
}: {
  uri: string;
  thumbnail?: boolean;
  dark?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [uri, attempt]);

  return (
    <View style={galleryStyles.photoBody}>
      {!failed && (
        <Image
          key={`${uri}-${attempt}`}
          source={{ uri }}
          resizeMode="contain"
          style={galleryStyles.photo}
          accessibilityIgnoresInvertColors
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
        />
      )}
      {!loaded && !thumbnail && (
        <View pointerEvents="none" style={galleryStyles.imageFeedback}>
          <ActivityIndicator size="small" color={dark ? "#FFFFFF" : "#0099FF"} />
        </View>
      )}
      {failed && (
        <View style={galleryStyles.imageFeedback}>
          <Feather name="image" size={thumbnail ? 19 : 36} color="#94A3B8" />
          {!thumbnail && (
            <>
              <Text style={[galleryStyles.imageErrorText, dark && galleryStyles.lightText]}>
                Não foi possível carregar esta foto.
              </Text>
              <TouchableOpacity
                onPress={(event) => {
                  event.stopPropagation();
                  setAttempt((value) => value + 1);
                }}
                style={galleryStyles.retryButton}
                accessibilityRole="button"
                accessibilityLabel="Tentar carregar a foto novamente"
              >
                <Text style={galleryStyles.retryText}>Tentar novamente</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// =========================================================
// CARROSSEL
// =========================================================
const PhotoCarousel = React.forwardRef<GalleryHandle, GalleryProps>(function PhotoCarousel(
  {
    photos,
    initialIndex = 0,
    fullscreen = false,
    onIndexChange,
    onOpen,
    stageHeight: stageHeightProp,
  },
  forwardedRef,
) {
  const scrollRef = useRef<ScrollView>(null);
  const thumbsRef = useRef<ScrollView>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [thumbsWidth, setThumbsWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(() =>
    clampPhotoIndex(initialIndex, photos.length),
  );
  const indexRef = useRef(activeIndex);
  const targetRef = useRef<number | null>(null);
  const offsetRef = useRef(0);
  const mouseDraggingRef = useRef(false);
  const suppressClickUntilRef = useRef(0);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionedRef = useRef(false);
  const changeCallbackRef = useRef(onIndexChange);
  changeCallbackRef.current = onIndexChange;

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const commitIndex = useCallback(
    (index: number) => {
      const next = clampPhotoIndex(index, photos.length);
      if (next !== indexRef.current) {
        indexRef.current = next;
        setActiveIndex(next);
        changeCallbackRef.current?.(next);
      }
    },
    [photos.length],
  );

  const goToIndex = useCallback(
    (index: number, animated = true) => {
      if (!photos.length || viewportWidth <= 0) return;
      clearSettleTimer();
      const next = clampPhotoIndex(index, photos.length);
      targetRef.current = next;
      scrollRef.current?.scrollTo({ x: next * viewportWidth, y: 0, animated });
      if (!animated) {
        offsetRef.current = next * viewportWidth;
        commitIndex(next);
        targetRef.current = null;
      }
    },
    [clearSettleTimer, commitIndex, photos.length, viewportWidth],
  );

  useImperativeHandle(forwardedRef, () => ({ goToIndex }), [goToIndex]);

  const moveBy = useCallback(
    (direction: number) => {
      goToIndex((targetRef.current ?? indexRef.current) + direction);
    },
    [goToIndex],
  );

  useLayoutEffect(() => {
    if (viewportWidth <= 0) return;
    const next = clampPhotoIndex(indexRef.current, photos.length);
    positionedRef.current = false;
    goToIndex(next, false);
    const frame = requestAnimationFrame(() => {
      goToIndex(next, false);
      positionedRef.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [viewportWidth, photos.length, goToIndex]);

  useEffect(() => {
    if (thumbsWidth <= 0) return;
    const centeredOffset =
      activeIndex * (THUMB_SIZE + THUMB_GAP) + THUMB_SIZE / 2 + 2 - thumbsWidth / 2;
    thumbsRef.current?.scrollTo({ x: Math.max(0, centeredOffset), y: 0, animated: true });
  }, [activeIndex, thumbsWidth]);

  useEffect(() => () => clearSettleTimer(), [clearSettleTimer]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!positionedRef.current || viewportWidth <= 0) return;
      if (Math.abs(event.nativeEvent.layoutMeasurement.width - viewportWidth) > 1) return;
      const x = event.nativeEvent.contentOffset.x;
      offsetRef.current = x;
      commitIndex(x / viewportWidth);

      if (Platform.OS === "web") {
        clearSettleTimer();
        settleTimerRef.current = setTimeout(() => {
          settleTimerRef.current = null;
          if (mouseDraggingRef.current) return;
          const next = clampPhotoIndex(offsetRef.current / viewportWidth, photos.length);
          targetRef.current = null;
          if (Math.abs(offsetRef.current - next * viewportWidth) > 1) {
            goToIndex(next);
          }
        }, 180);
      }
    },
    [clearSettleTimer, commitIndex, goToIndex, photos.length, viewportWidth],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!positionedRef.current || viewportWidth <= 0) return;
      if (Math.abs(event.nativeEvent.layoutMeasurement.width - viewportWidth) > 1) return;
      offsetRef.current = event.nativeEvent.contentOffset.x;
      commitIndex(offsetRef.current / viewportWidth);
      targetRef.current = null;
    },
    [commitIndex, viewportWidth],
  );

  // Arraste com mouse (web)
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || viewportWidth <= 0) return;
    const webScroll = scrollRef.current as
      | (ScrollView & {
          getScrollableNode?: () => HTMLElement;
        })
      | null;
    const node = webScroll?.getScrollableNode?.();
    if (!node?.addEventListener) return;

    let pointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startOffset = 0;
    let savedSnap = "";
    let savedBehavior = "";
    let savedCursor = "";

    const restoreStyles = () => {
      node.style.scrollSnapType = savedSnap;
      node.style.scrollBehavior = savedBehavior;
      node.style.cursor = savedCursor;
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.button !== 0 || photos.length < 2) return;
      clearSettleTimer();
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startOffset = node.scrollLeft;
      targetRef.current = null;
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!mouseDraggingRef.current) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
          pointerId = null;
          return;
        }
        if (Math.abs(dx) < 6) return;
        mouseDraggingRef.current = true;
        savedSnap = node.style.scrollSnapType;
        savedBehavior = node.style.scrollBehavior;
        savedCursor = node.style.cursor;
        node.style.scrollSnapType = "none";
        node.style.scrollBehavior = "auto";
        node.style.cursor = "grabbing";
      }
      event.preventDefault();
      suppressClickUntilRef.current = Date.now() + 350;
      node.scrollLeft = startOffset - dx;
    };
    const finishDrag = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      if (!mouseDraggingRef.current) return;
      mouseDraggingRef.current = false;
      suppressClickUntilRef.current = Date.now() + 350;
      const currentOffset = node.scrollLeft;
      restoreStyles();
      offsetRef.current = currentOffset;
      goToIndex(clampPhotoIndex(currentOffset / viewportWidth, photos.length));
    };
    const handleClick = (event: MouseEvent) => {
      if (Date.now() >= suppressClickUntilRef.current) return;
      event.preventDefault();
      event.stopPropagation();
    };
    const preventImageDrag = (event: Event) => event.preventDefault();

    node.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove, { passive: false });
    document.addEventListener("pointerup", finishDrag);
    document.addEventListener("pointercancel", finishDrag);
    node.addEventListener("click", handleClick, true);
    node.addEventListener("dragstart", preventImageDrag);
    return () => {
      node.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", finishDrag);
      document.removeEventListener("pointercancel", finishDrag);
      node.removeEventListener("click", handleClick, true);
      node.removeEventListener("dragstart", preventImageDrag);
      if (mouseDraggingRef.current) restoreStyles();
      mouseDraggingRef.current = false;
    };
  }, [clearSettleTimer, goToIndex, photos.length, viewportWidth]);

  const openPhoto = () => {
    if (Date.now() < suppressClickUntilRef.current) return;
    onOpen?.();
  };

  // Altura do stage: usa prop (calculada pelo parent com base no layout),
  // ou fallback baseado na largura
  const stageHeight =
    stageHeightProp ?? Math.min(560, Math.max(280, viewportWidth * 0.94));

  return (
    <View style={[galleryStyles.carousel, fullscreen && galleryStyles.fullscreenCarousel]}>
      <View
        testID={fullscreen ? "fullscreen-gallery-stage" : "product-gallery-stage"}
        style={[
          galleryStyles.stage,
          fullscreen ? galleryStyles.fullscreenStage : { height: stageHeight },
        ]}
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0 && Math.abs(viewportWidth - nextWidth) > 0.5) {
            positionedRef.current = false;
            clearSettleTimer();
            setViewportWidth(nextWidth);
          }
        }}
      >
        {photos.length === 0 ? (
          <View style={galleryStyles.emptyState}>
            <View style={galleryStyles.emptyIcon}>
              <Feather name="image" size={35} color="#94A3B8" />
            </View>
            <Text style={galleryStyles.emptyTitle}>Este anúncio ainda não tem fotos</Text>
          </View>
        ) : viewportWidth > 0 ? (
          <>
            <ScrollView
              ref={scrollRef}
              testID={fullscreen ? "fullscreen-gallery-scroll" : "product-gallery-scroll"}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              directionalLockEnabled
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              decelerationRate="fast"
              style={galleryStyles.pager}
              onScroll={handleScroll}
              onMomentumScrollEnd={handleScrollEnd}
              onScrollEndDrag={handleScrollEnd}
              onScrollBeginDrag={() => {
                clearSettleTimer();
                targetRef.current = null;
              }}
            >
              {photos.map((photo, index) => (
                <Pressable
                  key={photo.key}
                  onPress={fullscreen ? undefined : openPhoto}
                  accessibilityRole={fullscreen ? "image" : "button"}
                  accessibilityLabel={`Foto ${index + 1} de ${photos.length}${fullscreen ? "" : ". Ampliar foto"}`}
                  style={[
                    galleryStyles.slide,
                    { width: viewportWidth },
                    fullscreen && galleryStyles.fullscreenSlide,
                  ]}
                >
                  <GalleryImage uri={photo.uri} dark={fullscreen} />
                </Pressable>
              ))}
            </ScrollView>

            {!fullscreen && (
              <TouchableOpacity
                style={galleryStyles.expandButton}
                onPress={openPhoto}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Ver foto em tela cheia"
              >
                <Feather name="maximize" size={18} color="#0F172A" />
              </TouchableOpacity>
            )}

            {photos.length > 1 && (
              <>
                <TouchableOpacity
                  style={[
                    galleryStyles.arrow,
                    galleryStyles.arrowLeft,
                    activeIndex === 0 && galleryStyles.arrowDisabled,
                  ]}
                  onPress={() => moveBy(-1)}
                  disabled={activeIndex === 0}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Foto anterior"
                  accessibilityState={{ disabled: activeIndex === 0 }}
                >
                  <Feather name="chevron-left" size={23} color="#0F172A" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    galleryStyles.arrow,
                    galleryStyles.arrowRight,
                    activeIndex === photos.length - 1 && galleryStyles.arrowDisabled,
                  ]}
                  onPress={() => moveBy(1)}
                  disabled={activeIndex === photos.length - 1}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel="Próxima foto"
                  accessibilityState={{ disabled: activeIndex === photos.length - 1 }}
                >
                  <Feather name="chevron-right" size={23} color="#0F172A" />
                </TouchableOpacity>
              </>
            )}

            <View pointerEvents="none" style={galleryStyles.counter}>
              <Feather name="image" size={13} color="#FFFFFF" />
              <Text
                testID={fullscreen ? "fullscreen-gallery-counter" : "product-gallery-counter"}
                style={galleryStyles.counterText}
                accessibilityLabel={`Foto ${activeIndex + 1} de ${photos.length}`}
              >
                {activeIndex + 1} / {photos.length}
              </Text>
            </View>
          </>
        ) : null}
      </View>

      {photos.length > 1 && (
        <ScrollView
          ref={thumbsRef}
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={galleryStyles.thumbnails}
          contentContainerStyle={galleryStyles.thumbnailsContent}
          onLayout={(event) => setThumbsWidth(event.nativeEvent.layout.width)}
        >
          {photos.map((photo, index) => (
            <TouchableOpacity
              key={photo.key}
              onPress={() => goToIndex(index)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Selecionar foto ${index + 1}`}
              accessibilityState={{ selected: index === activeIndex }}
              style={[
                galleryStyles.thumbnail,
                fullscreen && galleryStyles.darkThumbnail,
                index === activeIndex && galleryStyles.selectedThumbnail,
              ]}
            >
              <GalleryImage uri={photo.uri} thumbnail dark={fullscreen} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
});

// =========================================================
// GALERIA COMPLETA
// =========================================================
function ProductGallery({
  photos,
  title,
  stageHeight,
}: {
  photos: GalleryPhoto[];
  title: string;
  stageHeight?: number;
}) {
  const galleryRef = useRef<GalleryHandle>(null);
  const viewerRef = useRef<GalleryHandle>(null);
  const currentIndexRef = useRef(0);
  const viewerIndexRef = useRef(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  const openViewer = () => {
    if (!photos.length) return;
    viewerIndexRef.current = currentIndexRef.current;
    setViewerInitialIndex(currentIndexRef.current);
    setViewerVisible(true);
  };
  const closeViewer = useCallback(() => {
    galleryRef.current?.goToIndex(viewerIndexRef.current, false);
    currentIndexRef.current = viewerIndexRef.current;
    setViewerVisible(false);
  }, []);

  useEffect(() => {
    if (!viewerVisible || Platform.OS !== "web" || typeof window === "undefined") return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeViewer();
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        viewerRef.current?.goToIndex(
          viewerIndexRef.current + (event.key === "ArrowRight" ? 1 : -1),
        );
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeViewer, viewerVisible]);

  return (
    <View style={galleryStyles.gallerySection}>
      <PhotoCarousel
        ref={galleryRef}
        photos={photos}
        onOpen={openViewer}
        onIndexChange={(index) => {
          currentIndexRef.current = index;
        }}
        stageHeight={stageHeight}
      />
      <Modal
        visible={viewerVisible}
        transparent={false}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={closeViewer}
      >
        <SafeAreaView style={galleryStyles.viewer} edges={["top", "bottom", "left", "right"]}>
          <View style={galleryStyles.viewerHeader}>
            <View style={galleryStyles.viewerHeaderText}>
              <Text style={galleryStyles.viewerEyebrow}>FOTOS DO ANÚNCIO</Text>
              <Text style={galleryStyles.viewerTitle} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <TouchableOpacity
              style={galleryStyles.viewerClose}
              onPress={closeViewer}
              accessibilityRole="button"
              accessibilityLabel="Fechar fotos em tela cheia"
            >
              <Feather name="x" size={23} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {viewerVisible && (
            <PhotoCarousel
              ref={viewerRef}
              photos={photos}
              fullscreen
              initialIndex={viewerInitialIndex}
              onIndexChange={(index) => {
                viewerIndexRef.current = index;
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// =========================================================
// TELA PRINCIPAL
// =========================================================
export default function ProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const productId = Array.isArray(id) ? id[0] : id;
  const { width: windowWidth } = useWindowDimensions();

  // Layout: 2 colunas em desktop
  const isDesktop = Platform.OS === "web" && windowWidth >= DESKTOP_BREAKPOINT;

  // Largura do conteúdo total
  const contentWidth = Math.min(windowWidth, isDesktop ? DESKTOP_MAX_WIDTH : MOBILE_MAX_WIDTH);

  // Em desktop: galeria ocupa ~55%, info ~45% (com gap de 32)
  const contentInnerWidth = contentWidth - 32; // padding lateral 16*2
  const galleryWidth = isDesktop
    ? Math.floor((contentInnerWidth - 32) * 0.55)
    : contentInnerWidth;

  // Altura do stage: em desktop usa min(560, altura da janela * 0.72);
  // em mobile/tablet, mantém proporcional à largura
  const stageHeight = useMemo(() => {
    if (isDesktop) {
      return Math.min(560, Math.max(380, galleryWidth * 0.78));
    }
    return Math.min(520, Math.max(260, galleryWidth * 0.94));
  }, [galleryWidth, isDesktop]);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // TROCA
  const [solicitandoTroca, setSolicitandoTroca] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [meusProdutos, setMeusProdutos] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  // FAVORITOS
  const [enviandoProposta, setEnviandoProposta] = useState(false);
  const propostaEmEnvioRef = useRef(false);
  const [favoritado, setFavoritado] = useState(false);
  const [carregandoFavorito, setCarregandoFavorito] = useState(false);

  const getImageUrl = (imagePath?: string | null) => {
    if (!imagePath) return null;
    const path = String(imagePath).trim();
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    const baseUrl = api.defaults.baseURL?.replace(/\/api\/?$/, "") || "http://127.0.0.1:8000";
    const cleanPath = path
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/^(?:storage\/app\/public|public\/storage|public|storage)\/+/, "");
    return `${baseUrl}/storage/${cleanPath}`;
  };

  const getCondicaoTexto = (condicao?: string) => {
    switch (condicao) {
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
  };

  useEffect(() => {
    buscarProduto();
  }, [productId]);

  const buscarProduto = async () => {
    try {
      setLoading(true);
      if (!productId) {
        setProduct(null);
        return;
      }
      const response = await api.get(`/products/${encodeURIComponent(productId)}`, {
        headers: { Accept: "application/json" },
      });
      const data = response.data;
      console.log("PRODUTO DETALHADO:", JSON.stringify(data, null, 2));
      setProduct(data);
      verificarFavorito(data);
    } catch (error) {
      console.error("Erro ao buscar produto:", error);
      Alert.alert("Erro", "Não foi possível carregar os dados do produto.");
    } finally {
      setLoading(false);
    }
  };

  const verificarFavorito = async (produtoAtual: any) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !produtoAtual?.id_produto) return;
      const response = await api.get("/favoritos", {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = response.data;
      const favoritos = Array.isArray(data) ? data : data?.favoritos || data?.data || [];
      const encontrado = favoritos.some(
        (item: any) =>
          Number(item.id_produto) === Number(produtoAtual.id_produto) ||
          Number(item.produto?.id_produto) === Number(produtoAtual.id_produto),
      );
      setFavoritado(encontrado);
    } catch (error) {
      console.error("Erro ao verificar favorito:", error);
    }
  };

  const handleFavorito = async () => {
    if (carregandoFavorito) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Atenção", "Você precisa estar logado para favoritar um produto.");
        return;
      }
      if (!product?.id_produto) return;
      setCarregandoFavorito(true);
      if (favoritado) {
        await api.delete(`/favoritos/${product.id_produto}`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
        setFavoritado(false);
      } else {
        await api.post(
          "/favoritos",
          { id_produto: Number(product.id_produto) },
          { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
        );
        setFavoritado(true);
      }
    } catch (error) {
      console.error("Erro favorito:", error);
      Alert.alert("Erro", "Não foi possível atualizar os favoritos.");
    } finally {
      setCarregandoFavorito(false);
    }
  };

  const handleSolicitarTroca = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Atenção", "Você precisa estar logado para solicitar uma troca.");
        return;
      }
      if (!product?.id_produto) return;
      setSolicitandoTroca(true);
      const meusProdutosResponse = await api.get("/my-products", {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const meusProdutosData = meusProdutosResponse.data;
      const produtos = Array.isArray(meusProdutosData)
        ? meusProdutosData
        : meusProdutosData?.products || meusProdutosData?.produtos || [];
      const produtosDisponiveis = produtos.filter(
        (item: any) =>
          item.st_status === "A" && Number(item.id_produto) !== Number(product.id_produto),
      );
      if (produtosDisponiveis.length === 0) {
        Alert.alert(
          "Sem produtos disponíveis",
          "Você não possui outros produtos disponíveis para oferecer em uma troca.",
        );
        return;
      }
      setMeusProdutos(produtosDisponiveis);
      setSelectedProductId(null);
      setModalVisible(true);
    } catch (error) {
      console.error("Erro ao solicitar troca:", error);
      Alert.alert("Erro", "Não foi possível carregar seus produtos.");
    } finally {
      setSolicitandoTroca(false);
    }
  };

  const handleConfirmarTroca = async () => {
    if (propostaEmEnvioRef.current) return;
    propostaEmEnvioRef.current = true;
    setEnviandoProposta(true);
    try {
      if (!selectedProductId) {
        Alert.alert("Atenção", "Selecione um produto para oferecer.");
        return;
      }
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Atenção", "Você precisa estar logado para realizar uma troca.");
        return;
      }
      await api.post(
        "/propostas",
        {
          id_produto_desejado: Number(product.id_produto),
          id_produto_oferecido: Number(selectedProductId),
        },
        { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
      );
      setModalVisible(false);
      setSelectedProductId(null);
      Alert.alert("Sucesso", "Sua proposta de troca foi enviada!");
      router.push("/trocas" as any);
    } catch (error: any) {
      console.error("Erro ao confirmar troca:", error);
      Alert.alert(
        "Erro",
        error?.response?.data?.message ||
          error?.message ||
          "Não foi possível enviar a proposta de troca.",
      );
    } finally {
      propostaEmEnvioRef.current = false;
      setEnviandoProposta(false);
    }
  };

  const handleVisualizarPerfil = () => {
    const idUsuario =
      product?.user?.id_usuario ?? product?.user?.id ?? product?.id_usuario ?? product?.user_id;
    if (!idUsuario) {
      Alert.alert("Erro", "Não foi possível identificar o usuário.");
      return;
    }
    router.push(`/visualizarperfil?id=${idUsuario}` as any);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0099FF" />
        <Text style={styles.loadingText}>Carregando produto...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loadingContainer}>
        <Feather name="package" size={50} color="#CCCCCC" />
        <Text style={styles.loadingText}>Produto não encontrado.</Text>
      </View>
    );
  }

  const rawImages = Array.isArray(product.images)
    ? product.images
    : Array.isArray(product.imagens)
      ? product.imagens
      : [];
  const photos: GalleryPhoto[] = rawImages
    .map((image: any, index: number) => ({ image, index }))
    .sort((a: any, b: any) => {
      const orderA = Number(a.image?.nr_ordem ?? a.index);
      const orderB = Number(b.image?.nr_ordem ?? b.index);
      return (
        (Number.isFinite(orderA) ? orderA : a.index) - (Number.isFinite(orderB) ? orderB : b.index)
      );
    })
    .map(({ image, index }: { image: any; index: number }) => {
      const uri = getImageUrl(
        typeof image === "string" ? image : image?.ds_imagem || image?.url || image?.imagem,
      );
      return uri
        ? {
            key:
              String(image?.id_imagem ?? image?.id_imagem_produto ?? image?.id ?? index) +
              "-" +
              index,
            uri,
          }
        : null;
    })
    .filter((photo: GalleryPhoto | null): photo is GalleryPhoto => photo !== null);
  if (photos.length === 0) {
    const fallback = getImageUrl(product.ds_imagem || product.imagem);
    if (fallback) photos.push({ key: "principal", uri: fallback });
  }
  const fotoPerfil = product?.user?.ds_foto_perfil || product?.user?.ds_foto;
  const fotoPerfilUrl = getImageUrl(fotoPerfil);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.innerContent, { maxWidth: isDesktop ? DESKTOP_MAX_WIDTH : MOBILE_MAX_WIDTH }]}>
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
              <Feather name="arrow-left" size={23} color="#005386" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Detalhes do anúncio</Text>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleFavorito}
              disabled={carregandoFavorito}
            >
              {carregandoFavorito ? (
                <ActivityIndicator size="small" color="#0099FF" />
              ) : (
                <Ionicons
                  name={favoritado ? "heart" : "heart-outline"}
                  size={25}
                  color={favoritado ? "#0099FF" : "#005386"}
                />
              )}
            </TouchableOpacity>
          </View>

          {/* CONTEÚDO — 1 coluna mobile / 2 colunas desktop */}
          <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
            {/* COLUNA ESQUERDA — GALERIA */}
            <View style={[styles.galleryColumn, isDesktop && { width: galleryWidth }]}>
              <ProductGallery
                key={String(product.id_produto)}
                photos={photos}
                title={product.nm_produto || "Anúncio"}
                stageHeight={stageHeight}
              />
            </View>

            {/* COLUNA DIREITA — INFO + ANUNCIANTE + TROCA */}
            <View style={[styles.infoColumn, isDesktop && styles.infoColumnDesktop]}>
              <View style={styles.productInfo}>
                <Text style={styles.productTitle}>{product.nm_produto}</Text>
                {product.categoria?.nm_categoria && (
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{product.categoria.nm_categoria}</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <View style={styles.infoItem}>
                    <Feather name="check-circle" size={17} color="#0099FF" />
                    <Text style={styles.infoText}>{getCondicaoTexto(product.st_condicao)}</Text>
                  </View>
                </View>
                {product.ds_produto && (
                  <>
                    <Text style={styles.sectionTitle}>Descrição</Text>
                    <Text style={styles.description}>{product.ds_produto}</Text>
                  </>
                )}
              </View>

              {product.user && (
                <View style={styles.sellerSection}>
                  <Text style={styles.sectionTitle}>Anunciante</Text>
                  <TouchableOpacity
                    style={styles.sellerCard}
                    activeOpacity={0.7}
                    onPress={handleVisualizarPerfil}
                  >
                    <View style={styles.sellerImageContainer}>
                      {fotoPerfilUrl ? (
                        <Image
                          source={{ uri: fotoPerfilUrl }}
                          style={styles.userProfileImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Feather name="user" size={22} color="#0099FF" />
                      )}
                    </View>
                    <View style={styles.sellerInfo}>
                      <Text style={styles.sellerName}>{product.user.nm_usuario}</Text>
                      <Text style={styles.sellerAction}>Visualizar perfil</Text>
                    </View>
                    <Feather name="chevron-right" size={22} color="#0099FF" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.exchangeSection}>
                <TouchableOpacity
                  style={styles.exchangeButton}
                  activeOpacity={0.8}
                  onPress={handleSolicitarTroca}
                  disabled={solicitandoTroca}
                >
                  {solicitandoTroca ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="repeat" size={20} color="#FFFFFF" />
                      <Text style={styles.exchangeButtonText}>Solicitar troca</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* MODAL SOLICITAR TROCA */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdropTouch}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalBackButton}
              >
                <Feather name="arrow-left" size={22} color="#005386" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Solicitar Troca</Text>
              <View style={styles.modalHeaderSpacer} />
            </View>
            <FlatList
              data={meusProdutos}
              keyExtractor={(item) => String(item.id_produto)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalListContent}
              ListHeaderComponent={
                <View>
                  <View style={styles.targetProductCard}>
                    <View style={styles.targetImageContainer}>
                      {(() => {
                        const imagemProduto = product?.images?.[0]?.ds_imagem;
                        const imagemUrl = getImageUrl(imagemProduto);
                        if (imagemUrl) {
                          return (
                            <Image
                              source={{ uri: imagemUrl }}
                              style={styles.targetProductImage}
                              resizeMode="cover"
                            />
                          );
                        }
                        return <Feather name="package" size={22} color="#0099FF" />;
                      })()}
                    </View>
                    <View style={styles.targetInfo}>
                      <Text style={styles.targetLabel}>Você deseja:</Text>
                      <Text style={styles.targetTitle} numberOfLines={1}>
                        {product.nm_produto}
                      </Text>
                      <Text style={styles.targetCondition}>
                        {getCondicaoTexto(product.st_condicao)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.modalDivider} />
                  <Text style={styles.modalSectionTitle}>
                    Selecione o item que você vai oferecer:
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const isSelected = selectedProductId === String(item.id_produto);
                const imagemProduto =
                  item.images?.[0]?.ds_imagem ||
                  item.imagens?.[0]?.ds_imagem ||
                  item.ds_imagem ||
                  item.imagem;
                const imagemUrl = getImageUrl(imagemProduto);
                return (
                  <TouchableOpacity
                    style={[styles.myProductCard, isSelected && styles.myProductCardSelected]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedProductId(String(item.id_produto))}
                  >
                    <View style={styles.myProductImageContainer}>
                      {imagemUrl ? (
                        <Image
                          source={{ uri: imagemUrl }}
                          style={styles.myProductImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Feather name="package" size={22} color="#0099FF" />
                      )}
                    </View>
                    <View style={styles.myProductInfo}>
                      <Text style={styles.myProductTitle} numberOfLines={1}>
                        {item.nm_produto}
                      </Text>
                      <Text style={styles.myProductCondition}>
                        {getCondicaoTexto(item.st_condicao)}
                      </Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Feather name="check" size={13} color="#FFFFFF" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
            <View style={styles.modalFooterContainer}>
              <TouchableOpacity
                style={[
                  styles.confirmButton,
                  (!selectedProductId || enviandoProposta) && styles.confirmButtonDisabled,
                ]}
                activeOpacity={0.8}
                disabled={!selectedProductId || enviandoProposta}
                onPress={handleConfirmarTroca}
              >
                {enviandoProposta ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirmar Proposta</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =============================================================
// ESTILOS
// =============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  scrollContent: { paddingBottom: 40 },
  innerContent: {
    width: "100%",
    alignSelf: "center",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  loadingText: {
    marginTop: 12,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#777777",
  },

  // HEADER
  header: {
    height: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 0,
    borderBottomColor: "transparent",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: "#005386",
  },

  // LAYOUT (1 col mobile / 2 col desktop)
  layout: {
    flexDirection: "column",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 24,
  },
  layoutDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 32,
  },

  galleryColumn: {
    width: "100%",
  },

  infoColumn: {
    width: "100%",
  },
  infoColumnDesktop: {
    flex: 1,
  },

  // PRODUTO
  productInfo: { paddingTop: 4 },
  productTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 22,
    color: "#005386",
    marginBottom: 10,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E4F8FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  categoryText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 11,
    color: "#0099FF",
  },
  infoRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  infoItem: { flexDirection: "row", alignItems: "center" },
  infoText: {
    marginLeft: 7,
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: "#555555",
  },
  sectionTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: "#005386",
    marginBottom: 10,
  },
  description: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: "#555555",
  },

  // ANUNCIANTE
  sellerSection: { marginTop: 25 },
  sellerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FCFF",
    borderWidth: 1,
    borderColor: "#E1F3FF",
    borderRadius: 12,
    padding: 12,
  },
  sellerImageContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  userProfileImage: { width: "100%", height: "100%" },
  sellerInfo: { flex: 1, marginLeft: 12 },
  sellerName: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: "#005386",
  },
  sellerAction: {
    marginTop: 3,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#0099FF",
  },

  // TROCA
  exchangeSection: { marginTop: 25 },
  exchangeButton: {
    height: 52,
    borderRadius: 10,
    backgroundColor: "#005386",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#005386",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  exchangeButtonText: {
    marginLeft: 8,
    fontFamily: "Montserrat_700Bold",
    fontSize: 15,
    color: "#FFFFFF",
  },

  // MODAL
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdropTouch: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalContent: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  modalHeader: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  modalBackButton: {
    width: 30,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  modalHeaderTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 16,
    color: "#005386",
  },
  modalHeaderSpacer: { width: 30 },
  modalListContent: { padding: 20, paddingBottom: 20 },

  targetProductCard: {
    flexDirection: "row",
    backgroundColor: "#E4F8FF",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#0099FF",
  },
  targetImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  targetProductImage: { width: "100%", height: "100%", borderRadius: 6 },
  targetInfo: { marginLeft: 10, flex: 1 },
  targetLabel: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#005386",
    marginBottom: 2,
  },
  targetTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 13,
    color: "#005386",
  },
  targetCondition: {
    marginTop: 3,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#0099FF",
  },
  modalDivider: { height: 1, backgroundColor: "#EEEEEE", marginVertical: 14 },
  modalSectionTitle: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#005386",
    marginBottom: 10,
  },

  myProductCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEEEEE",
    marginBottom: 8,
  },
  myProductCardSelected: {
    borderColor: "#0099FF",
    backgroundColor: "#E4F8FF",
  },
  myProductImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  myProductImage: { width: "100%", height: "100%", borderRadius: 8 },
  myProductInfo: { marginLeft: 10, flex: 1 },
  myProductTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#333333",
  },
  myProductCondition: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#CCCCCC",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: { backgroundColor: "#0099FF", borderColor: "#0099FF" },

  modalFooterContainer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    backgroundColor: "#FFFFFF",
  },
  confirmButton: {
    backgroundColor: "#0099FF",
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  confirmButtonDisabled: { backgroundColor: "#B3E5FF" },
  confirmButtonText: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 14,
    color: "#FFFFFF",
  },
});

const galleryStyles = StyleSheet.create({
  gallerySection: { width: "100%" },
  carousel: { width: "100%" },
  stage: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  pager: { flex: 1, width: "100%" },
  slide: { height: "100%", padding: 0, justifyContent: "center", alignItems: "center" },
  photoBody: { width: "100%", height: "100%", position: "relative" },
  photo: { width: "100%", height: "100%" },
  imageFeedback: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  imageErrorText: {
    marginTop: 12,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },
  lightText: { color: "#CBD5E1" },
  retryButton: { marginTop: 8, paddingHorizontal: 12, paddingVertical: 10 },
  retryText: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: "#0099FF" },
  expandButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.94)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -21,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
  },
  arrowLeft: { left: 10 },
  arrowRight: { right: 10 },
  arrowDisabled: { opacity: 0.35 },
  counter: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(15,23,42,0.72)",
    zIndex: 2,
  },
  counterText: { fontFamily: "Montserrat_600SemiBold", fontSize: 12, color: "#FFFFFF" },
  thumbnails: { marginTop: 12, height: THUMB_SIZE, flexGrow: 0, flexShrink: 0 },
  thumbnailsContent: { paddingHorizontal: 2, alignItems: "center" },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    marginRight: THUMB_GAP,
    padding: 3,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
  selectedThumbnail: { borderColor: "#0099FF", backgroundColor: "#EAF6FF" },
  darkThumbnail: { backgroundColor: "#172231", borderColor: "#334155" },
  galleryHint: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
  },
  galleryHintText: { fontFamily: "Montserrat_400Regular", fontSize: 11, color: "#64748B" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  emptyIcon: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: "#E8EDF2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: "Montserrat_500Medium",
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  viewer: { flex: 1, backgroundColor: "#0B1220" },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  viewerHeaderText: { flex: 1 },
  viewerEyebrow: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 9,
    letterSpacing: 1.4,
    color: "#94A3B8",
    marginBottom: 5,
  },
  viewerTitle: { fontFamily: "Montserrat_600SemiBold", fontSize: 14, color: "#FFFFFF" },
  viewerClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenCarousel: { flex: 1, paddingBottom: 14, paddingHorizontal: 14 },
  fullscreenStage: { flex: 1, borderRadius: 0, backgroundColor: "#0B1220" },
  fullscreenSlide: { padding: 4 },
});