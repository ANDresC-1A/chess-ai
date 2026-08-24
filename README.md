# ♟️ Chess AI

Plataforma de ajedrez interactiva que permite enfrentar a modelos de inteligencia artificial entre sí o jugar tú mismo contra una IA que, además, te explica en un chat en tiempo real.

## 📋 Descripción

Chess AI es una aplicación web que combina un tablero de ajedrez funcional con integración de modelos de lenguaje (LLMs), usando **LangChain** para orquestar las consultas a distintos proveedores de IA. El proyecto ofrece dos modos de juego:

- **🤖 IA vs IA**: selecciona dos modelos de inteligencia artificial y obsérvalos enfrentarse entre sí en una partida de ajedrez.
- **💬 Chatbot vs Jugador**: juega contra la IA que elijas, mientras esta te explica sus jugadas y estrategia a través de un chat integrado.

## ✨ Funcionalidades

- ♟️ Tablero de ajedrez funcional e interactivo (movimientos, reglas y validaciones)
- 🤖 **Modo IA vs IA**: selección de dos modelos de IA para que se enfrenten entre sí
- 💬 **Modo Chatbot**: juega contra una IA seleccionable que explica sus movimientos en un chat
- 🔌 Soporte para múltiples proveedores de IA mediante **LangChain** (modelos vía API key)
- 🖥️ Soporte para modelos **locales** mediante **Ollama**, sin depender de servicios externos
- 🔄 Comunicación en tiempo real entre el tablero (frontend) y la lógica de IA (backend)

## 🛠️ Tecnologías utilizadas

**Backend:**
- Node.js
- LangChain (orquestación de modelos de IA)
- Ollama (modelos de IA locales)
- Integración con APIs de proveedores de IA externos

**Frontend:**
- HTML, CSS y JavaScript
- [chess.js](https://github.com/jhlywa/chess.js) — lógica y reglas del ajedrez
- [chessboard.js](https://chessboardjs.com/) — renderizado visual del tablero interactivo

## 🚀 Instalación y ejecución local

### Requisitos previos
- [Node.js](https://nodejs.org/) instalado
- (Opcional) [Ollama](https://ollama.com/) instalado si deseas usar modelos locales
- API keys de los proveedores de IA que quieras usar

### Pasos

```bash
# Clonar el repositorio
git clone https://github.com/Adrian-Ariza/chess-ai.git
cd chess-ai

# Instalar dependencias
npm install

# Configurar variables de entorno
# Crea un archivo .env con tus API keys (ver sección Configuración)

# Ejecutar el servidor
npm start
```

La aplicación quedará disponible en `http://localhost:{puerto}` (verifica el puerto configurado en el proyecto).

## ⚙️ Configuración

Este proyecto requiere API keys para consultar modelos de IA externos. Crea un archivo `.env` en la raíz del proyecto (no incluido en el repositorio por seguridad):

```
OPENAI_API_KEY=tu-api-key-aqui
# Agrega aquí las demás API keys de los proveedores que uses
```

Si prefieres usar modelos locales, asegúrate de tener **Ollama** corriendo y el modelo descargado previamente:

```bash
ollama pull nombre-del-modelo
```

## 🎮 Modos de juego

### IA vs IA
1. Selecciona el modo "IA vs IA"
2. Elige el modelo de IA para las piezas blancas y para las piezas negras
3. Observa la partida desarrollarse automáticamente

### Chatbot (Jugador vs IA)
1. Selecciona el modo "Chatbot"
2. Elige contra qué IA quieres jugar
3. Realiza tus movimientos en el tablero
4. La IA responde con su movimiento

## 📌 Estado del proyecto

✅ Completo y funcional.

## 📝 Nota

Este proyecto fue desarrollado con apoyo de herramientas de inteligencia artificial como asistencia durante el desarrollo.

## 👤 Autor
Desarrollado por Adrian Ariza Tapia como parte de mi formación en Ingeniería de Sistemas.
- LinkedIn: https://www.linkedin.com/in/adrian-ariza-tapia/
- GitHub: [@Adrian-Ariza](https://github.com/Adrian-Ariza)
