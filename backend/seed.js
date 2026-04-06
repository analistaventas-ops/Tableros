require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database'); // Ahora es Supabase

const positionsData = [
  { name: 'Directorio' },
  { name: 'Administración' },
  { name: 'Encargado Ecommerce' },
  { name: 'Encargado Colón' },
  { name: 'Encargado Recta' },
  { name: 'Asesor Ecommerce' },
  { name: 'Operativo COLON' },
  { name: 'Operativo RECTA' }
];

// ... (datos omitidos por brevedad, usaremos los mismos del archivo original)
const usersDataRaw = [
  { username: 'admin', password: 'adminpassword', name: 'Administrador Global', role: 'admin', posName: null },
  { username: 'maria.pons', password: 'password123', name: 'Maria Pons', role: 'user', posName: 'Directorio' },
  { username: 'alejandro.pons', password: 'password123', name: 'Alejandro Pons', role: 'user', posName: 'Directorio' },
  { username: 'agustin.pons', password: 'password123', name: 'Agustin Pons', role: 'user', posName: 'Directorio' },
  { username: 'florencia.calderon', password: 'password123', name: 'Florencia Calderón', role: 'user', posName: 'Administración' },
  { username: 'julieta.robles', password: 'password123', name: 'Julieta Robles', role: 'user', posName: 'Encargado Ecommerce' },
  { username: 'jose.medina', password: 'password123', name: 'José Medina', role: 'user', posName: 'Encargado Colón' },
  { username: 'lucas.sanchez', password: 'password123', name: 'Lucas Sanchez', role: 'user', posName: 'Encargado Colón' },
  { username: 'daniel.moscatini', password: 'password123', name: 'Daniel Moscatini', role: 'user', posName: 'Encargado Recta' },
  { username: 'candela.alvarez', password: 'password123', name: 'Candela Alvarez', role: 'user', posName: 'Asesor Ecommerce' },
  { username: 'jonathan.bravo', password: 'password123', name: 'Jonathan Bravo', role: 'user', posName: 'Asesor Ecommerce' },
  { username: 'basso.sebastian', password: 'password123', name: 'Basso Sebastian Pablo', role: 'user', posName: 'Operativo COLON' },
  { username: 'bentos.luciano', password: 'password123', name: 'Bentos Luciano Jorge Rafael', role: 'user', posName: 'Operativo COLON' },
  { username: 'agustin.bravo', password: 'password123', name: 'Bravo Agustin', role: 'user', posName: 'Operativo COLON' },
  { username: 'luca.cabrera', password: 'password123', name: 'Cabrera Luca Ignacio', role: 'user', posName: 'Operativo COLON' },
  { username: 'tomas.cabrera', password: 'password123', name: 'Cabrera Tomas Alberto', role: 'user', posName: 'Operativo COLON' },
  { username: 'franco.colazo', password: 'password123', name: 'Colazo Sanchez Franco Daniel', role: 'user', posName: 'Operativo COLON' },
  { username: 'cristian.fernandez', password: 'password123', name: 'Fernandez Cristian Ariel', role: 'user', posName: 'Operativo COLON' },
  { username: 'jesus.ferrer', password: 'password123', name: 'Ferrer Isturiz Jesús Enrique', role: 'user', posName: 'Operativo COLON' },
  { username: 'jonathan.fussi', password: 'password123', name: 'Fussi Jonathan', role: 'user', posName: 'Operativo COLON' },
  { username: 'omar.gonzalez', password: 'password123', name: 'Gonzalez Omar Alberto', role: 'user', posName: 'Operativo COLON' },
  { username: 'leandro.ledesma', password: 'password123', name: 'Ledesma Leandro David', role: 'user', posName: 'Operativo COLON' },
  { username: 'thomas.madera', password: 'password123', name: 'Madera Thomas Emmanuel', role: 'user', posName: 'Operativo COLON' },
  { username: 'santiago.madrid', password: 'password123', name: 'Madrid Calvao Santiago', role: 'user', posName: 'Operativo COLON' },
  { username: 'facundo.moyano', password: 'password123', name: 'Moyano Facundo Jose', role: 'user', posName: 'Operativo COLON' },
  { username: 'esteban.oviedo', password: 'password123', name: 'Oviedo Esteban Luciano', role: 'user', posName: 'Operativo COLON' },
  { username: 'claudio.plaza', password: 'password123', name: 'Plaza Claudio Alejandro', role: 'user', posName: 'Operativo COLON' },
  { username: 'dario.toloza', password: 'password123', name: 'Toloza Dario Fernando', role: 'user', posName: 'Operativo COLON' },
  { username: 'luciano.torres', password: 'password123', name: 'Torres Luciano', role: 'user', posName: 'Operativo COLON' },
  { username: 'marcos.cabrera', password: 'password123', name: 'Cabrera Marcos Ariel', role: 'user', posName: 'Operativo RECTA' },
  { username: 'facundo.carballo', password: 'password123', name: 'Carballo Facundo', role: 'user', posName: 'Operativo RECTA' },
  { username: 'facundo.diaz', password: 'password123', name: 'Diaz Facundo Luciano', role: 'user', posName: 'Operativo RECTA' },
  { username: 'nicolas.garofalo', password: 'password123', name: 'Garofalo Nicolas Alejandro', role: 'user', posName: 'Operativo RECTA' },
  { username: 'gustavo.gonzalez', password: 'password123', name: 'Gonzalez Gustavo Marcelo', role: 'user', posName: 'Operativo RECTA' },
  { username: 'luis.otano', password: 'password123', name: 'Otaño Luis', role: 'user', posName: 'Operativo RECTA' },
  { username: 'jonathan.quevedo', password: 'password123', name: 'Quevedo Jonathan Nehuen Ignacio', role: 'user', posName: 'Operativo RECTA' },
  { username: 'angel.quintana', password: 'password123', name: 'Quintana Angel', role: 'user', posName: 'Operativo RECTA' },
  { username: 'luis.suarez', password: 'password123', name: 'Suarez Belune Luis Gabriel', role: 'user', posName: 'Operativo RECTA' },
  { username: 'nestor.vera', password: 'password123', name: 'Vera Nestor Daniel', role: 'user', posName: 'Operativo RECTA' }
];

async function seed() {
  console.log("Iniciando seed en Supabase...");

  // 1. Insertar Puestos
  const { data: posData, error: posError } = await db.from('positions').upsert(positionsData, { onConflict: 'name' }).select();
  if (posError) return console.error("Error seeding positions:", posError);
  console.log("Puestos insertados/actualizados.");

  // Mapeo de nombre a ID para las FK
  const posMap = {};
  posData.forEach(p => posMap[p.name] = p.id);

  // 2. Insertar Usuarios (Sin position_id, se hará via user_positions)
  const usersToInsert = usersDataRaw.map(u => {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(u.password, salt);
    return {
      username: u.username,
      password_hash: hash,
      password_plain: u.password,
      name: u.name,
      role: u.role
    };
  });

  const { data: insertedUsers, error: userError } = await db.from('users').upsert(usersToInsert, { onConflict: 'username' }).select();
  if (userError) return console.error("Error seeding users:", userError);

  // 3. Crear relaciones User <-> Positions
  console.log("Usuarios actualizados. Creando relaciones...");
  const userMap = {};
  insertedUsers.forEach(u => userMap[u.username] = u.id);

  const relations = usersDataRaw
    .filter(u => u.posName)
    .map(u => ({ 
      user_id: userMap[u.username], 
      position_id: posMap[u.posName] 
    }));

  await db.from('user_positions').upsert(relations, { onConflict: 'user_id, position_id' });
  console.log("Relaciones de puestos creadas con éxito.");
}

seed();
