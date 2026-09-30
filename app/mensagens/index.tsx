import { Feather } from "@expo/vector-icons";
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
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import api from "../../services/api.js";

// ============================================================
// CONSTANTES
// ============================================================

const INTERVALO_ATUALIZACAO = 5000;
const TEMPO_LIMITE_REQUISICAO = 15000;
const CHATS_CACHE_KEY = "@pecapeca:chats_cache_v1";
const CACHE_MAX_AGE = 1000 * 60 * 60 * 6; // 6h

// ============================================================
// TIPOS
// ============================================================

type Usuario = {
  id_usuario: number;
  nm_usuario: string;
  ds_foto_perfil?: string | null;
};

type Mensagem = {
  id_mensagem: number;
  ds_mensagem?: string | null;
  ds_imagem?: string | null;
  created_at?: string | null;
};

type Proposta = {
  id_proposta: number;
  id_solicitante: number;
  id_destinatario: number;
  st_troca: string;
  solicitante?: Usuario | null;
  destinatario?: Usuario | null;
  ultima_mensagem: Mensagem | null;
};

type Chat = {
  id: string;
  idProposta: number;
  idOutroUsuario: number;
  usuario: string;
  avatar: string | null;
  lastMessage: string;
  time: string;
  lastMessageDate: number;
};

// ============================================================
// HELPERS
// ============================================================

function getImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  const path = imagePath.trim();
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;

  const baseUrl =
    api.defaults.baseURL?.replace(/\/api\/?$/, "").replace(/\/$/, "") ||
    "http://127.0.0.1:8000";

  const normalized = path.replace(/^\/+/, "").replace(/^storage\/+/, "");
  return `${baseUrl}/storage/${normalized}`;
}

function dataEmNumero(data?: string | null): number {
  if (!data) return 0;
  const v = new Date(data).getTime();
  return Number.isFinite(v) ? v : 0;
}

function formatarHora(data?: string | null): string {
  if (!data) return "";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";

  const agora = new Date();

  if (d.toDateString() === agora.toDateString()) {
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);

  if (d.toDateString() === ontem.toDateString()) return "Ontem";

  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatarUltimaMensagem(m?: Mensagem | null): string {
  if (!m) return "Nenhuma mensagem ainda";
  if (m.ds_mensagem?.trim()) return m.ds_mensagem;
  if (m.ds_imagem) return "Imagem";
  return "Nenhuma mensagem ainda";
}

function listasIguais(a: Chat[], b: Chat[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.idProposta !== y.idProposta ||
      x.idOutroUsuario !== y.idOutroUsuario ||
      x.usuario !== y.usuario ||
      x.avatar !== y.avatar ||
      x.lastMessage !== y.lastMessage ||
      x.time !== y.time ||
      x.lastMessageDate !== y.lastMessageDate
    ) {
      return false;
    }
  }
  return true;
}

// ============================================================
// CACHE
// ============================================================

async function saveCache(chats: Chat[]) {
  try {
    await AsyncStorage.setItem(
      CHATS_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), data: chats.slice(0, 100) })
    );
  } catch {}
}

async function loadCache(): Promise<Chat[] | null> {
  try {
    const raw = await AsyncStorage.getItem(CHATS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - parsed.ts > CACHE_MAX_AGE) return null;
    return parsed.data as Chat[];
  } catch {
    return null;
  }
}

// ============================================================
// SKELETON
// ============================================================

const SkeletonChat = memo(function SkeletonChat() {
  return (
    <View style={styles.chatItem}>
      <View style={[styles.avatar, styles.skeletonBlock]} />
      <View style={styles.chatContent}>
        <View
          style={[
            styles.skeletonLine,
            { width: "60%", height: 14, marginBottom: 8 },
          ]}
        />
        <View style={[styles.skeletonLine, { width: "85%", height: 12 }]} />
      </View>
    </View>
  );
});

// ============================================================
// CHAT ITEM
// ============================================================

const ChatItem = memo(function ChatItem({
  item,
  onPress,
}: {
  item: Chat;
  onPress: (chat: Chat) => void;
}) {
  const [failedAvatar, setFailedAvatar] = useState(false);

  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  const handleAvatarError = useCallback(() => setFailedAvatar(true), []);

  const showAvatar = item.avatar && !failedAvatar;

  return (
    <TouchableOpacity
      style={styles.chatItem}
      activeOpacity={0.7}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir conversa com ${item.usuario}`}
    >
      {showAvatar ? (
        <Image
          source={{ uri: item.avatar! }}
          style={styles.avatar}
          onError={handleAvatarError}
          fadeDuration={150}
        />
      ) : (
        <View style={styles.avatarFallback}>
          <Feather name="user" size={24} color="#005386" />
        </View>
      )}

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.usuario}
          </Text>
          {item.time ? <Text style={styles.timeText}>{item.time}</Text> : null}
        </View>

        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

// ============================================================
// TELA
// ============================================================

export default function ChatsListScreen() {
  const router = useRouter();

  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const chatsRef = useRef<Chat[]>([]);
  const usuarioAtualRef = useRef<number | null>(null);
  const loadingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const aplicarChats = useCallback((novos: Chat[], persist = true) => {
    const ordenados = novos
      .slice()
      .sort(
        (a, b) =>
          b.lastMessageDate - a.lastMessageDate ||
          b.idProposta - a.idProposta
      );

    if (listasIguais(chatsRef.current, ordenados)) return;

    chatsRef.current = ordenados;
    setChats(ordenados);

    if (persist) saveCache(ordenados);
  }, []);

  // Carrega do cache na montagem
  useEffect(() => {
    let ativo = true;

    (async () => {
      const cached = await loadCache();
      if (!ativo) return;

      if (cached && cached.length > 0) {
        chatsRef.current = cached;
        setChats(cached);
        setLoading(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  // Monitora background/foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, []);

  // Busca conversas
  const carregarConversas = useCallback(
    async (
      primeiraCarga: boolean,
      signal: AbortSignal
    ): Promise<boolean> => {
      if (loadingRef.current && !primeiraCarga) return true;
      loadingRef.current = true;

      try {
        const [token, usuarioStorage] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("usuario"),
        ]);

        if (signal.aborted) return true;

        if (!token || !usuarioStorage) {
          aplicarChats([], false);
          usuarioAtualRef.current = null;
          setErro("Faça login novamente para acessar suas mensagens.");
          return true;
        }

        let usuario: { id_usuario?: number | string };
        try {
          usuario = JSON.parse(usuarioStorage);
        } catch {
          aplicarChats([], false);
          setErro("Os dados do usuário estão inválidos. Faça login novamente.");
          return true;
        }

        const idUsuario = Number(usuario?.id_usuario);
        if (!Number.isFinite(idUsuario) || idUsuario <= 0) {
          aplicarChats([], false);
          setErro("Não foi possível identificar o usuário logado.");
          return true;
        }

        if (usuarioAtualRef.current !== idUsuario) {
          usuarioAtualRef.current = idUsuario;
          aplicarChats([], false);
          setLoading(true);
        }

        const response = await api.get("/propostas", {
          params: { para_chat: 1 },
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal,
          timeout: TEMPO_LIMITE_REQUISICAO,
        });

        if (signal.aborted) return true;

        if (!Array.isArray(response.data?.propostas)) {
          throw new Error("A API retornou uma lista inválida.");
        }

        const propostas: Proposta[] = response.data.propostas;
        const novosChats: Chat[] = [];

        for (let i = 0; i < propostas.length; i++) {
          const p = propostas[i];
          const souSol = Number(p.id_solicitante) === idUsuario;
          const souDest = Number(p.id_destinatario) === idUsuario;
          const aceitaOuFinalizada = p.st_troca === "A" || p.st_troca === "F";

          if ((!souSol && !souDest) || !aceitaOuFinalizada) continue;

          const outro = souSol ? p.destinatario : p.solicitante;
          if (!outro) continue;

          if (!Object.prototype.hasOwnProperty.call(p, "ultima_mensagem")) {
            throw new Error(
              "A API não retornou a última mensagem. Confira o PropostaController."
            );
          }

          const ult = p.ultima_mensagem;
          const idProposta = Number(p.id_proposta);

          novosChats.push({
            id: String(idProposta),
            idProposta,
            idOutroUsuario: Number(outro.id_usuario),
            usuario: outro.nm_usuario || "Usuário",
            avatar: getImageUrl(outro.ds_foto_perfil),
            lastMessage: formatarUltimaMensagem(ult),
            time: formatarHora(ult?.created_at),
            lastMessageDate: dataEmNumero(ult?.created_at),
          });
        }

        aplicarChats(novosChats);
        setErro("");
        return true;
      } catch (error: any) {
        if (signal.aborted) return true;

        if (error?.response?.status === 401) {
          aplicarChats([], false);
          usuarioAtualRef.current = null;
        }

        const msg =
          error?.response?.data?.message ||
          error?.message ||
          "Não foi possível carregar as conversas.";

        setErro(msg);
        return false;
      } finally {
        loadingRef.current = false;
      }
    },
    [aplicarChats]
  );

  // Polling inteligente
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const controller = new AbortController();

      const primeiro = chatsRef.current.length === 0;
      if (primeiro) setLoading(true);
      setErro("");

      const executarCiclo = async (primeiraCarga: boolean) => {
        if (appStateRef.current !== "active") {
          if (ativo) {
            timer = setTimeout(
              () => void executarCiclo(false),
              INTERVALO_ATUALIZACAO
            );
          }
          return;
        }

        const sucesso = await carregarConversas(
          primeiraCarga,
          controller.signal
        );

        if (ativo) setLoading(false);

        if (ativo) {
          const delay = sucesso
            ? INTERVALO_ATUALIZACAO
            : INTERVALO_ATUALIZACAO * 2;
          timer = setTimeout(() => void executarCiclo(false), delay);
        }
      };

      void executarCiclo(true);

      return () => {
        ativo = false;
        if (timer) clearTimeout(timer);
        controller.abort();
      };
    }, [carregarConversas])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const ctrl = new AbortController();
    await carregarConversas(false, ctrl.signal);
    setRefreshing(false);
  }, [carregarConversas]);

  const handleOpenChat = useCallback(
    (chat: Chat) => {
      router.push({
        pathname: "/mensagens/chat",
        params: { id_proposta: String(chat.idProposta) },
      } as any);
    },
    [router]
  );

  const keyExtractor = useCallback((item: Chat) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Chat }) => (
      <ChatItem item={item} onPress={handleOpenChat} />
    ),
    [handleOpenChat]
  );

  const skeletonData = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ id: `sk-${i}` })),
    []
  );

  const showSkeleton = loading && chats.length === 0;
  const listData = showSkeleton ? skeletonData : chats;

  const ListEmptyComponent = useMemo(() => {
    if (showSkeleton) return null;

    return (
      <View style={styles.emptyContainer}>
        <Feather
          name={erro ? "wifi-off" : "message-square"}
          size={48}
          color={erro ? "#D8B0AC" : "#B9C7D2"}
        />
        <Text style={styles.emptyTitle}>
          {erro ? "Não foi possível carregar" : "Nenhuma conversa ainda"}
        </Text>
        <Text style={styles.emptyText}>
          {erro || "Suas conversas de trocas aceitas aparecerão aqui."}
        </Text>
        {erro ? (
          <TouchableOpacity
            onPress={handleRefresh}
            style={styles.retryButton}
            activeOpacity={0.85}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }, [showSkeleton, erro, handleRefresh]);

  return (
    <SafeAreaView style={styles.mainContainer}>
      <View style={styles.listHeader}>
        <Text style={styles.title}>Mensagens</Text>
        {chats.length > 0 ? (
          <Text style={styles.subtitle}>
            {chats.length} {chats.length === 1 ? "conversa" : "conversas"}
          </Text>
        ) : null}
      </View>

      {erro && chats.length > 0 ? (
        <View style={styles.bannerError}>
          <Feather name="alert-circle" size={14} color="#A33A32" />
          <Text style={styles.bannerErrorText}>
            Sem conexão — tentando novamente...
          </Text>
        </View>
      ) : null}

      <FlatList
        data={listData}
        keyExtractor={(item: any) => item.id}
        renderItem={showSkeleton ? () => <SkeletonChat /> : (renderItem as any)}
        contentContainerStyle={[
          styles.listContainer,
          listData.length === 0 && styles.emptyListContainer,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={ListEmptyComponent}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={9}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}

// ============================================================
// ESTILOS
// ============================================================

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: "#FFFFFF" },

  listHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 28,
    fontFamily: "Montserrat_700Bold",
    color: "#005386",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#8A9BA8",
    fontFamily: "Montserrat_400Regular",
  },

  bannerError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FDECEA",
    borderWidth: 1,
    borderColor: "#F5C6C0",
  },
  bannerErrorText: {
    fontSize: 12,
    color: "#A33A32",
    fontFamily: "Montserrat_400Regular",
  },

  listContainer: { paddingHorizontal: 20, paddingBottom: 80 },
  emptyListContainer: { flexGrow: 1 },

  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F5F8",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E4F8FF",
  },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DCEEFA",
  },
  chatContent: { flex: 1, marginLeft: 14 },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  userName: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
    color: "#1E2B36",
    marginRight: 10,
  },
  timeText: {
    fontSize: 11,
    color: "#9BAAB6",
    fontFamily: "Montserrat_400Regular",
  },
  lastMessage: {
    fontSize: 13,
    color: "#7A8A96",
    fontFamily: "Montserrat_400Regular",
  },

  skeletonBlock: { backgroundColor: "#EAF3FA" },
  skeletonLine: { backgroundColor: "#EAF3FA", borderRadius: 4 },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 80,
    gap: 8,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 17,
    fontFamily: "Montserrat_600SemiBold",
    color: "#4A5A66",
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: "#9BAAB6",
    textAlign: "center",
    lineHeight: 20,
    fontFamily: "Montserrat_400Regular",
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: "#005386",
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryText: {
    color: "#FFFFFF",
    fontFamily: "Montserrat_600SemiBold",
  },
});