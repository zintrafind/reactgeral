import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import api from "../../services/api";

type Troca = {
  id: number;
  usuarioProposta: string;
  status: "PENDENTE" | "ACEITA" | "RECUSADA" | "FINALIZADA";
  meuProduto: string;
  produtoOfertado: string;
  idSolicitante: number;
  idDestinatario: number;
};

export default function TrocasScreen() {
  const router = useRouter();

  const [trocas, setTrocas] = useState<Troca[]>([]);
  const [activeTab, setActiveTab] = useState<
    "TODAS" | "RECEBIDAS" | "ENVIADAS"
  >("TODAS");
  const [loading, setLoading] = useState(true);
  const [usuarioLogado, setUsuarioLogado] = useState<number | null>(null);

  // ============================================================
  // CARREGAR TROCAS
  // ============================================================

  const carregarTrocas = async () => {
    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("token");
      const usuarioStorage = await AsyncStorage.getItem("usuario");

      if (!token) {
        Alert.alert(
          "Login necessário",
          "Faça login para visualizar suas trocas."
        );
        return;
      }

      let usuarioLogadoId = 0;

      if (usuarioStorage) {
        const usuario = JSON.parse(usuarioStorage);

        console.log("USUÁRIO LOGADO:", usuario);

        usuarioLogadoId = Number(usuario.id_usuario);
        setUsuarioLogado(usuarioLogadoId);
      }

      const response = await api.get("/propostas", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = response.data;

      console.log("========== TROCAS ==========");
      console.log("STATUS:", response.status);
      console.log("RESPOSTA:", JSON.stringify(data, null, 2));
      console.log("É ARRAY?", Array.isArray(data));
      console.log("============================");

      console.log(
        "PROPOSTAS RECEBIDAS:",
        JSON.stringify(data, null, 2)
      );

      console.log("TIPO DA RESPOSTA:", Array.isArray(data));
      console.log(
        "CHAVES DA RESPOSTA:",
        Object.keys(data || {})
      );

      const propostas = Array.isArray(data?.propostas)
        ? data.propostas
        : [];

      const trocasFormatadas: Troca[] = propostas.map(
        (proposta: any) => {
          const produtoOferecido =
            proposta.itens?.find(
              (item: any) => item.tp_item === "O"
            )?.produto;

          const produtoDesejado =
            proposta.itens?.find(
              (item: any) => item.tp_item === "D"
            )?.produto;

          const idSolicitante = Number(
            proposta.id_solicitante
          );

          const idDestinatario = Number(
            proposta.id_destinatario
          );

          const souDestinatario =
            idDestinatario === usuarioLogadoId;

          return {
            id: Number(proposta.id_proposta),

            usuarioProposta: souDestinatario
              ? proposta.solicitante?.nm_usuario ||
                "Usuário"
              : proposta.destinatario?.nm_usuario ||
                "Usuário",

            status:
              proposta.st_troca === "P"
                ? "PENDENTE"
                : proposta.st_troca === "A"
                ? "ACEITA"
                : proposta.st_troca === "F"
                ? "FINALIZADA"
                : "RECUSADA",

            meuProduto: souDestinatario
              ? produtoDesejado?.nm_produto ||
                "Produto desejado"
              : produtoOferecido?.nm_produto ||
                "Produto oferecido",

            produtoOfertado: souDestinatario
              ? produtoOferecido?.nm_produto ||
                "Produto oferecido"
              : produtoDesejado?.nm_produto ||
                "Produto desejado",

            idSolicitante,
            idDestinatario,
          };
        }
      );

      console.log(
        "TROCAS FORMATADAS:",
        JSON.stringify(
          trocasFormatadas,
          null,
          2
        )
      );

      setTrocas(trocasFormatadas);
    } catch (error: any) {
      console.error(
        "ERRO AO CARREGAR TROCAS:",
        error
      );

      const mensagem =
        error?.response?.data?.message ||
        error?.message ||
        "Não foi possível carregar suas trocas.";

      Alert.alert("Erro", mensagem);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarTrocas();
  }, []);

  // ============================================================
  // ALTERAR STATUS DA TROCA
  // ============================================================

  const handleAlterarStatus = async (
    id: number,
    status: "A" | "R"
  ) => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Login necessário",
          "Faça login novamente."
        );
        return;
      }

      const response = await api.put(
        `/propostas/${id}/status`,
        {
          st_troca: status,
        },
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = response.data;

      console.log(
        "RESPOSTA ALTERAÇÃO STATUS:",
        JSON.stringify(data, null, 2)
      );

      Alert.alert(
        status === "A"
          ? "Troca aceita!"
          : "Troca recusada!",
        status === "A"
          ? "A proposta de troca foi aceita."
          : "A proposta de troca foi recusada."
      );

      await carregarTrocas();
    } catch (error: any) {
      console.error(
        "ERRO AO ALTERAR STATUS:",
        error
      );

      const mensagem =
        error?.response?.data?.message ||
        error?.message ||
        "Não foi possível alterar o status da troca.";

      Alert.alert("Erro", mensagem);
    }
  };

  const handleAceitarTroca = (id: number) => {
    handleAlterarStatus(id, "A");
  };

  const handleRecusarTroca = (id: number) => {
    handleAlterarStatus(id, "R");
  };

  // ============================================================
  // FILTROS
  // ============================================================

  const trocasFiltradas = trocas.filter((item) => {
    if (activeTab === "TODAS") {
      return true;
    }

    if (activeTab === "RECEBIDAS") {
      return item.idDestinatario === usuarioLogado;
    }

    if (activeTab === "ENVIADAS") {
      return item.idSolicitante === usuarioLogado;
    }

    return true;
  });

  // ============================================================
  // TELA
  // ============================================================

  return (
    <View style={styles.mainContainer}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* CABEÇALHO */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Minhas Trocas
          </Text>

          <Text style={styles.headerSubtitle}>
            Gerencie suas propostas de troca
          </Text>
        </View>

        {/* ABAS */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "TODAS" &&
                styles.activeTabButton,
            ]}
            onPress={() =>
              setActiveTab("TODAS")
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "TODAS" &&
                  styles.activeTabText,
              ]}
            >
              Todas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "RECEBIDAS" &&
                styles.activeTabButton,
            ]}
            onPress={() =>
              setActiveTab("RECEBIDAS")
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "RECEBIDAS" &&
                  styles.activeTabText,
              ]}
            >
              Recebidas
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "ENVIADAS" &&
                styles.activeTabButton,
            ]}
            onPress={() =>
              setActiveTab("ENVIADAS")
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "ENVIADAS" &&
                  styles.activeTabText,
              ]}
            >
              Enviadas
            </Text>
          </TouchableOpacity>
        </View>

        {/* LISTA */}
        <View style={styles.cardsContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator
                size="large"
                color="#0099FF"
              />

              <Text style={styles.loadingText}>
                Carregando trocas...
              </Text>
            </View>
          ) : trocasFiltradas.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather
                name="repeat"
                size={40}
                color="#BBBBBB"
              />

              <Text style={styles.emptyTitle}>
                Nenhuma troca encontrada
              </Text>

              <Text style={styles.emptyText}>
                Suas solicitações de troca aparecerão
                aqui.
              </Text>
            </View>
          ) : (
            trocasFiltradas.map((item) => {
              const podeResponder =
                item.idDestinatario ===
                usuarioLogado;

              return (
                <View
                  key={item.id}
                  style={styles.tradeCard}
                >
                  {/* TOPO DO CARD */}
                  <View style={styles.cardHeader}>
                    <View style={styles.userInfoRow}>
                      <Feather
                        name="repeat"
                        size={18}
                        color="#005386"
                        style={{
                          marginRight: 8,
                        }}
                      />

                      <Text style={styles.userName}>
                        {item.usuarioProposta}
                      </Text>
                    </View>

                    {/* STATUS */}
                    {item.status === "PENDENTE" && (
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              "#FFF3CD",
                          },
                        ]}
                      >
                        <Feather
                          name="clock"
                          size={12}
                          color="#856404"
                        />

                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: "#856404",
                            },
                          ]}
                        >
                          Pendente
                        </Text>
                      </View>
                    )}

                    {item.status === "ACEITA" && (
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              "#D4EDDA",
                          },
                        ]}
                      >
                        <Feather
                          name="check-circle"
                          size={12}
                          color="#155724"
                        />

                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: "#155724",
                            },
                          ]}
                        >
                          Aceita
                        </Text>
                      </View>
                    )}

                    {item.status === "FINALIZADA" && (
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              "#E2F0D9",
                          },
                        ]}
                      >
                        <Feather
                          name="check-circle"
                          size={12}
                          color="#155724"
                        />

                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: "#155724",
                            },
                          ]}
                        >
                          Finalizada
                        </Text>
                      </View>
                    )}

                    {item.status === "RECUSADA" && (
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              "#F8D7DA",
                          },
                        ]}
                      >
                        <Feather
                          name="x-circle"
                          size={12}
                          color="#721C24"
                        />

                        <Text
                          style={[
                            styles.statusText,
                            {
                              color: "#721C24",
                            },
                          ]}
                        >
                          Recusada
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* PRODUTOS */}
                  <View
                    style={
                      styles.productsComparisonRow
                    }
                  >
                    <View
                      style={styles.productBox}
                    >
                      <Text
                        style={
                          styles.productLabel
                        }
                      >
                        Seu produto:
                      </Text>

                      <Text
                        style={
                          styles.productName
                        }
                        numberOfLines={1}
                      >
                        {item.meuProduto}
                      </Text>
                    </View>

                    <Feather
                      name="repeat"
                      size={18}
                      color="#0099FF"
                      style={{
                        marginHorizontal: 30,
                      }}
                    />

                    <View
                      style={styles.productBox}
                    >
                      <Text
                        style={
                          styles.productLabel
                        }
                      >
                        Oferta:
                      </Text>

                      <Text
                        style={
                          styles.productName
                        }
                        numberOfLines={1}
                      >
                        {item.produtoOfertado}
                      </Text>
                    </View>
                  </View>

                  {/* AÇÕES */}
                  {item.status ===
                    "PENDENTE" &&
                    podeResponder && (
                      <View
                        style={
                          styles.pendingActionsRow
                        }
                      >
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            styles.rejectBtn,
                          ]}
                          onPress={() =>
                            handleRecusarTroca(
                              item.id
                            )
                          }
                        >
                          <Text
                            style={
                              styles.rejectBtnText
                            }
                          >
                            Recusar
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            styles.acceptBtn,
                          ]}
                          onPress={() =>
                            handleAceitarTroca(
                              item.id
                            )
                          }
                        >
                          <Text
                            style={
                              styles.acceptBtnText
                            }
                          >
                            Aceitar
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                  {item.status === "ACEITA" && (
                    <TouchableOpacity
                      style={
                        styles.chatActionButton
                      }
                      onPress={() =>
                        router.push({
                          pathname:
                            "/mensagens/chat",
                          params: {
                            id_proposta: String(
                              item.id
                            ),
                          },
                        } as any)
                      }
                    >
                      <Feather
                        name="message-square"
                        size={18}
                        color="#005386"
                        style={{
                          marginRight: 8,
                        }}
                      />

                      <Text
                        style={
                          styles.chatActionButtonText
                        }
                      >
                        Ir para o Chat
                      </Text>
                    </TouchableOpacity>
                  )}

                  {item.status === "RECUSADA" && (
                    <View
                      style={
                        styles.rejectedInfoBox
                      }
                    >
                      <Text
                        style={
                          styles.rejectedInfoText
                        }
                      >
                        Proposta recusada
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

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
    marginTop: 2,
  },

  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#EEEEEE",
    borderRadius: 25,
    marginHorizontal: 20,
    marginTop: 10,
    padding: 4,
  },

  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 20,
  },

  activeTabButton: {
    backgroundColor: "#FFFFFF",
    elevation: 2,
  },

  tabText: {
    fontSize: 12,
    fontFamily: "Montserrat_600SemiBold",
    color: "#777777",
  },

  activeTabText: {
    color: "#005386",
  },

  cardsContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 20,
  },

  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
  },

  loadingText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: "Montserrat_400Regular",
    color: "#777777",
  },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },

  emptyTitle: {
    marginTop: 12,
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

  tradeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },

  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },

  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  userName: {
    fontSize: 14,
    fontFamily: "Montserrat_700Bold",
    color: "#005386",
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },

  statusText: {
    fontSize: 11,
    fontFamily: "Montserrat_600SemiBold",
    marginLeft: 4,
  },

  productsComparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5FBFF",
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },

  productBox: {
    flex: 1,
  },

  productLabel: {
    fontSize: 11,
    fontFamily: "Montserrat_400Regular",
    color: "#777777",
  },

  productName: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
    color: "#333333",
    marginTop: 2,
  },

  pendingActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  rejectBtn: {
    backgroundColor: "#E0E0E0",
    marginRight: 8,
  },

  rejectBtnText: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
    color: "#555555",
  },

  acceptBtn: {
    backgroundColor: "#0099FF",
    marginLeft: 8,
  },

  acceptBtnText: {
    fontSize: 13,
    fontFamily: "Montserrat_600SemiBold",
    color: "#FFFFFF",
  },

  chatActionButton: {
    borderWidth: 1.5,
    borderColor: "#005386",
    height: 42,
    borderRadius: 25,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },

  chatActionButtonText: {
    fontSize: 13,
    fontFamily: "Montserrat_700Bold",
    color: "#005386",
  },

  rejectedInfoBox: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
  },

  rejectedInfoText: {
    fontSize: 12,
    fontFamily: "Montserrat_500Medium",
    color: "#888888",
  },
});
