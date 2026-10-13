import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type AvaliacaoLocal = {
  storageKey: string;
  id_proposta?: string | number;
  id_usuario_avaliado?: string | number;
  nota: number;
  criado_em?: string;
  comentario?: string | null;
};

type ComentarioAvaliacao = {
  id: string;
  texto: string;
  autor: string;
  criado_em: string;
};

const AVALIACAO_PREFIX = "@pecapeca:avaliacao_visual:";
const COMENTARIO_PREFIX = "@pecapeca:comentarios_avaliacao:";

// Validação visual/local simples para o UC40.
// Depois o backend deve fazer a moderação real.
const TERMOS_BLOQUEADOS = [
  "idiota",
  "burro",
  "imbecil",
  "otario",
  "otário",
];

export default function AvaliacoesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const idParametro = Array.isArray(params.id) ? params.id[0] : params.id;
  const nomeParametro = Array.isArray(params.nome) ? params.nome[0] : params.nome;

  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoLocal[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const [avaliacaoAberta, setAvaliacaoAberta] = useState<string | null>(null);
  const [textoComentario, setTextoComentario] = useState("");
  const [erroComentario, setErroComentario] = useState("");
  const [enviandoComentario, setEnviandoComentario] = useState(false);
  const [comentariosPorAvaliacao, setComentariosPorAvaliacao] = useState<
    Record<string, ComentarioAvaliacao[]>
  >({});

  const [nomeUsuarioLogado, setNomeUsuarioLogado] = useState("Você");

  useEffect(() => {
    carregarUsuarioLogado();
    carregarAvaliacoes();
  }, [idParametro]);

  const carregarUsuarioLogado = async () => {
    try {
      const raw = await AsyncStorage.getItem("usuario");
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const usuario =
        parsed?.user ||
        parsed?.usuario ||
        parsed?.data ||
        parsed;

      const nome =
        usuario?.nm_usuario ||
        usuario?.nome ||
        usuario?.name;

      if (nome) {
        setNomeUsuarioLogado(String(nome));
      }
    } catch {}
  };

  const carregarAvaliacoes = async () => {
    try {
      setLoading(true);
      setErro("");

      const idUsuario = Number(idParametro || 0);

      if (!idUsuario) {
        setAvaliacoes([]);
        setErro("Não foi possível identificar este usuário.");
        return;
      }

      const todasAsChaves = await AsyncStorage.getAllKeys();

      const chavesAvaliacao = todasAsChaves.filter((chave) =>
        chave.startsWith(AVALIACAO_PREFIX)
      );

      if (chavesAvaliacao.length === 0) {
        setAvaliacoes([]);
        return;
      }

      const registros = await AsyncStorage.multiGet(chavesAvaliacao);

      const encontradas: AvaliacaoLocal[] = registros
        .map(([storageKey, valor]) => {
          try {
            if (!valor) return null;

            const item = JSON.parse(valor);

            return {
              ...item,
              storageKey,
            } as AvaliacaoLocal;
          } catch {
            return null;
          }
        })
        .filter(
          (item): item is AvaliacaoLocal =>
            !!item &&
            Number(item.id_usuario_avaliado) === idUsuario &&
            Number(item.nota) >= 1 &&
            Number(item.nota) <= 5
        )
        .sort((a, b) => {
          const dataA = a.criado_em ? new Date(a.criado_em).getTime() : 0;
          const dataB = b.criado_em ? new Date(b.criado_em).getTime() : 0;
          return dataB - dataA;
        });

      setAvaliacoes(encontradas);

      const comentarios: Record<string, ComentarioAvaliacao[]> = {};

      await Promise.all(
        encontradas.map(async (avaliacao) => {
          try {
            const chaveComentarios = criarChaveComentarios(avaliacao.storageKey);
            const rawComentarios = await AsyncStorage.getItem(chaveComentarios);

            comentarios[avaliacao.storageKey] = rawComentarios
              ? JSON.parse(rawComentarios)
              : [];
          } catch {
            comentarios[avaliacao.storageKey] = [];
          }
        })
      );

      setComentariosPorAvaliacao(comentarios);
    } catch (error) {
      console.error("ERRO AO CARREGAR AVALIAÇÕES:", error);
      setAvaliacoes([]);
      setErro("Não foi possível carregar as avaliações.");
    } finally {
      setLoading(false);
    }
  };

  const criarChaveComentarios = (storageKey: string) =>
    `${COMENTARIO_PREFIX}${encodeURIComponent(storageKey)}`;

  const mediaAvaliacoes = useMemo(() => {
    if (avaliacoes.length === 0) return "0.0";

    const total = avaliacoes.reduce(
      (soma, item) => soma + Number(item.nota),
      0
    );

    return (total / avaliacoes.length).toFixed(1);
  }, [avaliacoes]);

  const formatarData = (data?: string) => {
    if (!data) return "";

    const date = new Date(data);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("pt-BR");
  };

  const abrirComentario = (storageKey: string) => {
    if (avaliacaoAberta === storageKey) {
      setAvaliacaoAberta(null);
      setTextoComentario("");
      setErroComentario("");
      return;
    }

    setAvaliacaoAberta(storageKey);
    setTextoComentario("");
    setErroComentario("");
  };

  const contemConteudoInadequado = (texto: string) => {
    const normalizado = texto.toLocaleLowerCase("pt-BR");

    return TERMOS_BLOQUEADOS.some((termo) =>
      normalizado.includes(termo.toLocaleLowerCase("pt-BR"))
    );
  };

  const enviarComentario = async (avaliacao: AvaliacaoLocal) => {
    const comentario = textoComentario.trim();

    if (!comentario) {
      setErroComentario("Digite um comentário antes de enviar.");
      return;
    }

    if (contemConteudoInadequado(comentario)) {
      setErroComentario(
        "O comentário contém conteúdo inadequado e não pode ser publicado."
      );
      return;
    }

    try {
      setEnviandoComentario(true);
      setErroComentario("");

      const novoComentario: ComentarioAvaliacao = {
        id: `${Date.now()}`,
        texto: comentario,
        autor: nomeUsuarioLogado || "Você",
        criado_em: new Date().toISOString(),
      };

      const atuais = comentariosPorAvaliacao[avaliacao.storageKey] || [];
      const atualizados = [...atuais, novoComentario];

      const chave = criarChaveComentarios(avaliacao.storageKey);

      await AsyncStorage.setItem(chave, JSON.stringify(atualizados));

      setComentariosPorAvaliacao((prev) => ({
        ...prev,
        [avaliacao.storageKey]: atualizados,
      }));

      setTextoComentario("");
      setAvaliacaoAberta(null);

      Alert.alert("Comentário publicado", "Seu comentário foi adicionado à avaliação.");
    } catch {
      setErroComentario("Não foi possível publicar o comentário.");
    } finally {
      setEnviandoComentario(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)" as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={24} color="#005386" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Avaliações</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {nomeParametro || "Usuário"}
          </Text>
        </View>

        <View style={styles.headerPlaceholder} />
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#0099FF" />
          <Text style={styles.stateText}>Carregando avaliações...</Text>
        </View>
      ) : erro ? (
        <View style={styles.stateContainer}>
          <Feather name="alert-circle" size={38} color="#D9534F" />

          <Text style={styles.stateTitle}>Não foi possível carregar</Text>

          <Text style={styles.stateText}>{erro}</Text>

          <TouchableOpacity
            style={styles.retryButton}
            onPress={carregarAvaliacoes}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : avaliacoes.length === 0 ? (
        <View style={styles.stateContainer}>
          <Feather name="star" size={40} color="#B9C5CF" />

          <Text style={styles.stateTitle}>Nenhuma avaliação ainda</Text>

          <Text style={styles.stateText}>
            Este usuário ainda não recebeu feedback.
          </Text>
        </View>
      ) : (
        <FlatList
          data={avaliacoes}
          keyExtractor={(item) => item.storageKey}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <View style={styles.summaryMainRow}>
                <Feather name="star" size={28} color="#005386" />

                <Text style={styles.averageText}>{mediaAvaliacoes}</Text>

                <Text style={styles.averageOf}>/ 5</Text>
              </View>

              <Text style={styles.totalText}>
                {avaliacoes.length}{" "}
                {avaliacoes.length === 1 ? "avaliação" : "avaliações"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const comentarios =
              comentariosPorAvaliacao[item.storageKey] || [];

            const comentarioAberto =
              avaliacaoAberta === item.storageKey;

            return (
              <View style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((estrela) => (
                      <Feather
                        key={estrela}
                        name="star"
                        size={18}
                        color={
                          estrela <= Number(item.nota)
                            ? "#005386"
                            : "#D6DEE5"
                        }
                        style={estrela < 5 ? styles.starSpacing : undefined}
                      />
                    ))}
                  </View>

                  <Text style={styles.reviewDate}>
                    {formatarData(item.criado_em)}
                  </Text>
                </View>

                <Text style={styles.reviewScore}>
                  {item.nota}{" "}
                  {Number(item.nota) === 1 ? "estrela" : "estrelas"}
                </Text>

                <Text style={styles.reviewBaseComment}>
                  {item.comentario?.trim()
                    ? item.comentario
                    : "Avaliação sem comentário."}
                </Text>

                {comentarios.length > 0 ? (
                  <View style={styles.commentsContainer}>
                    <Text style={styles.commentsTitle}>
                      Comentários ({comentarios.length})
                    </Text>

                    {comentarios.map((comentario) => (
                      <View
                        key={comentario.id}
                        style={styles.commentItem}
                      >
                        <View style={styles.commentAvatar}>
                          <Feather
                            name="user"
                            size={16}
                            color="#005386"
                          />
                        </View>

                        <View style={styles.commentContent}>
                          <View style={styles.commentHeader}>
                            <Text style={styles.commentAuthor}>
                              {comentario.autor}
                            </Text>

                            <Text style={styles.commentDate}>
                              {formatarData(comentario.criado_em)}
                            </Text>
                          </View>

                          <Text style={styles.commentText}>
                            {comentario.texto}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.commentAction}
                  activeOpacity={0.75}
                  onPress={() => abrirComentario(item.storageKey)}
                >
                  <Feather
                    name="message-circle"
                    size={17}
                    color="#0099FF"
                  />

                  <Text style={styles.commentActionText}>
                    {comentarioAberto ? "Cancelar comentário" : "Comentar avaliação"}
                  </Text>
                </TouchableOpacity>

                {comentarioAberto ? (
                  <View style={styles.commentForm}>
                    <Text style={styles.commentFormLabel}>
                      Escreva seu comentário
                    </Text>

                    <TextInput
                      style={styles.commentInput}
                      placeholder="Digite um comentário..."
                      placeholderTextColor="#999999"
                      value={textoComentario}
                      onChangeText={(texto) => {
                        setTextoComentario(texto);
                        if (erroComentario) setErroComentario("");
                      }}
                      multiline
                      maxLength={500}
                      editable={!enviandoComentario}
                    />

                    <View style={styles.commentFormFooter}>
                      <Text style={styles.characterCount}>
                        {textoComentario.length}/500
                      </Text>
                    </View>

                    {erroComentario ? (
                      <View style={styles.commentErrorBox}>
                        <Feather
                          name="alert-circle"
                          size={16}
                          color="#D9534F"
                        />

                        <Text style={styles.commentErrorText}>
                          {erroComentario}
                        </Text>
                      </View>
                    ) : null}

                    <TouchableOpacity
                      style={[
                        styles.sendCommentButton,
                        enviandoComentario && styles.buttonDisabled,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => enviarComentario(item)}
                      disabled={enviandoComentario}
                    >
                      {enviandoComentario ? (
                        <ActivityIndicator
                          size="small"
                          color="#FFFFFF"
                        />
                      ) : (
                        <Feather
                          name="send"
                          size={17}
                          color="#FFFFFF"
                        />
                      )}

                      <Text style={styles.sendCommentButtonText}>
                        {enviandoComentario
                          ? "Enviando..."
                          : "Publicar comentário"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          }}
        />
      )}
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
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },

  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },

  headerTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#005386",
  },

  headerSubtitle: {
    marginTop: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
    maxWidth: "100%",
  },

  headerPlaceholder: {
    width: 42,
    height: 42,
  },

  listContent: {
    padding: 16,
    paddingBottom: 32,
  },

  summaryCard: {
    backgroundColor: "#F5FBFF",
    borderWidth: 1,
    borderColor: "#E1EEF6",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },

  summaryMainRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  averageText: {
    marginLeft: 9,
    fontFamily: "Montserrat_700Bold",
    fontSize: 28,
    color: "#005386",
  },

  averageOf: {
    marginLeft: 4,
    marginTop: 8,
    fontFamily: "Montserrat_500Medium",
    fontSize: 14,
    color: "#777777",
  },

  totalText: {
    marginTop: 4,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    color: "#777777",
  },

  reviewCard: {
    borderWidth: 1,
    borderColor: "#E8ECEF",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 14,
  },

  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  starSpacing: {
    marginRight: 4,
  },

  reviewDate: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#999999",
  },

  reviewScore: {
    marginTop: 9,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
  },

  reviewBaseComment: {
    marginTop: 6,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 20,
    color: "#666666",
  },

  commentsContainer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
  },

  commentsTitle: {
    marginBottom: 10,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#333333",
  },

  commentItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E4F8FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
  },

  commentContent: {
    flex: 1,
    minWidth: 0,
  },

  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  commentAuthor: {
    flex: 1,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: "#005386",
  },

  commentDate: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 10,
    color: "#999999",
  },

  commentText: {
    marginTop: 3,
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#555555",
  },

  commentAction: {
    minHeight: 44,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  commentActionText: {
    marginLeft: 7,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: "#0099FF",
  },

  commentForm: {
    marginTop: 10,
    backgroundColor: "#F8FAFB",
    borderRadius: 12,
    padding: 12,
  },

  commentFormLabel: {
    marginBottom: 8,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: "#333333",
  },

  commentInput: {
    minHeight: 90,
    maxHeight: 150,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#DDE5EA",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    color: "#333333",
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    textAlignVertical: "top",
  },

  commentFormFooter: {
    alignItems: "flex-end",
    marginTop: 5,
  },

  characterCount: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 10,
    color: "#999999",
  },

  commentErrorBox: {
    marginTop: 9,
    padding: 9,
    borderRadius: 8,
    backgroundColor: "#FFF3F2",
    flexDirection: "row",
    alignItems: "flex-start",
  },

  commentErrorText: {
    flex: 1,
    marginLeft: 7,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    lineHeight: 16,
    color: "#B23B35",
  },

  sendCommentButton: {
    minHeight: 44,
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: "#0099FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },

  sendCommentButtonText: {
    marginLeft: 7,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },

  stateTitle: {
    marginTop: 14,
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 16,
    color: "#333333",
    textAlign: "center",
  },

  stateText: {
    marginTop: 7,
    fontFamily: "Montserrat_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: "#777777",
    textAlign: "center",
  },

  retryButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#0099FF",
  },

  retryButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});
