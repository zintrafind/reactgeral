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

// As listas podem conter caminhos em texto ou objetos com os dados da imagem.
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
  const insets = useSafeAreaInsets();

  const idProposta = params.id_proposta
    ? String(params.id_proposta)
    : "";

  const flatListRef = useRef<FlatList<Message>>(null);

  const initialScrollDone = useRef(false);

  const scrollTimers = useRef<
    ReturnType<typeof setTimeout>[]
  >([]);

  const [inputText, setInputText] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);

  const [loadingMessages, setLoadingMessages] = useState(true);

  const [sendingMessage, setSendingMessage] = useState(false);

  const [usuarioLogado, setUsuarioLogado] = useState<
    number | null
  >(null);

  const [idOutroUsuario, setIdOutroUsuario] = useState<
    number | null
  >(null);

  const [nomeOutroUsuario, setNomeOutroUsuario] = useState("");

  const [fotoOutroUsuario, setFotoOutroUsuario] = useState<
    string | null
  >(null);

  const [idProduto, setIdProduto] = useState<number | null>(null);

  const [nomeProduto, setNomeProduto] = useState("");

  const [fotoProduto, setFotoProduto] = useState<
    string | null
  >(null);

  const [tradeStatus, setTradeStatus] = useState<
    "em_andamento" | "confirmada_por_mim" | "concluida"
  >("em_andamento");

  // Estados do modal de confirmação da finalização.
  const [modalFinalizacaoVisivel, setModalFinalizacaoVisivel] =
    useState(false);

  const [finalizandoTroca, setFinalizandoTroca] = useState(false);

  const [erroFinalizacao, setErroFinalizacao] = useState("");

  // Bloqueia cliques repetidos antes de o estado atualizar a tela.
  const finalizandoTrocaRef = useRef(false);

  // Evita que uma consulta antiga sobrescreva o status após confirmar.
  const versaoStatusRef = useRef(0);

  const [imagemSelecionada, setImagemSelecionada] = useState<{
    uri: string;
    name: string;
    type: string;
    file?: File;
  } | null>(null);

  const getImageUrl = (imagePath?: string | null) => {
    if (!imagePath) {
      return null;
    }

    const path = String(imagePath).trim();

    if (!path) {
      return null;
    }

    if (
      path.startsWith("http://") ||
      path.startsWith("https://")
    ) {
      return path;
    }

    const normalizedPath = path
      .replace(/^\/+/, "")
      .replace(/^storage\/+/, "");

    return `${API_URL}/storage/${normalizedPath}`;
  };

  const getProductImage = (produto?: Produto | null) => {
    if (!produto) {
      return null;
    }

    if (
      typeof produto.ds_imagem === "string" &&
      produto.ds_imagem.trim()
    ) {
      return getImageUrl(produto.ds_imagem);
    }

    const possiveisImagens = [
      produto.images,
      produto.imagens,
      produto.imagem,
      produto.imagem_produto,
      produto.imagens_produto,
    ];

    for (const lista of possiveisImagens) {
      if (!Array.isArray(lista) || lista.length === 0) {
        continue;
      }

      for (const imagem of lista) {
        if (
          typeof imagem === "string" &&
          imagem.trim()
        ) {
          return getImageUrl(imagem);
        }

        if (imagem && typeof imagem === "object") {
          const caminho =
            imagem.ds_imagem ||
            imagem.imagem ||
            imagem.url ||
            imagem.path;

          if (
            typeof caminho === "string" &&
            caminho.trim()
          ) {
            return getImageUrl(caminho);
          }
        }
      }
    }

    return null;
  };

  const formatarHora = (data?: string) => {
    if (!data) {
      return "";
    }

    const dataMensagem = new Date(data);

    if (isNaN(dataMensagem.getTime())) {
      return "";
    }

    return dataMensagem.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    const carregarUsuarioLogado = async () => {
      try {
        const usuarioStorage =
          await AsyncStorage.getItem("usuario");

        if (!usuarioStorage) {
          return;
        }

        const usuario = JSON.parse(usuarioStorage);

        if (usuario?.id_usuario) {
          setUsuarioLogado(Number(usuario.id_usuario));
        }
      } catch (error) {
        console.error(
          "Erro ao carregar usuário logado:",
          error
        );
      }
    };

    carregarUsuarioLogado();
  }, []);

  const carregarDadosProposta = useCallback(
    async (mostrarErro = false) => {
      if (!idProposta || usuarioLogado === null) {
        return;
      }

      // Aguarda a requisição de finalização terminar.
      if (finalizandoTrocaRef.current) {
        return;
      }

      const versaoConsulta = versaoStatusRef.current;

      try {
        const token = await AsyncStorage.getItem("token");

        if (!token) {
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

        const proposta: Proposta | undefined =
          propostas.find(
            (item: Proposta) =>
              Number(item.id_proposta) ===
              Number(idProposta)
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
          Number(proposta.id_solicitante) ===
          Number(usuarioLogado)
            ? proposta.destinatario
            : proposta.solicitante;

        if (outroUsuario) {
          setIdOutroUsuario(
            Number(outroUsuario.id_usuario)
          );

          setNomeOutroUsuario(
            outroUsuario.nm_usuario || ""
          );

          setFotoOutroUsuario(
            getImageUrl(
              outroUsuario.ds_foto_perfil
            )
          );
        }

        // Só aplica o status se a consulta ainda for válida.
        if (
          !finalizandoTrocaRef.current &&
          versaoConsulta === versaoStatusRef.current
        ) {
          if (proposta.st_troca === "F") {
            setTradeStatus("concluida");
          } else {
            const usuarioEhSolicitante =
              Number(proposta.id_solicitante) ===
              Number(usuarioLogado);

            const minhaConfirmacao =
              usuarioEhSolicitante
                ? proposta.st_confirmacao_solicitante
                : proposta.st_confirmacao_destinatario;

            if (minhaConfirmacao === "S") {
              setTradeStatus("confirmada_por_mim");
            } else {
              setTradeStatus("em_andamento");
            }
          }
        }

        const itens = Array.isArray(proposta.itens)
          ? proposta.itens
          : [];

        const itemDoOutroUsuario = itens.find(
          (item: ItemProposta) => {
            const produto = item.produto;

            if (!produto) {
              return false;
            }

            return (
              Number(produto.id_usuario) !==
              Number(usuarioLogado)
            );
          }
        );

        if (itemDoOutroUsuario?.produto) {
          const produto =
            itemDoOutroUsuario.produto;

          setIdProduto(
            Number(produto.id_produto)
          );

          setNomeProduto(
            produto.nm_produto || ""
          );

          let imagemProduto =
            getProductImage(produto);

          if (!imagemProduto) {
            try {
              const produtoResponse =
                await fetch(
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
                  getProductImage(
                    produtoCompleto
                  );

                if (
                  produtoCompleto?.nm_produto
                ) {
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

  // Se a confirmação já foi registrada, fecha o modal.
  useEffect(() => {
    if (tradeStatus !== "em_andamento") {
      setModalFinalizacaoVisivel(false);
      setErroFinalizacao("");
    }
  }, [tradeStatus]);

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

        const token =
          await AsyncStorage.getItem("token");

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

        const mensagensRecebidas =
          Array.isArray(data.mensagens)
            ? data.mensagens
            : [];

        const mensagensFormatadas: Message[] =
          mensagensRecebidas
            .map((mensagem: any) => ({
              id: String(
                mensagem.id_mensagem
              ),
              sender:
                Number(mensagem.id_usuario) ===
                Number(usuarioLogado)
                  ? "me"
                  : "other",
              text:
                mensagem.ds_mensagem ||
                null,
              image: getImageUrl(
                mensagem.ds_imagem
              ),
              createdAt:
                mensagem.created_at,
            }))
            .sort(
              (
                a: Message,
                b: Message
              ) => {
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
            );

        setMessages(
          (mensagensAtuais) => {
            const mensagensIguais =
              mensagensAtuais.length ===
                mensagensFormatadas.length &&
              mensagensAtuais.every(
                (
                  mensagem,
                  index
                ) =>
                  mensagem.id ===
                    mensagensFormatadas[
                      index
                    ]?.id &&
                  mensagem.text ===
                    mensagensFormatadas[
                      index
                    ]?.text &&
                  mensagem.image ===
                    mensagensFormatadas[
                      index
                    ]?.image &&
                  mensagem.sender ===
                    mensagensFormatadas[
                      index
                    ]?.sender
              );

            if (mensagensIguais) {
              return mensagensAtuais;
            }

            return mensagensFormatadas;
          }
        );
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

    scrollTimers.current.forEach(
      (timer) => clearTimeout(timer)
    );

    scrollTimers.current = [];

    setModalFinalizacaoVisivel(false);
    setErroFinalizacao("");
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

      if (resultado.canceled) {
        return;
      }

      const imagem =
        resultado.assets?.[0];

      if (!imagem?.uri) {
        return;
      }

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

      if (resultado.canceled) {
        return;
      }

      const imagem =
        resultado.assets?.[0];

      if (!imagem?.uri) {
        return;
      }

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

  const selecionarImagem = () => {
    if (sendingMessage) {
      return;
    }

    if (Platform.OS === "web") {
      const input =
        document.createElement("input");

      input.type = "file";
      input.accept =
        "image/jpeg,image/png,image/gif,image/webp";

      input.onchange = (event: any) => {
        const file =
          event.target.files?.[0];

        if (!file) {
          return;
        }

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

  const removerImagemSelecionada = () => {
    if (sendingMessage) {
      return;
    }

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
    const mensagem =
      inputText.trim();

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

    if (sendingMessage) {
      return;
    }

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

      const formData =
        new FormData();

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
            ? "Imagem enviada"
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

  // Abre apenas o modal. Não envia a finalização para a API.
  const abrirModalFinalizacao = () => {
    if (
      tradeStatus !== "em_andamento" ||
      finalizandoTrocaRef.current
    ) {
      return;
    }

    setErroFinalizacao("");
    setModalFinalizacaoVisivel(true);
  };

  // Cancelar ou voltar no Android apenas fecha o modal.
  const fecharModalFinalizacao = () => {
    if (finalizandoTrocaRef.current) {
      return;
    }

    setModalFinalizacaoVisivel(false);
    setErroFinalizacao("");
  };

  // Esta função é chamada somente pelo botão "Sim, finalizar".
  const handleFinalizeTrade = async () => {
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
      const token =
        await AsyncStorage.getItem("token");

      if (!token) {
        setErroFinalizacao(
          "Faça login novamente para finalizar a troca."
        );

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
        setErroFinalizacao(
          data?.message ||
            "Ocorreu um erro ao finalizar a troca."
        );

        return;
      }

      setModalFinalizacaoVisivel(false);

      if (
        data?.troca_concluida === true
      ) {
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

      setTradeStatus(
        "confirmada_por_mim"
      );

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

      setErroFinalizacao(
        "Não foi possível confirmar o resultado. Verifique sua conexão e aguarde a atualização do status da troca."
      );
    } finally {
      finalizandoTrocaRef.current = false;
      setFinalizandoTroca(false);
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

        scrollTimers.current.push(
          timer
        );
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

  const inputBottomSpace =
    Math.max(insets.bottom, 8) + 6;

  const previewBottom =
    inputBottomSpace + 64;

  return (
    <SafeAreaView
      style={styles.mainContainer}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
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
                style={
                  styles.headerAvatar
                }
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
                onError={(event) => {
                  console.error(
                    "Erro ao carregar imagem do anúncio:",
                    event.nativeEvent.error
                  );
                }}
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
              <Text
                style={styles.bannerLabel}
              >
                Negociando sobre:
              </Text>

              <Text
                style={styles.bannerTitle}
                numberOfLines={1}
              >
                {nomeProduto ||
                  "Anúncio"}
              </Text>

              <Text
                style={styles.bannerHint}
              >
                Toque para visualizar
              </Text>
            </View>
          </TouchableOpacity>

          {/* Este botão abre o modal, sem finalizar diretamente. */}
          <TouchableOpacity
            style={[
              styles.finishBtn,
              tradeStatus === "concluida"
                ? styles.finishBtnDone
                : tradeStatus ===
                  "confirmada_por_mim"
                ? styles.finishBtnWaiting
                : styles.finishBtnActive,
              finalizandoTroca &&
                styles.buttonDisabled,
            ]}
            onPress={abrirModalFinalizacao}
            disabled={
              tradeStatus === "concluida" ||
              tradeStatus === "confirmada_por_mim" ||
              finalizandoTroca
            }
            accessibilityRole="button"
            accessibilityLabel={
              tradeStatus === "concluida"
                ? "Troca concluída"
                : tradeStatus === "confirmada_por_mim"
                ? "Você já confirmou a troca"
                : "Finalizar troca"
            }
          >
            <Feather
              name={
                tradeStatus ===
                "concluida"
                  ? "check-circle"
                  : tradeStatus ===
                    "confirmada_por_mim"
                  ? "clock"
                  : "check"
              }
              size={14}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.finishBtnText
              }
            >
              {tradeStatus ===
              "concluida"
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
            style={[
              styles.imagePreviewContainer,
              {
                bottom: previewBottom,
              },
            ]}
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

        <View
          style={[
            styles.inputContainer,
            {
              bottom: inputBottomSpace,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.imageButton,
              sendingMessage &&
                styles.imageButtonDisabled,
            ]}
            onPress={
              selecionarImagem
            }
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
            onPress={
              handleSendMessage
            }
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
      </KeyboardAvoidingView>

      {/* Modal de confirmação antes de registrar a finalização. */}
      <Modal
        visible={modalFinalizacaoVisivel}
        transparent
        animationType="fade"
        onRequestClose={fecharModalFinalizacao}
      >
        <View style={styles.modalOverlay}>
          <View
            style={styles.modalContainer}
            accessibilityViewIsModal
          >
            <ScrollView
              contentContainerStyle={
                styles.modalContent
              }
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.modalIconContainer}>
                <Feather
                  name="check-circle"
                  size={32}
                  color="#0099FF"
                />
              </View>

              <Text
                style={styles.modalTitle}
                accessibilityRole="header"
              >
                Confirmar finalização
              </Text>

              <Text style={styles.modalDescription}>
                Tem certeza de que deseja finalizar esta troca?
              </Text>

              <View style={styles.modalNotice}>
                <Feather
                  name="info"
                  size={18}
                  color="#005386"
                />

                <Text style={styles.modalNoticeText}>
                  Confirme somente se a troca já foi realizada.
                  A troca será concluída quando os dois usuários
                  confirmarem.
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
                    finalizandoTroca &&
                      styles.buttonDisabled,
                  ]}
                  activeOpacity={0.7}
                  onPress={fecharModalFinalizacao}
                  disabled={finalizandoTroca}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar finalização"
                >
                  <Text style={styles.modalCancelText}>
                    Cancelar
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalConfirmButton,
                    finalizandoTroca &&
                      styles.buttonDisabled,
                  ]}
                  activeOpacity={0.7}
                  onPress={handleFinalizeTrade}
                  disabled={
                    finalizandoTroca ||
                    tradeStatus !== "em_andamento"
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Sim, finalizar troca"
                  accessibilityState={{
                    disabled:
                      finalizandoTroca ||
                      tradeStatus !== "em_andamento",
                    busy: finalizandoTroca,
                  }}
                >
                  {finalizandoTroca ? (
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />
                  ) : (
                    <Feather
                      name="check"
                      size={18}
                      color="#FFFFFF"
                    />
                  )}

                  <Text style={styles.modalConfirmText}>
                    {finalizandoTroca
                      ? "Confirmando..."
                      : "Sim, finalizar"}
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

  // Estilos do modal de confirmação.

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
    shadowOffset: {
      width: 0,
      height: 5,
    },
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