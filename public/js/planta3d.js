// Cena 3D da planta (Three.js) — carrega o modelo exportado do Sweet Home 3D,
// permite girar/dar zoom com o mouse. A reserva só é aberta clicando nas "bolinhas"
// (marcadores) de cada sala, não clicando direto no modelo.
// Depende de salasPorSvgId (definido em app.js) para ligar cada malha do modelo à sala do banco.

let cena3d, camera3d, renderer3d, controles3d;
let malhasPorSvgId = {};     // svg_id -> malha (Mesh) do Three.js de cada sala mapeada
let modeloCarregado = false; // evita carregar o modelo 3D mais de uma vez
let animacaoCameraEmAndamento = null; // guarda a animação de câmera atual, pra poder cancelar se o usuário clicar de novo
let centrosDasSalas = {};    // svg_id -> posição 3D (THREE.Vector3) de cada sala, calculada uma vez
let marcadoresDeSala = {};   // svg_id -> elemento HTML da "bolinha" clicável daquela sala
let todasAsPortas = [];      // posições 3D (centro) de todas as portas do modelo
let salaSelecionadaNaCena = null; // última sala focada (usado pelo botão de captura de posição)
let todosOsComodos = [];     // todas as malhas de piso do modelo, usado no modo identificar (clique direto)
let raycaster3d, mouse3d;
let andarAtual = 'terreo';   // andar selecionado: só as bolinhas desse andar aparecem
let objetoRaiz = null;       // grupo raiz do modelo carregado (pra poder mostrar/esconder por andar)

// O Sweet Home 3D não exporta o nome que a gente dá ao cômodo — os grupos do OBJ saem com
// nomes automáticos tipo "room_75_401". Por isso mapeamos esses nomes manualmente aqui.
const MAPEAMENTO_MANUAL_SALAS = {
  'room_73_397': 'lab-1',
  'room_74_399': 'lab-2',
  'room_82_412': 'lab-3',
  'room_83_414': 'sala-1',
  'room_84_416': 'sala-2',
  'room_85_418': 'sala-3',
  'room_79_406': 'sala-4',
  'room_80_408': 'sala-5',
  'room_81_410': 'sala-6',
  'room_70_391': 'auditorio',
  // Biblioteca ainda falta identificar.
};

// Direção "direita" relativa ao jeito que a câmera está olhando agora (não um eixo fixo do
// mundo) — assim a seta ◀▶ sempre corresponde ao lado visual certo, mesmo em alas viradas
// pra direções opostas (a câmera olha pra cada ala por um ângulo diferente).
function obterDirecaoDireitaDaCamera() {
  camera3d.updateMatrixWorld();
  const direita = new THREE.Vector3().setFromMatrixColumn(camera3d.matrixWorld, 0);
  direita.y = 0;
  return direita.normalize();
}

// Vista padrão de cada andar (capturadas manualmente com o botão "Capturar posição da câmera"),
// usadas ao arrastar o slider de andar e pelo botão "Centralizar câmera"
const VISAO_POR_ANDAR = {
  terreo: {
    posicao: new THREE.Vector3(2962, 672, 2533),
    alvo: new THREE.Vector3(8005, 552, 2491),
  },
  superior: {
    posicao: new THREE.Vector3(2962, 1463, 2533),
    alvo: new THREE.Vector3(8005, 552, 2491),
  },
};

// Posições de câmera gravadas manualmente por sala (svg_id -> {posicao, alvo}). Quando uma sala
// tem uma entrada aqui, ela é usada em vez de calcular automaticamente pela porta mais próxima.
// Preencha colando as linhas que aparecem no painel de debug ao clicar em "Capturar posição da câmera"
// com uma sala selecionada.
const POSICOES_FIXAS_POR_SALA = {
  'lab-1': { posicao: new THREE.Vector3(5942, 1458, 2674), alvo: new THREE.Vector3(5891, 497, 485) },
  'lab-2': { posicao: new THREE.Vector3(7654, 1462, 2227), alvo: new THREE.Vector3(7636, 497, 485) },
  'sala-3': { posicao: new THREE.Vector3(5999, 1540, 2562), alvo: new THREE.Vector3(6006, 497, 4501) },
  'sala-2': { posicao: new THREE.Vector3(7989, 1390, 2843), alvo: new THREE.Vector3(8010, 497, 4503) },
  'sala-1': { posicao: new THREE.Vector3(10932, 1081, 3437), alvo: new THREE.Vector3(10006, 497, 4503) },
  'lab-3': { posicao: new THREE.Vector3(11064, 1018, 3414), alvo: new THREE.Vector3(11505, 497, 4502) },
  'sala-4': { posicao: new THREE.Vector3(7069, 302, 3487), alvo: new THREE.Vector3(8008, 0, 4495) },
  'sala-5': { posicao: new THREE.Vector3(8501, 264, 3356), alvo: new THREE.Vector3(9671, 0, 4495) },
  'auditorio': { posicao: new THREE.Vector3(9255, 265, 1481), alvo: new THREE.Vector3(11002, 0, 788) },
  'sala-6': { posicao: new THREE.Vector3(10282, 188, 3593), alvo: new THREE.Vector3(11258, 0, 4497) },
};

function iniciarCena3D() {
  const container = document.getElementById('planta3d-container');

  cena3d = new THREE.Scene();
  cena3d.background = new THREE.Color(0x000000);

  camera3d = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 100000);
  camera3d.position.copy(VISAO_POR_ANDAR[andarAtual].posicao);

  renderer3d = new THREE.WebGLRenderer({ antialias: true });
  renderer3d.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer3d.domElement);

  // Luzes — sem elas o modelo aparece todo preto
  cena3d.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
  const luzDirecional = new THREE.DirectionalLight(0xffffff, 0.6);
  luzDirecional.position.set(5000, 8000, 3000);
  cena3d.add(luzDirecional);

  // Controle de câmera orbital: arrastar gira, roda do mouse dá zoom
  controles3d = new THREE.OrbitControls(camera3d, renderer3d.domElement);
  controles3d.enableDamping = true;
  controles3d.target.copy(VISAO_POR_ANDAR[andarAtual].alvo);

  raycaster3d = new THREE.Raycaster();
  mouse3d = new THREE.Vector2();

  carregarModelo3D();

  renderer3d.domElement.addEventListener('click', aoClicarNaCena3D);
  window.addEventListener('resize', ajustarTamanho3D);
  animar3D();
}

// Carrega os materiais (.mtl) e depois a geometria (.obj) exportados na pasta public/modelo3d
function carregarModelo3D() {
  const mtlLoader = new THREE.MTLLoader();
  mtlLoader.setPath('/modelo3d/');
  mtlLoader.load('IFRSCERTO.mtl', (materiais) => {
    materiais.preload();
    const objLoader = new THREE.OBJLoader();
    objLoader.setMaterials(materiais);
    objLoader.setPath('/modelo3d/');
    objLoader.load('IFRSCERTO.obj', (objeto) => {
      cena3d.add(objeto);
      objetoRaiz = objeto;
      // removerGrama(objeto); // desativado: os nomes dos cômodos mudaram depois do reexport da porta,
      // a lista antiga estava escondendo salas de verdade. Reidentificar a grama depois.
      mapearSalasNoModelo(objeto);
      classificarAndares(objeto);
      corrigirAndarDasSalasMapeadas(objeto); // usa o andar do banco pras salas já identificadas
      aplicarVisibilidadeAndar(andarAtual);
      criarMarcadoresDeSala();
      coletarPortas(objeto);
      modeloCarregado = true;
    });
  });
}

// Remove o terreno/grama exportado pelo Sweet Home 3D: o grupo "ground_1" e os canteiros de
// grama ao redor do prédio, que o Sweet Home 3D exporta como se fossem "cômodos" (room_XX_YYY)
const NOMES_DA_GRAMA = ['ground_1', 'room_76_402', 'room_77_403', 'room_78_404', 'room_79_405'];
function removerGrama(objeto) {
  NOMES_DA_GRAMA.forEach((nome) => {
    const item = objeto.getObjectByName(nome);
    if (item) objeto.remove(item);
  });
}

// Percorre todas as malhas do modelo e guarda as que correspondem a uma sala do banco
// (via MAPEAMENTO_MANUAL_SALAS, já que o nome bruto do OBJ não bate com o svg_id diretamente)
function mapearSalasNoModelo(objeto) {
  malhasPorSvgId = {};
  todosOsComodos = [];
  objeto.traverse((filho) => {
    if (!filho.isMesh || !filho.name.startsWith('room_')) return;
    filho.material = filho.material.clone(); // pra poder mudar a cor sem afetar outras malhas
    todosOsComodos.push(filho);

    const svgId = MAPEAMENTO_MANUAL_SALAS[filho.name];
    if (svgId && salasPorSvgId[svgId]) {
      malhasPorSvgId[svgId] = filho;
    }
  });
}

// MODO IDENTIFICAR: clique direto num cômodo do modelo pra descobrir o nome bruto dele (room_XX_YYY),
// usado quando o MAPEAMENTO_MANUAL_SALAS precisa ser atualizado (ex.: depois de reexportar o modelo).
// Só mostra o nome no painel de debug — não pinta a sala nem abre agendamento (isso só acontece pelas bolinhas).
function aoClicarNaCena3D(evento) {
  const retangulo = renderer3d.domElement.getBoundingClientRect();
  mouse3d.x = ((evento.clientX - retangulo.left) / retangulo.width) * 2 - 1;
  mouse3d.y = -((evento.clientY - retangulo.top) / retangulo.height) * 2 + 1;

  // só considera cômodos realmente visíveis no momento (o raycaster do Three.js não ignora objetos escondidos)
  const comodosVisiveis = todosOsComodos.filter((malha) =>
    andarAtual === 'superior' ? true : malha.userData.andar === 'terreo'
  );

  raycaster3d.setFromCamera(mouse3d, camera3d);
  const intersecoes = raycaster3d.intersectObjects(comodosVisiveis);
  if (intersecoes.length === 0) return;

  const malha = intersecoes[0].object;

  const painelDebug = document.getElementById('debug-sala-clicada');
  if (painelDebug) painelDebug.textContent = `Nome bruto: ${malha.name}`;
}

// Cria uma "bolinha" clicável pra cada sala já mapeada, no centro dela.
// Clicar na bolinha foca a câmera na sala e abre o painel de reserva — é a única forma de
// selecionar uma sala (clicar direto no modelo 3D não faz mais nada).
function criarMarcadoresDeSala() {
  const container = document.getElementById('planta3d-container');
  Object.values(marcadoresDeSala).forEach((elemento) => elemento.remove());
  marcadoresDeSala = {};
  centrosDasSalas = {};

  Object.entries(malhasPorSvgId).forEach(([svgId, malha]) => {
    const sala = salasPorSvgId[svgId];
    if (!sala) return;

    const centro = new THREE.Box3().setFromObject(malha).getCenter(new THREE.Vector3());
    centro.y += 200; // eleva um pouco acima do chão pra não ficar "dentro" da sala
    centrosDasSalas[svgId] = centro;

    const marcador = document.createElement('button');
    marcador.type = 'button';
    marcador.className = 'marcador-sala';
    marcador.title = sala.nome;
    marcador.onclick = () => selecionarSalaComFoco(sala);
    container.appendChild(marcador);
    marcadoresDeSala[svgId] = marcador;
  });
}

// Atualiza a posição na tela de cada bolinha, projetando a posição 3D da sala pra coordenadas de tela.
// Só mostra as bolinhas do andar selecionado (andarAtual).
function atualizarMarcadoresDeSala() {
  const container = document.getElementById('planta3d-container');
  Object.entries(marcadoresDeSala).forEach(([svgId, elemento]) => {
    const centro = centrosDasSalas[svgId];
    const sala = salasPorSvgId[svgId];
    if (!centro || !sala) return;

    // esconde bolinhas de outro andar
    if (sala.andar !== andarAtual) {
      elemento.style.display = 'none';
      return;
    }

    const projetado = centro.clone().project(camera3d);
    if (projetado.z > 1) { // atrás da câmera
      elemento.style.display = 'none';
      return;
    }
    elemento.style.display = 'block';
    elemento.style.left = `${(projetado.x * 0.5 + 0.5) * container.clientWidth}px`;
    elemento.style.top = `${(-projetado.y * 0.5 + 0.5) * container.clientHeight}px`;
  });

  atualizarSetasDeNavegacao(container);
}

// Classifica cada objeto de nível mais alto do modelo (paredes, teto, móveis...) em "terreo" ou
// "superior", com base na altura (eixo Y) dele. Estratégia: usamos a altura da BASE das salas
// que já sabemos que são do superior (MAPEAMENTO_MANUAL_SALAS + andar cadastrado no banco) como
// referência real — mais confiável que tentar adivinhar "saltos" de altura entre objetos não identificados.
function classificarAndares(objeto) {
  const dados = objeto.children.map((grupo) => {
    const caixa = new THREE.Box3().setFromObject(grupo);
    return { grupo, yBase: caixa.min.y, yCentro: caixa.getCenter(new THREE.Vector3()).y };
  });

  const nomesConhecidosSuperior = Object.entries(MAPEAMENTO_MANUAL_SALAS)
    .filter(([, svgId]) => salasPorSvgId[svgId] && salasPorSvgId[svgId].andar === 'superior')
    .map(([nomeCru]) => nomeCru);

  const gruposConhecidosSuperior = dados.filter((d) => nomesConhecidosSuperior.includes(d.grupo.name));

  let alturaDeCorte;
  if (gruposConhecidosSuperior.length > 0) {
    // a base mais baixa entre as salas conhecidas do superior vira a linha de corte (com margem)
    alturaDeCorte = Math.min(...gruposConhecidosSuperior.map((d) => d.yBase)) - 10;
  } else {
    // reserva: se ainda não temos nenhuma sala identificada, divide pela metade da altura total
    const alturas = dados.map((d) => d.yCentro);
    alturaDeCorte = (Math.min(...alturas) + Math.max(...alturas)) / 2;
  }

  dados.forEach(({ grupo, yCentro }) => {
    const andar = yCentro >= alturaDeCorte ? 'superior' : 'terreo';
    grupo.userData.andar = andar;
    // propaga pros filhos — o Three.js não ignora objetos invisíveis ao fazer raycasting
    grupo.traverse((filho) => { filho.userData.andar = andar; });
  });
}

// A separação por altura é só uma aproximação — para as salas que já identificamos manualmente,
// usamos o andar cadastrado no banco (fonte confiável) e sobrescrevemos o grupo inteiro daquele cômodo
function corrigirAndarDasSalasMapeadas(objeto) {
  Object.entries(malhasPorSvgId).forEach(([svgId, malha]) => {
    const sala = salasPorSvgId[svgId];
    if (!sala || !sala.andar) return;

    // sobe na hierarquia até achar o grupo de nível mais alto (filho direto da raiz do modelo)
    let grupo = malha;
    while (grupo.parent && grupo.parent !== objeto) grupo = grupo.parent;

    grupo.userData.andar = sala.andar;
    grupo.traverse((filho) => { filho.userData.andar = sala.andar; });
  });
}

// Mostra os objetos do andar escolhido. No térreo, mostra só o térreo (esconde o superior
// inteiro, incluindo o teto/laje de cima); no superior, mostra o prédio inteiro (os dois juntos).
function aplicarVisibilidadeAndar(andar) {
  if (!objetoRaiz) return;
  objetoRaiz.children.forEach((grupo) => {
    grupo.visible = andar === 'superior' ? true : grupo.userData.andar === 'terreo';
  });
}

// Troca o andar exibido e move a câmera pra vista padrão daquele andar (RF10)
function trocarAndar(andar) {
  andarAtual = andar;
  salaSelecionadaNaCena = null; // esconde as setas de navegação
  atualizarAlcaDoSlider(andar);
  aplicarVisibilidadeAndar(andar);

  const vista = VISAO_POR_ANDAR[andar];
  if (modeloCarregado) animarCamera(vista.alvo.clone(), vista.posicao.clone(), 600);
}

// Move a alça do slider lateral pro topo (Superior) ou pra base (Térreo)
function atualizarAlcaDoSlider(andar) {
  const alca = document.getElementById('slider-andar-alca');
  if (alca) alca.classList.toggle('no-terreo', andar === 'terreo');
}

// Posiciona as 4 setas coladas na bolinha da sala selecionada no momento
function atualizarSetasDeNavegacao(container) {
  const setas = {
    cima: document.getElementById('btn-seta-cima'),
    baixo: document.getElementById('btn-seta-baixo'),
    esquerda: document.getElementById('btn-seta-esquerda'),
    direita: document.getElementById('btn-seta-direita'),
  };
  if (!setas.cima) return;

  const svgId = salaSelecionadaNaCena && salaSelecionadaNaCena.svg_id;
  const marcador = svgId && marcadoresDeSala[svgId];
  if (!svgId || !marcador || marcador.style.display === 'none') {
    Object.values(setas).forEach((seta) => { seta.style.display = 'none'; });
    return;
  }

  const x = parseFloat(marcador.style.left);
  const y = parseFloat(marcador.style.top);
  const distancia = 26;
  Object.values(setas).forEach((seta) => { seta.style.display = 'flex'; });
  setas.cima.style.left = `${x}px`;
  setas.cima.style.top = `${y - distancia}px`;
  setas.baixo.style.left = `${x}px`;
  setas.baixo.style.top = `${y + distancia}px`;
  setas.esquerda.style.left = `${x - distancia}px`;
  setas.esquerda.style.top = `${y}px`;
  setas.direita.style.left = `${x + distancia}px`;
  setas.direita.style.top = `${y}px`;
}

// Acha a sala mais próxima na direção pedida (no plano X/Z do mundo real), a partir da sala atual,
// só entre salas do MESMO ANDAR (esquerda/direita não trocam de pavimento).
// Só considera salas cujo ângulo em relação à direção seja razoável (evita pular "de lado")
// e, entre as candidatas, prioriza a mais alinhada e mais próxima.
function encontrarSalaNaDirecao(svgIdAtual, direcaoVetor, andarAtual) {
  const centroAtual = centrosDasSalas[svgIdAtual];
  if (!centroAtual) return null;

  let melhorSvgId = null;
  let melhorPontuacao = -Infinity;

  Object.entries(centrosDasSalas).forEach(([svgId, centro]) => {
    if (svgId === svgIdAtual) return;
    const sala = salasPorSvgId[svgId];
    if (!sala || sala.andar !== andarAtual) return;

    const delta = new THREE.Vector3(centro.x - centroAtual.x, 0, centro.z - centroAtual.z);
    const distancia = delta.length();
    if (distancia < 1) return;

    const alinhamento = delta.clone().normalize().dot(direcaoVetor); // 1 = direção exata, 0 = perpendicular
    if (alinhamento < 0.4) return; // fora de um cone de ~65° na direção pedida

    const pontuacao = alinhamento / distancia; // prioriza alinhada e próxima
    if (pontuacao > melhorPontuacao) {
      melhorPontuacao = pontuacao;
      melhorSvgId = svgId;
    }
  });

  return melhorSvgId;
}

// Acha a sala mais próxima (em linha reta) que esteja no andar pedido — usado pelas setas cima/baixo
function encontrarSalaMaisProximaNoAndar(svgIdAtual, andarAlvo) {
  const centroAtual = centrosDasSalas[svgIdAtual];
  if (!centroAtual) return null;

  let melhorSvgId = null;
  let menorDistancia = Infinity;

  Object.entries(centrosDasSalas).forEach(([svgId, centro]) => {
    if (svgId === svgIdAtual) return;
    const sala = salasPorSvgId[svgId];
    if (!sala || sala.andar !== andarAlvo) return;

    const distancia = centro.distanceTo(centroAtual);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhorSvgId = svgId;
    }
  });

  return melhorSvgId;
}

// Navega pra sala da seta clicada: esquerda/direita ficam no mesmo andar (geometria real),
// cima/baixo trocam de andar (cima -> superior, baixo -> térreo)
function navegarParaSala(nomeDirecao) {
  if (!salaSelecionadaNaCena) return;

  let svgId;
  if (nomeDirecao === 'cima' || nomeDirecao === 'baixo') {
    const andarAlvo = nomeDirecao === 'cima' ? 'superior' : 'terreo';
    svgId = encontrarSalaMaisProximaNoAndar(salaSelecionadaNaCena.svg_id, andarAlvo);
  } else {
    const direita = obterDirecaoDireitaDaCamera();
    const direcaoVetor = nomeDirecao === 'direita' ? direita : direita.clone().negate();
    svgId = encontrarSalaNaDirecao(salaSelecionadaNaCena.svg_id, direcaoVetor, salaSelecionadaNaCena.andar);
  }

  const sala = svgId && salasPorSvgId[svgId];
  if (sala) selecionarSalaComFoco(sala, false); // navegar por seta só foca a câmera, não abre a janela
}

// Junta as posições de todas as portas do modelo (grupos "sweethome3d_opening_on_hinge...")
function coletarPortas(objeto) {
  todasAsPortas = [];
  objeto.traverse((filho) => {
    if (filho.isMesh && filho.name.startsWith('sweethome3d_opening_on_hinge')) {
      todasAsPortas.push(new THREE.Box3().setFromObject(filho).getCenter(new THREE.Vector3()));
    }
  });
}

// Acha a porta mais próxima do centro de uma sala (distância no plano XZ, ignora altura)
function encontrarPortaMaisProxima(centroSala) {
  let maisProxima = null;
  let menorDistancia = Infinity;
  todasAsPortas.forEach((portaCentro) => {
    const dx = portaCentro.x - centroSala.x;
    const dz = portaCentro.z - centroSala.z;
    const distancia = Math.sqrt(dx * dx + dz * dz);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      maisProxima = portaCentro;
    }
  });
  return maisProxima;
}

// Move a câmera suavemente até ficar em frente à sala escolhida. Se tiver uma posição gravada
// manualmente pra essa sala (POSICOES_FIXAS_POR_SALA), usa ela; senão calcula automaticamente
// pela porta mais próxima, olhando pra dentro dela.
function focarCameraNaSala(malha, svgId) {
  if (!malha || !controles3d) return;

  const fixa = svgId && POSICOES_FIXAS_POR_SALA[svgId];
  if (fixa) {
    animarCamera(fixa.alvo.clone(), fixa.posicao.clone(), 600);
    return;
  }

  const caixa = new THREE.Box3().setFromObject(malha);
  const centro = caixa.getCenter(new THREE.Vector3());
  const tamanho = caixa.getSize(new THREE.Vector3());
  const distancia = Math.max(tamanho.x, tamanho.z, 300) * 1.3;

  const porta = encontrarPortaMaisProxima(centro);
  let direcao;
  if (porta) {
    // direção do centro da sala até a porta (no plano do chão) — é por onde a câmera "entra"
    direcao = new THREE.Vector3(porta.x - centro.x, 0, porta.z - centro.z);
  }
  if (!porta || direcao.lengthSq() < 1) {
    // reserva: se não achou porta perto, mantém o ângulo em que a câmera já está
    direcao = camera3d.position.clone().sub(controles3d.target);
  }
  direcao.normalize();

  const alvoFinal = centro.clone();
  const posicaoFinal = centro.clone().add(direcao.multiplyScalar(distancia));
  posicaoFinal.y = Math.max(posicaoFinal.y, centro.y + distancia * 0.3); // não deixa a câmera "cair" pro nível do chão

  animarCamera(alvoFinal, posicaoFinal, 600);
}

// Anima a câmera e o alvo dos controles suavemente entre a posição atual e a final (easeOutQuad).
// O deslocamento da câmera em relação ao alvo é interpolado em coordenadas esféricas
// (raio + ângulos), como um drone orbitando — interpolar em linha reta fazia a câmera
// "afundar" no prédio e girar estranho nas transições quase verticais (vista de cima).
function animarCamera(alvoFinal, posicaoFinal, duracaoMs) {
  if (animacaoCameraEmAndamento) cancelAnimationFrame(animacaoCameraEmAndamento);

  // Descarrega a inércia (damping) que sobrou de um arraste do usuário ANTES de gravar o ponto
  // de partida — senão essa "velocidade residual" continuava sendo aplicada pelo OrbitControls
  // depois da animação acabar, dando um puxão (flick) no final. Com o damping desligado,
  // o update() aplica e zera o delta pendente de uma vez só.
  controles3d.enableDamping = false;
  controles3d.update();
  controles3d.enableDamping = true;

  const alvoInicial = controles3d.target.clone();
  const posicaoInicial = camera3d.position.clone();

  const esfericaInicial = new THREE.Spherical().setFromVector3(posicaoInicial.clone().sub(alvoInicial));
  const esfericaFinal = new THREE.Spherical().setFromVector3(posicaoFinal.clone().sub(alvoFinal));

  // Quando uma das pontas é vista de cima (phi ~ 0), o ângulo horizontal (theta) fica indefinido —
  // copiamos o da outra ponta pra câmera não dar uma volta desnecessária no eixo vertical
  const LIMIAR_VERTICAL = 0.05;
  if (esfericaFinal.phi < LIMIAR_VERTICAL) esfericaFinal.theta = esfericaInicial.theta;
  if (esfericaInicial.phi < LIMIAR_VERTICAL) esfericaInicial.theta = esfericaFinal.theta;

  // Gira sempre pelo caminho mais curto no eixo horizontal
  if (esfericaFinal.theta - esfericaInicial.theta > Math.PI) esfericaFinal.theta -= Math.PI * 2;
  if (esfericaInicial.theta - esfericaFinal.theta > Math.PI) esfericaFinal.theta += Math.PI * 2;

  const inicio = performance.now();

  function passo(agora) {
    const t = Math.min((agora - inicio) / duracaoMs, 1);
    // easeInOutCubic: acelera e desacelera suavemente nas duas pontas — movimento mais natural
    const suavizado = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    controles3d.target.lerpVectors(alvoInicial, alvoFinal, suavizado);

    const esferica = new THREE.Spherical(
      THREE.MathUtils.lerp(esfericaInicial.radius, esfericaFinal.radius, suavizado),
      THREE.MathUtils.lerp(esfericaInicial.phi, esfericaFinal.phi, suavizado),
      THREE.MathUtils.lerp(esfericaInicial.theta, esfericaFinal.theta, suavizado)
    );
    camera3d.position.setFromSpherical(esferica).add(controles3d.target);

    if (t < 1) {
      animacaoCameraEmAndamento = requestAnimationFrame(passo);
    } else {
      animacaoCameraEmAndamento = null;
    }
  }
  animacaoCameraEmAndamento = requestAnimationFrame(passo);
}

// Chamada pelas bolinhas (abrirJanela=true) e pelas setas de navegação (abrirJanela=false):
// sempre foca a câmera na sala, mas só abre o painel de reserva quando vem de um clique direto na sala.
function selecionarSalaComFoco(sala, abrirJanela = true) {
  if (!sala) return;
  salaSelecionadaNaCena = sala; // pro botão de captura saber pra qual sala gravar a posição
  // se a sala for de outro andar (ex.: navegou pela seta ▲/▼), acompanha o filtro de andar
  if (sala.andar && sala.andar !== andarAtual) trocarAndarSemMoverCamera(sala.andar);
  const malha = malhasPorSvgId[sala.svg_id];
  if (malha) focarCameraNaSala(malha, sala.svg_id);
  selecionarSala(sala, abrirJanela);
}

// Só troca o filtro de andar, a alça do slider e a visibilidade da geometria — sem reposicionar
// a câmera (usado quando a troca vem de navegar pra uma sala, não de arrastar o slider)
function trocarAndarSemMoverCamera(andar) {
  andarAtual = andar;
  atualizarAlcaDoSlider(andar);
  aplicarVisibilidadeAndar(andar);
}

// Pinta uma sala de vermelho (ocupada) ou verde (livre) — usado pelo RF04 (a bolinha também muda de cor)
function pintarSala3D(svgId, ocupada) {
  const malha = malhasPorSvgId[svgId];
  if (malha) malha.material.color.set(ocupada ? 0xe57373 : 0xa8d5a2);

  const marcador = marcadoresDeSala[svgId];
  if (marcador) marcador.style.background = ocupada ? '#e57373' : '#2e7d53';
}

// Ícone de mira acima do slider: sempre volta pra vista padrão do TÉRREO (a posição "home" do sistema)
const btnCentralizarPadrao = document.getElementById('btn-centralizar-padrao');
if (btnCentralizarPadrao) {
  btnCentralizarPadrao.onclick = () => trocarAndar('terreo');
}

// Setas de navegação: pulam pra sala mais próxima naquela direção
['cima', 'baixo', 'esquerda', 'direita'].forEach((direcao) => {
  const botao = document.getElementById(`btn-seta-${direcao}`);
  if (botao) botao.onclick = () => navegarParaSala(direcao);
});

// Slider lateral de andar (RF10): arraste a alça até o topo (Superior) ou a base (Térreo).
// Clicar em qualquer ponto do trilho também move a alça direto pra lá.
(function configurarSliderDeAndar() {
  const trilho = document.getElementById('slider-andar-trilho');
  const alca = document.getElementById('slider-andar-alca');
  if (!trilho || !alca) return;

  let arrastando = false;

  // Converte a posição Y do ponteiro (mouse/toque) em 'terreo' ou 'superior',
  // dependendo de qual metade do trilho ele está
  function andarNaPosicao(clientY) {
    const retangulo = trilho.getBoundingClientRect();
    const proporcao = (clientY - retangulo.top) / retangulo.height; // 0 = topo, 1 = base
    return proporcao > 0.5 ? 'terreo' : 'superior';
  }

  function aoMover(evento) {
    if (!arrastando) return;
    const clientY = evento.touches ? evento.touches[0].clientY : evento.clientY;
    atualizarAlcaDoSlider(andarNaPosicao(clientY)); // feedback visual imediato, sem esperar soltar
  }

  function aoSoltar(evento) {
    if (!arrastando) return;
    arrastando = false;
    alca.classList.remove('arrastando');
    const clientY = evento.changedTouches ? evento.changedTouches[0].clientY : evento.clientY;
    trocarAndar(andarNaPosicao(clientY));
  }

  function aoComecarArrastar(evento) {
    arrastando = true;
    alca.classList.add('arrastando');
    evento.preventDefault();
  }

  alca.addEventListener('mousedown', aoComecarArrastar);
  alca.addEventListener('touchstart', aoComecarArrastar, { passive: false });
  window.addEventListener('mousemove', aoMover);
  window.addEventListener('touchmove', aoMover, { passive: false });
  window.addEventListener('mouseup', aoSoltar);
  window.addEventListener('touchend', aoSoltar);

  // Clicar em qualquer ponto do trilho (fora da alça) já manda direto pro andar daquele ponto
  trilho.addEventListener('click', (evento) => {
    if (evento.target === alca) return;
    trocarAndar(andarNaPosicao(evento.clientY));
  });
})();

function ajustarTamanho3D() {
  const container = document.getElementById('planta3d-container');
  camera3d.aspect = container.clientWidth / container.clientHeight;
  camera3d.updateProjectionMatrix();
  renderer3d.setSize(container.clientWidth, container.clientHeight);
}

function animar3D() {
  requestAnimationFrame(animar3D);
  controles3d.update(); // necessário por causa do enableDamping
  if (modeloCarregado) atualizarMarcadoresDeSala();
  renderer3d.render(cena3d, camera3d);
}

// Botão de captura: navegue até a vista que quer pra sala selecionada e clique aqui.
// Gera a linha pronta pra colar em POSICOES_FIXAS_POR_SALA (mostra no painel e no console).
const btnCapturarCamera = document.getElementById('btn-capturar-camera');
if (btnCapturarCamera) {
  btnCapturarCamera.onclick = () => {
    const p = camera3d.position;
    const t = controles3d.target;
    const painelDebug = document.getElementById('debug-sala-clicada');

    const svgId = salaSelecionadaNaCena ? salaSelecionadaNaCena.svg_id : null;
    const texto = svgId
      ? `'${svgId}': { posicao: new THREE.Vector3(${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}), alvo: new THREE.Vector3(${t.x.toFixed(0)}, ${t.y.toFixed(0)}, ${t.z.toFixed(0)}) },`
      : `Nenhuma sala selecionada — clique numa bolinha antes de capturar. posição: (${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)})  |  alvo: (${t.x.toFixed(0)}, ${t.y.toFixed(0)}, ${t.z.toFixed(0)})`;

    if (painelDebug) painelDebug.textContent = texto;
    console.log(texto);
  };
}
