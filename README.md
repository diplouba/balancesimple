# BalanceSimple

**Herramienta de análisis de estados financieros para inversores, potenciada con IA generativa.**

Trabajo Final Integrador — Diplomatura en IA Aplicada a Entornos Digitales de Gestión (FCE-UBA, Cohorte 2026)

🔗 **App en vivo:** https://stupendous-jalebi-a78dd2.netlify.app/
📄 **Informe completo (PDF):** ver informe adjunto en la entrega / `informe/TP_BalanceSimple.pdf`

---

## ¿Qué hace?

BalanceSimple permite a cualquier inversor —sin formación contable— subir el estado financiero en PDF de una empresa que cotiza en bolsa y obtener, en segundos, un diagnóstico de inversión completo: análisis fundamental, valuación relativa, salud financiera, calidad de resultados, alertas de riesgo y una recomendación concreta de comprar, mantener o vender.

Leer un balance o un estado de resultados requiere formación técnica que la mayoría de los inversores minoristas no tiene. BalanceSimple traduce ese documento complejo en un diagnóstico claro, con indicadores cuantificados y alertas priorizadas, funcionando como un primer nivel de análisis fundamental antes reservado a quienes tienen formación específica o acceso a plataformas pagas.

Funciona con estados financieros de empresas de cualquier mercado bursátil del mundo (NYSE, NASDAQ, LSE, BCBA, B3, entre otros), bajo US GAAP, IFRS o normativa contable local.

## ¿Cómo se usa?

1. Entrá a la app: https://stupendous-jalebi-a78dd2.netlify.app/
2. Elegí el modelo de IA que va a hacer el análisis (hay opciones gratuitas y pagas).
3. Arrastrá o seleccioná el PDF del estado financiero (10-K, 20-F, reporte anual, earnings release, idealmente con dos períodos comparables).
4. Opcional: indicá el ticker de la empresa (ej. `AAPL`, `GGAL`) para enriquecer el análisis con precio y capitalización de mercado en tiempo real.
5. Hacé clic en **"Analizar Reporte Financiero"** y esperá unos segundos.
6. Recibís un diagnóstico completo: alertas con semáforo (verde/amarillo/rojo), evolución interanual, calidad de resultados, fortalezas y riesgos, alertas críticas, plan de acción por plazos, y una conclusión de inversión.

No requiere instalación, registro ni costo para el usuario final.

## Resultados generados

Entre 6 y 8 indicadores con semáforo de estado, cubriendo análisis fundamental, salud financiera, calidad de resultados y momentum/valuación; comparación automática entre el período actual y el anterior; alertas críticas cuando se detectan señales de riesgo grave (13 condiciones cuantitativas monitoreadas); un plan de acción para el inversor ordenado por urgencia (Inmediato / 30 días / 90 días / 6 meses); y una conclusión directa de comprar, mantener o vender, con el argumento principal.

## Arquitectura

El proyecto se construyó mediante **Vibe Coding** con Claude.ai: se describió el problema y el resultado esperado en lenguaje natural, y la IA generó el código de la aplicación de forma iterativa.

- **`index.html`** — Frontend estático (HTML/CSS/JS en un solo archivo). Extrae el texto del PDF directamente en el navegador con [PDF.js](https://mozilla.github.io/pdf.js/) (Mozilla), sin subir el archivo original a ningún servidor.
- **`netlify/functions/analyze.js`** — Backend serverless (Netlify Function). Contiene el prompt de sistema con la metodología de análisis financiero, gestiona la API key de OpenRouter de forma segura (nunca expuesta en el navegador), y consulta opcionalmente la API de [Finnhub](https://finnhub.io/) para enriquecer el análisis con datos de mercado en tiempo real.

```
┌─────────────┐      texto extraído      ┌──────────────────────┐      prompt + fallback      ┌──────────────┐
│  index.html │ ───────────────────────▶ │ netlify/functions/    │ ───────────────────────────▶ │  OpenRouter   │
│  (PDF.js)   │                          │ analyze.js             │                              │ (4 modelos)   │
└─────────────┘ ◀─────────────────────── └──────────────────────┘ ◀─────────────────────────── └──────────────┘
                     diagnóstico JSON            │
                                                  ▼
                                         Finnhub (opcional,
                                         datos de mercado)
```

### Modelos de IA disponibles (vía OpenRouter)

| Modelo | Tipo |
|---|---|
| Gemini 2.0 Flash | Gratis |
| Llama 3.3 70B | Gratis |
| Claude Sonnet 4.5 | Pago |
| GPT-4o | Pago |

El backend implementa un sistema de **fallback automático**: si el modelo elegido no está disponible, prueba sucesivamente con los siguientes de la lista hasta obtener una respuesta válida.

## Herramientas de IA generativa utilizadas

- **Claude.ai (Anthropic)** — Ideación del proyecto, diseño del prompt de sistema, generación del código mediante Vibe Coding y revisión iterativa de la lógica de análisis.
- **OpenRouter** — Acceso unificado a los cuatro modelos de análisis (Gemini, Llama, Claude, GPT-4o) con fallback automático.
- **Netlify** — Hosting del frontend y ejecución del backend como función serverless.
- **Finnhub** — Datos de mercado en tiempo real (precio, variación diaria, capitalización) para enriquecer la valuación relativa cuando el usuario indica un ticker.
- **PDF.js (Mozilla)** — Extracción de texto de los PDF directamente en el navegador del usuario.

El detalle completo del proceso, el prompt de sistema y las decisiones de diseño está desarrollado en la sección **Metodología** del informe.

## Deploy propio (opcional)

1. Cloná este repositorio.
2. Desplegalo en [Netlify](https://www.netlify.com/) conectando el repo.
3. Configurá las variables de entorno en Netlify:
   - `OPENROUTER_API_KEY` (obligatoria)
   - `FINNHUB_API_KEY` (opcional — sin ella, el análisis funciona igual solo con los datos del PDF)
4. Netlify detecta automáticamente la función en `netlify/functions/analyze.js`.

## Limitaciones conocidas

- El análisis depende de la calidad del PDF de entrada (no funciona con documentos escaneados sin texto seleccionable).
- Puede haber variabilidad entre modelos de IA para un mismo documento.
- No reemplaza la validación de un profesional matriculado — la herramienta lo aclara mediante un disclaimer visible en la interfaz.

Un desarrollo más extenso de limitaciones y oportunidades de mejora está disponible en la sección **Análisis crítico** del informe.

## Autores

Exequiel Modarelli · Elisa Loza · Carolina Bacinello

Diplomatura en IA Aplicada a Entornos Digitales de Gestión — FCE-UBA, Cohorte 2026

## Disclaimer

Este análisis es generado por inteligencia artificial y tiene carácter orientativo. No constituye asesoramiento financiero ni recomendación de inversión. Las decisiones de inversión implican riesgos; consultá siempre a un asesor financiero matriculado antes de comprar o vender activos.
