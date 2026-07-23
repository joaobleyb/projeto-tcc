// Conexão com o MySQL usando pool (reaproveita conexões, recomendado)
const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agenda_ifrs',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4', // sem isso, acentos gravam/leem errado (ex.: "João" virava "JoÃ£o")
});

// Exporta a versão com Promises (permite usar async/await nas rotas)
module.exports = pool.promise();
