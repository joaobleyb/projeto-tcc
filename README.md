# Sistema de Agendamento de Salas Com Iteratividade 3D — IFRS Campus Rolante

Trabalho de Conclusão de Curso (ADS — IFRS Campus Rolante): sistema web de agendamento de
salas com **planta 3D interativa** do prédio, onde o usuário navega pelo modelo, clica na
sala desejada e faz a reserva direto pela interface.

**Stack:** Node.js + Express (backend) · MySQL (banco) · HTML/CSS/JS puro + Three.js (frontend,
sem build/bundler) · Docker (ambiente pronto pra rodar).

## Funcionalidades

- **Login e cadastro** de usuários (senha com hash bcrypt, sessão via `express-session`).
- **Planta 3D navegável** (Three.js): arraste para girar, role o mouse para zoom.
- **Bolinhas clicáveis** em cada sala — ao clicar, a câmera "voa" até a porta da sala e abre
  a janela de agendamento.
- **Setas de navegação** (▲▼◀▶) ao redor da sala selecionada, para pular pra sala vizinha
  sem precisar mirar no modelo 3D.
- **Slider lateral de andar** — arraste a alça (ou clique no trilho) para trocar entre
  Térreo e Superior; só as salas do andar escolhido ficam visíveis/clicáveis.
- **Ocupação em tempo real**: a bolinha de cada sala fica vermelha automaticamente durante o
  horário de uma reserva confirmada e volta pra verde sozinha quando o horário passa.
- **Grade de horários por data**: escolha uma data no formulário de reserva pra ver os
  horários já ocupados daquela sala antes de reservar.
- **Validação de conflito de horário** no backend — não é possível reservar uma sala em cima
  de um horário já ocupado.

## Como rodar

### Opção 1 — Docker (recomendado)

Só precisa ter o [Docker](https://www.docker.com/) instalado.

```
docker compose up --build
```

Isso sobe dois containers: o app Node (porta `3000`) e um MySQL já com o banco criado e
populado a partir de `sql/schema.sql`. Acesse **http://localhost:3000**.

Para configurar senha do banco, porta etc., copie `.env.example` para `.env` e ajuste — o
`docker-compose.yml` lê essas variáveis automaticamente.

Se você mudar o `sql/schema.sql` depois de já ter subido o banco uma vez, recrie o volume
para as mudanças entrarem:
```
docker compose down -v
docker compose up --build
```

### Opção 2 — Local (sem Docker)

**Pré-requisitos:** Node.js 18+ e MySQL rodando.

```
npm install
mysql -u root -p < sql/schema.sql
cp .env.example .env      # edite com a senha do seu MySQL
npm start
```
Acesse **http://localhost:3000**.

## Usuário padrão

Já vem cadastrado um usuário administrador para testes:

- **Email:** `jvbb2004@gmail.com`
- **Senha:** `123`

## Estrutura do projeto

```
server.js                   ponto de entrada (Express)
config/
  db.js                      conexão com o MySQL (pool com promises)
  auth-middleware.js         middlewares exigirLogin / exigirAdmin
routes/
  auth.js                    cadastro, login, logout, sessão atual
  salas.js                   listar/criar salas
  reservas.js                grade de horários, ocupação (por data e em tempo real), criar/cancelar reserva
sql/
  schema.sql                 criação das tabelas + dados de exemplo (salas e usuário padrão)
public/
  index.html                 telas de login, cadastro, planta 3D e janela de reserva
  css/estilo.css             tema visual (paleta IFRS)
  js/app.js                  login, cadastro, reserva, grade de horários
  js/planta3d.js              cena 3D (Three.js): carregamento do modelo, câmera, navegação, andares
  modelo3d/                  modelo 3D exportado do Sweet Home 3D (.obj/.mtl + texturas)
Dockerfile, docker-compose.yml   ambiente Docker (app + MySQL)
```

## Sobre o modelo 3D

O modelo em `public/modelo3d/` foi exportado do Sweet Home 3D (Arquivo → Exportar para
formato OBJ). Como o exportador não preserva o nome dado a cada cômodo, a ligação entre cada
sala do modelo e o registro correspondente no banco é feita manualmente em
`MAPEAMENTO_MANUAL_SALAS`, dentro de `public/js/planta3d.js`. Se o modelo for reexportado
(por exemplo, depois de adicionar uma porta ou móvel novo no Sweet Home 3D), os nomes internos
dos cômodos podem mudar e esse mapeamento precisa ser conferido de novo.

## Primeiro usuário administrador (caso crie um novo banco do zero)

Se você preferir cadastrar seu próprio usuário em vez de usar o padrão, cadastre-se
normalmente pela tela de cadastro e depois promova a admin pelo MySQL:
```sql
UPDATE usuarios SET tipo = 'admin' WHERE email = 'seu@email.com';
```

## Próximos passos sugeridos (para evoluir o TCC)

- Painel administrativo (cadastrar/editar/desativar salas, ver todas as reservas de todos os usuários)
- Dashboard de ocupação (sala mais reservada, horários de pico)
- Animações/transições adicionais na interface (RF09)
- Completar a identificação da Biblioteca no modelo 3D (falta mapear no `MAPEAMENTO_MANUAL_SALAS`)
