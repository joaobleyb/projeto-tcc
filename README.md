# Sistema de Agendamento de Salas — IFRS Campus Rolante

Sistema web com planta interativa para reserva de salas. Stack: Node.js + Express + MySQL, front em HTML/CSS/JS puro.

## Como rodar (passo a passo)

### 1. Pré-requisitos
- Node.js instalado (versão 18 ou superior)
- MySQL instalado e rodando

### 2. Instalar as dependências
Dentro da pasta do projeto, no terminal:
```
npm install
```

### 3. Criar o banco de dados
Abra o MySQL e execute o script:
```
mysql -u root -p < sql/schema.sql
```
Isso cria o banco `agenda_ifrs`, as tabelas e algumas salas de exemplo.

### 4. Configurar as variáveis de ambiente
Copie o arquivo de exemplo e preencha com seus dados:
```
cp .env.example .env
```
Edite o `.env` com a senha do seu MySQL.

### 5. Rodar o servidor
```
npm start
```
Acesse no navegador: http://localhost:3000

### 6. Colocar a planta
Exporte a planta do Sweet Home 3D em SVG (`Plano > Exportar para formato SVG`),
renomeie para `planta.svg` e coloque dentro da pasta `public/`.

**Importante:** cada sala no SVG precisa ter um `id` igual ao `svg_id` cadastrado
na tabela `salas`. Você pode ajustar os ids abrindo o SVG num editor de texto,
ou ajustar os `svg_id` no banco para bater com os ids que o Sweet Home gerou.

## Estrutura do projeto
```
config/          conexão com o banco e middlewares de login
routes/          rotas da API (auth, salas, reservas)
public/          front-end (html, css, js, e o planta.svg)
sql/schema.sql   script de criação do banco
server.js        ponto de entrada
```

## Primeiro usuário administrador
Cadastre-se normalmente pela API e depois promova o usuário a admin pelo MySQL:
```sql
UPDATE usuarios SET tipo = 'admin' WHERE email = 'seu@email.com';
```

## Próximos passos sugeridos (para evoluir o TCC)
- Tela de cadastro no front (hoje o registro é só via API)
- Painel administrativo (gerenciar salas e ver todas as reservas)
- Dashboard de ocupação (sala mais usada, horários de pico)
- Destacar em vermelho no SVG as salas já ocupadas na data escolhida
- Sugestão automática de sala alternativa quando há conflito
