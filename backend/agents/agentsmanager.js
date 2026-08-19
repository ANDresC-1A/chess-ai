import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatCohere } from "@langchain/cohere";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOllama } from "@langchain/ollama";

function createKeyRouter(prefix) {
  const keys = [
    process.env[`${prefix}_1`],
    process.env[`${prefix}_2`],
    process.env[`${prefix}_3`]
  ].filter(Boolean); 

  let currentIndex = 0;
  return {
    getNextKey: () => {
      if (keys.length === 0) return null;
      const key = keys[currentIndex];
      currentIndex = (currentIndex + 1) % keys.length;
      return key;
    }
  };
}

const cohereRouter = createKeyRouter("COHERE_API_KEY");
const mistralRouter = createKeyRouter("MISTRAL_API_KEY");
const geminiRouter = createKeyRouter("GEMINI_API_KEY");
const groqRouter = createKeyRouter("GROQ_API_KEY");

const PROVIDERS = {
  cohere: {
    envKey: "COHERE_API_KEY_1",
    createModel: (temperature) => new ChatCohere({
      model: "command-r-08-2024",
      temperature: temperature,
      apiKey: cohereRouter.getNextKey(),
    })
  },
  mistral: {
    envKey: "MISTRAL_API_KEY_1",
    createModel: (temperature) => new ChatMistralAI({
      model: "mistral-large-latest",
      temperature: temperature,
      apiKey: mistralRouter.getNextKey(),
    })
  },
  gemini: {
    envKey: "GEMINI_API_KEY_1",
    createModel: (temperature) => new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      temperature: temperature,
      apiKey: geminiRouter.getNextKey(),
    })
  },
  groq: {
    envKey: "GROQ_API_KEY_1",
    createModel: (temperature) => new ChatGroq({
      model: "llama-3.1-8b-instant",
      temperature: temperature,
      apiKey: groqRouter.getNextKey(),
    })
  },
  ollama: {
    envKey: "HOME",
    createModel: (temperature, modelName = "llama3:8b") => {
      console.log(`[Ollama] Instanciando modelo local: ${modelName}`);
      return new ChatOllama({
        baseUrl: "http://localhost:11434",
        model: modelName,
        temperature: temperature,
      });
    }
  }
};
export async function getLocalOllamaModels() {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) throw new Error("No se pudo conectar con Ollama");
    
    const data = await response.json();
    return data.models.map(m => m.name);
  } catch (error) {
    console.warn("[Ollama] Servidor local no detectado o apagado:", error.message);
    return []; 
  }
}
const chessPromptTemplate = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Eres un Gran Maestro de ajedrez implacable y ofensivo. Tu objetivo no es ganar piezas, es DAR JAQUE MATE al Rey rival.\n\n" +
    
    "JERARQUÍA DE DECISIÓN (Prioridad absoluta):\n" +
    "1. SEGURIDAD PROPIA: Mantén tu Rey a salvo. Si estás en jaque, debes salir de él inmediatamente con la jugada más segura.\n" +
    "2. ATAQUE AL REY RIVAL: Prioriza movimientos que amenacen Jaque, restrinjan la movilidad del Rey enemigo o inicien un ataque contra la posición de su Rey (enroque, columnas abiertas).\n" +
    "3. MATERIAL: Solo captura material si esto debilita la defensa del Rey rival o si es una captura gratuita sin riesgo.\n\n" +
    
    "REGLA DE FORMATO: Responde ÚNICAMENTE con el string del movimiento en formato UCI (ej: e2e4, g1f3). " +
    "No saludes, no expliques, no uses Markdown. Solo el string puro de 4 caracteres."
  ],
  [
    "user",
    "Posición FEN actual: {fen}\n\n" +
    "Movimientos legales disponibles: {legalMoves}. Elige el que mejor presione al Rey rival o mejore tu posición de ataque."
  ]
]);


export async function getAIMove(engine, fen, legalMoves, temperature) {
  const engineLower = engine.toLowerCase();

  try {
    let provider;
    let model;

    // Enrutador Inteligente para Ollama o APIs en la nube
    if (engineLower.startsWith("ollama:")) {
      const modelTag = engine.substring(engine.indexOf(":") + 1) || "llama3:8b";
      provider = PROVIDERS.ollama;
      if (!provider) throw new Error("El proveedor 'ollama' no está registrado.");
      model = provider.createModel(temperature, modelTag);
    } else {
      provider = PROVIDERS[engineLower];
      if (!provider) {
        throw new Error(`El motor de IA '${engine}' no está registrado en la arquitectura de proveedores.`);
      }
      if (!process.env[provider.envKey]) {
        throw new Error(`Falta la variable de entorno obligatoria: ${provider.envKey}`);
      }
      model = provider.createModel(temperature);
    }

    const chain = chessPromptTemplate.pipe(model);
    console.log(`[LangChain Arena] Invocando proveedor: ${engine.toUpperCase()} | Temp: ${temperature}`);

    const response = await chain.invoke({
      fen: fen,
      legalMoves: legalMoves.join(", ")
    });

    // Extracción segura del texto de respuesta
    let contentStr = "";
    if (response) {
      if (typeof response === 'string') {
        contentStr = response;
      } else if (response.content) {
        contentStr = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      }
    }

    // Limpieza estricta de formato UCI
    let rawMove = contentStr.trim().toLowerCase().replace(/[^a-h1-8q]/g, '');
    console.log(`[LangChain Arena] Respuesta de ${engine.toUpperCase()}: "${rawMove}"`);

    // Escaneo alternativo si metió texto adicional
    if (!rawMove || !legalMoves.includes(rawMove)) {
      const textTarget = contentStr.toLowerCase();
      const foundMove = legalMoves.find(m => textTarget.includes(m));
      if (foundMove) rawMove = foundMove;
    }

    if (rawMove && legalMoves.includes(rawMove)) return rawMove;
    throw new Error(`No se obtuvo un movimiento legal coincidente. Recibido crudo: "${contentStr.substring(0,20)}"`);

  } catch (error) {
    console.error(`[Manejador de Emergencia] Falló ${engine.toUpperCase()}:`, error.message);
    return String(legalMoves[0]); // Garantiza un String primitivo para evitar errores de .slice()
  }
}

// ─── Prompt para el chatbot experto ───
const expertPromptTemplate = ChatPromptTemplate.fromMessages([
  [
    "system",
    "Eres un entrenador de ajedrez experto y didáctico, de nivel Gran Maestro. " +
    "Tu tarea es analizar la posición actual en formato FEN y recomendar la mejor jugada al jugador humano. " +
    "Responde ÚNICAMENTE en formato JSON válido, sin markdown, sin backticks, con esta estructura exacta: " +
    '{{"move": "e2e4", "explanation": "Explicación breve y clara en español de por qué esta jugada es buena"}}. ' +
    "El campo 'move' debe ser EXACTAMENTE uno de los movimientos legales proporcionados, en formato UCI (4 o 5 caracteres). " +
    "La explicación debe ser concisa (máximo 3 frases), en español, y entendible para un jugador intermedio."
  ],
  [
    "user",
    "Posición FEN actual: {fen}\n\n" +
    "Movimientos legales disponibles: {legalMoves}\n\n" +
    "Recomienda la mejor jugada y explica por qué."
  ]
]);

// ─── Función: obtener recomendación + explicación del experto ───
export async function getExpertAdvice(engine, fen, legalMoves) {
  const engineLower = engine.toLowerCase();

  try {
    let provider;
    let model;

    // Enrutador Inteligente para Ollama o APIs en la nube (Modo Experto)
    if (engineLower.startsWith("ollama:")) {
      const modelTag = engine.substring(engine.indexOf(":") + 1) || "llama3:8b";
      provider = PROVIDERS.ollama;
      if (!provider) throw new Error("El proveedor 'ollama' no está registrado.");
      model = provider.createModel(0.2, modelTag);
    } else {
      provider = PROVIDERS[engineLower];
      if (!provider) {
        throw new Error(`El motor de IA '${engine}' no está registrado en la arquitectura de proveedores.`);
      }
      if (!process.env[provider.envKey]) {
        throw new Error(`Falta la variable de entorno obligatoria: ${provider.envKey}`);
      }
      model = provider.createModel(0.2);
    }

    const chain = expertPromptTemplate.pipe(model);
    console.log(`[Experto] Consultando a ${engine.toUpperCase()} para sugerencia...`);

    const response = await chain.invoke({
      fen: fen,
      legalMoves: legalMoves.join(", ")
    });

    let contentStr = "";
    if (response) {
      if (typeof response === 'string') {
        contentStr = response;
      } else if (response.content) {
        contentStr = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      }
    }

    const rawContent = contentStr.trim().replace(/```json/gi, '').replace(/```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr) {
      throw new Error(`Respuesta del experto no es JSON válido: "${rawContent.substring(0, 40)}"`);
    }

    const { move, explanation } = parsed;
    const normalizedMove = move?.trim().toLowerCase();

    if (!legalMoves.includes(normalizedMove)) {
      throw new Error(`El experto sugirió un movimiento ilegal: "${normalizedMove}"`);
    }

    console.log(`[Experto] ${engine.toUpperCase()} sugiere: ${normalizedMove}`);

    return {
      success: true,
      move: normalizedMove,
      explanation: explanation || 'Sin explicación disponible.'
    };

  } catch (error) {
    console.error(`[Experto] Error con ${engine.toUpperCase()}:`, error.message);
    return {
      success: false,
      move: String(legalMoves[0]),
      explanation: 'No se pudo obtener una recomendación del experto en este momento. Aquí tienes un movimiento legal disponible.'
    };
  }
}