import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import api from "../../services/api";

type AvaliacaoAPI = {
  id_avaliacao: number;
  id_proposta: number;
  nr_nota: number;
  ds_comentario: string;
  created_at: string;
  avaliador?: {
    id_usuario: number;
    nm_usuario: string;
    ds_foto_perfil?: string | null;
  } | null;
};

type ComentarioAPI = {
  id_comentario: number;
  ds_comentario: string;
  created_at: string;
  autor?: {
    id_usuario: number;
    nm_usuario: string;
    ds_foto_perfil?: string | null;
  } | null;
};

export default function AvaliacoesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const idParametro = Array.isArray(params.id) ? params.id[0] : params.id;
  const nomeParametro = Array.isArray(params.nome) ? params.nome[0] : params.nome;

  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoAPI[]>([]);
  const [mediaAvaliacoes, setMediaAvaliacoes] = useState("0.0");
  const [quantidadeAvaliacoes, setQuantidadeAvaliacoes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [avaliacoesAbertas, setAvaliacoesAbertas] = useState<Record<number, boolean>>({});
  const [comentarios, setComentarios] = useState<Record<number, ComentarioAPI[]>>({});
  const [carregandoComentarios, setCarregandoComentarios] = useState<Record<number, boolean>>({});
  const [comentariosRascunho, setComentariosRascunho] = useState<Record<number, string>>({});
  const [enviandoComentario, setEnviandoComentario] = useState<Record<number, boolean>>({});
  const [errosComentario, setErrosComentario] = useState<Record<number, string>>({});

  const carregarAvaliacoes = useCallback(async () => {
    try {
      setLoading(true);
      setErro("");

      const idUsuario = Number(idParametro || 0);

      if (!idUsuario) {
        setAvaliacoes([]);
        setMediaAvaliacoes("0.0");
        setQuantidadeAvaliacoes(0);
        setErro("Não foi possível identificar este usuário.");
        return;
      }

      const token = await AsyncStorage.getItem("token");
      const response = await api.get(`/usuarios/${idUsuario}/avaliacoes`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const encontradas = Array.isArray(response.data?.avaliacoes)
        ? response.data.avaliacoes as AvaliacaoAPI[]
        : [];
      const media = Number(response.data?.media ?? 0);
      const quantidade = Number(response.data?.quantidade ?? encontradas.length);

      setAvaliacoes(encontradas);
      setMediaAvaliacoes(media.toFixed(1));
      setQuantidadeAvaliacoes(quantidade);
    } catch (error) {
      console.error("ERRO AO CARREGAR AVALIAÇÕES:", error);
      setAvaliacoes([]);
      setMediaAvaliacoes("0.0");
      setQuantidadeAvaliacoes(0);
      setErro("Não foi possível carregar as avaliações.");
    } finally {
      setLoading(false);
    }
  }, [idParametro]);

  useEffect(() => {
    void carregarAvaliacoes();
  }, [carregarAvaliacoes]);

  const formatarData = (data?: string) => {
    if (!data) return "";

    const date = new Date(data);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("pt-BR");
  };

  const urlFotoAutor = (caminho?: string | null) => {
    const path = String(caminho || "").trim();
    if (!path) return null;
    if (/^(https?:|blob:|data:|file:|content:)/i.test(path)) return path;

    const baseUrl = String(api.defaults.baseURL || "http://127.0.0.1:8000/api")
      .replace(/\/+$/, "")
      .replace(/\/api$/, "");
    const normalizedPath = path
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/^storage\/+/, "");

    return `${baseUrl}/storage/${normalizedPath}`;
  };

  const carregarComentarios = useCallback(async (idAvaliacao: number) => {
    setCarregandoComentarios((current) => ({ ...current, [idAvaliacao]: true }));
    setErrosComentario((current) => ({ ...current, [idAvaliacao]: "" }));

    try {
      const token = await AsyncStorage.getItem("token");
      const response = await api.get(`/avaliacoes/${idAvaliacao}/comentarios`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const lista = Array.isArray(response.data?.comentarios)
        ? response.data.comentarios as ComentarioAPI[]
        : [];

      setComentarios((current) => ({ ...current, [idAvaliacao]: lista }));
    } catch (error: any) {
      setErrosComentario((current) => ({
        ...current,
        [idAvaliacao]: error?.response?.data?.message || "Não foi possível carregar os comentários.",
      }));
    } finally {
      setCarregandoComentarios((current) => ({ ...current, [idAvaliacao]: false }));
    }
  }, []);

  const alternarComentarios = (idAvaliacao: number) => {
    const estaAberta = Boolean(avaliacoesAbertas[idAvaliacao]);
    setAvaliacoesAbertas((current) => ({ ...current, [idAvaliacao]: !estaAberta }));
    if (!estaAberta) void carregarComentarios(idAvaliacao);
  };

  const enviarComentario = async (idAvaliacao: number) => {
    const texto = (comentariosRascunho[idAvaliacao] || "").trim();
    if (!texto) {
      setErrosComentario((current) => ({
        ...current,
        [idAvaliacao]: "Digite um comentário antes de enviar.",
      }));
      return;
    }

    setEnviandoComentario((current) => ({ ...current, [idAvaliacao]: true }));
    setErrosComentario((current) => ({ ...current, [idAvaliacao]: "" }));

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setErrosComentario((current) => ({
          ...current,
          [idAvaliacao]: "Faça login para comentar esta avaliação.",
        }));
        return;
      }

      const response = await api.post(
        `/avaliacoes/${idAvaliacao}/comentarios`,
        { ds_comentario: texto },
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const novoComentario = response.data?.comentario as ComentarioAPI;
      if (novoComentario) {
        setComentarios((current) => ({
          ...current,
          [idAvaliacao]: [...(current[idAvaliacao] || []), novoComentario],
        }));
      } else {
        await carregarComentarios(idAvaliacao);
      }
      setComentariosRascunho((current) => ({ ...current, [idAvaliacao]: "" }));
    } catch (error: any) {
      const validationErrors = error?.response?.data?.errors;
      const commentError = validationErrors?.ds_comentario?.[0];
      setErrosComentario((current) => ({
        ...current,
        [idAvaliacao]: commentError || error?.response?.data?.message || "Não foi possível publicar o comentário.",
      }));
    } finally {
      setEnviandoComentario((current) => ({ ...current, [idAvaliacao]: false }));
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
          keyExtractor={(item) => String(item.id_avaliacao)}
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
                {quantidadeAvaliacoes}{" "}
                {quantidadeAvaliacoes === 1 ? "avaliação" : "avaliações"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const fotoAvaliador = item.avaliador?.ds_foto_perfil;
            const uriFoto = fotoAvaliador
              ? /^(https?:|blob:|data:|file:|content:)/i.test(fotoAvaliador)
                ? fotoAvaliador
                : `${String(api.defaults.baseURL || "http://127.0.0.1:8000/api").replace(/\/api\/?$/, "")}/storage/${fotoAvaliador.replace(/^\/+|^storage\/+/, "")}`
              : null;

            return (
              <View style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <View style={styles.reviewAuthorRow}>
                    {uriFoto ? (
                      <Image
                        source={{ uri: uriFoto }}
                        style={styles.commentAvatar}
                      />
                    ) : (
                      <View style={styles.commentAvatar}>
                        <Feather name="user" size={16} color="#005386" />
                      </View>
                    )}
                    <Text style={styles.commentAuthor} numberOfLines={1}>
                      {item.avaliador?.nm_usuario || "Usuário"}
                    </Text>
                  </View>

                  <Text style={styles.reviewDate}>{formatarData(item.created_at)}</Text>
                </View>

                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((estrela) => (
                    <Feather
                      key={estrela}
                      name="star"
                      size={18}
                      color={estrela <= Number(item.nr_nota) ? "#005386" : "#D6DEE5"}
                      style={estrela < 5 ? styles.starSpacing : undefined}
                    />
                  ))}
                </View>

                <Text style={styles.reviewScore}>
                  {item.nr_nota}{" "}
                  {Number(item.nr_nota) === 1 ? "estrela" : "estrelas"}
                </Text>

                <Text style={styles.reviewBaseComment}>
                  {item.ds_comentario?.trim() || "Avaliação sem comentário."}
                </Text>

                <TouchableOpacity
                  style={styles.commentAction}
                  activeOpacity={0.75}
                  onPress={() => alternarComentarios(item.id_avaliacao)}
                >
                  <Feather name="message-circle" size={17} color="#0099FF" />
                  <Text style={styles.commentActionText}>
                    {avaliacoesAbertas[item.id_avaliacao]
                      ? "Ocultar comentários"
                      : "Ver/comentar avaliação"}
                  </Text>
                </TouchableOpacity>

                {avaliacoesAbertas[item.id_avaliacao] ? (
                  <View style={styles.commentsContainer}>
                    <Text style={styles.commentsTitle}>
                      Comentários ({(comentarios[item.id_avaliacao] || []).length})
                    </Text>

                    {carregandoComentarios[item.id_avaliacao] ? (
                      <ActivityIndicator size="small" color="#0099FF" />
                    ) : (
                      <>
                        {(comentarios[item.id_avaliacao] || []).map((comentario) => {
                          const fotoAutor = urlFotoAutor(comentario.autor?.ds_foto_perfil);

                          return (
                            <View key={comentario.id_comentario} style={styles.commentItem}>
                              {fotoAutor ? (
                                <Image source={{ uri: fotoAutor }} style={styles.commentAvatar} />
                              ) : (
                                <View style={styles.commentAvatar}>
                                  <Feather name="user" size={16} color="#005386" />
                                </View>
                              )}
                              <View style={styles.commentContent}>
                                <View style={styles.commentHeader}>
                                  <Text style={styles.commentAuthor} numberOfLines={1}>
                                    {comentario.autor?.nm_usuario || "Usuário"}
                                  </Text>
                                  <Text style={styles.commentDate}>
                                    {formatarData(comentario.created_at)}
                                  </Text>
                                </View>
                                <Text style={styles.commentText}>
                                  {comentario.ds_comentario}
                                </Text>
                              </View>
                            </View>
                          );
                        })}

                        {(comentarios[item.id_avaliacao] || []).length === 0 ? (
                          <Text style={styles.noCommentsText}>
                            Ainda não há comentários nesta avaliação.
                          </Text>
                        ) : null}

                        <View style={styles.commentForm}>
                          <Text style={styles.commentFormLabel}>
                            Escreva seu comentário
                          </Text>
                          <TextInput
                            style={styles.commentInput}
                            placeholder="Digite um comentário..."
                            placeholderTextColor="#999999"
                            value={comentariosRascunho[item.id_avaliacao] || ""}
                            onChangeText={(texto) => {
                              setComentariosRascunho((current) => ({
                                ...current,
                                [item.id_avaliacao]: texto,
                              }));
                              if (errosComentario[item.id_avaliacao]) {
                                setErrosComentario((current) => ({
                                  ...current,
                                  [item.id_avaliacao]: "",
                                }));
                              }
                            }}
                            multiline
                            maxLength={500}
                            editable={!enviandoComentario[item.id_avaliacao]}
                          />
                          <View style={styles.commentFormFooter}>
                            <Text style={styles.characterCount}>
                              {(comentariosRascunho[item.id_avaliacao] || "").length}/500
                            </Text>
                          </View>

                          {errosComentario[item.id_avaliacao] ? (
                            <View style={styles.commentErrorBox}>
                              <Feather name="alert-circle" size={16} color="#D9534F" />
                              <Text style={styles.commentErrorText}>
                                {errosComentario[item.id_avaliacao]}
                              </Text>
                            </View>
                          ) : null}

                          <TouchableOpacity
                            style={[
                              styles.sendCommentButton,
                              (!comentariosRascunho[item.id_avaliacao]?.trim() ||
                                enviandoComentario[item.id_avaliacao]) && styles.buttonDisabled,
                            ]}
                            activeOpacity={0.8}
                            onPress={() => void enviarComentario(item.id_avaliacao)}
                            disabled={
                              !comentariosRascunho[item.id_avaliacao]?.trim() ||
                              Boolean(enviandoComentario[item.id_avaliacao])
                            }
                          >
                            {enviandoComentario[item.id_avaliacao] ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Feather name="send" size={17} color="#FFFFFF" />
                            )}
                            <Text style={styles.sendCommentButtonText}>
                              {enviandoComentario[item.id_avaliacao]
                                ? "Enviando..."
                                : "Publicar comentário"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
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

  reviewAuthorRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
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
