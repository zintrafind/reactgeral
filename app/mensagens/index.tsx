import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const API_URL = "http://127.0.0.1:8000";

type Usuario = {
  id_usuario: number;
  nm_usuario: string;
  ds_foto_perfil?: string | null;
};

type Mensagem = {
  id_mensagem: number;
  id_usuario: number;
  id_proposta: number;
  ds_mensagem?: string | null;
  ds_imagem?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Proposta = {
  id_proposta: number;
  id_solicitante: number;
  id_destinatario: number;
  st_troca: string;
  solicitante?: Usuario;
  destinatario?: Usuario;
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

export default function ChatsListScreen() {
  const router = useRouter();

  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  const getImageUrl = (
    imagePath?: string | null
  ): string | null => {
    if (!imagePath) return null;

    if (
      imagePath.startsWith("http://") ||
      imagePath.startsWith("https://")
    ) {
      return imagePath;
    }

    const normalizedPath = imagePath
      .replace(/^\/+/, "")
      .replace(/^storage\//, "");

    return `${API_URL}/storage/${normalizedPath}`;
  };

  const formatarHora = (
    data?: string | null
  ): string => {
    if (!data) return "";

    const dataMensagem = new Date(data);

    if (isNaN(dataMensagem.getTime())) return "";

    const agora = new Date();

    const mesmaData =
      dataMensagem.getDate() === agora.getDate() &&
      dataMensagem.getMonth() === agora.getMonth() &&
      dataMensagem.getFullYear() === agora.getFullYear();

    if (mesmaData) {
      return dataMensagem.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const ontem = new Date(agora);
    ontem.setDate(agora.getDate() - 1);

    const foiOntem =
      dataMensagem.getDate() === ontem.getDate() &&
      dataMensagem.getMonth() === ontem.getMonth() &&
      dataMensagem.getFullYear() === ontem.getFullYear();

    if (foiOntem) return "Ontem";

    return dataMensagem.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const formatarUltimaMensagem = (
    mensagem?: Mensagem
  ): string => {
    if (!mensagem) return "Nenhuma mensagem ainda";

    if (
      mensagem.ds_mensagem &&
      mensagem.ds_mensagem.trim() !== ""
    ) {
      return mensagem.ds_mensagem;
    }

    if (mensagem.ds_imagem) return "Imagem";

    return "Nenhuma mensagem ainda";
  };

  const buscarMensagens = async (
    token: string,
    idProposta: number
  ): Promise<Mensagem[]> => {
    try {
      const response = await fetch(
        `${API_URL}/api/propostas/${idProposta}/mensagens`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          `Erro ao buscar mensagens da proposta ${idProposta}:`,
          data?.message
        );

        return [];
      }

      return Array.isArray(data.mensagens)
        ? data.mensagens
        : [];
    } catch (error) {
      console.error(
        `Erro ao buscar mensagens da proposta ${idProposta}:`,
        error
      );

      return [];
    }
  };

  const carregarConversas = useCallback(
    async (
      mostrarLoading = false
    ): Promise<void> => {
      try {
        if (mostrarLoading) {
          setLoading(true);
        }

        const token =
          await AsyncStorage.getItem("token");

        const usuarioStorage =
          await AsyncStorage.getItem("usuario");

        if (!token) {
          if (mostrarLoading) {
            Alert.alert(
              "Não autenticado",
              "Faça login novamente para acessar suas mensagens."
            );
          }

          return;
        }

        if (!usuarioStorage) {
          if (mostrarLoading) {
            Alert.alert(
              "Erro",
              "Não foi possível identificar o usuário logado."
            );
          }

          return;
        }

        let usuario: any;

        try {
          usuario = JSON.parse(usuarioStorage);
        } catch (error) {
          console.error(
            "Erro ao interpretar usuário:",
            error
          );

          if (mostrarLoading) {
            Alert.alert(
              "Erro",
              "Os dados do usuário estão inválidos. Faça login novamente."
            );
          }

          return;
        }

        const idUsuario = Number(
          usuario?.id_usuario
        );

        if (!idUsuario) {
          if (mostrarLoading) {
            Alert.alert(
              "Erro",
              "Não foi possível identificar o usuário logado."
            );
          }

          return;
        }

        const response = await fetch(
          `${API_URL}/api/propostas`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(
            "Erro ao carregar propostas:",
            data?.message
          );

          if (mostrarLoading) {
            Alert.alert(
              "Erro",
              data?.message ||
                "Não foi possível carregar suas conversas."
            );
          }

          return;
        }

        const propostas: Proposta[] =
          Array.isArray(data.propostas)
            ? data.propostas
            : [];

        const propostasComChat =
          propostas.filter(
            (proposta: Proposta) => {
              const souSolicitante =
                Number(
                  proposta.id_solicitante
                ) === idUsuario;

              const souDestinatario =
                Number(
                  proposta.id_destinatario
                ) === idUsuario;

              const trocaAceitaOuFinalizada =
                proposta.st_troca === "A" ||
                proposta.st_troca === "F";

              return (
                (souSolicitante ||
                  souDestinatario) &&
                trocaAceitaOuFinalizada
              );
            }
          );

        const chatsPromises =
          propostasComChat.map(
            async (
              proposta: Proposta
            ): Promise<Chat | null> => {
              const souSolicitante =
                Number(
                  proposta.id_solicitante
                ) === idUsuario;

              const outroUsuario =
                souSolicitante
                  ? proposta.destinatario
                  : proposta.solicitante;

              if (!outroUsuario) {
                return null;
              }

              const idOutroUsuario =
                Number(
                  outroUsuario.id_usuario
                );

              const chatAnterior =
                chats.find(
                  (chat: Chat) =>
                    chat.idProposta ===
                    Number(
                      proposta.id_proposta
                    )
                );

              const mensagens =
                await buscarMensagens(
                  token,
                  Number(
                    proposta.id_proposta
                  )
                );

              const mensagensOrdenadas =
                [...mensagens].sort(
                  (
                    a: Mensagem,
                    b: Mensagem
                  ) => {
                    const dataA =
                      a.created_at
                        ? new Date(
                            a.created_at
                          ).getTime()
                        : 0;

                    const dataB =
                      b.created_at
                        ? new Date(
                            b.created_at
                          ).getTime()
                        : 0;

                    return dataA - dataB;
                  }
                );

              const ultimaMensagem =
                mensagensOrdenadas.length >
                0
                  ? mensagensOrdenadas[
                      mensagensOrdenadas.length -
                        1
                    ]
                  : undefined;

              const ultimaData =
                ultimaMensagem?.created_at
                  ? new Date(
                      ultimaMensagem.created_at
                    ).getTime()
                  : chatAnterior?.lastMessageDate ||
                    0;

              return {
                id: String(
                  proposta.id_proposta
                ),

                idProposta: Number(
                  proposta.id_proposta
                ),

                idOutroUsuario,

                usuario:
                  outroUsuario.nm_usuario ||
                  "Usuário",

                avatar: getImageUrl(
                  outroUsuario.ds_foto_perfil
                ),

                lastMessage:
                  formatarUltimaMensagem(
                    ultimaMensagem
                  ),

                time: formatarHora(
                  ultimaMensagem?.created_at
                ),

                lastMessageDate:
                  ultimaData,
              };
            }
          );

        const chatsResultado =
          await Promise.all(
            chatsPromises
          );

        const chatsValidos =
          chatsResultado.filter(
            (
              chat
            ): chat is Chat =>
              chat !== null
          );

        chatsValidos.sort(
          (
            a: Chat,
            b: Chat
          ) =>
            b.lastMessageDate -
            a.lastMessageDate
        );

        setChats(
          (chatsAtuais: Chat[]) => {
            const iguais =
              chatsAtuais.length ===
                chatsValidos.length &&
              chatsAtuais.every(
                (
                  chat: Chat,
                  index: number
                ) => {
                  const novoChat =
                    chatsValidos[index];

                  return (
                    chat.id ===
                      novoChat.id &&
                    chat.idProposta ===
                      novoChat.idProposta &&
                    chat.idOutroUsuario ===
                      novoChat.idOutroUsuario &&
                    chat.usuario ===
                      novoChat.usuario &&
                    chat.avatar ===
                      novoChat.avatar &&
                    chat.lastMessage ===
                      novoChat.lastMessage &&
                    chat.time ===
                      novoChat.time &&
                    chat.lastMessageDate ===
                      novoChat.lastMessageDate
                  );
                }
              );

            if (iguais) {
              return chatsAtuais;
            }

            return chatsValidos;
          }
        );
      } catch (error) {
        console.error(
          "Erro ao carregar conversas:",
          error
        );

        if (mostrarLoading) {
          Alert.alert(
            "Erro",
            "Não foi possível conectar ao servidor."
          );
        }
      } finally {
        if (mostrarLoading) {
          setLoading(false);
        }
      }
    },
    [chats]
  );

  useEffect(() => {
    carregarConversas(true);
  }, [carregarConversas]);

  useEffect(() => {
    const intervalo =
      setInterval(() => {
        carregarConversas(false);
      }, 5000);

    return () => {
      clearInterval(intervalo);
    };
  }, [carregarConversas]);

  return (
    <SafeAreaView
      style={styles.mainContainer}
    >
      <View style={styles.listHeader}>
        <Text style={styles.title}>
          Mensagens
        </Text>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        renderItem={({
          item,
        }: {
          item: Chat;
        }) => (
          <TouchableOpacity
            style={styles.chatItem}
            activeOpacity={0.7}
            onPress={() => {
              router.push({
                pathname:
                  "/mensagens/chat",
                params: {
                  id_proposta:
                    String(
                      item.idProposta
                    ),
                },
              } as any);
            }}
          >
            {item.avatar ? (
              <Image
                source={{
                  uri: item.avatar,
                }}
                style={styles.avatar}
              />
            ) : (
              <View
                style={
                  styles.avatarFallback
                }
              >
                <Feather
                  name="user"
                  size={24}
                  color="#005386"
                />
              </View>
            )}

            <View
              style={styles.chatContent}
            >
              <View
                style={styles.chatHeader}
              >
                <Text
                  style={styles.userName}
                  numberOfLines={1}
                >
                  {item.usuario}
                </Text>

                {item.time ? (
                  <Text
                    style={
                      styles.timeText
                    }
                  >
                    {item.time}
                  </Text>
                ) : null}
              </View>

              <Text
                style={styles.lastMessage}
                numberOfLines={1}
              >
                {item.lastMessage}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={[
          styles.listContainer,
          chats.length === 0 &&
            styles.emptyListContainer,
        ]}
        showsVerticalScrollIndicator={
          false
        }
        ListEmptyComponent={
          !loading ? (
            <View
              style={styles.emptyContainer}
            >
              <Feather
                name="message-square"
                size={45}
                color="#BBBBBB"
              />

              <Text
                style={styles.emptyTitle}
              >
                Nenhuma conversa
              </Text>

              <Text
                style={styles.emptyText}
              >
                Suas conversas de trocas
                aceitas aparecerão aqui.
              </Text>
            </View>
          ) : null
        }
      />

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            router.replace("/")
          }
        >
          <Feather
            name="home"
            size={24}
            color="#777777"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
        >
          <Feather
            name="message-square"
            size={24}
            color="#005386"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItemCenter}
          onPress={() =>
            router.push(
              "/announce" as any
            )
          }
        >
          <Feather
            name="plus"
            size={26}
            color="#FFFFFF"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            router.push(
              "/trocas" as any
            )
          }
        >
          <Feather
            name="repeat"
            size={24}
            color="#777777"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() =>
            router.push(
              "/perfil" as any
            )
          }
        >
          <Feather
            name="user"
            size={24}
            color="#777777"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  listHeader: {
    padding: 20,
    paddingTop: 40,
  },

  title: {
    fontSize: 28,
    fontFamily:
      "Montserrat_700Bold",
    color: "#005386",
  },

  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },

  emptyListContainer: {
    flexGrow: 1,
  },

  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E4F8FF",
  },

  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#E4F8FF",
    justifyContent: "center",
    alignItems: "center",
  },

  chatContent: {
    flex: 1,
    marginLeft: 15,
  },

  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom: 4,
  },

  userName: {
    flex: 1,
    fontSize: 16,
    fontFamily:
      "Montserrat_600SemiBold",
    color: "#333333",
    marginRight: 10,
  },

  timeText: {
    fontSize: 12,
    color: "#AAAAAA",
  },

  lastMessage: {
    fontSize: 14,
    color: "#777777",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },

  emptyTitle: {
    marginTop: 15,
    fontSize: 18,
    fontFamily:
      "Montserrat_600SemiBold",
    color: "#555555",
  },

  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: "#999999",
    textAlign: "center",
    lineHeight: 20,
  },

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent:
      "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    elevation: 10,
  },

  navItem: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
    height: "100%",
  },

  navItemCenter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#0099FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    elevation: 4,
  },
});
