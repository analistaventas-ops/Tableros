const { createClient } = require('@supabase/supabase-js');

// Estas variables se deben configurar en el archivo .env o en el panel de Vercel
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: SUPABASE_URL y SUPABASE_KEY son requeridos en el archivo .env");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Este es un wrapper para mantener compatibilidad basica con el codigo existente
// que usaba sqlite3 (db.get, db.all, etc), aunque lo ideal seria usar la sintaxis de supabase.
const db = {
  // Metodo auxiliar para simular db.get de sqlite (retorna un objeto)
  get: async (table, query, params) => {
    // Nota: Esto es una simplificacion. En la practica adaptaremos server.js.
  },
  supabase // Exportamos el cliente original para usar la sintaxis potente
};

module.exports = supabase;
