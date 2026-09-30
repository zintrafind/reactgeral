import { Feather } from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useFocusEffect, useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";
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
  Alert,

  AppState,

  type AppStateStatus,

  Image,

  Modal,
  Platform,
  ScrollView,

  StyleSheet,

  Text,

  TouchableOpacity,

  View
} from "react-native";



import api from "../../services/api";



// ============================================================

// TIPOS

// ============================================================



type ImagemProduto = {

  id_imagem?: number;

  ds_imagem?: string | null;

};



type ProdutoTroca = {

  id_produto: number;

  nm_produto: string;

  ds_produto?: string | null;

  st_condicao?: string;

  images?: ImagemProduto[];

  imagens?: ImagemProduto[];

  ds_imagem?: string | null;

};



type Troca = {

  id: number;

  usuarioProposta: string;

  idOutroUsuario: number;

  fotoOutroUsuario: string | null;

  status: "PENDENTE" | "ACEITA" | "RECUSADA" | "FINALIZADA";

  meuProduto: ProdutoTroca | null;

  outroProduto: ProdutoTroca | null;

  idSolicitante: number;

  idDestinatario: number;

};



// ============================================================

// CONSTANTES

// ============================================================



const TROCAS_CACHE_KEY = "@pecapeca:trocas_cache_v1";

const TROCAS_CACHE_MAX_AGE = 1000 * 60 * 60 * 6; // 6h

const CACHE_TROCAS = 30_000; // throttle de foco (30s)

const TEMPO_LIMITE_REQUISICAO = 15000;

const LIMITE_INICIAL = 12;



const CONDITION_NAMES: Record<string, string> = {

  N: "Novo",

  S: "Seminovo",

  U: "Usado",

  Q: "Quebrado",

};



// ============================================================

// HELPERS

// ============================================================



function getImageUrl(imagePath?: string | null): string | null {
  if (!imagePath) return null;

  let path = String(imagePath).trim();
  if (!path) return null;

  if (/^https?:\/\//i.test(path)) return path;

  const baseUrl = String(
    api.defaults?.baseURL || "http://127.0.0.1:8000/api"
  )
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");

  path = path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^public\//, "")
    .replace(/^storage\/+/, "");

  return `${baseUrl}/storage/${path}`;
}


function getProdutoImage(produto: ProdutoTroca | null): string | null {

  if (!produto) return null;

  const imagePath =

    produto.images?.[0]?.ds_imagem ||

    produto.imagens?.[0]?.ds_imagem ||

    produto.ds_imagem ||

    null;

  return getImageUrl(imagePath);

}



function formatarTroca(proposta: any, usuarioLogadoId: number): Troca {

  const itemOferecido = proposta.itens?.find((i: any) => i.tp_item === "O");

  const itemDesejado = proposta.itens?.find((i: any) => i.tp_item === "D");



  const produtoOferecido = itemOferecido?.produto || null;

  const produtoDesejado = itemDesejado?.produto || null;



  const idSolicitante = Number(proposta.id_solicitante);

  const idDestinatario = Number(proposta.id_destinatario);

  const souDestinatario = idDestinatario === usuarioLogadoId;



  const outroUsuario = souDestinatario

    ? proposta.solicitante

    : proposta.destinatario;



  const status: Troca["status"] =

    proposta.st_troca === "P"

      ? "PENDENTE"

      : proposta.st_troca === "A"

      ? "ACEITA"

      : proposta.st_troca === "F"

      ? "FINALIZADA"

      : "RECUSADA";



  return {

    id: Number(proposta.id_proposta),

    usuarioProposta: outroUsuario?.nm_usuario || "Usuário",

    idOutroUsuario: Number(

      outroUsuario?.id_usuario ||

        (souDestinatario ? idSolicitante : idDestinatario)

    ),

    fotoOutroUsuario: outroUsuario?.ds_foto_perfil || null,

    status,

    meuProduto: souDestinatario ? produtoDesejado : produtoOferecido,

    outroProduto: souDestinatario ? produtoOferecido : produtoDesejado,

    idSolicitante,

    idDestinatario,

  };

}



// ============================================================

// CACHE

// ============================================================



async function saveTrocasCache(trocas: Troca[]) {

  try {

    await AsyncStorage.setItem(

      TROCAS_CACHE_KEY,

      JSON.stringify({ ts: Date.now(), data: trocas.slice(0, 100) })

    );

  } catch {}

}



async function loadTrocasCache(): Promise<Troca[] | null> {

  try {

    const raw = await AsyncStorage.getItem(TROCAS_CACHE_KEY);

    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (!parsed?.ts || !Array.isArray(parsed?.data)) return null;

    if (Date.now() - parsed.ts > TROCAS_CACHE_MAX_AGE) return null;

    return parsed.data as Troca[];

  } catch {

    return null;

  }

}



// ============================================================

// SKELETON

// ============================================================



const SkeletonTradeCard = memo(function SkeletonTradeCard() {

  return (

    <View style={styles.tradeCard}>

      {/* Perfil */}

      <View style={styles.userHeader}>

        <View style={[styles.otherUserAvatar, styles.skeletonBlock]} />

        <View style={styles.otherUserText}>

          <View

            style={[

              styles.skeletonLine,

              { width: 60, height: 10, marginBottom: 6 },

            ]}

          />

          <View style={[styles.skeletonLine, { width: 120, height: 14 }]} />

        </View>

      </View>



      <View style={styles.headerDivider} />



      {/* Produtos */}

      <View style={styles.exchangeContainer}>

        <View style={[styles.skeletonLine, { width: 80, height: 10, marginBottom: 8 }]} />

        <View style={[styles.skeletonBlock, { height: 82, borderRadius: 12 }]} />

        <View style={{ height: 18 }} />

        <View style={[styles.skeletonLine, { width: 80, height: 10, marginBottom: 8 }]} />

        <View style={[styles.skeletonBlock, { height: 82, borderRadius: 12 }]} />

      </View>

    </View>

  );

});



// ============================================================

// STATUS BADGE

// ============================================================



const StatusTroca = memo(function StatusTroca({

  status,

}: {

  status: Troca["status"];

}) {

  const config = useMemo(() => {

    switch (status) {

      case "PENDENTE":

        return {

          style: styles.pendingBadge,

          icon: "clock" as const,

          color: "#856404",

          label: "Pendente",

        };

      case "ACEITA":

        return {

          style: styles.acceptedBadge,

          icon: "check-circle" as const,

          color: "#155724",

          label: "Aceita",

        };

      case "FINALIZADA":

        return {

          style: styles.finishedBadge,

          icon: "check-circle" as const,

          color: "#155724",

          label: "Finalizada",

        };

      default:

        return {

          style: styles.rejectedBadge,

          icon: "x-circle" as const,

          color: "#721C24",

          label: "Recusada",

        };

    }

  }, [status]);



  return (

    <View style={[styles.statusBadge, config.style]}>

      <Feather name={config.icon} size={11} color={config.color} />

      <Text style={[styles.statusText, { color: config.color }]}>

        {config.label}

      </Text>

    </View>

  );

});



// ============================================================

// CARD DE PRODUTO (memoizado)

// ============================================================



const ProdutoTrocaCard = memo(function ProdutoTrocaCard({

  produto,

  titulo,

  onPress,

}: {

  produto: ProdutoTroca | null;

  titulo: string;

  onPress: (produto: ProdutoTroca | null) => void;

}) {

  const imageUrl = useMemo(() => getProdutoImage(produto), [produto]);

  const [failed, setFailed] = useState(false);



  const handlePress = useCallback(() => onPress(produto), [onPress, produto]);

  const handleError = useCallback(() => setFailed(true), []);



  if (!produto) {

    return (

      <View style={styles.tradeProductSection}>

        <Text style={styles.tradeProductTitle}>{titulo}</Text>

        <View style={styles.productUnavailable}>

          <Feather name="package" size={25} color="#AABBC5" />

          <Text style={styles.productUnavailableText}>

            Produto indisponível

          </Text>

        </View>

      </View>

    );

  }



  const showImage = imageUrl && !failed;



  return (

    <View style={styles.tradeProductSection}>

      <Text style={styles.tradeProductTitle}>{titulo}</Text>



      <View style={styles.tradeProductCard}>

        <View style={styles.tradeProductImageContainer}>

          {showImage ? (

            <Image

              source={{ uri: imageUrl! }}

              style={styles.tradeProductImage}

              resizeMode="cover"

              onError={handleError}

              fadeDuration={150}

            />

          ) : (

            <View style={styles.noImageContainer}>

              <Feather name="image" size={27} color="#9BB5C4" />

              <Text style={styles.noImageText}>Sem foto</Text>

            </View>

          )}

        </View>



        <View style={styles.tradeProductContent}>

          <Text style={styles.tradeProductName} numberOfLines={2}>

            {produto.nm_produto}

          </Text>



          {!!produto.st_condicao && (

            <View style={styles.conditionRow}>

              <View style={styles.conditionDot} />

              <Text style={styles.tradeProductCondition}>

                {CONDITION_NAMES[produto.st_condicao] || produto.st_condicao}

              </Text>

            </View>

          )}



          <TouchableOpacity

            style={styles.viewItemButton}

            onPress={handlePress}

            activeOpacity={0.7}

          >

            <Text style={styles.viewItemButtonText}>Ver item</Text>

            <Feather name="chevron-right" size={14} color="#005386" />

          </TouchableOpacity>

        </View>

      </View>

    </View>

  );

});



// ============================================================

// HOOK — TROCAS (cache-first + SWR)

// ============================================================



function useTrocas() {

  const [trocas, setTrocas] = useState<Troca[]>([]);

  const [loading, setLoading] = useState(true);

  const [usuarioLogado, setUsuarioLogado] = useState<number | null>(null);



  const trocasRef = useRef<Troca[]>([]);

  const carregandoRef = useRef(false);

  const tokenRef = useRef<string | null>(null);

  const usuarioRef = useRef<number | null>(null);

  const ultimaAtualizacaoRef = useRef(0);

  const loadedRef = useRef(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);



  // Sincroniza ref

  useEffect(() => {

    trocasRef.current = trocas;

  }, [trocas]);



  // AppState

  useEffect(() => {

    const sub = AppState.addEventListener("change", (state) => {

      appStateRef.current = state;

    });

    return () => sub.remove();

  }, []);



  // 1) Cache na montagem + usuário/token

  useEffect(() => {

    let ativo = true;



    (async () => {

      const [cached, usuarioStorage, token] = await Promise.all([

        loadTrocasCache(),

        AsyncStorage.getItem("usuario"),

        AsyncStorage.getItem("token"),

      ]);



      if (!ativo) return;



      tokenRef.current = token;



      if (usuarioStorage) {

        try {

          const u = JSON.parse(usuarioStorage);

          const id = Number(u?.id_usuario);

          if (Number.isFinite(id) && id > 0) {

            usuarioRef.current = id;

            setUsuarioLogado(id);

          }

        } catch {}

      }



      if (cached && cached.length > 0) {

        trocasRef.current = cached;

        setTrocas(cached);

        setLoading(false);

        loadedRef.current = true;

      }

    })();



    return () => {

      ativo = false;

    };

  }, []);



  // 2) Fetch

  const carregarTrocas = useCallback(

    async (mostrarLoading = false, forcar = false, signal?: AbortSignal) => {

      if (carregandoRef.current) return;



      if (

        !forcar &&

        loadedRef.current &&

        Date.now() - ultimaAtualizacaoRef.current < CACHE_TROCAS

      ) {

        return;

      }



      // Precisa de token + usuário

      let token = tokenRef.current;

      let idUsuario = usuarioRef.current;



      if (!token || !idUsuario) {

        const [tokenStorage, usuarioStorage] = await Promise.all([

          AsyncStorage.getItem("token"),

          AsyncStorage.getItem("usuario"),

        ]);



        token = tokenStorage;

        tokenRef.current = tokenStorage;



        if (usuarioStorage) {

          try {

            const u = JSON.parse(usuarioStorage);

            const id = Number(u?.id_usuario);

            if (Number.isFinite(id) && id > 0) {

              idUsuario = id;

              usuarioRef.current = id;

              setUsuarioLogado(id);

            }

          } catch {}

        }

      }



      if (!token || !idUsuario) {

        setLoading(false);

        return;

      }



      carregandoRef.current = true;

      if (mostrarLoading && !loadedRef.current) setLoading(true);



      try {

        const response = await api.get("/propostas", {

          headers: {

            Accept: "application/json",

            Authorization: `Bearer ${token}`,

          },

          signal,

          timeout: TEMPO_LIMITE_REQUISICAO,

        });



        if (signal?.aborted) return;



        const propostas = Array.isArray(response.data?.propostas)

          ? response.data.propostas

          : [];



        const formatadas: Troca[] = propostas.map((p: any) =>

          formatarTroca(p, idUsuario!)

        );



        setTrocas(formatadas);

        trocasRef.current = formatadas;

        loadedRef.current = true;

        ultimaAtualizacaoRef.current = Date.now();

        saveTrocasCache(formatadas);

      } catch (error: any) {

        if (signal?.aborted) return;

        if (!loadedRef.current && trocasRef.current.length === 0) {

          // Só alerta se ainda não tem nada pra mostrar

          const msg =

            error?.response?.data?.message ||

            error?.message ||

            "Não foi possível carregar suas trocas.";

          // Evita spam de alert

          console.warn("Erro ao carregar trocas:", msg);

        }

      } finally {

        carregandoRef.current = false;

        setLoading(false);

      }

    },

    []

  );



  // 3) Primeiro fetch

  useEffect(() => {

    const ctrl = new AbortController();

    carregarTrocas(true, true, ctrl.signal);

    return () => ctrl.abort();

  }, [carregarTrocas]);



  // 4) Refresh em foco (throttled)

  useFocusEffect(

    useCallback(() => {

      if (!loadedRef.current) return;

      if (Date.now() - ultimaAtualizacaoRef.current < CACHE_TROCAS) return;

      if (appStateRef.current !== "active") return;



      const ctrl = new AbortController();

      carregarTrocas(false, false, ctrl.signal);

      return () => ctrl.abort();

    }, [carregarTrocas])

  );



  // 5) Atualização local otimista

  const atualizarStatusLocal = useCallback(

    (id: number, status: Troca["status"]) => {

      setTrocas((atuais) => {

        const novas = atuais.map((t) =>

          t.id === id ? { ...t, status } : t

        );

        trocasRef.current = novas;

        saveTrocasCache(novas);

        ultimaAtualizacaoRef.current = Date.now();

        return novas;

      });

    },

    []

  );



  const recarregar = useCallback(

    (forcar = true) => carregarTrocas(false, forcar),

    [carregarTrocas]

  );



  return {

    trocas,

    loading,

    usuarioLogado,

    atualizarStatusLocal,

    recarregar,

  };

}



// ============================================================

// TELA

// ============================================================



export default function TrocasScreen() {

  const router = useRouter();



  const {

    trocas,

    loading,

    usuarioLogado,

    atualizarStatusLocal,

    recarregar,

  } = useTrocas();



  const [activeTab, setActiveTab] = useState<

    "TODAS" | "RECEBIDAS" | "ENVIADAS"

  >("TODAS");



  const [limiteVisivel, setLimiteVisivel] = useState(LIMITE_INICIAL);

  const [erroAcao, setErroAcao] = useState("");
  const [acaoEmAndamento, setAcaoEmAndamento] = useState<number | null>(null);
  const [confirmacaoTroca, setConfirmacaoTroca] = useState<{
    visivel: boolean;
    id: number | null;
    tipo: "A" | "R" | null;
  }>({ visivel: false, id: null, tipo: null });



  // Reset limite ao trocar aba

  useEffect(() => {

    setLimiteVisivel(LIMITE_INICIAL);

  }, [activeTab]);



  // Filtros

  const trocasFiltradas = useMemo(() => {

    if (activeTab === "TODAS") return trocas;

    return trocas.filter((item) =>

      activeTab === "RECEBIDAS"

        ? item.idDestinatario === usuarioLogado

        : item.idSolicitante === usuarioLogado

    );

  }, [trocas, activeTab, usuarioLogado]);



  const trocasVisiveis = useMemo(

    () => trocasFiltradas.slice(0, limiteVisivel),

    [trocasFiltradas, limiteVisivel]

  );



  const temMais = trocasFiltradas.length > limiteVisivel;



  // ==========================================================

  // AÇÕES

  // ==========================================================



  const handleAlterarStatus = useCallback(
    async (id: number, status: "A" | "R") => {
      if (acaoEmAndamento !== null) return;

      const statusAnterior =
        trocas.find((troca) => troca.id === id)?.status || "PENDENTE";

      try {
        setErroAcao("");
        setAcaoEmAndamento(id);

        atualizarStatusLocal(
          id,
          status === "A" ? "ACEITA" : "RECUSADA"
        );

        const token = await AsyncStorage.getItem("token");

        if (!token) {
          atualizarStatusLocal(id, statusAnterior);
          const mensagem = "Sua sessão expirou. Faça login novamente.";
          setErroAcao(mensagem);

          if (Platform.OS === "web") window.alert(mensagem);
          else Alert.alert("Login necessário", mensagem);
          return;
        }

        const response = await api.put(
          `/propostas/${id}/status`,
          { st_troca: status },
          {
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            timeout: TEMPO_LIMITE_REQUISICAO,
          }
        );

        const mensagem =
          response?.data?.message ||
          (status === "A"
            ? "A proposta de troca foi aceita."
            : "A proposta de troca foi recusada.");

        if (Platform.OS === "web") window.alert(mensagem);
        else {
          Alert.alert(
            status === "A" ? "Troca aceita!" : "Troca recusada!",
            mensagem
          );
        }
      } catch (error: any) {
        atualizarStatusLocal(id, statusAnterior);

        const mensagem =
          error?.response?.data?.message ||
          error?.response?.data?.errors?.st_troca?.[0] ||
          error?.message ||
          "Não foi possível alterar o status da troca.";

        console.error("ERRO AO ALTERAR STATUS DA TROCA:", {
          id,
          status,
          httpStatus: error?.response?.status,
          data: error?.response?.data,
          error,
        });

        setErroAcao(mensagem);

        if (Platform.OS === "web") window.alert(mensagem);
        else Alert.alert("Erro", mensagem);
      } finally {
        setAcaoEmAndamento(null);
      }
    },
    [acaoEmAndamento, atualizarStatusLocal, trocas]
  );

  const fecharConfirmacaoTroca = useCallback(() => {
    if (acaoEmAndamento !== null) return;
    setConfirmacaoTroca({ visivel: false, id: null, tipo: null });
  }, [acaoEmAndamento]);

  const confirmarAcaoTroca = useCallback(async () => {
    const { id, tipo } = confirmacaoTroca;
    if (!id || !tipo || acaoEmAndamento !== null) return;

    await handleAlterarStatus(id, tipo);
    setConfirmacaoTroca({ visivel: false, id: null, tipo: null });
  }, [acaoEmAndamento, confirmacaoTroca, handleAlterarStatus]);

  const handleAceitarTroca = useCallback((id: number) => {
    if (acaoEmAndamento !== null) return;
    setConfirmacaoTroca({ visivel: true, id, tipo: "A" });
  }, [acaoEmAndamento]);

  const handleRecusarTroca = useCallback((id: number) => {
    if (acaoEmAndamento !== null) return;
    setConfirmacaoTroca({ visivel: true, id, tipo: "R" });
  }, [acaoEmAndamento]);


  const abrirProduto = useCallback(

    (produto: ProdutoTroca | null) => {

      if (!produto?.id_produto) return;

      router.push({

        pathname: "/visuanuncios",

        params: { id: String(produto.id_produto) },

      } as any);

    },

    [router]

  );



  const abrirPerfil = useCallback(

    (idUsuario: number) => {

      router.push({

        pathname: "/perfilusuario",

        params: { id: String(idUsuario) },

      } as any);

    },

    [router]

  );



  const abrirChat = useCallback(

    (idProposta: number) => {

      router.push({

        pathname: "/mensagens/chat",

        params: { id_proposta: String(idProposta) },

      } as any);

    },

    [router]

  );



  const carregarMais = useCallback(() => {

    setLimiteVisivel((v) => v + LIMITE_INICIAL);

  }, []);



  // ==========================================================

  // RENDER ITEM (memoizado via useCallback)

  // ==========================================================



  const renderTrade = useCallback(

    (item: Troca) => {

      const podeResponder = item.idDestinatario === usuarioLogado;

      const fotoPerfilUrl = getImageUrl(item.fotoOutroUsuario);



      return (

        <View key={item.id} style={styles.tradeCard}>

          {/* PERFIL + STATUS */}

          <View style={styles.userHeader}>

            <View style={styles.otherUserAvatar}>

              {fotoPerfilUrl ? (

                <Image

                  source={{ uri: fotoPerfilUrl }}

                  style={styles.otherUserAvatarImage}

                  resizeMode="cover"

                  fadeDuration={150}

                />

              ) : (

                <Feather name="user" size={21} color="#005386" />

              )}

            </View>



            <View style={styles.otherUserText}>

              <Text style={styles.tradeWithLabel}>Troca com</Text>

              <Text style={styles.tradeWithName} numberOfLines={1}>

                {item.usuarioProposta}

              </Text>

              <View style={styles.statusUnderUser}>

                <StatusTroca status={item.status} />

              </View>

            </View>



            <TouchableOpacity

              style={styles.profileActionButton}

              onPress={() => abrirPerfil(item.idOutroUsuario)}

              activeOpacity={0.7}

            >

              <Text style={styles.profileActionText}>Ver perfil</Text>

              <Feather name="chevron-right" size={14} color="#005386" />

            </TouchableOpacity>

          </View>



          <View style={styles.headerDivider} />



          {/* PRODUTOS */}

          <View style={styles.exchangeContainer}>

            <ProdutoTrocaCard

              produto={item.outroProduto}

              titulo="VOCÊ RECEBE"

              onPress={abrirProduto}

            />



            <View style={styles.exchangeDivider}>

              <View style={styles.exchangeLine} />

              <View style={styles.exchangeIcon}>

                <Feather name="repeat" size={17} color="#FFFFFF" />

              </View>

              <View style={styles.exchangeLine} />

            </View>



            <ProdutoTrocaCard

              produto={item.meuProduto}

              titulo="VOCÊ OFERECE"

              onPress={abrirProduto}

            />

          </View>



          {/* PENDENTE - RECEBIDA */}

          {item.status === "PENDENTE" && podeResponder && (

            <>

              <Text style={styles.actionQuestion}>

                Deseja aceitar esta proposta?

              </Text>



              <View style={styles.pendingActionsRow}>

                <TouchableOpacity

                  style={[styles.actionBtn, styles.rejectBtn]}

                  onPress={() => handleRecusarTroca(item.id)}

                  activeOpacity={0.8}

                >

                  <Feather name="x" size={17} color="#555555" />

                  <Text style={styles.rejectBtnText}>Recusar</Text>

                </TouchableOpacity>



                <TouchableOpacity

                  style={[styles.actionBtn, styles.acceptBtn]}

                  onPress={() => handleAceitarTroca(item.id)}

                  activeOpacity={0.8}

                >

                  <Feather name="check" size={17} color="#FFFFFF" />

                  <Text style={styles.acceptBtnText}>Aceitar troca</Text>

                </TouchableOpacity>

              </View>

            </>

          )}



          {/* PENDENTE - ENVIADA */}

          {item.status === "PENDENTE" && !podeResponder && (

            <View style={styles.waitingInfoBox}>

              <Feather name="clock" size={15} color="#856404" />

              <Text style={styles.waitingInfoText}>

                Aguardando resposta de {item.usuarioProposta}

              </Text>

            </View>

          )}



          {/* ACEITA */}

          {item.status === "ACEITA" && (

            <View>

              <View style={styles.acceptedInfoBox}>

                <Feather name="check-circle" size={16} color="#155724" />

                <Text style={styles.acceptedInfoText}>

                  Proposta aceita. Converse com o outro usuário para combinar a

                  troca.

                </Text>

              </View>



              <TouchableOpacity

                style={styles.chatActionButton}

                onPress={() => abrirChat(item.id)}

                activeOpacity={0.8}

              >

                <Feather name="message-square" size={18} color="#FFFFFF" />

                <Text style={styles.chatActionButtonText}>

                  Conversar sobre a troca

                </Text>

              </TouchableOpacity>

            </View>

          )}



          {/* FINALIZADA */}

          {item.status === "FINALIZADA" && (

            <View style={styles.finishedInfoBox}>

              <Feather name="check-circle" size={16} color="#155724" />

              <Text style={styles.finishedInfoText}>

                Esta troca foi finalizada.

              </Text>

            </View>

          )}



          {/* RECUSADA */}

          {item.status === "RECUSADA" && (

            <View style={styles.rejectedInfoBox}>

              <Feather name="x-circle" size={16} color="#888888" />

              <Text style={styles.rejectedInfoText}>

                Esta proposta foi recusada.

              </Text>

            </View>

          )}

        </View>

      );

    },

    [

      usuarioLogado,

      abrirPerfil,

      abrirProduto,

      abrirChat,

      handleAceitarTroca,

      handleRecusarTroca,

    ]

  );



  // ==========================================================

  // RENDER

  // ==========================================================



  const showSkeleton = loading && trocas.length === 0;



  return (
    <>
      <Modal
        visible={confirmacaoTroca.visivel}
        transparent
        animationType="fade"
        onRequestClose={fecharConfirmacaoTroca}
      >
        <View style={styles.confirmacaoOverlay}>
          <View style={styles.confirmacaoCard}>
            <View style={styles.confirmacaoIcone}>
              <Ionicons
                name={confirmacaoTroca.tipo === "A" ? "checkmark-circle-outline" : "close-circle-outline"}
                size={34}
                color="#0099FF"
              />
            </View>

            <Text style={styles.confirmacaoTitulo}>
              {confirmacaoTroca.tipo === "A" ? "Aceitar proposta" : "Recusar proposta"}
            </Text>

            <Text style={styles.confirmacaoTexto}>
              {confirmacaoTroca.tipo === "A"
                ? "Tem certeza de que deseja aceitar esta proposta de troca?"
                : "Tem certeza de que deseja recusar esta proposta de troca?"}
            </Text>

            <View style={styles.confirmacaoAcoes}>
              <TouchableOpacity
                style={styles.confirmacaoCancelar}
                onPress={fecharConfirmacaoTroca}
                disabled={acaoEmAndamento !== null}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmacaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmacaoConfirmar}
                onPress={() => void confirmarAcaoTroca()}
                disabled={acaoEmAndamento !== null}
                activeOpacity={0.8}
              >
                {acaoEmAndamento !== null ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmacaoConfirmarTexto}>
                    {confirmacaoTroca.tipo === "A" ? "Aceitar troca" : "Recusar"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    <View style={styles.mainContainer}>

      <ScrollView

        style={styles.container}

        showsVerticalScrollIndicator={false}

      >

        {/* CABEÇALHO */}

        <View style={styles.header}>

          <Text style={styles.headerTitle}>Minhas Trocas</Text>

          <Text style={styles.headerSubtitle}>

            Acompanhe e gerencie suas propostas de troca

          </Text>

        </View>



        {/* ABAS */}

        <View style={styles.tabsContainer}>

          {(["TODAS", "RECEBIDAS", "ENVIADAS"] as const).map((tab) => {

            const isActive = activeTab === tab;

            return (

              <TouchableOpacity

                key={tab}

                style={[styles.tabButton, isActive && styles.activeTabButton]}

                onPress={() => setActiveTab(tab)}

                activeOpacity={0.7}

              >

                <Text style={[styles.tabText, isActive && styles.activeTabText]}>

                  {tab.charAt(0) + tab.slice(1).toLowerCase()}

                </Text>

              </TouchableOpacity>

            );

          })}

        </View>



        {/* ERRO DE AÇÃO */}

        {erroAcao ? (

          <View style={styles.erroAcaoBox}>

            <Feather name="alert-circle" size={14} color="#A33A32" />

            <Text style={styles.erroAcaoTexto}>{erroAcao}</Text>

          </View>

        ) : null}



        {/* LISTA */}

        <View style={styles.cardsContainer}>

          {showSkeleton ? (

            <>

              <SkeletonTradeCard />

              <SkeletonTradeCard />

              <SkeletonTradeCard />

            </>

          ) : trocasFiltradas.length === 0 ? (

            <View style={styles.emptyContainer}>

              <View style={styles.emptyIconContainer}>

                <Feather name="repeat" size={28} color="#0099FF" />

              </View>

              <Text style={styles.emptyTitle}>Nenhuma troca encontrada</Text>

              <Text style={styles.emptyText}>

                Suas solicitações de troca aparecerão aqui.

              </Text>

            </View>

          ) : (

            <>

              {trocasVisiveis.map(renderTrade)}



              {temMais && (

                <TouchableOpacity

                  style={styles.loadMoreButton}

                  onPress={carregarMais}

                  activeOpacity={0.8}

                >

                  <Text style={styles.loadMoreText}>

                    Ver mais ({trocasFiltradas.length - limiteVisivel})

                  </Text>

                  <Feather name="chevron-down" size={16} color="#005386" />

                </TouchableOpacity>

              )}

            </>

          )}

        </View>

      </ScrollView>

    </View>
    </>

  );

}



// ============================================================

// ESTILOS

// ============================================================



const styles = StyleSheet.create({

  mainContainer: { flex: 1, backgroundColor: "#FFFFFF" },

  container: { flex: 1, backgroundColor: "#FFFFFF" },



  // ============ CABEÇALHO ============

  header: {

    paddingHorizontal: 20,

    paddingTop: 45,

    paddingBottom: 10,

  },

  headerTitle: {

    fontSize: 22,

    fontFamily: "Montserrat_700Bold",

    color: "#005386",

  },

  headerSubtitle: {

    fontSize: 13,

    fontFamily: "Montserrat_400Regular",

    color: "#777777",

    marginTop: 3,

  },



  // ============ ABAS ============

  tabsContainer: {

    flexDirection: "row",

    backgroundColor: "#F1F3F5",

    borderRadius: 25,

    marginHorizontal: 20,

    marginTop: 10,

    padding: 4,

  },

  tabButton: {

    flex: 1,

    paddingVertical: 9,

    alignItems: "center",

    borderRadius: 20,

  },

  activeTabButton: {

    backgroundColor: "#FFFFFF",

    elevation: 2,

    shadowColor: "#000000",

    shadowOffset: { width: 0, height: 1 },

    shadowOpacity: 0.08,

    shadowRadius: 3,

  },

  tabText: {

    fontSize: 12,

    fontFamily: "Montserrat_600SemiBold",

    color: "#777777",

  },

  activeTabText: { color: "#005386" },



  // ============ ERRO AÇÃO ============

  erroAcaoBox: {

    flexDirection: "row",

    alignItems: "center",

    gap: 6,

    marginHorizontal: 20,

    marginTop: 12,

    paddingVertical: 8,

    paddingHorizontal: 12,

    borderRadius: 10,

    backgroundColor: "#FDECEA",

    borderWidth: 1,

    borderColor: "#F5C6C0",

  },

  erroAcaoTexto: {

    flex: 1,

    fontSize: 12,

    color: "#A33A32",

    fontFamily: "Montserrat_400Regular",

  },



  // ============ LISTA ============

  cardsContainer: {

    paddingHorizontal: 16,

    paddingTop: 16,

    paddingBottom: 30,

  },



  // ============ EMPTY ============

  emptyContainer: {

    alignItems: "center",

    justifyContent: "center",

    paddingVertical: 60,

  },

  emptyIconContainer: {

    width: 58,

    height: 58,

    borderRadius: 29,

    backgroundColor: "#F1FAFF",

    justifyContent: "center",

    alignItems: "center",

  },

  emptyTitle: {

    marginTop: 14,

    fontSize: 15,

    fontFamily: "Montserrat_700Bold",

    color: "#555555",

  },

  emptyText: {

    marginTop: 5,

    fontSize: 12,

    fontFamily: "Montserrat_400Regular",

    color: "#888888",

    textAlign: "center",

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

    marginBottom: 12,

    gap: 6,

  },

  loadMoreText: {

    fontSize: 13,

    color: "#005386",

    fontFamily: "Montserrat_600SemiBold",

  },



  // ============ CARD ============

  tradeCard: {

    backgroundColor: "#FFFFFF",

    borderRadius: 18,

    borderWidth: 1,

    borderColor: "#DFEAF0",

    padding: 15,

    marginBottom: 18,

    elevation: 3,

    shadowColor: "#000000",

    shadowOffset: { width: 0, height: 2 },

    shadowOpacity: 0.07,

    shadowRadius: 6,

  },



  // ============ PERFIL ============

  userHeader: {

    flexDirection: "row",

    alignItems: "center",

    paddingBottom: 13,

  },

  otherUserAvatar: {

    width: 48,

    height: 48,

    borderRadius: 24,

    backgroundColor: "#F1FAFF",

    borderWidth: 1,

    borderColor: "#D9EFFC",

    justifyContent: "center",

    alignItems: "center",

    overflow: "hidden",

    marginRight: 11,

  },

  otherUserAvatarImage: {

    width: "100%",

    height: "100%",

    borderRadius: 24,

  },

  otherUserText: { flex: 1 },

  tradeWithLabel: {

    fontSize: 10,

    color: "#888888",

    fontFamily: "Montserrat_400Regular",

  },

  tradeWithName: {

    marginTop: 1,

    fontSize: 14,

    color: "#333333",

    fontFamily: "Montserrat_600SemiBold",

  },

  statusUnderUser: {

    alignSelf: "flex-start",

    marginTop: 5,

  },

  profileActionButton: {

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 11,

    height: 35,

    borderRadius: 18,

    backgroundColor: "#F1FAFF",

    borderWidth: 1,

    borderColor: "#BDE5FF",

  },

  profileActionText: {

    marginLeft: 5,

    marginRight: 1,

    fontSize: 10,

    color: "#005386",

    fontFamily: "Montserrat_600SemiBold",

  },

  headerDivider: {

    height: 1,

    backgroundColor: "#EEF2F4",

    marginBottom: 12,

  },



  // ============ STATUS ============

  statusBadge: {

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 8,

    paddingVertical: 4,

    borderRadius: 10,

  },

  statusText: {

    fontSize: 9,

    fontFamily: "Montserrat_600SemiBold",

    marginLeft: 4,

  },

  pendingBadge: { backgroundColor: "#FFF3CD" },

  acceptedBadge: { backgroundColor: "#D4EDDA" },

  finishedBadge: { backgroundColor: "#E2F0D9" },

  rejectedBadge: { backgroundColor: "#F8D7DA" },



  // ============ ÁREA DA TROCA ============

  exchangeContainer: {

    backgroundColor: "#F8FCFF",

    borderRadius: 14,

    padding: 11,

    marginBottom: 14,

    borderWidth: 1,

    borderColor: "#E0F1FC",

  },

  tradeProductSection: { width: "100%" },

  tradeProductTitle: {

    fontSize: 10,

    color: "#005386",

    letterSpacing: 0.7,

    marginBottom: 7,

    fontFamily: "Montserrat_700Bold",

  },

  tradeProductCard: {

    flexDirection: "row",

    alignItems: "center",

    backgroundColor: "#FFFFFF",

    borderRadius: 12,

    padding: 9,

    borderWidth: 1,

    borderColor: "#E5EDF2",

  },

  tradeProductImageContainer: {

    width: 90,

    height: 82,

    borderRadius: 10,

    backgroundColor: "#F1FAFF",

    overflow: "hidden",

    justifyContent: "center",

    alignItems: "center",

  },

  tradeProductImage: { width: "100%", height: "100%" },

  noImageContainer: {

    flex: 1,

    width: "100%",

    justifyContent: "center",

    alignItems: "center",

  },

  noImageText: {

    marginTop: 4,

    fontSize: 9,

    color: "#8AA5B5",

    fontFamily: "Montserrat_500Medium",

  },

  tradeProductContent: { flex: 1, marginLeft: 12 },

  tradeProductName: {

    fontSize: 14,

    lineHeight: 18,

    color: "#333333",

    fontFamily: "Montserrat_600SemiBold",

  },

  conditionRow: {

    flexDirection: "row",

    alignItems: "center",

    marginTop: 5,

  },

  conditionDot: {

    width: 5,

    height: 5,

    borderRadius: 3,

    backgroundColor: "#0099FF",

    marginRight: 5,

  },

  tradeProductCondition: {

    fontSize: 10,

    color: "#777777",

    fontFamily: "Montserrat_400Regular",

  },

  viewItemButton: {

    flexDirection: "row",

    alignItems: "center",

    alignSelf: "flex-start",

    marginTop: 10,

    paddingVertical: 2,

  },

  viewItemButtonText: {

    marginLeft: 5,

    marginRight: 1,

    fontSize: 10,

    color: "#005386",

    fontFamily: "Montserrat_600SemiBold",

  },

  productUnavailable: {

    height: 82,

    borderRadius: 12,

    backgroundColor: "#FFFFFF",

    borderWidth: 1,

    borderColor: "#E5EDF2",

    justifyContent: "center",

    alignItems: "center",

  },

  productUnavailableText: {

    marginTop: 5,

    fontSize: 10,

    color: "#999999",

    fontFamily: "Montserrat_400Regular",

  },



  // ============ DIVISOR ============

  exchangeDivider: {

    flexDirection: "row",

    alignItems: "center",

    marginVertical: 10,

  },

  exchangeLine: {

    flex: 1,

    height: 1,

    backgroundColor: "#D7EAF5",

  },

  exchangeIcon: {

    width: 31,

    height: 31,

    borderRadius: 16,

    marginHorizontal: 10,

    backgroundColor: "#0099FF",

    justifyContent: "center",

    alignItems: "center",

  },



  // ============ AÇÕES ============

  actionQuestion: {

    fontSize: 11,

    color: "#555555",

    marginBottom: 9,

    fontFamily: "Montserrat_600SemiBold",

  },

  pendingActionsRow: { flexDirection: "row" },

  actionBtn: {

    flex: 1,

    height: 42,

    borderRadius: 10,

    justifyContent: "center",

    alignItems: "center",

    flexDirection: "row",

  },

  rejectBtn: { backgroundColor: "#F1F2F3", marginRight: 6 },

  rejectBtnText: {

    marginLeft: 6,

    fontSize: 12,

    fontFamily: "Montserrat_600SemiBold",

    color: "#555555",

  },

  acceptBtn: { backgroundColor: "#0099FF", marginLeft: 6 },

  acceptBtnText: {

    marginLeft: 6,

    fontSize: 12,

    fontFamily: "Montserrat_600SemiBold",

    color: "#FFFFFF",

  },



  // ============ AGUARDANDO ============

  waitingInfoBox: {

    minHeight: 40,

    flexDirection: "row",

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "#FFF9E8",

    borderRadius: 9,

    paddingHorizontal: 10,

  },

  waitingInfoText: {

    flex: 1,

    marginLeft: 7,

    fontSize: 10,

    color: "#856404",

    fontFamily: "Montserrat_500Medium",

  },



  // ============ ACEITA ============

  acceptedInfoBox: {

    flexDirection: "row",

    alignItems: "center",

    backgroundColor: "#F0F9F2",

    borderRadius: 9,

    padding: 10,

    marginBottom: 9,

  },

  acceptedInfoText: {

    flex: 1,

    marginLeft: 7,

    fontSize: 10,

    lineHeight: 15,

    color: "#155724",

    fontFamily: "Montserrat_500Medium",

  },



  // ============ CHAT ============

  chatActionButton: {

    height: 43,

    borderRadius: 22,

    flexDirection: "row",

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "#005386",

  },

  chatActionButtonText: {

    marginLeft: 8,

    fontSize: 12,

    fontFamily: "Montserrat_600SemiBold",

    color: "#FFFFFF",

  },



  // ============ FINALIZADA ============

  finishedInfoBox: {

    minHeight: 40,

    flexDirection: "row",

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "#F0F9F2",

    borderRadius: 9,

    paddingHorizontal: 10,

  },

  finishedInfoText: {

    marginLeft: 7,

    fontSize: 11,

    color: "#155724",

    fontFamily: "Montserrat_500Medium",

  },



  // ============ RECUSADA ============

  rejectedInfoBox: {

    minHeight: 40,

    flexDirection: "row",

    justifyContent: "center",

    alignItems: "center",

    backgroundColor: "#F8F9FA",

    borderRadius: 9,

    paddingHorizontal: 10,

  },

  rejectedInfoText: {

    marginLeft: 7,

    fontSize: 11,

    color: "#888888",

    fontFamily: "Montserrat_500Medium",

  },



  // ============ SKELETON ============

  skeletonBlock: { backgroundColor: "#EAF3FA" },

  skeletonLine: {

    backgroundColor: "#EAF3FA",

    borderRadius: 4,

  },


  confirmacaoOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  confirmacaoCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
  },
  confirmacaoIcone: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#EAF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  confirmacaoTitulo: {
    fontSize: 19,
    fontFamily: "Montserrat_700Bold",
    color: "#17324D",
    textAlign: "center",
    marginBottom: 9,
  },
  confirmacaoTexto: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Montserrat_400Regular",
    color: "#667788",
    textAlign: "center",
    marginBottom: 24,
  },
  confirmacaoAcoes: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  confirmacaoCancelar: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DCE6EF",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmacaoCancelarTexto: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#5B6B7A",
  },
  confirmacaoConfirmar: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#0099FF",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmacaoConfirmarTexto: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
    textAlign: "center",
  },
});