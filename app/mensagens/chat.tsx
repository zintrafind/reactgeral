import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Message = {
  id: string;
  sender: "me" | "other" | "system";
  text?: string | null;
  image?: string | null;
  createdAt?: string;
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

type Produto = {
  id_produto: number;
  id_usuario: number;
  nm_produto: string;
  ds_produto?: string | null;
  ds_imagem?: string | null;
  imagens?: ImagemProduto[];
  images?: ImagemProduto[];
  imagem?: ImagemProduto[];
  imagem_produto?: ImagemProduto[];
  imagens_produto?: ImagemProduto[];
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

const API_URL = "http://127.0.0.1:8000";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const idProposta = params.id_proposta
    ? String(params.id_proposta)
    : "";

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
  const [fotoOutroUsuario, setFotoOutroUsuario] =
    useState<string | null>(null);

  const [idProduto, setIdProduto] = useState<number | null>(null);
  const [nomeProduto, setNomeProduto] = useState("");
  const [fotoProduto, setFotoProduto] = useState<string | null>(null);

  const [tradeStatus, setTradeStatus] = useState<
    "em_andamento" | "confirmada_por_mim" | "concluida"
  >("em_andamento");

  const [imagemSelecionada, setImagemSelecionada] = useState<{
    uri: string;
    name: string;
    type: string;
    file?: File;
  } | null>(null);

  const getImageUrl = (imagePath?: string | null) => {
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

  const getProductImage = (produto?: Produto | null) => {
    if (!produto) return null;

    if (
      typeof produto.ds_imagem === "string" &&
      produto.ds_imagem.trim()
    ) {
      return getImageUrl(produto.ds_imagem);
    }

    const possiveisImagens: any[] = [
      produto.imagens,
      produto.images,
      produto.imagem,
      produto.imagem_produto,
      produto.imagens_produto,
    ];

    for (const lista of possiveisImagens) {
      if (!Array.isArray(lista) || lista.length === 0) continue;

      for (const imagem of lista) {
        if (typeof imagem === "string" && imagem.trim()) {
          return getImageUrl(imagem);
        }

        if (imagem && typeof imagem === "object") {
          const caminho =
            imagem.ds_imagem ||
            imagem.imagem ||
            imagem.url ||
            imagem.path;

          if (typeof caminho === "string" && caminho.trim()) {
            return getImageUrl(caminho);
          }
        }
      }
    }

    return null;
  };

  const formatarHora = (data?: string) => {
    if (!data) return "";

    const dataMensagem = new Date(data);

    if (isNaN(dataMensagem.getTime())) return "";

    return dataMensagem.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    const carregarUsuarioLogado = async () => {
      try {
        const usuarioStorage = await AsyncStorage.getItem("usuario");

        if (!usuarioStorage) return;

        const usuario = JSON.parse(usuarioStorage);

        if (usuario?.id_usuario) {
          setUsuarioLogado(Number(usuario.id_usuario));
        }
      } catch (error) {
        console.error("Erro ao carregar usuário logado:", error);
      }
    };

    carregarUsuarioLogado();
  }, []);

  /*
   * Carrega os dados da proposta.
   *
   * Essa função também é usada pelo intervalo de atualização,
   * para que a confirmação do outro usuário apareça automaticamente.
   */
  const carregarDadosProposta = useCallback(
    async (mostrarErro = false) => {
      if (!idProposta || usuarioLogado === null) return;

      try {
        const token = await AsyncStorage.getItem("token");

        if (!token) return;

        const response = await fetch(`${API_URL}/api/propostas`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          if (mostrarErro) {
            console.error(
              "Erro ao carregar propostas:",
              data?.message
            );
          }

          return;
        }

        const propostas = Array.isArray(data.propostas)
          ? data.propostas
          : [];

        const proposta: Proposta | undefined = propostas.find(
          (item: Proposta) =>
            Number(item.id_proposta) === Number(idProposta)
        );

        if (!proposta) {
          if (mostrarErro) {
            console.error(
              "Proposta não encontrada:",
              idProposta
            );
          }

          return;
        }

        const outroUsuario =
          Number(proposta.id_solicitante) === Number(usuarioLogado)
            ? proposta.destinatario
            : proposta.solicitante;

        if (outroUsuario) {
          setIdOutroUsuario(Number(outroUsuario.id_usuario));
          setNomeOutroUsuario(outroUsuario.nm_usuario || "");
          setFotoOutroUsuario(
            getImageUrl(outroUsuario.ds_foto_perfil)
          );
        }

        /*
         * Define o estado da troca para o usuário atual.
         */
        if (proposta.st_troca === "F") {
          setTradeStatus("concluida");
        } else {
          const usuarioEhSolicitante =
            Number(proposta.id_solicitante) ===
            Number(usuarioLogado);

          const minhaConfirmacao = usuarioEhSolicitante
            ? proposta.st_confirmacao_solicitante
            : proposta.st_confirmacao_destinatario;

          if (minhaConfirmacao === "S") {
            setTradeStatus("confirmada_por_mim");
          } else {
            setTradeStatus("em_andamento");
          }
        }

        const itens = Array.isArray(proposta.itens)
          ? proposta.itens
          : [];

        const itemDoOutroUsuario = itens.find(
          (item: ItemProposta) => {
            const produto = item.produto;

            if (!produto) return false;

            return (
              Number(produto.id_usuario) !==
              Number(usuarioLogado)
            );
          }
        );

        if (itemDoOutroUsuario?.produto) {
          const produto = itemDoOutroUsuario.produto;

          setIdProduto(Number(produto.id_produto));
          setNomeProduto(produto.nm_produto || "");

          let imagemProduto = getProductImage(produto);

          if (!imagemProduto) {
            try {
              const produtoResponse = await fetch(
                `${API_URL}/api/products/${produto.id_produto}`,
                {
                  method: "GET",
                  headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              const produtoData =
                await produtoResponse.json();

              if (produtoResponse.ok) {
                const produtoCompleto =
                  produtoData?.produto ||
                  produtoData?.product ||
                  produtoData?.data ||
                  produtoData;

                imagemProduto =
                  getProductImage(produtoCompleto);

                if (produtoCompleto?.nm_produto) {
                  setNomeProduto(
                    produtoCompleto.nm_produto
                  );
                }
              } else {
                console.error(
                  "Erro ao buscar produto:",
                  produtoData?.message ||
                    produtoResponse.status
                );
              }
            } catch (error) {
              console.error(
                "Erro ao buscar imagem do produto:",
                error
              );
            }
          }

          setFotoProduto(imagemProduto);
        }
      } catch (error) {
        if (mostrarErro) {
          console.error(
            "Erro ao carregar dados da proposta:",
            error
          );
        }
      }
    },
    [idProposta, usuarioLogado]
  );

  useEffect(() => {
    carregarDadosProposta(true);
  }, [carregarDadosProposta]);

  /*
   * Atualiza o estado da proposta a cada 5 segundos.
   *
   * Isso permite que, quando o outro usuário confirmar,
   * o chat seja atualizado automaticamente.
   */
  useEffect(() => {
    if (
      usuarioLogado === null ||
      !idProposta
    ) {
      return;
    }

    const intervalo = setInterval(() => {
      carregarDadosProposta(false);
    }, 5000);

    return () => {
      clearInterval(intervalo);
    };
  }, [
    usuarioLogado,
    idProposta,
    carregarDadosProposta,
  ]);

  const carregarMensagens = useCallback(
    async (mostrarLoading = false) => {
      if (!idProposta) {
        setLoadingMessages(false);

        if (mostrarLoading) {
          Alert.alert(
            "Erro",
            "Não foi possível identificar a proposta desta conversa."
          );
        }

        return;
      }

      if (
        usuarioLogado === null ||
        idOutroUsuario === null
      ) {
        return;
      }

      try {
        if (mostrarLoading) {
          setLoadingMessages(true);
        }

        const token = await AsyncStorage.getItem("token");

        if (!token) {
          if (mostrarLoading) {
            Alert.alert(
              "Não autenticado",
              "Faça login novamente para acessar as mensagens."
            );
          }

          return;
        }

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
          if (mostrarLoading) {
            Alert.alert(
              "Erro",
              data?.message ||
                "Não foi possível carregar as mensagens."
            );
          }

          return;
        }

        const mensagensRecebidas = Array.isArray(
          data.mensagens
        )
          ? data.mensagens
          : [];

        const mensagensFormatadas: Message[] =
          mensagensRecebidas
            .map((mensagem: any) => ({
              id: String(mensagem.id_mensagem),
              sender:
                Number(mensagem.id_usuario) ===
                Number(usuarioLogado)
                  ? "me"
                  : "other",
              text: mensagem.ds_mensagem || null,
              image: getImageUrl(
                mensagem.ds_imagem
              ),
              createdAt: mensagem.created_at,
            }))
            .sort((a: Message, b: Message) => {
              const dataA = a.createdAt
                ? new Date(a.createdAt).getTime()
                : NaN;

              const dataB = b.createdAt
                ? new Date(b.createdAt).getTime()
                : NaN;

              if (
                !Number.isNaN(dataA) &&
                !Number.isNaN(dataB) &&
                dataA !== dataB
              ) {
                return dataA - dataB;
              }

              return (
                Number(a.id) - Number(b.id)
              );
            });

        setMessages((mensagensAtuais) => {
          const mensagensIguais =
            mensagensAtuais.length ===
              mensagensFormatadas.length &&
            mensagensAtuais.every(
              (mensagem, index) =>
                mensagem.id ===
                  mensagensFormatadas[index]?.id &&
                mensagem.text ===
                  mensagensFormatadas[index]?.text &&
                mensagem.image ===
                  mensagensFormatadas[index]?.image &&
                mensagem.sender ===
                  mensagensFormatadas[index]?.sender
            );

          if (mensagensIguais) {
            return mensagensAtuais;
          }

          return mensagensFormatadas;
        });
      } catch (error) {
        console.error(
          "Erro ao carregar mensagens:",
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
          setLoadingMessages(false);
        }
      }
    },
    [
      idProposta,
      usuarioLogado,
      idOutroUsuario,
    ]
  );

  useEffect(() => {
    initialScrollDone.current = false;

    scrollTimers.current.forEach((timer) =>
      clearTimeout(timer)
    );

    scrollTimers.current = [];
  }, [idProposta]);

  useEffect(() => {
    if (
      usuarioLogado === null ||
      !idProposta ||
      idOutroUsuario === null
    ) {
      return;
    }

    carregarMensagens(true);
  }, [
    idProposta,
    usuarioLogado,
    idOutroUsuario,
    carregarMensagens,
  ]);

  useEffect(() => {
    if (
      usuarioLogado === null ||
      !idProposta ||
      idOutroUsuario === null
    ) {
      return;
    }

    const intervalo = setInterval(() => {
      carregarMensagens(false);
    }, 5000);

    return () => {
      clearInterval(intervalo);
    };
  }, [
    idProposta,
    usuarioLogado,
    idOutroUsuario,
    carregarMensagens,
  ]);

  const abrirPerfilUsuario = () => {
    if (!idOutroUsuario) {
      Alert.alert(
        "Erro",
        "Não foi possível identificar este usuário."
      );

      return;
    }

    router.push({
      pathname: "/visualizarperfil",
      params: {
        id: String(idOutroUsuario),
      },
    } as any);
  };

  const abrirAnuncio = () => {
    if (!idProduto) {
      Alert.alert(
        "Erro",
        "Não foi possível identificar este anúncio."
      );

      return;
    }

    router.push({
      pathname: "/visuanuncios",
      params: {
        id: String(idProduto),
      },
    } as any);
  };

  const selecionarImagem = () => {
    if (sendingMessage) return;

    if (Platform.OS === "web") {
      const input =
        document.createElement("input");

      input.type = "file";
      input.accept =
        "image/jpeg,image/png,image/gif,image/webp";

      input.onchange = (event: any) => {
        const file =
          event.target.files?.[0];

        if (!file) return;

        if (file.size > MAX_IMAGE_SIZE) {
          Alert.alert(
            "Arquivo muito grande",
            "A imagem deve ter no máximo 5MB."
          );

          return;
        }

        if (
          !ALLOWED_IMAGE_TYPES.includes(
            file.type
          )
        ) {
          Alert.alert(
            "Formato não suportado",
            "Use JPG, PNG, GIF ou WEBP."
          );

          return;
        }

        const uri =
          URL.createObjectURL(file);

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

    Alert.alert(
      "Enviar imagem",
      "Escolha uma opção",
      [
        {
          text: "Galeria",
          onPress: abrirGaleria,
        },
        {
          text: "Câmera",
          onPress: abrirCamera,
        },
        {
          text: "Cancelar",
          style: "cancel",
        },
      ]
    );
  };

  const abrirGaleria = async () => {
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

      const resultado =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });

      if (resultado.canceled) return;

      const imagem =
        resultado.assets?.[0];

      if (!imagem?.uri) return;

      if (
        imagem.fileSize &&
        imagem.fileSize > MAX_IMAGE_SIZE
      ) {
        Alert.alert(
          "Arquivo muito grande",
          "A imagem deve ter no máximo 5MB."
        );

        return;
      }

      if (
        imagem.mimeType &&
        !ALLOWED_IMAGE_TYPES.includes(
          imagem.mimeType
        )
      ) {
        Alert.alert(
          "Formato não suportado",
          "Use JPG, PNG, GIF ou WEBP."
        );

        return;
      }

      const uri = imagem.uri;

      const fileName =
        uri.split("/").pop() ||
        `imagem_${Date.now()}.jpg`;

      const mimeType =
        imagem.mimeType ||
        "image/jpeg";

      setImagemSelecionada({
        uri,
        name: fileName,
        type: mimeType,
      });
    } catch (error) {
      console.error(
        "Erro ao selecionar imagem:",
        error
      );

      Alert.alert(
        "Erro",
        "Não foi possível selecionar a imagem."
      );
    }
  };

  const abrirCamera = async () => {
    try {
      const permissao =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permissao.granted) {
        Alert.alert(
          "Permissão necessária",
          "Permita o acesso à câmera para tirar uma foto."
        );

        return;
      }

      const resultado =
        await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          quality: 0.8,
        });

      if (resultado.canceled) return;

      const imagem =
        resultado.assets?.[0];

      if (!imagem?.uri) return;

      if (
        imagem.fileSize &&
        imagem.fileSize > MAX_IMAGE_SIZE
      ) {
        Alert.alert(
          "Arquivo muito grande",
          "A imagem deve ter no máximo 5MB."
        );

        return;
      }

      if (
        imagem.mimeType &&
        !ALLOWED_IMAGE_TYPES.includes(
          imagem.mimeType
        )
      ) {
        Alert.alert(
          "Formato não suportado",
          "Use JPG, PNG, GIF ou WEBP."
        );

        return;
      }

      const uri = imagem.uri;

      const fileName =
        uri.split("/").pop() ||
        `foto_${Date.now()}.jpg`;

      const mimeType =
        imagem.mimeType ||
        "image/jpeg";

      setImagemSelecionada({
        uri,
        name: fileName,
        type: mimeType,
      });
    } catch (error) {
      console.error(
        "Erro ao abrir câmera:",
        error
      );

      Alert.alert(
        "Erro",
        "Não foi possível abrir a câmera."
      );
    }
  };

  const removerImagemSelecionada = () => {
    if (sendingMessage) return;

    if (
      imagemSelecionada?.uri &&
      imagemSelecionada.uri.startsWith("blob:")
    ) {
      URL.revokeObjectURL(
        imagemSelecionada.uri
      );
    }

    setImagemSelecionada(null);
  };

  const handleSendMessage = async () => {
    const mensagem = inputText.trim();

    if (
      mensagem === "" &&
      !imagemSelecionada
    ) {
      return;
    }

    if (!idProposta) {
      Alert.alert(
        "Erro",
        "Não foi possível identificar a proposta desta conversa."
      );

      return;
    }

    if (sendingMessage) return;

    try {
      setSendingMessage(true);

      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Não autenticado",
          "Faça login novamente para enviar mensagens."
        );

        setSendingMessage(false);
        return;
      }

      const formData = new FormData();

      if (mensagem !== "") {
        formData.append(
          "ds_mensagem",
          mensagem
        );
      }

      if (imagemSelecionada) {
        if (
          Platform.OS === "web" &&
          imagemSelecionada.file
        ) {
          formData.append(
            "imagem",
            imagemSelecionada.file
          );
        } else if (
          Platform.OS === "web" &&
          !imagemSelecionada.file
        ) {
          try {
            const response =
              await fetch(
                imagemSelecionada.uri
              );

            const blob =
              await response.blob();

            const file = new File(
              [blob],
              imagemSelecionada.name,
              {
                type:
                  imagemSelecionada.type,
              }
            );

            formData.append(
              "imagem",
              file
            );
          } catch (error) {
            console.error(
              "Erro ao processar imagem:",
              error
            );

            Alert.alert(
              "Erro",
              "Não foi possível processar a imagem."
            );

            setSendingMessage(false);
            return;
          }
        } else {
          const arquivo = {
            uri: imagemSelecionada.uri,
            name: imagemSelecionada.name,
            type: imagemSelecionada.type,
          };

          formData.append(
            "imagem",
            arquivo as any
          );
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

      const data =
        await response.json();

      if (!response.ok) {
        Alert.alert(
          "Não foi possível enviar",
          data?.message ||
            "Ocorreu um erro ao enviar a mensagem."
        );

        return;
      }

      const novaMensagem: Message = {
        id: String(
          data.mensagem.id_mensagem ||
            Date.now()
        ),
        sender: "me",
        text:
          data.mensagem.ds_mensagem ||
          (imagemSelecionada
            ? "📷 Imagem enviada"
            : null),
        image: getImageUrl(
          data.mensagem.ds_imagem
        ),
        createdAt:
          data.mensagem.created_at ||
          new Date().toISOString(),
      };

      setMessages((prev) =>
        [...prev, novaMensagem].sort(
          (a, b) => {
            const dataA =
              a.createdAt
                ? new Date(
                    a.createdAt
                  ).getTime()
                : NaN;

            const dataB =
              b.createdAt
                ? new Date(
                    b.createdAt
                  ).getTime()
                : NaN;

            if (
              !Number.isNaN(dataA) &&
              !Number.isNaN(dataB) &&
              dataA !== dataB
            ) {
              return dataA - dataB;
            }

            return (
              Number(a.id) -
              Number(b.id)
            );
          }
        )
      );

      setInputText("");

      if (
        imagemSelecionada?.uri &&
        imagemSelecionada.uri.startsWith("blob:")
      ) {
        URL.revokeObjectURL(
          imagemSelecionada.uri
        );
      }

      setImagemSelecionada(null);

      setTimeout(() => {
        carregarMensagens(false);
      }, 500);
    } catch (error) {
      console.error(
        "Erro ao enviar mensagem:",
        error
      );

      Alert.alert(
        "Erro",
        "Não foi possível conectar ao servidor."
      );
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFinalizeTrade = async () => {
    if (
      tradeStatus === "concluida" ||
      tradeStatus === "confirmada_por_mim"
    ) {
      return;
    }

    try {
      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        Alert.alert(
          "Não autenticado",
          "Faça login novamente para finalizar a troca."
        );

        return;
      }

      if (!idProposta) {
        Alert.alert(
          "Erro",
          "Não foi possível identificar a proposta desta troca."
        );

        return;
      }

      const response = await fetch(
        `${API_URL}/api/propostas/${idProposta}/finalizar`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        Alert.alert(
          "Não foi possível finalizar",
          data?.message ||
            "Ocorreu um erro ao finalizar a troca."
        );

        return;
      }

      /*
       * O backend informa se os dois usuários
       * já confirmaram ou não.
       */
      if (data?.troca_concluida === true) {
        setTradeStatus("concluida");

        const systemMessage: Message = {
          id: String(Date.now()),
          sender: "system",
          text:
            "Troca concluída com sucesso!",
        };

        setMessages((prev) => [
          ...prev,
          systemMessage,
        ]);

        Alert.alert(
          "Troca concluída",
          data?.message ||
            "Os dois usuários confirmaram a finalização da troca."
        );

        return;
      }

      /*
       * Apenas este usuário confirmou.
       */
      setTradeStatus("confirmada_por_mim");

      Alert.alert(
        "Confirmação registrada",
        data?.message ||
          "Sua confirmação foi registrada. A troca será concluída quando o outro usuário também confirmar."
      );
    } catch (error) {
      console.error(
        "Erro ao finalizar troca:",
        error
      );

      Alert.alert(
        "Erro",
        "Não foi possível conectar ao servidor."
      );
    }
  };

  const rolarParaUltimaMensagem =
    useCallback(() => {
      if (
        loadingMessages ||
        messages.length === 0 ||
        initialScrollDone.current
      ) {
        return;
      }

      const delays = [
        0,
        80,
        180,
        350,
      ];

      delays.forEach((delay) => {
        const timer = setTimeout(() => {
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({
              animated: false,
            });
          });
        }, delay);

        scrollTimers.current.push(timer);
      });

      const finalTimer = setTimeout(
        () => {
          requestAnimationFrame(() => {
            flatListRef.current?.scrollToEnd({
              animated: false,
            });

            initialScrollDone.current =
              true;
          });
        },
        450
      );

      scrollTimers.current.push(
        finalTimer
      );
    },
    [loadingMessages, messages.length]
  );

  useEffect(() => {
    if (
      !loadingMessages &&
      messages.length > 0
    ) {
      rolarParaUltimaMensagem();
    }

    return () => {
      scrollTimers.current.forEach(
        (timer) =>
          clearTimeout(timer)
      );

      scrollTimers.current = [];
    };
  }, [
    loadingMessages,
    messages.length,
    rolarParaUltimaMensagem,
  ]);

  return (
    <SafeAreaView
      style={styles.mainContainer}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace(
                  "/(tabs)"
                );
              }
            }}
            style={styles.backBtn}
          >
            <Feather
              name="arrow-left"
              size={24}
              color="#005386"
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={abrirPerfilUsuario}
          >
            {fotoOutroUsuario ? (
              <Image
                source={{
                  uri: fotoOutroUsuario,
                }}
                style={styles.headerAvatar}
              />
            ) : (
              <View
                style={
                  styles.headerAvatarFallback
                }
              >
                <Feather
                  name="user"
                  size={20}
                  color="#005386"
                />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={abrirPerfilUsuario}
            >
              <Text
                style={styles.headerName}
                numberOfLines={1}
              >
                {nomeOutroUsuario}
              </Text>
            </TouchableOpacity>

            <Text
              style={styles.headerStatus}
            >
              {tradeStatus ===
              "concluida"
                ? "Troca Concluída"
                : tradeStatus ===
                  "confirmada_por_mim"
                ? "Aguardando confirmação"
                : "Online"}
            </Text>
          </View>
        </View>

        <View style={styles.productBanner}>
          <TouchableOpacity
            style={styles.productClickable}
            activeOpacity={0.75}
            onPress={abrirAnuncio}
          >
            {fotoProduto ? (
              <Image
                source={{
                  uri: fotoProduto,
                }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            ) : (
              <View
                style={
                  styles.bannerImageFallback
                }
              >
                <Feather
                  name="package"
                  size={22}
                  color="#777777"
                />
              </View>
            )}

            <View style={styles.bannerInfo}>
              <Text style={styles.bannerLabel}>
                Negociando sobre:
              </Text>

              <Text
                style={styles.bannerTitle}
                numberOfLines={1}
              >
                {nomeProduto ||
                  "Anúncio"}
              </Text>

              <Text style={styles.bannerHint}>
                Toque para visualizar
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.finishBtn,
              tradeStatus === "concluida"
                ? styles.finishBtnDone
                : tradeStatus ===
                  "confirmada_por_mim"
                ? styles.finishBtnWaiting
                : styles.finishBtnActive,
            ]}
            onPress={handleFinalizeTrade}
            disabled={
              tradeStatus === "concluida" ||
              tradeStatus ===
                "confirmada_por_mim"
            }
          >
            <Feather
              name={
                tradeStatus === "concluida"
                  ? "check-circle"
                  : tradeStatus ===
                    "confirmada_por_mim"
                  ? "clock"
                  : "check"
              }
              size={14}
              color="#FFFFFF"
            />

            <Text style={styles.finishBtnText}>
              {tradeStatus === "concluida"
                ? "Concluída"
                : tradeStatus ===
                  "confirmada_por_mim"
                ? "Você confirmou"
                : "Finalizar"}
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) =>
            item.id
          }
          onContentSizeChange={() => {
            rolarParaUltimaMensagem();
          }}
          contentContainerStyle={
            styles.chatContainer
          }
          showsVerticalScrollIndicator={
            false
          }
          renderItem={({ item }) => {
            if (
              item.sender === "system"
            ) {
              return (
                <View
                  style={
                    styles.systemMessageBubble
                  }
                >
                  <Text
                    style={
                      styles.systemMessageText
                    }
                  >
                    {item.text}
                  </Text>
                </View>
              );
            }

            const isMe =
              item.sender === "me";

            return (
              <View
                style={[
                  styles.messageBubble,
                  isMe
                    ? styles.myMessage
                    : styles.otherMessage,
                ]}
              >
                {item.image ? (
                  <Image
                    source={{
                      uri: item.image,
                    }}
                    style={
                      styles.messageImage
                    }
                    resizeMode="cover"
                  />
                ) : null}

                {item.text ? (
                  <Text
                    style={[
                      styles.messageText,
                      isMe
                        ? styles.myMessageText
                        : styles.otherMessageText,
                    ]}
                  >
                    {item.text}
                  </Text>
                ) : null}

                {item.createdAt ? (
                  <Text
                    style={[
                      styles.messageTime,
                      isMe
                        ? styles.myMessageTime
                        : styles.otherMessageTime,
                    ]}
                  >
                    {formatarHora(
                      item.createdAt
                    )}
                  </Text>
                ) : null}
              </View>
            );
          }}
          ListEmptyComponent={
            !loadingMessages ? (
              <Text
                style={
                  styles.emptyMessages
                }
              >
                Nenhuma mensagem ainda.
                Envie a primeira!
              </Text>
            ) : null
          }
        />

        {imagemSelecionada ? (
          <View
            style={
              styles.imagePreviewContainer
            }
          >
            <Image
              source={{
                uri: imagemSelecionada.uri,
              }}
              style={styles.imagePreview}
            />

            <TouchableOpacity
              style={
                styles.removeImageButton
              }
              onPress={
                removerImagemSelecionada
              }
              disabled={sendingMessage}
            >
              <Feather
                name="x"
                size={14}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            <Text
              style={
                styles.imagePreviewName
              }
              numberOfLines={1}
            >
              {imagemSelecionada.name}
            </Text>
          </View>
        ) : null}

        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={[
              styles.imageButton,
              sendingMessage &&
                styles.imageButtonDisabled,
            ]}
            onPress={selecionarImagem}
            disabled={sendingMessage}
          >
            <Feather
              name="image"
              size={21}
              color="#005386"
            />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Digite sua mensagem..."
            placeholderTextColor="#888888"
            value={inputText}
            onChangeText={setInputText}
            editable={!sendingMessage}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (sendingMessage ||
                (!inputText.trim() &&
                  !imagemSelecionada)) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={
              sendingMessage ||
              (!inputText.trim() &&
                !imagemSelecionada)
            }
          >
            {sendingMessage ? (
              <ActivityIndicator
                size="small"
                color="#FFFFFF"
              />
            ) : (
              <Feather
                name="send"
                size={18}
                color="#FFFFFF"
              />
            )}
          </TouchableOpacity>
        </View>

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
            onPress={() =>
              router.replace(
                "/mensagens"
              )
            }
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
              router.replace(
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
              router.replace(
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
              router.replace(
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
    fontFamily:
      "Montserrat_600SemiBold",
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
    fontFamily:
      "Montserrat_600SemiBold",
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
    fontFamily:
      "Montserrat_600SemiBold",
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

  messageTime: {
    fontSize: 10,
    marginLeft: 8,
    marginTop: 3,
  },

  myMessageTime: {
    color: "#D9F1FF",
  },

  otherMessageTime: {
    color: "#777777",
  },

  systemMessageBubble: {
    backgroundColor: "#FFE5E5",
    padding: 10,
    borderRadius: 8,
    alignSelf: "center",
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#F1BDBD",
  },

  systemMessageText: {
    color: "#D9534F",
    fontSize: 12,
    textAlign: "center",
    fontFamily:
      "Montserrat_600SemiBold",
  },

  emptyMessages: {
    textAlign: "center",
    color: "#777777",
    fontSize: 14,
    marginTop: 30,
  },

  imagePreviewContainer: {
    position: "absolute",
    bottom: 110,
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
    bottom: 60,
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

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#EEEEEE",
    elevation: 10,
    zIndex: 100,
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