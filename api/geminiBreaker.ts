import { GoogleGenAI } from "@google/genai";

let geminiAccessDenied = false;

// Pre-flight check at startup to detect project permission state without throwing errors
if (process.env.GEMINI_API_KEY) {
  try {
    const testAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    testAi.models.generateContent({ model: "gemini-3.8-flash", contents: "ping" })
      .then(() => {
        // Gemini operates normally
      })
      .catch((err: any) => {
        const errMsg = err?.message || String(err);
        if (
          err?.status === 403 ||
          errMsg.includes("403") ||
          errMsg.includes("PERMISSION_DENIED") ||
          errMsg.includes("denied access")
        ) {
          geminiAccessDenied = true;
          console.log("[AI Router] Permisos de Gemini no activos en el proyecto (403). Redirigiendo automáticamente a Groq y motor heurístico.");
        }
      });
  } catch {
    // Silent catch
  }
}

export function isGeminiAvailable(): boolean {
  if (!process.env.GEMINI_API_KEY) return false;
  return !geminiAccessDenied;
}

export function markGeminiDenied() {
  geminiAccessDenied = true;
}

export function handleGeminiError(err: any, _modelName?: string): { shouldBreak: boolean } {
  const errMsg = err?.message || String(err);
  if (
    err?.status === 403 ||
    errMsg.includes("403") ||
    errMsg.includes("PERMISSION_DENIED") ||
    errMsg.includes("denied access")
  ) {
    if (!geminiAccessDenied) {
      geminiAccessDenied = true;
      console.log("[AI Router] Acceso Gemini no disponible por permisos (403). Conmutando a Groq / proveedor secundario.");
    }
    return { shouldBreak: true };
  }
  return { shouldBreak: false };
}
