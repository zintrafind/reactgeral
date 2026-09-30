import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ============================================================
// TIPOS
// ============================================================

type Message = {
  id: string;
  sender: "me" | "other" | "system";
  text?: string | null;
  image?: string | null;
  createdAt?: string;
  pending?: boolean;
};

type Usuario = {
  id_usuario: number;
  nm_usuario: string;
  ds_foto_perfil?: string | null;
};

type ImagemProduto = {
  id_imagem_produto?: number;
  ds_imagem?: string | null;
  imagem?: string | null;
  url?: string | null;
  path?: string | null;
};

type ImagemProdutoItem = string | ImagemProduto;

type Produto = {
  id_produto: number;
  id_usuario: number;
  nm_produto: string;
  ds_produto?: string | null;
  ds_imagem?: string | null;
  imagens?: ImagemProdutoItem[];
  images?: ImagemProdutoItem[];
  imagem?: ImagemProdutoItem[];
  imagem_produto?: ImagemProdutoItem[];
  imagens_produto?: ImagemProdutoItem[];
};

type ItemProposta = {
  id_item_proposta?: number;
  id_proposta?: number;
  id_produto: number;
  tp_item: string;
  produto?: Produto;
};

type Proposta = {
  id_proposta: number;
  id_solicitante: number;
  id_destinatario: number;
  st_troca: string;
  st_confirmacao_solicitante?: string;
  st_confirmacao_destinatario?: string;
  solicitante?: Usuario;
  destinatario?: Usuario;
  itens?: ItemProposta[];
};

// ============================================================
// CONSTANTES
// ============================================================

const API_URL = "http://127.0.0.1:8000";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const INTERVALO_MENSAGENS_ATIVO = 3000;
const INTERVALO_MENSAGENS_OCIOSO = 8000;

const INTERVALO_PROPOSTA = 15000;

const MSG_CACHE_PREFIX = "@pecapeca:chat_msgs_v1:";
const MSG_CACHE_MAX_AGE = 1000 * 60 * 60 * 6; // 6h

const PROD_CACHE_PREFIX = "@pecapeca:prod_v1:";
const PROD_CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24h

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// ============================================================
// HELPERS
// ============================================================

function getImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;
  const path = String(imagePath).trim();
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const normalized = path.replace(/^\/+/, "").replace(/^storage\/+/, "");
  return `${API_URL}/storage/${normalized}`;
}

function getProductImage(produto?: Produto | null): string | null {
  if (!produto) return null;

  if (typeof produto.ds_imagem === "string" && produto.ds_imagem.trim()) {
    return getImageUrl(produto.ds_imagem);
  }

  const listas = [
    produto.images,
    produto.imagens,
    produto.imagem,
    produto.imagem_produto,
    produto.imagens_produto,
  ];

  for (const lista of listas) {
    if (!Array.isArray(lista) || lista.length === 0) continue;

    for (const img of lista) {
      if (typeof img === "string" && img.trim()) {
        return getImageUrl(img);
      }
      if (img && typeof img === "object") {
        const caminho = img.ds_imagem || img.imagem || img.url || img.path;
        if (typeof caminho === "string" && caminho.trim()) {
          return getImageUrl(caminho);
        }
      }
    }
  }
  return null;
}

function formatarHora(data?: string): string {
  if (!data) return "";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function compararMensagens(a: Message, b: Message): number {
  const da = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
  const db = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
  if (!Number.isNaN(da) && !Number.isNaN(db) && da !== db) return da - db;
  return Number(a.id) - Number(b.id);
}

function mensagensIguais(a: Message[], b: Message[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].text !== b[i].text ||
      a[i].image !== b[i].image ||
      a[i].sender !== b[i].sender
    ) {
      return false;
    }
  }
  return true;
}

// ============================================================
// CACHE — Mensagens
// ============================================================

async function saveMsgCache(idProposta: string, msgs: Message[]) {
  try {
    const key = `${MSG_CACHE_PREFIX}${idProposta}`;
    await AsyncStorage.setItem(
      key,
      JSON.stringify({ ts: Date.now(), data: msgs.slice(-100) })
    );
  } catch {}
}

async function loadMsgCache(idProposta: string): Promise<Message[] | null> {
  try {
    const key = `${MSG_CACHE_PREFIX}${idProposta}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed?.data)) return null;
    if (Date.now() - parsed.ts > MSG_CACHE_MAX_AGE) return null;
    return parsed.data as Message[];
  } catch {
    return null;
  }
}

// ============================================================
// CACHE — Produto
// ============================================================

async function saveProdCache(
  id: number,
  dados: { nm_produto: string; imagem: string | null }
) {
  try {
    await AsyncStorage.setItem(
      `${PROD_CACHE_PREFIX}${id}`,
      JSON.stringify({ ts: Date.now(), ...dados })
    );
  } catch {}
}

async function loadProdCache(
  id: number
): Promise<{ nm_produto: string; imagem: string | null } | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PROD_CACHE_PREFIX}${id}`);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (Date.now() - p.ts > PROD_CACHE_MAX_AGE) return null;
    return p as { nm_produto: string; imagem: string | null };
  } catch {
    return null;
  }
}

// ============================================================
// ITEM DA MENSAGEM (memoizado)
// ============================================================

const MessageItem = memo(function MessageItem({ item }: { item: Message }) {
  if (item.sender === "system") {
    return (
      <View style={styles.systemMessageBubble}>
        <Text style={styles.systemMessageText}>{item.text}</Text>
      </View>
    );
  }

  const isMe = item.sender === "me";

  return (
    <View
      style={[
        styles.messageBubble,
        isMe ? styles.myMessage : styles.otherMessage,
        item.pending && styles.pendingBubble,
      ]}
    >
      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={styles.messageImage}
          resizeMode="cover"
        />
      ) : null}

      {item.text ? (
        <Text
          style={[
            styles.messageText,
            isMe ? styles.myMessageText : styles.otherMessageText,
          ]}
        >
          {item.text}
        </Text>
      ) : null}

      <View style={styles.messageFooter}>
        {item.createdAt ? (
          <Text
            style={[
              styles.messageTime,
              isMe ? styles.myMessageTime : styles.otherMessageTime,
            ]}
          >
            {formatarHora(item.createdAt)}
          </Text>
        ) : null}

        {item.pending ? (
          <Feather
            name="clock"
            size={10}
            color={isMe ? "#D9F1FF" : "#777777"}
            style={{ marginLeft: 4 }}
          />
        ) : null}
      </View>
    </View>
  );
});

// ============================================================
// INPUT MEMOIZADO
// ============================================================

const ChatInput = memo(function ChatInput({
  value,
  onChangeText,
  onSend,
  onPickImage,
  sending,
  hasImage,
  bottomSpace,
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onPickImage: () => void;
  sending: boolean;
  hasImage: boolean;
  bottomSpace: number;
}) {
  const disabledSend = sending || (!value.trim() && !hasImage);

  return (
    <View style={[styles.inputContainer, { bottom: bottomSpace }]}>
      <TouchableOpacity
        style={[styles.imageButton, sending && styles.imageButtonDisabled]}
        onPress={onPickImage}
        disabled={sending}
      >
        <Feather name="image" size={21} color="#005386" />
      </TouchableOpacity>

      <TextInput
        style={styles.textInput}
        placeholder="Digite sua mensagem..."
        placeholderTextColor="#888888"
        value={value}
        onChangeText={onChangeText}
        editable={!sending}
        multiline
      />

      <TouchableOpacity
        style={[styles.sendButton, disabledSend && styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={disabledSend}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Feather name="send" size={18} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );
});

// ============================================================
// TELA
// ============================================================

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const idProposta = params.id_proposta ? String(params.id_proposta) : "";

  const flatListRef = useRef<FlatList<Message>>(null);
  const initialScrollDone = useRef(false);
  const scrollTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [usuarioLogado, setUsuarioLogado] = useState<number | null>(null);
  const [idOutroUsuario, setIdOutroUsuario] = useState<number | null>(null);
  const [nomeOutroUsuario, setNomeOutroUsuario] = useState("");
  const [fotoOutroUsuario, setFotoOutroUsuario] = useState<string | null>(null);
  const [idProduto, setIdProduto] = useState<number | null>(null);
  const [nomeProduto, setNomeProduto] = useState("");
  const [fotoProduto, setFotoProduto] = useState<string | null>(null);
  const [tradeStatus, setTradeStatus] = useState<
    "em_andamento" | "confirmada_por_mim" | "concluida"
  >("em_andamento");
  const [modalFinalizacaoVisivel, setModalFinalizacaoVisivel] = useState(false);
  const [finalizandoTroca, setFinalizandoTroca] = useState(false);
  const [erroFinalizacao, setErroFinalizacao] = useState("");
  const [imagemSelecionada, setImagemSelecionada] = useState<{
    uri: string;
    name: string;
    type: string;
    file?: File;
  } | null>(null);

  const finalizandoTrocaRef = useRef(false);
  const versaoStatusRef = useRef(0);
  const carregandoPropostaRef = useRef(false);
  const carregandoMensagensRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const messagesRef = useRef<Message[]>([]);
  const inputTextRef = useRef("");

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  // ==========================================================
  // USUÁRIO LOGADO + TOKEN
  // ==========================================================
  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const [usuarioStorage, token] = await Promise.all([
          AsyncStorage.getItem("usuario"),
          AsyncStorage.getItem("token"),
        ]);

        if (!ativo) return;
        tokenRef.current = token;

        if (!usuarioStorage) return;
        const usuario = JSON.parse(usuarioStorage);
        if (usuario?.id_usuario) {
          setUsuarioLogado(Number(usuario.id_usuario));
        }
      } catch {}
    })();

    return () => {
      ativo = false;
    };
  }, []);

  // ==========================================================
  // AppState
  // ==========================================================
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
    });
    return () => sub.remove();
  }, []);

  // ==========================================================
  // CARREGAR DADOS DA PROPOSTA
  // ==========================================================
  const carregarDadosProposta = useCallback(
    async (mostrarErro = false, signal?: AbortSignal) => {
      if (!idProposta || usuarioLogado === null) return;
      if (finalizandoTrocaRef.current) return;
      if (carregandoPropostaRef.current) return;

      carregandoPropostaRef.current = true;
      const versaoConsulta = versaoStatusRef.current;

      try {
        let token = tokenRef.current;
        if (!token) {
          token = await AsyncStorage.getItem("token");
          tokenRef.current = token;
        }
        if (!token) return;

        const response = await fetch(`${API_URL}/api/propostas`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal,
        });

        if (signal?.aborted) return;

        const data = await response.json();
        if (!response.ok) return;

        const propostas = Array.isArray(data.propostas) ? data.propostas : [];
        const proposta: Proposta | undefined = propostas.find(
          (item: Proposta) => Number(item.id_proposta) === Number(idProposta)
        );

        if (!proposta) return;

        const outroUsuario =
          Number(proposta.id_solicitante) === Number(usuarioLogado)
            ? proposta.destinatario
            : proposta.solicitante;

        if (outroUsuario) {
          setIdOutroUsuario(Number(outroUsuario.id_usuario));
          setNomeOutroUsuario(outroUsuario.nm_usuario || "");
          setFotoOutroUsuario(getImageUrl(outroUsuario.ds_foto_perfil));
        }

        if (
          !finalizandoTrocaRef.current &&
          versaoConsulta === versaoStatusRef.current
        ) {
          if (proposta.st_troca === "F") {
            setTradeStatus("concluida");
          } else {
            const souSolicitante =
              Number(proposta.id_solicitante) === Number(usuarioLogado);
            const minhaConfirmacao = souSolicitante
              ? proposta.st_confirmacao_solicitante
              : proposta.st_confirmacao_destinatario;

            setTradeStatus(
              minhaConfirmacao === "S"
                ? "confirmada_por_mim"
                : "em_andamento"
            );
          }
        }

        const itens = Array.isArray(proposta.itens) ? proposta.itens : [];
        const itemDoOutro = itens.find((item) => {
          const p = item.produto;
          return p && Number(p.id_usuario) !== Number(usuarioLogado);
        });

        if (itemDoOutro?.produto) {
          const produto = itemDoOutro.produto;
          const idProd = Number(produto.id_produto);
          setIdProduto(idProd);
          setNomeProduto(produto.nm_produto || "");

          let imagemProduto = getProductImage(produto);

          if (!imagemProduto) {
            const cache = await loadProdCache(idProd);
            if (cache) {
              setNomeProduto(cache.nm_produto);
              setFotoProduto(cache.imagem);
              return;
            }

            try {
              const prodRes = await fetch(
                `${API_URL}/api/products/${idProd}`,
                {
                  method: "GET",
                  headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  signal,
                }
              );

              if (signal?.aborted) return;

              const prodData = await prodRes.json();
              if (prodRes.ok) {
                const completo =
                  prodData?.produto ||
                  prodData?.product ||
                  prodData?.data ||
                  prodData;
                imagemProduto = getProductImage(completo);
                if (completo?.nm_produto) setNomeProduto(completo.nm_produto);

                await saveProdCache(idProd, {
                  nm_produto: completo?.nm_produto || produto.nm_produto || "",
                  imagem: imagemProduto,
                });
              }
            } catch {}
          }

          setFotoProduto(imagemProduto);
        }
      } catch {
      } finally {
        carregandoPropostaRef.current = false;
      }
    },
    [idProposta, usuarioLogado]
  );

  useEffect(() => {
    const ctrl = new AbortController();
    carregarDadosProposta(true, ctrl.signal);
    return () => ctrl.abort();
  }, [carregarDadosProposta]);

  useEffect(() => {
    if (usuarioLogado === null || !idProposta) return;

    const ctrl = new AbortController();
    const intervalo = setInterval(() => {
      if (appStateRef.current === "active") {
        carregarDadosProposta(false, ctrl.signal);
      }
    }, INTERVALO_PROPOSTA);

    return () => {
      clearInterval(intervalo);
      ctrl.abort();
    };
  }, [usuarioLogado, idProposta, carregarDadosProposta]);

  useEffect(() => {
    if (tradeStatus !== "em_andamento") {
      setModalFinalizacaoVisivel(false);
      setErroFinalizacao("");
    }
  }, [tradeStatus]);

  // ==========================================================
  // CARREGAR MENSAGENS
  // ==========================================================
  const carregarMensagens = useCallback(
    async (mostrarLoading = false, signal?: AbortSignal) => {
      if (!idProposta) {
        setLoadingMessages(false);
        return;
      }

      if (usuarioLogado === null || idOutroUsuario === null) return;
      if (carregandoMensagensRef.current) return;

      carregandoMensagensRef.current = true;

      try {
        if (mostrarLoading) setLoadingMessages(true);

        let token = tokenRef.current;
        if (!token) {
          token = await AsyncStorage.getItem("token");
          tokenRef.current = token;
        }
        if (!token) return;

        const response = await fetch(
          `${API_URL}/api/propostas/${idProposta}/mensagens`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            signal,
          }
        );

        if (signal?.aborted) return;

        const data = await response.json();
        if (!response.ok) return;

        const recebidas = Array.isArray(data.mensagens) ? data.mensagens : [];

        const formatadas: Message[] = recebidas
          .map((m: any) => ({
            id: String(m.id_mensagem),
            sender:
              Number(m.id_usuario) === Number(usuarioLogado) ? "me" : "other",
            text: m.ds_mensagem || null,
            image: getImageUrl(m.ds_imagem),
            createdAt: m.created_at,
          }))
          .sort(compararMensagens);

        setMessages((atuais) => {
          const pendentes = atuais.filter(
            (m) => m.pending && !formatadas.some((f) => f.id === m.id)
          );
          const combinadas = [...formatadas, ...pendentes].sort(
            compararMensagens
          );

          if (mensagensIguais(atuais, combinadas)) return atuais;
          saveMsgCache(idProposta, combinadas);
          return combinadas;
        });
      } catch {
      } finally {
        carregandoMensagensRef.current = false;
        if (mostrarLoading) setLoadingMessages(false);
      }
    },
    [idProposta, usuarioLogado, idOutroUsuario]
  );

  useEffect(() => {
    initialScrollDone.current = false;
    scrollTimers.current.forEach(clearTimeout);
    scrollTimers.current = [];
    setModalFinalizacaoVisivel(false);
    setErroFinalizacao("");
  }, [idProposta]);

  useEffect(() => {
    if (usuarioLogado === null || !idProposta || idOutroUsuario === null) return;

    let ativo = true;

    (async () => {
      const cached = await loadMsgCache(idProposta);
      if (ativo && cached && cached.length > 0) {
        setMessages(cached);
        setLoadingMessages(false);
      }
      const ctrl = new AbortController();
      await carregarMensagens(!cached, ctrl.signal);
    })();

    return () => {
      ativo = false;
    };
  }, [idProposta, usuarioLogado, idOutroUsuario, carregarMensagens]);

  // ==========================================================
  // POLLING ADAPTATIVO
  // ==========================================================
  useEffect(() => {
    if (usuarioLogado === null || !idProposta || idOutroUsuario === null) return;

    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const loop = async () => {
      if (appStateRef.current === "active" && !sendingMessage) {
        await carregarMensagens(false, ctrl.signal);
      }

      const delay =
        inputTextRef.current.length > 0
          ? INTERVALO_MENSAGENS_OCIOSO
          : INTERVALO_MENSAGENS_ATIVO;

      timer = setTimeout(loop, delay);
    };

    loop();

    return () => {
      if (timer) clearTimeout(timer);
      ctrl.abort();
    };
  }, [
    idProposta,
    usuarioLogado,
    idOutroUsuario,
    carregarMensagens,
    sendingMessage,
  ]);

  // ==========================================================
  // NAVEGAÇÃO
  // ==========================================================
  const abrirPerfilUsuario = useCallback(() => {
    if (!idOutroUsuario) {
      Alert.alert("Erro", "Não foi possível identificar este usuário.");
      return;
    }
    router.push({
      pathname: "/visualizarperfil",
      params: { id: String(idOutroUsuario) },
    } as any);
  }, [idOutroUsuario, router]);

  const abrirAnuncio = useCallback(() => {
    if (!idProduto) {
      Alert.alert("Erro", "Não foi possível identificar este anúncio.");
      return;
    }
    router.push({
      pathname: "/visuanuncios",
      params: { id: String(idProduto) },
    } as any);
  }, [idProduto, router]);

  // ==========================================================
  // SELEÇÃO DE IMAGEM
  // ==========================================================
  const abrirGaleria = useCallback(async () => {
    try {
      const permissao =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso às fotos para enviar uma imagem."
        );
        return;
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (resultado.canceled) return;

      const imagem = resultado.assets?.[0];
      if (!imagem?.uri) return;

      if (imagem.fileSize && imagem.fileSize > MAX_IMAGE_SIZE) {
        Alert.alert("Arquivo muito grande", "A imagem deve ter no máximo 5MB.");
        return;
      }

      if (imagem.mimeType && !ALLOWED_IMAGE_TYPES.includes(imagem.mimeType)) {
        Alert.alert("Formato não suportado", "Use JPG, PNG, GIF ou WEBP.");
        return;
      }

      const uri = imagem.uri;
      const fileName = uri.split("/").pop() || `imagem_${Date.now()}.jpg`;
      const mimeType = imagem.mimeType || "image/jpeg";

      setImagemSelecionada({ uri, name: fileName, type: mimeType });
    } catch {
      Alert.alert("Erro", "Não foi possível selecionar a imagem.");
    }
  }, []);

  const abrirCamera = useCallback(async () => {
    try {
      const permissao = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissao.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à câmera para tirar uma foto."
        );
        return;
      }

      const resultado = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
      });

      if (resultado.canceled) return;

      const imagem = resultado.assets?.[0];
      if (!imagem?.uri) return;

      if (imagem.fileSize && imagem.fileSize > MAX_IMAGE_SIZE) {
        Alert.alert("Arquivo muito grande", "A imagem deve ter no máximo 5MB.");
        return;
      }

      if (imagem.mimeType && !ALLOWED_IMAGE_TYPES.includes(imagem.mimeType)) {
        Alert.alert("Formato não suportado", "Use JPG, PNG, GIF ou WEBP.");
        return;
      }

      const uri = imagem.uri;
      const fileName = uri.split("/").pop() || `foto_${Date.now()}.jpg`;
      const mimeType = imagem.mimeType || "image/jpeg";

      setImagemSelecionada({ uri, name: fileName, type: mimeType });
    } catch {
      Alert.alert("Erro", "Não foi possível abrir a câmera.");
    }
  }, []);

  const selecionarImagem = useCallback(() => {
    if (sendingMessage) return;

    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/jpeg,image/png,image/gif,image/webp";

      input.onchange = (event: any) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_IMAGE_SIZE) {
          Alert.alert("Arquivo muito grande", "A imagem deve ter no máximo 5MB.");
          return;
        }
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          Alert.alert("Formato não suportado", "Use JPG, PNG, GIF ou WEBP.");
          return;
        }

        const uri = URL.createObjectURL(file);
        setImagemSelecionada({
          uri,
          name: file.name,
          type: file.type,
          file,
        });
        input.value = "";
      };

      input.click();
      return;
    }

    Alert.alert("Enviar imagem", "Escolha uma opção", [
      { text: "Galeria", onPress: abrirGaleria },
      { text: "Câmera", onPress: abrirCamera },
      { text: "Cancelar", style: "cancel" },
    ]);
  }, [sendingMessage, abrirGaleria, abrirCamera]);

  const removerImagemSelecionada = useCallback(() => {
    if (sendingMessage) return;
    if (imagemSelecionada?.uri?.startsWith("blob:")) {
      URL.revokeObjectURL(imagemSelecionada.uri);
    }
    setImagemSelecionada(null);
  }, [sendingMessage, imagemSelecionada]);

  // ==========================================================
  // ENVIAR MENSAGEM (OPTIMISTIC UPDATE)
  // ==========================================================
  const handleSendMessage = useCallback(async () => {
    const mensagem = inputText.trim();
    if (mensagem === "" && !imagemSelecionada) return;
    if (!idProposta || sendingMessage) return;

    const tempId = `temp-${Date.now()}`;
    const imagemLocal = imagemSelecionada?.uri || null;

    const mensagemOtimista: Message = {
      id: tempId,
      sender: "me",
      text: mensagem || (imagemLocal ? "Imagem enviada" : null),
      image: imagemLocal,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages((prev) => {
      const atualizadas = [...prev, mensagemOtimista].sort(compararMensagens);
      saveMsgCache(idProposta, atualizadas);
      return atualizadas;
    });

    setInputText("");
    setSendingMessage(true);

    try {
      let token = tokenRef.current;
      if (!token) {
        token = await AsyncStorage.getItem("token");
        tokenRef.current = token;
      }
      if (!token) throw new Error("Sem token");

      const formData = new FormData();
      if (mensagem !== "") formData.append("ds_mensagem", mensagem);

      if (imagemSelecionada) {
        if (Platform.OS === "web" && imagemSelecionada.file) {
          formData.append("imagem", imagemSelecionada.file);
        } else if (Platform.OS === "web" && !imagemSelecionada.file) {
          const response = await fetch(imagemSelecionada.uri);
          const blob = await response.blob();
          const file = new File([blob], imagemSelecionada.name, {
            type: imagemSelecionada.type,
          });
          formData.append("imagem", file);
        } else {
          formData.append("imagem", {
            uri: imagemSelecionada.uri,
            name: imagemSelecionada.name,
            type: imagemSelecionada.type,
          } as any);
        }
      }

      const response = await fetch(
        `${API_URL}/api/propostas/${idProposta}/mensagens`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        Alert.alert(
          "Não foi possível enviar",
          data?.message || "Ocorreu um erro ao enviar a mensagem."
        );
        return;
      }

      const realId = String(data.mensagem.id_mensagem || tempId);
      const realImage = getImageUrl(data.mensagem.ds_imagem) || imagemLocal;

      setMessages((prev) => {
        const trocadas = prev
          .map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: realId,
                  text: data.mensagem.ds_mensagem || m.text,
                  image: realImage,
                  createdAt: data.mensagem.created_at || m.createdAt,
                  pending: false,
                }
              : m
          )
          .sort(compararMensagens);
        saveMsgCache(idProposta, trocadas);
        return trocadas;
      });

      if (imagemSelecionada?.uri?.startsWith("blob:")) {
        URL.revokeObjectURL(imagemSelecionada.uri);
      }
      setImagemSelecionada(null);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert("Erro", "Não foi possível conectar ao servidor.");
    } finally {
      setSendingMessage(false);
    }
  }, [inputText, imagemSelecionada, idProposta, sendingMessage]);

  // ==========================================================
  // MODAL DE FINALIZAÇÃO
  // ==========================================================
  const abrirModalFinalizacao = useCallback(() => {
    if (tradeStatus !== "em_andamento" || finalizandoTrocaRef.current) return;
    setErroFinalizacao("");
    setModalFinalizacaoVisivel(true);
  }, [tradeStatus]);

  const fecharModalFinalizacao = useCallback(() => {
    if (finalizandoTrocaRef.current) return;
    setModalFinalizacaoVisivel(false);
    setErroFinalizacao("");
  }, []);

  const handleFinalizeTrade = useCallback(async () => {
    if (
      !modalFinalizacaoVisivel ||
      tradeStatus !== "em_andamento" ||
      finalizandoTrocaRef.current
    ) {
      return;
    }

    finalizandoTrocaRef.current = true;
    versaoStatusRef.current += 1;
    setFinalizandoTroca(true);
    setErroFinalizacao("");

    try {
      let token = tokenRef.current;
      if (!token) {
        token = await AsyncStorage.getItem("token");
        tokenRef.current = token;
      }
      if (!token) {
        setErroFinalizacao("Faça login novamente para finalizar a troca.");
        return;
      }
      if (!idProposta) {
        setErroFinalizacao(
          "Não foi possível identificar a proposta desta troca."
        );
        return;
      }

      const response = await fetch(
        `${API_URL}/api/propostas/${idProposta}/finalizar`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        setErroFinalizacao(
          data?.message || "Ocorreu um erro ao finalizar a troca."
        );
        return;
      }

      setModalFinalizacaoVisivel(false);

      if (data?.troca_concluida === true) {
        setTradeStatus("concluida");
        const sys: Message = {
          id: String(Date.now()),
          sender: "system",
          text: "Troca concluída com sucesso!",
        };
        setMessages((prev) => {
          const atualizadas = [...prev, sys];
          saveMsgCache(idProposta, atualizadas);
          return atualizadas;
        });
        Alert.alert(
          "Troca concluída",
          data?.message ||
            "Os dois usuários confirmaram a finalização da troca."
        );
        return;
      }

      setTradeStatus("confirmada_por_mim");
      Alert.alert(
        "Confirmação registrada",
        data?.message ||
          "Sua confirmação foi registrada. A troca será concluída quando o outro usuário também confirmar."
      );
    } catch {
      setErroFinalizacao(
        "Não foi possível confirmar o resultado. Verifique sua conexão e aguarde a atualização do status da troca."
      );
    } finally {
      finalizandoTrocaRef.current = false;
      setFinalizandoTroca(false);
    }
  }, [modalFinalizacaoVisivel, tradeStatus, idProposta]);

  // ==========================================================
  // SCROLL
  // ==========================================================
  const rolarParaUltimaMensagem = useCallback(() => {
    if (
      loadingMessages ||
      messagesRef.current.length === 0 ||
      initialScrollDone.current
    ) {
      return;
    }

    const delays = [0, 80, 180, 350];
    delays.forEach((delay) => {
      const timer = setTimeout(() => {
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        });
      }, delay);
      scrollTimers.current.push(timer);
    });

    const finalTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
        initialScrollDone.current = true;
      });
    }, 450);
    scrollTimers.current.push(finalTimer);
  }, [loadingMessages]);

  useEffect(() => {
    if (!loadingMessages && messages.length > 0) {
      rolarParaUltimaMensagem();
    }
    return () => {
      scrollTimers.current.forEach(clearTimeout);
      scrollTimers.current = [];
    };
  }, [loadingMessages, messages.length, rolarParaUltimaMensagem]);

  // ==========================================================
  // RENDER
  // ==========================================================
  const inputBottomSpace = Math.max(insets.bottom, 8) + 6;
  const previewBottom = inputBottomSpace + 64;

  const renderItem = useCallback(
    ({ item }: { item: Message }) => <MessageItem item={item} />,
    []
  );

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router]);

  return (
    <SafeAreaView style={styles.mainContainer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color="#005386" />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7} onPress={abrirPerfilUsuario}>
            {fotoOutroUsuario ? (
              <Image
                source={{ uri: fotoOutroUsuario }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Feather name="user" size={20} color="#005386" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <TouchableOpacity activeOpacity={0.7} onPress={abrirPerfilUsuario}>
              <Text style={styles.headerName} numberOfLines={1}>
                {nomeOutroUsuario}
              </Text>
            </TouchableOpacity>

            <Text style={styles.headerStatus}>
              {tradeStatus === "concluida"
                ? "Troca Concluída"
                : tradeStatus === "confirmada_por_mim"
                ? "Aguardando confirmação"
                : "Online"}
            </Text>
          </View>
        </View>

        {/* BANNER DO PRODUTO */}
        <View style={styles.productBanner}>
          <TouchableOpacity
            style={styles.productClickable}
            activeOpacity={0.75}
            onPress={abrirAnuncio}
          >
            {fotoProduto ? (
              <Image
                source={{ uri: fotoProduto }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.bannerImageFallback}>
                <Feather name="package" size={22} color="#777777" />
              </View>
            )}

            <View style={styles.bannerInfo}>
              <Text style={styles.bannerLabel}>Negociando sobre:</Text>
              <Text style={styles.bannerTitle} numberOfLines={1}>
                {nomeProduto || "Anúncio"}
              </Text>
              <Text style={styles.bannerHint}>Toque para visualizar</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.finishBtn,
              tradeStatus === "concluida"
                ? styles.finishBtnDone
                : tradeStatus === "confirmada_por_mim"
                ? styles.finishBtnWaiting
                : styles.finishBtnActive,
              finalizandoTroca && styles.buttonDisabled,
            ]}
            onPress={abrirModalFinalizacao}
            disabled={
              tradeStatus === "concluida" ||
              tradeStatus === "confirmada_por_mim" ||
              finalizandoTroca
            }
          >
            <Feather
              name={
                tradeStatus === "concluida"
                  ? "check-circle"
                  : tradeStatus === "confirmada_por_mim"
                  ? "clock"
                  : "check"
              }
              size={14}
              color="#FFFFFF"
            />
            <Text style={styles.finishBtnText}>
              {tradeStatus === "concluida"
                ? "Concluída"
                : tradeStatus === "confirmada_por_mim"
                ? "Você confirmou"
                : "Finalizar"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* LISTA DE MENSAGENS */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={keyExtractor}
          onContentSizeChange={rolarParaUltimaMensagem}
          contentContainerStyle={styles.chatContainer}
          showsVerticalScrollIndicator={false}
          initialNumToRender={20}
          maxToRenderPerBatch={15}
          windowSize={7}
          removeClippedSubviews={Platform.OS !== "web"}
          renderItem={renderItem}
          ListEmptyComponent={
            !loadingMessages ? (
              <Text style={styles.emptyMessages}>
                Nenhuma mensagem ainda. Envie a primeira!
              </Text>
            ) : null
          }
        />

        {/* PREVIEW DE IMAGEM */}
        {imagemSelecionada ? (
          <View
            style={[
              styles.imagePreviewContainer,
              { bottom: previewBottom },
            ]}
          >
            <Image
              source={{ uri: imagemSelecionada.uri }}
              style={styles.imagePreview}
            />

            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={removerImagemSelecionada}
              disabled={sendingMessage}
            >
              <Feather name="x" size={14} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.imagePreviewName} numberOfLines={1}>
              {imagemSelecionada.name}
            </Text>
          </View>
        ) : null}

        {/* INPUT MEMOIZADO */}
        <ChatInput
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSendMessage}
          onPickImage={selecionarImagem}
          sending={sendingMessage}
          hasImage={!!imagemSelecionada}
          bottomSpace={inputBottomSpace}
        />
      </KeyboardAvoidingView>

      {/* MODAL DE FINALIZAÇÃO */}
      <Modal
        visible={modalFinalizacaoVisivel}
        transparent
        animationType="fade"
        onRequestClose={fecharModalFinalizacao}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer} accessibilityViewIsModal>
            <ScrollView
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.modalIconContainer}>
                <Feather name="check-circle" size={32} color="#0099FF" />
              </View>

              <Text style={styles.modalTitle} accessibilityRole="header">
                Confirmar finalização
              </Text>

              <Text style={styles.modalDescription}>
                Tem certeza de que deseja finalizar esta troca?
              </Text>

              <View style={styles.modalNotice}>
                <Feather name="info" size={18} color="#005386" />
                <Text style={styles.modalNoticeText}>
                  Confirme somente se a troca já foi realizada. A troca será
                  concluída quando os dois usuários confirmarem.
                </Text>
              </View>

              {erroFinalizacao ? (
                <View style={styles.modalErrorContainer}>
                  <Text
                    style={styles.modalErrorText}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    {erroFinalizacao}
                  </Text>
                </View>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[
                    styles.modalCancelButton,
                    finalizandoTroca && styles.buttonDisabled,
                  ]}
                  activeOpacity={0.7}
                  onPress={fecharModalFinalizacao}
                  disabled={finalizandoTroca}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalConfirmButton,
                    finalizandoTroca && styles.buttonDisabled,
                  ]}
                  activeOpacity={0.7}
                  onPress={handleFinalizeTrade}
                  disabled={
                    finalizandoTroca || tradeStatus !== "em_andamento"
                  }
                >
                  {finalizandoTroca ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Feather name="check" size={18} color="#FFFFFF" />
                  )}
                  <Text style={styles.modalConfirmText}>
                    {finalizandoTroca ? "Confirmando..." : "Sim, finalizar"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  mainContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    backgroundColor: "#FFFFFF",
    paddingTop: 40,
  },

  backBtn: {
    marginRight: 10,
  },

  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E4F8FF",
  },

  headerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
  },

  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },

  headerName: {
    fontSize: 15,
    fontFamily: "Montserrat_600SemiBold",
    color: "#005386",
  },

  headerStatus: {
    fontSize: 12,
    color: "#777777",
  },

  productBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F8FB",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },

  productClickable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  bannerImage: {
    width: 55,
    height: 55,
    borderRadius: 8,
    backgroundColor: "#DDDDDD",
  },

  bannerImageFallback: {
    width: 55,
    height: 55,
    borderRadius: 8,
    backgroundColor: "#DDDDDD",
    justifyContent: "center",
    alignItems: "center",
  },

  bannerInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },

  bannerLabel: {
    fontSize: 11,
    color: "#777777",
  },

  bannerTitle: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
    color: "#005386",
  },

  bannerHint: {
    fontSize: 10,
    color: "#999999",
    marginTop: 2,
  },

  finishBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },

  finishBtnActive: {
    backgroundColor: "#0099FF",
  },

  finishBtnWaiting: {
    backgroundColor: "#777777",
  },

  finishBtnDone: {
    backgroundColor: "#28A745",
  },

  finishBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Montserrat_600SemiBold",
  },

  chatContainer: {
    padding: 16,
    paddingBottom: 180,
  },

  messageBubble: {
    maxWidth: "75%",
    padding: 8,
    borderRadius: 14,
    marginVertical: 6,
  },

  myMessage: {
    backgroundColor: "#0099FF",
    alignSelf: "flex-end",
    borderBottomRightRadius: 2,
  },

  otherMessage: {
    backgroundColor: "#F0F2F5",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 2,
  },

  pendingBubble: {
    opacity: 0.65,
  },

  messageImage: {
    width: 220,
    height: 220,
    borderRadius: 10,
    marginBottom: 4,
  },

  messageText: {
    fontSize: 14,
    flexShrink: 1,
  },

  myMessageText: {
    color: "#FFFFFF",
  },

  otherMessageText: {
    color: "#333333",
  },

  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 3,
  },

  messageTime: {
    fontSize: 10,
    marginLeft: 8,
  },

  myMessageTime: {
    color: "#D9F1FF",
  },

  otherMessageTime: {
    color: "#777777",
  },

  systemMessageBubble: {
    backgroundColor: "#E8F5E9",
    padding: 10,
    borderRadius: 8,
    alignSelf: "center",
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#A5D6A7",
  },

  systemMessageText: {
    color: "#2E7D32",
    fontSize: 12,
    textAlign: "center",
    fontFamily: "Montserrat_600SemiBold",
  },

  emptyMessages: {
    textAlign: "center",
    color: "#777777",
    fontSize: 14,
    marginTop: 30,
  },

  imagePreviewContainer: {
    position: "absolute",
    left: 16,
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDDDDD",
    padding: 4,
    elevation: 5,
    shadowColor: "#000000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 20,
  },

  imagePreview: {
    width: "100%",
    height: "85%",
    borderRadius: 9,
  },

  imagePreviewName: {
    fontSize: 9,
    color: "#777777",
    textAlign: "center",
    marginTop: 2,
  },

  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#555555",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
  },

  inputContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    zIndex: 10,
    elevation: 20,
  },

  imageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
    backgroundColor: "#F4F8FB",
  },

  imageButtonDisabled: {
    opacity: 0.5,
  },

  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: "#F7F9FA",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    fontSize: 14,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0099FF",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },

  sendButtonDisabled: {
    opacity: 0.5,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  modalContainer: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "90%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },

  modalContent: {
    padding: 24,
  },

  modalIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginBottom: 18,
  },

  modalTitle: {
    fontSize: 20,
    fontFamily: "Montserrat_600SemiBold",
    color: "#005386",
    textAlign: "center",
    marginBottom: 12,
  },

  modalDescription: {
    fontSize: 15,
    color: "#555555",
    textAlign: "center",
    lineHeight: 23,
  },

  modalNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F0F8FF",
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    gap: 10,
  },

  modalNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#005386",
    lineHeight: 19,
  },

  modalErrorContainer: {
    backgroundColor: "#FFF1F0",
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },

  modalErrorText: {
    fontSize: 13,
    color: "#B42318",
    lineHeight: 19,
  },

  modalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 24,
  },

  modalCancelButton: {
    flexGrow: 1,
    flexBasis: 100,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8E3EB",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },

  modalCancelText: {
    color: "#005386",
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
    textAlign: "center",
  },

  modalConfirmButton: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: "#0099FF",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
  },

  modalConfirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
    textAlign: "center",
    flexShrink: 1,
  },
});