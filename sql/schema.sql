-- Banco de dados: Sistema de Agendamento de Salas - IFRS Campus Rolante
-- Execute este script uma vez para criar o banco e as tabelas.

-- Força a sessão que roda este script a usar utf8mb4 — sem isso, o cliente MySQL às vezes usa
-- latin1 por padrão e os acentos dos INSERTs abaixo gravam corrompidos (ex.: "João" vira "JoÃ£o").
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS agenda_ifrs
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE agenda_ifrs;

-- Usuários do sistema (professores/servidores e administradores)
CREATE TABLE usuarios (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nome         VARCHAR(120)  NOT NULL,
  email        VARCHAR(160)  NOT NULL UNIQUE,
  senha_hash   VARCHAR(255)  NOT NULL,
  tipo         ENUM('usuario','admin') NOT NULL DEFAULT 'usuario',
  criado_em    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Salas / laboratórios / espaços agendáveis (correspondem ao modelo 3D)
CREATE TABLE salas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nome         VARCHAR(80)   NOT NULL,          -- ex.: "Sala 1", "Lab Info 1", "Biblioteca"
  svg_id       VARCHAR(80)   NOT NULL UNIQUE,   -- id do elemento na planta/modelo 3D (liga o clique à sala)
  capacidade   INT           NOT NULL DEFAULT 30,
  recursos     VARCHAR(255)  DEFAULT NULL,      -- ex.: "projetor, ar-condicionado"
  andar        ENUM('terreo','superior') NOT NULL DEFAULT 'terreo', -- RF10: pavimento do prédio
  ativa        BOOLEAN       NOT NULL DEFAULT TRUE
);

-- Reservas
CREATE TABLE reservas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  sala_id      INT           NOT NULL,
  usuario_id   INT           NOT NULL,
  data         DATE          NOT NULL,
  hora_inicio  TIME          NOT NULL,
  hora_fim     TIME          NOT NULL,
  finalidade   VARCHAR(200)  DEFAULT NULL,
  status       ENUM('pendente','confirmada','cancelada') NOT NULL DEFAULT 'confirmada',
  criado_em    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reserva_sala    FOREIGN KEY (sala_id)    REFERENCES salas(id),
  CONSTRAINT fk_reserva_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT chk_horario CHECK (hora_fim > hora_inicio)
);

-- Índice que acelera a checagem de conflito (mesma sala + mesma data)
CREATE INDEX idx_conflito ON reservas (sala_id, data, status);

-- Usuário padrão para testes (email: jvbb2004@gmail.com / senha: 123)
-- senha_hash gerado com bcrypt (bcryptjs.hashSync('123', 10))
INSERT INTO usuarios (nome, email, senha_hash, tipo) VALUES
  ('João', 'jvbb2004@gmail.com', '$2a$10$NqZryJgWl1eaMJ04nRJB4OoK81TdEn.cwjJqKSdH5NBhPJDzdy9Fu', 'admin');

-- Dados de exemplo (ajuste os svg_id para bater com os ids reais do seu modelo 3D)
-- Sala 1/2/3 e Lab 1/2/3 ficam no pavimento superior (identificado no modelo 3D exportado).
-- Biblioteca assumida no térreo — ajuste se estiver em outro andar.
INSERT INTO salas (nome, svg_id, capacidade, recursos, andar) VALUES
  ('Sala 1',       'sala-1',   30, 'projetor',              'superior'),
  ('Sala 2',       'sala-2',   30, 'projetor',              'superior'),
  ('Sala 3',       'sala-3',   30, NULL,                    'superior'),
  ('Laboratório 1','lab-1',    25, 'computadores, projetor','superior'),
  ('Laboratório 2','lab-2',    25, 'computadores, projetor','superior'),
  ('Laboratório 3','lab-3',    25, 'computadores, projetor','superior'),
  ('Biblioteca',   'biblioteca',40,'mesas de estudo',       'terreo'),
  ('Sala 4',       'sala-4',   30, 'projetor',              'terreo'),
  ('Sala 5',       'sala-5',   30, 'projetor',              'terreo'),
  ('Sala 6',       'sala-6',   30, 'projetor',              'terreo'),
  ('Auditório',    'auditorio',80, 'projetor, som',         'terreo');
