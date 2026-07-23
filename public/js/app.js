// Lógica do front-end: login, planta clicável, grade de horários e reserva.

let salaSelecionada = null; // { id, nome }
let salasPorSvgId = {};     // mapa: svg_id -> sala do banco

// ---- utilidades ----
async function api(url, metodo = 'GET', corpo = null) {
  const opcoes = { method: metodo, headers: { 'Content-Type': 'application/json' } };
  if (corpo) opcoes.body = JSON.stringify(corpo);
  const resp = await fetch(url, opcoes);
  const dados = await resp.json();
  if (!resp.ok) throw new Error(dados.erro || 'Erro');
  return dados;
}

// ---- controle de telas conforme o login ----
async function verificarLogin() {
  const { usuario } = await api('/api/auth/eu');
  if (usuario) {
    document.getElementById('tela-login').style.display = 'none';
    document.getElementById('tela-principal').style.display = 'block';
    document.getElementById('nome-usuario').textContent = 'Olá, ' + usuario.nome;
    document.getElementById('btn-logout').style.display = 'inline';
    carregarSalas();
  } else {
    document.getElementById('tela-login').style.display = 'block';
    document.getElementById('tela-principal').style.display = 'none';
    document.getElementById('btn-logout').style.display = 'none';
    document.getElementById('nome-usuario').textContent = '';
  }
}

document.getElementById('btn-login').onclick = async () => {
  try {
    await api('/api/auth/login', 'POST', {
      email: document.getElementById('login-email').value,
      senha: document.getElementById('login-senha').value,
    });
    verificarLogin();
  } catch (e) {
    document.getElementById('msg-login').textContent = e.message;
  }
};

document.getElementById('btn-logout').onclick = async () => {
  await api('/api/auth/logout', 'POST');
  verificarLogin();
};

// ---- cadastro ----
document.getElementById('link-cadastro').onclick = (e) => {
  e.preventDefault();
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-cadastro').style.display = 'block';
};

document.getElementById('link-login').onclick = (e) => {
  e.preventDefault();
  document.getElementById('tela-cadastro').style.display = 'none';
  document.getElementById('tela-login').style.display = 'block';
};

document.getElementById('btn-cadastrar').onclick = async () => {
  try {
    await api('/api/auth/registrar', 'POST', {
      nome: document.getElementById('cad-nome').value,
      email: document.getElementById('cad-email').value,
      senha: document.getElementById('cad-senha').value,
    });
    document.getElementById('msg-cadastro').style.color = '#2e7d53';
    document.getElementById('msg-cadastro').textContent = 'Cadastro feito! Faça login.';
  } catch (e) {
    document.getElementById('msg-cadastro').style.color = '';
    document.getElementById('msg-cadastro').textContent = e.message;
  }
};

// ---- planta interativa (modelo 3D — ver public/js/planta3d.js) ----
async function carregarSalas() {
  const salas = await api('/api/salas');
  salasPorSvgId = {};
  salas.forEach(s => { salasPorSvgId[s.svg_id] = s; });

  // Inicia a cena 3D só uma vez; se o usuário deslogar/logar de novo, não recarrega o modelo
  if (!modeloCarregado) {
    iniciarCena3D();
  }

  // Começa a pintar a ocupação em tempo real e mantém repetindo (ver atualizarOcupacaoAoVivo)
  atualizarOcupacaoAoVivo();
  if (!timerOcupacaoAoVivo) {
    timerOcupacaoAoVivo = setInterval(atualizarOcupacaoAoVivo, 30000); // confere a cada 30s
  }
}

// RF04 - Pinta cada sala do modelo 3D de vermelho (ocupada) ou verde (livre) conforme a data escolhida
// (usado na grade de horários da janela de reserva)
async function atualizarOcupacaoNaPlanta() {
  const data = document.getElementById('data').value;
  if (!data || !modeloCarregado) return;
  try {
    const salas = await api(`/api/reservas/ocupacao?data=${data}`);
    salas.forEach(sala => pintarSala3D(sala.svg_id, !!sala.ocupada));
  } catch (e) {
    console.error('Erro ao buscar ocupação:', e);
  }
}

// Sempre que o usuário mudar a data, repinta a planta
document.getElementById('data').addEventListener('change', atualizarOcupacaoNaPlanta);

// Ocupação em tempo real: pinta de vermelho só as salas que têm reserva confirmada acontecendo
// AGORA (hoje, dentro do horário) e volta pra verde sozinha assim que o horário passa —
// por isso repetimos essa checagem periodicamente, não só quando o usuário escolhe uma data.
let timerOcupacaoAoVivo = null;
async function atualizarOcupacaoAoVivo() {
  if (!modeloCarregado) return;
  try {
    const salas = await api('/api/reservas/ocupacao-agora');
    salas.forEach(sala => pintarSala3D(sala.svg_id, !!sala.ocupada));
  } catch (e) {
    console.error('Erro ao buscar ocupação em tempo real:', e);
  }
}

let timerAbrirReserva = null; // adia a abertura da janela até a câmera chegar na sala

function selecionarSala(sala, abrirJanela = true) {
  salaSelecionada = sala;
  document.getElementById('titulo-sala').textContent =
    sala.nome + ' (capacidade: ' + sala.capacidade + ')';
  document.getElementById('lista-horarios').innerHTML = '';
  document.getElementById('msg-reserva').textContent = '';

  clearTimeout(timerAbrirReserva);
  if (!abrirJanela) return; // navegação por seta: só troca o "foco", não abre o formulário

  // abre a janela de reserva só depois que a câmera termina de "voar" até a sala (600ms)
  timerAbrirReserva = setTimeout(() => {
    document.getElementById('overlay-reserva').style.display = 'flex';
  }, 650);
}

function fecharReserva() {
  clearTimeout(timerAbrirReserva);
  document.getElementById('overlay-reserva').style.display = 'none';
}

document.getElementById('btn-fechar-reserva').onclick = fecharReserva;
// clicar no fundo escurecido (fora do cartão) também fecha
document.getElementById('overlay-reserva').onclick = (e) => {
  if (e.target.id === 'overlay-reserva') fecharReserva();
};

// ---- grade de horários ----
document.getElementById('btn-ver-horarios').onclick = async () => {
  if (!salaSelecionada) return;
  const data = document.getElementById('data').value;
  if (!data) return alert('Escolha uma data.');

  const reservas = await api(`/api/reservas?sala_id=${salaSelecionada.id}&data=${data}`);
  const lista = document.getElementById('lista-horarios');
  lista.innerHTML = '';
  if (reservas.length === 0) {
    lista.innerHTML = '<li>Nenhuma reserva nesta data — sala livre o dia todo.</li>';
  } else {
    reservas.forEach(r => {
      const li = document.createElement('li');
      li.textContent = `${r.hora_inicio} – ${r.hora_fim}  (${r.usuario})` +
        (r.finalidade ? ` — ${r.finalidade}` : '');
      lista.appendChild(li);
    });
  }
};

// ---- criar reserva ----
document.getElementById('btn-reservar').onclick = async () => {
  if (!salaSelecionada) return;
  try {
    await api('/api/reservas', 'POST', {
      sala_id: salaSelecionada.id,
      data: document.getElementById('data').value,
      hora_inicio: document.getElementById('hora-inicio').value,
      hora_fim: document.getElementById('hora-fim').value,
      finalidade: document.getElementById('finalidade').value,
    });
    document.getElementById('msg-reserva').textContent = 'Reserva confirmada!';
    document.getElementById('btn-ver-horarios').click(); // atualiza a lista
    atualizarOcupacaoAoVivo(); // se a reserva já começou agora, pinta a bolinha de vermelho na hora
  } catch (e) {
    document.getElementById('msg-reserva').textContent = e.message;
  }
};

// inicia
verificarLogin();
