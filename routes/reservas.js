// Rotas de reservas — inclui a validação de conflito de horário (núcleo do sistema)
const express = require('express');
const db = require('../config/db');
const { exigirLogin } = require('../config/auth-middleware');
const router = express.Router();

// Listar as reservas de uma sala em uma data (para montar a grade de horários)
// Ex.: GET /api/reservas?sala_id=3&data=2026-08-10
router.get('/', async (req, res) => {
  try {
    const { sala_id, data } = req.query;
    if (!sala_id || !data) {
      return res.status(400).json({ erro: 'Informe sala_id e data.' });
    }
    const [reservas] = await db.query(
      `SELECT r.id, r.hora_inicio, r.hora_fim, r.finalidade, u.nome AS usuario
         FROM reservas r
         JOIN usuarios u ON u.id = r.usuario_id
        WHERE r.sala_id = ? AND r.data = ? AND r.status = 'confirmada'
        ORDER BY r.hora_inicio`,
      [sala_id, data]
    );
    res.json(reservas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar reservas.' });
  }
});

// RF04 - Status de ocupação de todas as salas numa data (para pintar a planta)
// Ex.: GET /api/reservas/ocupacao?data=2026-08-10
// Retorna, para cada sala ativa, se ela tem alguma reserva confirmada na data informada.
router.get('/ocupacao', async (req, res) => {
  try {
    const { data } = req.query;
    if (!data) {
      return res.status(400).json({ erro: 'Informe a data.' });
    }
    // EXISTS verifica, para cada sala, se existe reserva confirmada na data — sem precisar de GROUP BY
    const [salas] = await db.query(
      `SELECT s.id, s.svg_id, s.nome,
              EXISTS(
                SELECT 1 FROM reservas r
                 WHERE r.sala_id = s.id AND r.data = ? AND r.status = 'confirmada'
              ) AS ocupada
         FROM salas s
        WHERE s.ativa = TRUE`,
      [data]
    );
    res.json(salas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao verificar ocupação das salas.' });
  }
});

// RF04 (tempo real) - Diz quais salas estão ocupadas NESTE EXATO MOMENTO (hoje + horário atual
// dentro de alguma reserva confirmada). Usado pra pintar a bolinha de vermelho só durante o
// horário reservado, voltando sozinha pra verde assim que o horário passa.
// Ex.: GET /api/reservas/ocupacao-agora
router.get('/ocupacao-agora', async (req, res) => {
  try {
    const [salas] = await db.query(
      `SELECT s.id, s.svg_id, s.nome,
              EXISTS(
                SELECT 1 FROM reservas r
                 WHERE r.sala_id = s.id AND r.data = CURDATE() AND r.status = 'confirmada'
                   AND r.hora_inicio <= CURTIME() AND CURTIME() < r.hora_fim
              ) AS ocupada
         FROM salas s
        WHERE s.ativa = TRUE`
    );
    res.json(salas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao verificar ocupação atual das salas.' });
  }
});

// Criar uma reserva (exige login) — valida sobreposição de horário
router.post('/', exigirLogin, async (req, res) => {
  try {
    const { sala_id, data, hora_inicio, hora_fim, finalidade } = req.body;
    const usuario_id = req.session.usuario.id;

    if (!sala_id || !data || !hora_inicio || !hora_fim) {
      return res.status(400).json({ erro: 'Preencha sala, data e horários.' });
    }
    if (hora_fim <= hora_inicio) {
      return res.status(400).json({ erro: 'O horário final deve ser maior que o inicial.' });
    }

    // CHECAGEM DE CONFLITO:
    // duas reservas se sobrepõem quando  inicio_novo < fim_existente  E  fim_novo > inicio_existente
    const [conflito] = await db.query(
      `SELECT id FROM reservas
        WHERE sala_id = ? AND data = ? AND status = 'confirmada'
          AND hora_inicio < ? AND hora_fim > ?`,
      [sala_id, data, hora_fim, hora_inicio]
    );
    if (conflito.length > 0) {
      return res.status(409).json({ erro: 'Já existe uma reserva nesse horário para esta sala.' });
    }

    const [resultado] = await db.query(
      `INSERT INTO reservas (sala_id, usuario_id, data, hora_inicio, hora_fim, finalidade)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sala_id, usuario_id, data, hora_inicio, hora_fim, finalidade || null]
    );
    res.status(201).json({ mensagem: 'Reserva confirmada.', id: resultado.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar reserva.' });
  }
});

// Cancelar uma reserva (só o dono ou um admin)
router.delete('/:id', exigirLogin, async (req, res) => {
  try {
    const [linhas] = await db.query('SELECT * FROM reservas WHERE id = ?', [req.params.id]);
    if (linhas.length === 0) return res.status(404).json({ erro: 'Reserva não encontrada.' });

    const reserva = linhas[0];
    const u = req.session.usuario;
    if (reserva.usuario_id !== u.id && u.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Você não pode cancelar esta reserva.' });
    }
    await db.query("UPDATE reservas SET status = 'cancelada' WHERE id = ?", [req.params.id]);
    res.json({ mensagem: 'Reserva cancelada.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao cancelar reserva.' });
  }
});

module.exports = router;
