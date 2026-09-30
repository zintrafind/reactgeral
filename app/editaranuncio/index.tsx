import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../services/api";

const LIMITE_IMAGENS = 5;
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

const CATEGORIAS = [
  { id: 1, nome: "Hardware" },
  { id: 2, nome: "Computador e notebook" },
  { id: 3, nome: "Celular e tablet" },
  { id: 4, nome: "Memórias e pen drives" },
  { id: 5, nome: "Fontes e carregadores" },
  { id: 6, nome: "Impressoras e adaptadores" },
  { id: 7, nome: "Consoles e videogames" },
  { id: 8, nome: "Câmeras" },
  { id: 9, nome: "Outros" },
];

const CONDICOES = [
  { codigo: "N", nome: "Novo" },
  { codigo: "S", nome: "Seminovo" },
  { codigo: "U", nome: "Usado" },
  { codigo: "Q", nome: "Com defeito / Quebrado" },
];

type ImagemExistente = {
  id_imagem?: number;
  id_imagem_produto?: number;
  id?: number;
  ds_imagem: string;
  nr_ordem?: number;
  uri: string;
  existente: true;
};

type NovaImagem = {
  uri: string;
  file?: ImagePicker.ImagePickerAsset["file"];
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number;
  existente: false;
};

type ImagemProduto = ImagemExistente | NovaImagem;

type Aviso = {
  titulo: string;
  mensagem: string;
  voltar?: boolean;
};

function getImageUrl(imagePath?: string | null) {
  const path = String(imagePath || "").trim();

  if (!path) return "";

  if (/^(https?:|blob:|file:|data:|content:)/i.test(path)) {
    return path;
  }

  const baseUrl = (
    api.defaults.baseURL || "http://127.0.0.1:8000/api"
  )
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");

  const caminho = path
    .replace(/^\/+/, "")
    .replace(/^storage\/+/, "");

  return `${baseUrl}/storage/${caminho}`;
}

function extensaoDaImagem(tipo: string) {
  switch (tipo.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "jpg";
  }
}

function tipoDaImagem(imagem: NovaImagem) {
  if (imagem.mimeType) return imagem.mimeType;

  const nome = (
    imagem.fileName || imagem.uri.split("?")[0]
  ).toLowerCase();

  if (nome.endsWith(".png")) return "image/png";
  if (nome.endsWith(".webp")) return "image/webp";
  if (nome.endsWith(".gif")) return "image/gif";

  return "image/jpeg";
}

export default function EditarAnuncioScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const idProduto = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [nomeProduto, setNomeProduto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [condicao, setCondicao] = useState("");
  const [idCategoria, setIdCategoria] = useState<number | null>(null);
  const [statusProduto, setStatusProduto] = useState("");

  const [imagens, setImagens] = useState<ImagemProduto[]>([]);
  const [imagensRemovidas, setImagensRemovidas] = useState<number[]>([]);
  const [imagemAtualIndex, setImagemAtualIndex] = useState(0);
  const [larguraCarrossel, setLarguraCarrossel] = useState(0);

  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [imagemParaRemover, setImagemParaRemover] =
    useState<ImagemProduto | null>(null);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  const carouselRef = useRef<FlatList<ImagemProduto>>(null);
  const salvandoRef = useRef(false);

  const categoriaSelecionada = CATEGORIAS.find(
    (categoria) => categoria.id === idCategoria
  );

  const indiceAtual = Math.min(
    Math.max(imagemAtualIndex, 0),
    Math.max(imagens.length - 1, 0)
  );

  const podeEditar = ["A", "N"].includes(statusProduto);
  const bloqueado = salvando || !podeEditar;

  useEffect(() => {
    let cancelado = false;

    async function carregarAnuncio() {
      setCarregando(true);

      try {
        if (!idProduto) {
          throw new Error("Não foi possível identificar o anúncio.");
        }

        const token = await AsyncStorage.getItem("token");

        if (!token) {
          throw new Error("Sua sessão não foi encontrada.");
        }

        const response = await api.get("/my-products", {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        });

        const dados = response.data;

        const produtos = Array.isArray(dados)
          ? dados
          : dados?.products || dados?.produtos || dados?.data || [];

        const produto = Array.isArray(produtos)
          ? produtos.find(
              (item: any) =>
                String(item.id_produto) === String(idProduto)
            )
          : null;

        if (!produto) {
          throw new Error(
            "Anúncio não encontrado ou você não tem permissão para editá-lo."
          );
        }

        if (cancelado) return;

        setNomeProduto(produto.nm_produto || "");
        setDescricao(produto.ds_produto || "");
        setCondicao(produto.st_condicao || "");
        setIdCategoria(Number(produto.id_categoria));
        setStatusProduto(produto.st_status || "");

        const lista = Array.isArray(produto.images)
          ? produto.images
          : Array.isArray(produto.imagens)
            ? produto.imagens
            : [];

        const formatadas: ImagemExistente[] = [...lista]
          .filter((item: any) => item?.ds_imagem)
          .sort(
            (a: any, b: any) =>
              Number(a.nr_ordem || 0) - Number(b.nr_ordem || 0)
          )
          .map((item: any) => ({
            ...item,
            uri: getImageUrl(item.ds_imagem),
            existente: true as const,
          }));

        setImagens(formatadas);
        setImagemAtualIndex(0);
        setImagensRemovidas([]);
      } catch (error: any) {
        if (cancelado) return;

        setAviso({
          titulo: "Erro",
          mensagem:
            error?.response?.data?.message ||
            error?.message ||
            "Não foi possível carregar o anúncio.",
          voltar: true,
        });
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }

    carregarAnuncio();

    return () => {
      cancelado = true;
    };
  }, [idProduto]);

  // Reposiciona após remover fotos ou mudar a largura.
  // A troca normal de foto é feita por irParaImagem().
  useEffect(() => {
    if (larguraCarrossel <= 0 || imagens.length === 0) return;

    const index = Math.min(
      Math.max(imagemAtualIndex, 0),
      imagens.length - 1
    );

    const frame = requestAnimationFrame(() => {
      carouselRef.current?.scrollToOffset({
        offset: index * larguraCarrossel,
        animated: false,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [larguraCarrossel, imagens.length]);

  async function pickImages() {
    if (bloqueado) return;

    const disponiveis = LIMITE_IMAGENS - imagens.length;

    if (disponiveis <= 0) {
      setAviso({
        titulo: "Limite de imagens",
        mensagem: "O anúncio pode ter no máximo 5 imagens.",
      });
      return;
    }

    try {
      if (Platform.OS !== "web") {
        const permissao =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissao.granted) {
          setAviso({
            titulo: "Permissão necessária",
            mensagem: "Permita o acesso à galeria para escolher as fotos.",
          });
          return;
        }
      }

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: disponiveis,
        quality: 1,
      });

      if (resultado.canceled) return;

      const selecionadas = resultado.assets.slice(0, disponiveis);

      if (
        selecionadas.some(
          (imagem) =>
            typeof imagem.fileSize === "number" &&
            imagem.fileSize > TAMANHO_MAXIMO
        )
      ) {
        throw new Error("Cada imagem deve ter no máximo 5 MB.");
      }

      const novas: NovaImagem[] = selecionadas.map((imagem) => ({
        uri: imagem.uri,
        file: imagem.file,
        fileName: imagem.fileName,
        mimeType: imagem.mimeType,
        fileSize: imagem.fileSize,
        existente: false,
      }));

      setImagens((anteriores) =>
        [...anteriores, ...novas].slice(0, LIMITE_IMAGENS)
      );
    } catch (error: any) {
      setAviso({
        titulo: "Erro",
        mensagem:
          error?.message ||
          "Não foi possível selecionar as imagens.",
      });
    }
  }

  function solicitarRemocao() {
    if (bloqueado) return;

    const imagem = imagens[indiceAtual];

    if (imagem) setImagemParaRemover(imagem);
  }

  function confirmarRemocao() {
    if (!imagemParaRemover || bloqueado) return;

    const index = imagens.indexOf(imagemParaRemover);

    if (index < 0) {
      setImagemParaRemover(null);
      return;
    }

    if (imagemParaRemover.existente) {
      const idImagem = Number(
        imagemParaRemover.id_imagem ??
          imagemParaRemover.id_imagem_produto ??
          imagemParaRemover.id
      );

      if (!Number.isInteger(idImagem) || idImagem <= 0) {
        setImagemParaRemover(null);

        setAviso({
          titulo: "Erro",
          mensagem:
            "A API não retornou o ID desta foto. Não foi possível removê-la.",
        });
        return;
      }

      setImagensRemovidas((anteriores) =>
        Array.from(new Set([...anteriores, idImagem]))
      );
    }

    const atualizadas = imagens.filter((_, i) => i !== index);

    let novoIndex = indiceAtual;

    if (index < indiceAtual) novoIndex -= 1;

    novoIndex = Math.min(
      Math.max(novoIndex, 0),
      Math.max(atualizadas.length - 1, 0)
    );

    setImagemParaRemover(null);
    setImagens(atualizadas);
    setImagemAtualIndex(novoIndex);
  }

  function irParaImagem(index: number) {
    if (
      larguraCarrossel <= 0 ||
      index < 0 ||
      index >= imagens.length
    ) {
      return;
    }

    setImagemAtualIndex(index);

    carouselRef.current?.scrollToOffset({
      offset: index * larguraCarrossel,
      animated: true,
    });
  }

  function handleScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) {
    if (larguraCarrossel <= 0) return;

    const index = Math.round(
      event.nativeEvent.contentOffset.x / larguraCarrossel
    );

    setImagemAtualIndex(
      Math.min(Math.max(index, 0), Math.max(imagens.length - 1, 0))
    );
  }

  async function handleSalvar() {
    if (salvandoRef.current) return;

    if (!idProduto) {
      setAviso({
        titulo: "Erro",
        mensagem: "Não foi possível identificar o anúncio.",
      });
      return;
    }

    if (!nomeProduto.trim()) {
      setAviso({
        titulo: "Atenção",
        mensagem: "Informe o nome do produto.",
      });
      return;
    }

    if (nomeProduto.trim().length > 100) {
      setAviso({
        titulo: "Atenção",
        mensagem: "O nome deve ter no máximo 100 caracteres.",
      });
      return;
    }

    if (descricao.trim().length > 255) {
      setAviso({
        titulo: "Atenção",
        mensagem: "A descrição deve ter no máximo 255 caracteres.",
      });
      return;
    }

    if (
      !categoriaSelecionada ||
      !CONDICOES.some((item) => item.codigo === condicao)
    ) {
      setAviso({
        titulo: "Atenção",
        mensagem: "Selecione a categoria e o estado de conservação.",
      });
      return;
    }

    if (!podeEditar) {
      setAviso({
        titulo: "Atenção",
        mensagem: "Este anúncio não pode ser editado.",
      });
      return;
    }

    if (imagens.length < 1 || imagens.length > LIMITE_IMAGENS) {
      setAviso({
        titulo: "Atenção",
        mensagem: "O anúncio precisa ter de 1 a 5 imagens.",
      });
      return;
    }

    salvandoRef.current = true;
    setSalvando(true);

    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        throw new Error("Sua sessão não foi encontrada.");
      }

      const formData = new FormData();

      // Laravel interpreta esta requisição como PUT.
      formData.append("_method", "PUT");

      formData.append("id_categoria", String(idCategoria));
      formData.append("nm_produto", nomeProduto.trim());
      formData.append("ds_produto", descricao.trim());
      formData.append("st_condicao", condicao);
      formData.append("st_status", statusProduto);

      for (const idImagem of Array.from(new Set(imagensRemovidas))) {
        formData.append(
          "imagens_removidas[]",
          String(idImagem)
        );
      }

      const novasImagens = imagens.filter(
        (imagem): imagem is NovaImagem => !imagem.existente
      );

      for (const [index, imagem] of novasImagens.entries()) {
        if (
          typeof imagem.fileSize === "number" &&
          imagem.fileSize > TAMANHO_MAXIMO
        ) {
          throw new Error("Cada imagem deve ter no máximo 5 MB.");
        }

        if (Platform.OS === "web") {
          let blob: Blob;

          if (imagem.file) {
            blob = imagem.file;
          } else {
            const resposta = await fetch(imagem.uri);

            if (!resposta.ok) {
              throw new Error(
                "Não foi possível ler uma das imagens."
              );
            }

            blob = await resposta.blob();
          }

          if (blob.size > TAMANHO_MAXIMO) {
            throw new Error("Cada imagem deve ter no máximo 5 MB.");
          }

          const tipo = blob.type || tipoDaImagem(imagem);
          const extensao = extensaoDaImagem(tipo);

          formData.append(
            "imagens[]",
            blob,
            imagem.fileName ||
              `produto-${Date.now()}-${index}.${extensao}`
          );
        } else {
          const tipo = tipoDaImagem(imagem);
          const extensao = extensaoDaImagem(tipo);

          formData.append(
            "imagens[]",
            {
              uri: imagem.uri,
              name:
                imagem.fileName ||
                `produto-${Date.now()}-${index}.${extensao}`,
              type: tipo,
            } as any
          );
        }
      }

      // Todos os dados e fotos são enviados juntos.
      // Não utiliza o upload individual de imagem.
      await api.post(`/products/${idProduto}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      setImagensRemovidas([]);

      setAviso({
        titulo: "Sucesso",
        mensagem: "Anúncio e fotos atualizados com sucesso!",
        voltar: true,
      });
    } catch (error: any) {
      const erros = error?.response?.data?.errors;
      const primeiroValor = erros
        ? Object.values(erros)[0]
        : undefined;

      const primeiroErro = Array.isArray(primeiroValor)
        ? primeiroValor[0]
        : typeof primeiroValor === "string"
          ? primeiroValor
          : undefined;

      setAviso({
        titulo: "Erro",
        mensagem:
          primeiroErro ||
          error?.response?.data?.message ||
          error?.message ||
          "Não foi possível atualizar o anúncio.",
      });
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  }

  function fecharAviso() {
    const voltar = aviso?.voltar;

    setAviso(null);

    if (voltar) router.back();
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.back()}
          disabled={salvando}
          accessibilityLabel="Voltar"
        >
          <Feather name="arrow-left" size={24} color="#005386" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Editar anúncio</Text>

        <View style={styles.headerButton} />
      </View>

      {carregando ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0099FF" />
          <Text style={styles.loadingText}>
            Carregando anúncio...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.label}>Nome do produto</Text>

          <TextInput
            style={styles.input}
            value={nomeProduto}
            onChangeText={setNomeProduto}
            placeholder="Informe o nome da peça"
            maxLength={100}
            editable={!bloqueado}
          />

          <Text style={styles.label}>Categoria</Text>

          <TouchableOpacity
            style={styles.inputPicker}
            onPress={() => setCategoryModalVisible(true)}
            disabled={bloqueado}
          >
            <Text
              style={
                categoriaSelecionada
                  ? styles.inputText
                  : styles.inputPlaceholder
              }
            >
              {categoriaSelecionada?.nome || "Selecione a categoria"}
            </Text>

            <Feather
              name="chevron-down"
              size={20}
              color="#0099FF"
            />
          </TouchableOpacity>

          <Text style={styles.label}>Estado de conservação</Text>

          <View style={styles.optionsList}>
            {CONDICOES.map((opcao) => {
              const selecionada = condicao === opcao.codigo;

              return (
                <TouchableOpacity
                  key={opcao.codigo}
                  style={[
                    styles.optionCard,
                    selecionada && styles.optionCardSelected,
                  ]}
                  onPress={() => setCondicao(opcao.codigo)}
                  disabled={bloqueado}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selecionada && styles.optionTextSelected,
                    ]}
                  >
                    {opcao.nome}
                  </Text>

                  <View
                    style={[
                      styles.radioCircle,
                      selecionada && styles.radioCircleSelected,
                    ]}
                  >
                    {selecionada && (
                      <View style={styles.radioInnerCircle} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.imagesTitleRow}>
            <Text style={styles.labelImages}>Fotos do anúncio</Text>

            <Text style={styles.imagesQuantity}>
              {imagens.length} / {LIMITE_IMAGENS}
            </Text>
          </View>

          <Text style={styles.imagesHelp}>
            Deslize para visualizar as fotos. As alterações nas
            imagens serão aplicadas ao salvar o anúncio.
          </Text>

          {imagens.length > 0 ? (
            <>
              <View
                style={styles.carouselContainer}
                onLayout={(event) => {
                  const largura = event.nativeEvent.layout.width;

                  if (largura > 0) setLarguraCarrossel(largura);
                }}
              >
                {larguraCarrossel > 0 && (
                  <FlatList
                    ref={carouselRef}
                    data={imagens}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    onMomentumScrollEnd={handleScrollEnd}
                    onScrollEndDrag={handleScrollEnd}
                    extraData={larguraCarrossel}
                    keyExtractor={(item, index) =>
                      item.existente
                        ? `existente-${
                            item.id_imagem ??
                            item.id_imagem_produto ??
                            item.id ??
                            index
                          }`
                        : `nova-${item.uri}-${index}`
                    }
                    getItemLayout={(_, index) => ({
                      length: larguraCarrossel,
                      offset: larguraCarrossel * index,
                      index,
                    })}
                    renderItem={({ item, index }) => (
                      <View
                        style={[
                          styles.imageSlide,
                          { width: larguraCarrossel },
                        ]}
                      >
                        <Image
                          source={{ uri: item.uri }}
                          style={styles.imagePreview}
                          resizeMode="contain"
                        />

                        {index === 0 && (
                          <View style={styles.principalBadge}>
                            <Feather
                              name="star"
                              size={13}
                              color="#FFFFFF"
                            />

                            <Text style={styles.principalBadgeText}>
                              Foto principal
                            </Text>
                          </View>
                        )}

                        <View style={styles.imageCounter}>
                          <Text style={styles.imageCounterText}>
                            {index + 1} / {imagens.length}
                          </Text>
                        </View>
                      </View>
                    )}
                  />
                )}

                {imagens.length > 1 && (
                  <>
                    {indiceAtual > 0 && (
                      <TouchableOpacity
                        style={[
                          styles.arrowButton,
                          styles.arrowLeft,
                        ]}
                        onPress={() => irParaImagem(indiceAtual - 1)}
                        accessibilityLabel="Foto anterior"
                      >
                        <Feather
                          name="chevron-left"
                          size={26}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                    )}

                    {indiceAtual < imagens.length - 1 && (
                      <TouchableOpacity
                        style={[
                          styles.arrowButton,
                          styles.arrowRight,
                        ]}
                        onPress={() => irParaImagem(indiceAtual + 1)}
                        accessibilityLabel="Próxima foto"
                      >
                        <Feather
                          name="chevron-right"
                          size={26}
                          color="#FFFFFF"
                        />
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>

              {imagens.length > 1 && (
                <View style={styles.pagination}>
                  {imagens.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => irParaImagem(index)}
                      style={styles.dotTouchArea}
                      accessibilityLabel={`Ver foto ${index + 1}`}
                    >
                      <View
                        style={[
                          styles.paginationDot,
                          indiceAtual === index &&
                            styles.paginationDotActive,
                        ]}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.removePhotoAction,
                  bloqueado && styles.disabled,
                ]}
                onPress={solicitarRemocao}
                disabled={bloqueado}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Remover a foto exibida"
              >
                <Feather
                  name="trash-2"
                  size={20}
                  color="#D32F2F"
                />

                <Text style={styles.removePhotoActionText}>
                  Remover foto {indiceAtual + 1}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emptyImages}>
              <Feather name="image" size={34} color="#0099FF" />

              <Text style={styles.emptyImagesTitle}>
                Nenhuma imagem
              </Text>

              <Text style={styles.emptyImagesText}>
                Adicione pelo menos uma foto antes de salvar.
              </Text>
            </View>
          )}

          {imagens.length < LIMITE_IMAGENS ? (
            <TouchableOpacity
              style={[
                styles.photosButton,
                bloqueado && styles.disabled,
              ]}
              onPress={pickImages}
              disabled={bloqueado}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={22} color="#005386" />

              <View style={styles.photosButtonInfo}>
                <Text style={styles.photosButtonText}>
                  {imagens.length === 0
                    ? "Adicionar fotos"
                    : "Adicionar mais fotos"}
                </Text>

                <Text style={styles.photosButtonSubtext}>
                  {LIMITE_IMAGENS - imagens.length}{" "}
                  {LIMITE_IMAGENS - imagens.length === 1
                    ? "foto disponível"
                    : "fotos disponíveis"}
                </Text>
              </View>

              <Feather name="image" size={22} color="#0099FF" />
            </TouchableOpacity>
          ) : (
            <View style={styles.limitMessage}>
              <Feather
                name="check-circle"
                size={18}
                color="#0099FF"
              />

              <Text style={styles.limitMessageText}>
                Limite de 5 imagens atingido.
              </Text>
            </View>
          )}

          <Text style={styles.label}>Descrição</Text>

          <TextInput
            style={[styles.input, styles.textArea]}
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Descreva detalhes da sua peça..."
            multiline
            numberOfLines={4}
            maxLength={255}
            textAlignVertical="top"
            editable={!bloqueado}
          />

          <TouchableOpacity
            style={[
              styles.saveButton,
              bloqueado && styles.disabled,
            ]}
            onPress={handleSalvar}
            disabled={bloqueado}
            activeOpacity={0.8}
          >
            {salvando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="save" size={19} color="#FFFFFF" />

                <Text style={styles.saveButtonText}>
                  {podeEditar
                    ? "Salvar alterações"
                    : "Edição indisponível"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModal}>
            <Text style={styles.modalTitle}>
              Selecione a categoria
            </Text>

            <ScrollView>
              {CATEGORIAS.map((categoria) => (
                <TouchableOpacity
                  key={categoria.id}
                  style={styles.modalItem}
                  onPress={() => {
                    setIdCategoria(categoria.id);
                    setCategoryModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>
                    {categoria.nome}
                  </Text>

                  {idCategoria === categoria.id && (
                    <Feather
                      name="check"
                      size={20}
                      color="#0099FF"
                    />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setCategoryModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={imagemParaRemover !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setImagemParaRemover(null)}
      >
        <View style={styles.centeredOverlay}>
          <View style={styles.dialog}>
            <Feather name="trash-2" size={30} color="#D32F2F" />

            <Text style={styles.dialogTitle}>Remover foto?</Text>

            <Text style={styles.dialogMessage}>
              Esta foto será removida do anúncio quando você salvar
              as alterações.
            </Text>

            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={[
                  styles.dialogButton,
                  styles.dialogCancelButton,
                ]}
                onPress={() => setImagemParaRemover(null)}
              >
                <Text style={styles.cancelButtonText}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dialogButton,
                  styles.deleteButton,
                ]}
                onPress={confirmarRemocao}
              >
                <Text style={styles.whiteButtonText}>
                  Remover
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={aviso !== null}
        animationType="fade"
        transparent
        onRequestClose={fecharAviso}
      >
        <View style={styles.centeredOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>
              {aviso?.titulo}
            </Text>

            <Text style={styles.dialogMessage}>
              {aviso?.mensagem}
            </Text>

            <TouchableOpacity
              style={styles.okButton}
              onPress={fecharAviso}
            >
              <Text style={styles.whiteButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  headerButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Montserrat_700Bold",
    color: "#005386",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#333333",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Montserrat_400Regular",
    color: "#333333",
    backgroundColor: "#F9F9F9",
  },
  inputPicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 46,
    borderRadius: 23,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#0099FF",
  },
  inputText: {
    flex: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#333333",
  },
  inputPlaceholder: {
    flex: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#777777",
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  optionsList: {
    gap: 8,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    borderRadius: 8,
    backgroundColor: "#F9F9F9",
  },
  optionCardSelected: {
    backgroundColor: "#E4F8FF",
    borderColor: "#0099FF",
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: "#666666",
    fontFamily: "Montserrat_500Medium",
  },
  optionTextSelected: {
    color: "#005386",
    fontFamily: "Montserrat_700Bold",
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CCCCCC",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleSelected: {
    borderColor: "#0099FF",
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0099FF",
  },
  imagesTitleRow: {
    marginTop: 20,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  labelImages: {
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
    color: "#333333",
  },
  imagesQuantity: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: "#0099FF",
  },
  imagesHelp: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: "#777777",
    marginBottom: 12,
  },
  carouselContainer: {
    position: "relative",
    width: "100%",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#F5F5F5",
  },
  imageSlide: {
    aspectRatio: 16 / 9,
    position: "relative",
    backgroundColor: "#F5F5F5",
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  principalBadge: {
    position: "absolute",
    left: 10,
    top: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(0,83,134,0.88)",
  },
  principalBadgeText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 10,
    color: "#FFFFFF",
  },
  imageCounter: {
    position: "absolute",
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  imageCounterText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 12,
    color: "#FFFFFF",
  },
  arrowButton: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    elevation: 3,
  },
  arrowLeft: {
    left: 10,
  },
  arrowRight: {
    right: 10,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  dotTouchArea: {
    minWidth: 30,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C7DCE8",
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: "#0099FF",
  },
  removePhotoAction: {
    width: "100%",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F1",
    borderWidth: 1,
    borderColor: "#EFBBBB",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 10,
    marginBottom: 14,
  },
  removePhotoActionText: {
    marginLeft: 8,
    color: "#D32F2F",
    fontSize: 14,
    fontFamily: "Montserrat_600SemiBold",
  },
  emptyImages: {
    minHeight: 160,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#BBDFF5",
    borderRadius: 12,
    backgroundColor: "#F8FCFF",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    marginBottom: 12,
  },
  emptyImagesTitle: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
    marginTop: 10,
    marginBottom: 5,
  },
  emptyImagesText: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 12,
    color: "#777777",
    textAlign: "center",
    lineHeight: 18,
  },
  photosButton: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F8FCFF",
    borderWidth: 1,
    borderColor: "#0099FF",
    borderStyle: "dashed",
    borderRadius: 10,
  },
  photosButtonInfo: {
    flex: 1,
    marginLeft: 10,
  },
  photosButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 13,
    color: "#005386",
  },
  photosButtonSubtext: {
    marginTop: 3,
    fontFamily: "Montserrat_400Regular",
    fontSize: 11,
    color: "#777777",
  },
  limitMessage: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FAFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  limitMessageText: {
    marginLeft: 8,
    fontFamily: "Montserrat_500Medium",
    fontSize: 12,
    color: "#005386",
  },
  saveButton: {
    backgroundColor: "#0099FF",
    borderRadius: 8,
    minHeight: 50,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
    paddingHorizontal: 16,
  },
  saveButtonText: {
    marginLeft: 8,
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Montserrat_700Bold",
  },
  disabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666666",
    fontFamily: "Montserrat_500Medium",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  categoryModal: {
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 30,
  },
  modalTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#005386",
    marginBottom: 16,
    textAlign: "center",
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalItemText: {
    flex: 1,
    fontFamily: "Montserrat_400Regular",
    fontSize: 15,
    color: "#444444",
  },
  centeredOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  dialogTitle: {
    fontFamily: "Montserrat_700Bold",
    fontSize: 18,
    color: "#005386",
    marginTop: 12,
    marginBottom: 10,
    textAlign: "center",
  },
  dialogMessage: {
    fontFamily: "Montserrat_400Regular",
    fontSize: 14,
    color: "#555555",
    lineHeight: 21,
    textAlign: "center",
  },
  dialogActions: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },
  dialogButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  dialogCancelButton: {
    backgroundColor: "#F0F3F5",
  },
  cancelButton: {
    backgroundColor: "#F0F3F5",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
  },
  cancelButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#005386",
  },
  deleteButton: {
    backgroundColor: "#D32F2F",
  },
  whiteButtonText: {
    fontFamily: "Montserrat_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  okButton: {
    width: "100%",
    minHeight: 46,
    backgroundColor: "#0099FF",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    marginTop: 22,
  },
});