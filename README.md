# Portal Interno de Tableros Power BI

Esta aplicación permite a los usuarios iniciar sesión y visualizar un tablero de Power BI asignado de forma segura a través de un iframe, ocultando el enlace directo.

## Requisitos
- Node.js (v18+ recomendado)
- npm

## Estructura del Proyecto
- \`backend/\`: Servidor Node.js + Express + SQLite
- \`frontend/\`: Aplicación web React + Vite + Tailwind CSS

## Instrucciones de Instalación y Ejecución

### 1. Backend
Abre una terminal y navega a la carpeta \`backend\`:
\`\`\`bash
cd backend
npm install
\`\`\`

**Generar base de datos de prueba:**
Para cargar los usuarios (Directorio, Administración, etc.) y la tabla de logs:
\`\`\`bash
npm run seed
\`\`\`

**Iniciar el servidor:**
\`\`\`bash
npm start
\`\`\`
El servidor correrá en \`http://localhost:5000\`.

### 2. Frontend
Abre otra terminal y navega a la carpeta \`frontend\`:
\`\`\`bash
cd frontend
npm install
\`\`\`

**Iniciar la aplicación en modo desarrollo:**
\`\`\`bash
npm run dev
\`\`\`
La aplicación web estará disponible en \`http://localhost:3000\`.

## Usuarios de Prueba (Base de datos Local)
La contraseña para todos los usuarios regulares es: \`password123\`
- \`directorio\`
- \`administracion\`
- \`encargada_ecommerce\`
- \`encargado_colon\`
- \`encargado_recta\`
- \`asesores_ecommerce\`
- \`equipo_colon\`
- \`equipo_recta\`

**Administrador Global:**
- Usuario: \`admin\`
- Contraseña: \`adminpassword\`
(El administrador puede inspeccionar la API de logs en \`http://localhost:5000/api/logs\`).
