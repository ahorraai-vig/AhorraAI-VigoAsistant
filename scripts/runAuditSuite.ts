import { vigoAgentPlanner } from '../api/services/brain/VigoAgentPlanner';
import { vigoTimeResolver } from '../api/services/brain/VigoTimeResolver';
import { vigoToolExecutor } from '../api/services/brain/VigoToolExecutor';
import { ahorraAIBusinessService } from '../api/services/brain/AhorraAIBusinessService';

const testCases = [
  { id: 1, query: "Hola, que tal. Que puedo hacer mañana en Vigo mi novia y yo?" },
  { id: 2, query: "Hay sitio para aparcar en el centro ahora mismo?" },
  { id: 3, query: "Cómo está el tráfico en Gran Vía y Praza de España?" },
  { id: 4, query: "Recomiéndame 3 sitios para cenar marisco hoy en Bouzas" },
  { id: 5, query: "Qué eventos culturales hay este fin de semana en Vigo?" },
  { id: 6, query: "Qué comercios tienen ofertas o bonos cruzados con otros locales?" },
  { id: 7, query: "Cuál es la historia de la Batalla de Rande y por qué es famosa en Vigo?" },
  { id: 8, query: "Dónde puedo comprar ropa o regalos en la calle Príncipe?" },
  { id: 9, query: "Cómo voy en autobús de Samil al Casco Vello?" },
  { id: 10, query: "Qué tiempo va a hacer mañana y qué plan me recomiendas?" }
];

async function runAuditSuite() {
  console.log("============================================================");
  console.log("AUDITORÍA DE EJECUCIÓN REAL DEL CEREBRO DE AHORRAAI V4");
  console.log("============================================================\n");

  const results = [];

  for (const tc of testCases) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`>>> TEST CASE ${tc.id}: "${tc.query}"`);
    console.log(`------------------------------------------------------------`);
    const startTime = Date.now();
    const plan = vigoAgentPlanner.analyzeIntent(tc.query);
    const messages = [{ role: 'user', content: tc.query }];
    
    const result = await vigoAgentPlanner.executePlan(plan, messages);
    const duration = Date.now() - startTime;

    console.log(`[1] Intenciones detectadas: [${plan.detectedIntents.join(', ')}]`);
    console.log(`[2] Contexto Temporal: "${plan.targetDateDescription || 'General'}" | Ámbito: ${plan.temporalScope || 'general'} | Fechas: [${plan.targetDates?.join(', ') || ''}]`);
    console.log(`[3] Zona de Vigo detectada: ${plan.zone || 'Ninguna (Global Vigo)'}`);
    console.log(`[4] Fuente de datos prioritaria: ${plan.prioritySource}`);
    console.log(`[5] Tools planificadas (${plan.actions.length}): ${plan.actions.map(a => a.toolName).join(', ')}`);
    console.log(`[6] Tools ejecutadas realmente (${result.debugTrace.toolsExecuted.length}):`);
    for (const t of result.debugTrace.toolsExecuted) {
      console.log(`    * ${t.toolName} -> Estado: ${t.status} | Hechos: ${t.factsCount} | Fuente: ${t.sourceType} | Duración: ${t.executionTimeMs}ms`);
    }
    console.log(`[7] Total hechos contrastados: ${result.rawFacts.length}`);
    console.log(`[8] Fuentes consumidas: [${result.sourcesUsed.join(', ')}]`);
    console.log(`[9] Tiempo total de ejecución del cerebro: ${duration}ms`);

    results.push({
      id: tc.id,
      query: tc.query,
      plan,
      debugTrace: result.debugTrace,
      factsCount: result.rawFacts.length,
      sourcesUsed: result.sourcesUsed,
      durationMs: duration
    });
  }

  console.log("\n============================================================");
  console.log("RESUMEN GENERAL DE LA AUDITORÍA DE EJECUCIÓN");
  console.log(`Total pruebas ejecutadas: ${results.length}/10`);
  console.log(`Promedio de hechos por consulta: ${(results.reduce((acc, r) => acc + r.factsCount, 0) / results.length).toFixed(1)}`);
  console.log(`Promedio de tiempo de respuesta: ${(results.reduce((acc, r) => acc + r.durationMs, 0) / results.length).toFixed(1)}ms`);
  console.log("============================================================\n");
}

runAuditSuite().catch(console.error);
