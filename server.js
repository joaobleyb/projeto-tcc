// Servidor principal
const express = require('express');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Middlewares para ler JSON e formulários
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessão (guarda o login do usuário)
app.use(session({
  secret: process.env.SESSION_SECRET || 'segredo-dev',
  resave: false,
  saveUninitialized: false,
}));

// Arquivos estáticos (o front HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/salas', require('./routes/salas'));
app.use('/api/reservas', require('./routes/reservas'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
