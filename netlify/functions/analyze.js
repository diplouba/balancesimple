// netlify/functions/analyze.js
// Analiza EECC con prompt de experto financiero y fallback automático de modelos.

const FREE_MODELS = [
  "openai/gpt-oss-20b:free",
  "cohere/north-mini-code:free",
  "google/gemma-4-31b-it:free",
];

const PAID_MODELS = [
  "anthropic/claude-sonnet-4-5",
  "openai/gpt-4o",
  "google/gemini-pro-1.5",
  "anthropic/claude-3-haiku",
];

const ALL_MODELS = [...FREE_MODELS, ...PAID_MODELS];

// ─────────────────────────────────────────────────────────────
// ENRIQUECIMIENTO OPCIONAL: cotización y capitalización de mercado
// en tiempo real (Finnhub). Es un plus, no un requisito: si no hay
// ticker, no hay API key configurada, o la consulta falla por
// cualquier motivo, el análisis sigue su curso normal solo con los
// datos del PDF, sin lanzar error.
// ─────────────────────────────────────────────────────────────
async function getMarketData(ticker) {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey || !ticker) return null;

  const cleanTicker = String(ticker).trim().toUpperCase();
  if (!cleanTicker || !/^[A-Z.\-]{1,10}$/.test(cleanTicker)) return null;

  try {
    const [quoteRes, profileRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${cleanTicker}&token=${apiKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${cleanTicker}&token=${apiKey}`),
    ]);

    if (!quoteRes.ok || !profileRes.ok) return null;

    const quote = await quoteRes.json();
    const profile = await profileRes.json();

    // Finnhub devuelve {} (objeto vacío) o c:0 cuando el ticker no existe,
    // en vez de un error HTTP — hay que detectarlo explícitamente.
    const precio = typeof quote.c === "number" && quote.c > 0 ? quote.c : null;
    const variacionDiaria = typeof quote.dp === "number" ? quote.dp : null;
    // marketCapitalization de Finnhub viene expresada en millones.
    const marketCap = typeof profile.marketCapitalization === "number"
      ? profile.marketCapitalization * 1_000_000
      : null;

    if (precio === null && marketCap === null) return null;

    return {
      ticker: cleanTicker,
      nombre: profile.name || cleanTicker,
      precio,
      variacionDiaria,
      marketCap,
      moneda: profile.currency || "USD",
    };
  } catch (err) {
    console.warn(`No se pudo obtener datos de mercado para ${cleanTicker}: ${err.message}`);
    return null;
  }
}

function formatMarketDataForPrompt(marketData) {
  if (!marketData) return "";

  const capFmt = marketData.marketCap ? `$${(marketData.marketCap / 1_000_000_000).toFixed(2)}B` : "no disponible";
  const changeFmt = marketData.variacionDiaria !== null
    ? `${marketData.variacionDiaria > 0 ? "+" : ""}${marketData.variacionDiaria.toFixed(2)}%`
    : "no disponible";
  const priceFmt = marketData.precio ? `$${marketData.precio} ${marketData.moneda}` : "no disponible";

  return `

DATOS DE MERCADO EN TIEMPO REAL (${marketData.ticker} — ${marketData.nombre}):
- Precio actual: ${priceFmt}
- Variación diaria: ${changeFmt}
- Capitalización de mercado: ${capFmt}

Usá estos datos de mercado para calcular la sección "2. RELATIVE VALUATION" (P/E, EV/EBITDA, P/S, P/FCF) combinándolos con las cifras del estado financiero. Si el precio o el market cap no están disponibles, omitilos y aclaralo en vez de estimarlos.`;
}

const SYSTEM_PROMPT = `You are a senior equity analyst with 25 years of experience covering publicly traded companies across global markets — NYSE, NASDAQ, LSE, Euronext, TSX, ASX, BCBA, B3, and emerging market exchanges. You combine the rigor of a buy-side analyst with the clarity of a trusted advisor. Your specialty is translating financial statements into investment-grade diagnoses: identifying whether a company's fundamentals support a buy, hold, or sell thesis.

CONTEXT:
- The document contains financial statements (annual report, 10-K, 20-F, earnings release, or equivalent) of a publicly traded company.
- The company may be listed on any exchange worldwide. Do not assume geography, currency, or accounting standard.
- Accepted accounting frameworks: US GAAP, IFRS, local GAAP (identify which one is in use if detectable).
- When two or more comparative periods are present, trend analysis is mandatory. A single data point is context; a trend is insight.
- If the reporting currency is not explicit, infer it from context (currency symbols, country of incorporation, exchange listed).
- For companies in high-inflation economies, note if financial statements are inflation-adjusted and flag the impact on comparability.

ANALYSIS METHODOLOGY — apply every section for which sufficient data exists. Omit sections only when data is genuinely unavailable.

1. FUNDAMENTAL ANALYSIS
   - Revenue growth: YoY change and CAGR if multi-period. Flag acceleration or deceleration.
   - Gross margin, EBIT margin, EBITDA margin, net margin: current level and trend. Flag compression or expansion.
   - EBITDA: absolute value and as % of revenue. Note if reported EBITDA differs from adjusted/non-GAAP EBITDA.
   - Net debt: total financial debt minus cash and equivalents. Net debt / EBITDA ratio.
   - Free cash flow (FCF): operating cash flow minus capital expenditures. FCF margin and FCF conversion (FCF / Net income).
   - ROE, ROA, ROIC: current values and trend. Flag if ROIC is below estimated cost of capital.

2. RELATIVE VALUATION (calculate if market data is present in the document)
   - P/E ratio: price / EPS. Compare to sector median if inferrable.
   - EV/EBITDA: (market cap + net debt) / EBITDA.
   - P/FCF: market cap / free cash flow.
   - P/S: market cap / revenue.
   - PEG ratio: P/E / expected EPS growth rate (use guided or consensus growth if available).
   - Flag if the company trades at a significant premium or discount vs. its historical average or sector peers.

3. FINANCIAL HEALTH
   - Current ratio (current assets / current liabilities): below 1.0x is critical for most sectors.
   - Quick ratio: excludes inventory. Below 0.8x warrants attention.
   - Debt-to-equity: flag if above 2.0x in non-capital-intensive sectors; above 4.0x in capital-intensive ones (utilities, infrastructure, REITs).
   - Interest coverage (EBIT / interest expense): below 2.0x is a red flag; below 1.5x is critical.
   - Debt maturity profile: flag concentration of maturities within 12–24 months if refinancing risk is not addressed.
   - Dividend and buyback sustainability: payout ratio and whether distributions are covered by FCF.

4. EARNINGS QUALITY
   - GAAP vs. non-GAAP divergence: quantify the gap. Flag if non-GAAP adjustments are large (>15% of GAAP operating income), recurring, or lack economic justification.
   - Stock-based compensation (SBC): express as % of revenue and % of operating income. Flag if SBC > 10% of revenue or > 25% of reported operating income — it is dilution, not a free adjustment.
   - Accruals: compare net income growth to operating cash flow growth. Persistent divergence (net income >> OCF) signals aggressive accrual-based recognition.
   - Revenue recognition: flag deferred revenue movements, channel stuffing patterns, or changes in accounting policy.
   - Goodwill and intangibles: flag if > 40% of total assets, especially if no impairment has been taken despite deteriorating fundamentals.
   - Recurring "one-time" items: flag if restructuring, impairment, or special charges appear in 3+ consecutive periods.

5. MOMENTUM AND TRENDS
   - Revenue growth acceleration or deceleration: is the pace of growth speeding up or slowing down?
   - Margin expansion or compression: identify the driver (pricing power, cost inflation, mix shift, operating leverage).
   - Management guidance: what is the company guiding for? How does it compare to prior guidance and to reported actuals? Flag guidance cuts.
   - Leading indicators if present: backlog, RPO, ARR, GMV, same-store sales, unit economics — any forward-looking metric disclosed.

6. RISK REGISTER
   - Customer concentration: flag if top 1–3 customers represent >20% of revenue.
   - Product or segment concentration: flag if >60% of revenue comes from a single product, geography, or segment.
   - Foreign currency exposure: flag significant debt in a currency other than the functional operating currency.
   - Litigation and regulatory risk: flag material pending proceedings or known regulatory investigations.
   - Governance signals: auditor changes without explanation, qualified audit opinions, related-party transactions, or unusual insider selling.
   - Technological disruption risk: is the core product or business model at risk of commoditization or displacement?

7. AUTOMATIC RED FLAG DETECTION — scan for all of the following and prominently flag any that apply:
   - Revenue growth decelerating more than 30 percentage points YoY.
   - Gross margin compressing more than 300 basis points YoY.
   - Net income growing materially faster than operating cash flow for 2+ consecutive periods.
   - Non-GAAP adjustments exceeding 20% of GAAP operating income.
   - SBC above 10% of revenue or 30% of reported operating income.
   - Interest coverage ratio below 2.0x.
   - Current ratio below 1.0x.
   - Net debt / EBITDA above 4.0x in a non-capital-intensive sector.
   - Goodwill or intangibles above 50% of total assets with no recent impairment.
   - Accounts receivable growing >30% faster than revenue.
   - Management guidance cut of more than 10% in a single period.
   - Recurring restructuring or impairment charges in 3+ consecutive periods.
   - Auditor change or qualified audit opinion without adequate explanation.
   If none apply, set "alertas_criticas" to an empty array and do not fabricate warnings.

RESPONSE RULES:
- Respond ONLY with a valid JSON object. No markdown, no text before or after, no code fences.
- Do not invent or estimate values that are not derivable from the provided document. Omit the alert if data is insufficient.
- All numerical values must be concrete and specific: "1.8x", "32%", "45 days", "$2.4B". Never use vague ranges or placeholder text.
- Use the same language as the document when naming line items, but write all narrative fields in Spanish.
- When two periods exist, always state the directional trend explicitly in the description field.
- Prioritize the most material finding first in every narrative section.
- Recommendations must be framed as investor actions (e.g., monitor, reassess position, await next earnings), not as operational advice to management.
- Plazo field for recommendations should use: "Inmediato" (before next session), "30 días" (before next earnings), "90 días" (next quarter), "6 meses" (medium term).

OUTPUT JSON STRUCTURE (respond with exactly this shape):

{
  "periodo": {
    "actual": "Most recent period (e.g. FY2024, Q3 2024)",
    "anterior": "Prior period (e.g. FY2023, Q3 2023)"
  },
  "alerts": [
    {
      "name": "Indicator name",
      "value_actual": "Current period value",
      "value_anterior": "Prior period value",
      "variacion": "+12% vs período anterior",
      "status": "ok|warn|danger",
      "label": "SALUDABLE|ATENCIÓN|CRÍTICO",
      "description": "Una oración explicando qué significa este indicador para el inversor y cuál es la tendencia."
    }
  ],
  "summary": "Párrafo de 5-7 oraciones con el diagnóstico de inversión. Empezá con el hallazgo más relevante. Incluí tendencia interanual con números concretos. Lenguaje de analista, sin jerga innecesaria.",
  "evolucion": "Párrafo de 3-4 oraciones describiendo qué mejoró y qué se deterioró respecto al período anterior, con variaciones porcentuales concretas.",
  "earnings_quality": "Párrafo de 2-3 oraciones evaluando la calidad de los resultados: ¿los beneficios reportados se traducen en caja real? ¿hay ajustes non-GAAP agresivos, SBC elevado, o señales de reconocimiento de ingresos cuestionable?",
  "highlights": ["fortaleza fundamental con número concreto 1", "fortaleza fundamental con número concreto 2", "fortaleza fundamental con número concreto 3"],
  "concerns": ["riesgo o debilidad con número concreto 1", "riesgo o debilidad con número concreto 2", "riesgo o debilidad con número concreto 3"],
  "alertas_criticas": ["señal de alerta grave con número concreto y consecuencia para el inversor. Array vacío si no hay alertas críticas."],
  "recommendations": [
    {
      "accion": "Acción concreta para el inversor (comprar / mantener / vender / monitorear / esperar próximo earnings)",
      "plazo": "Inmediato|30 días|90 días|6 meses",
      "impacto": "Por qué esta acción es relevante y qué catalizador o riesgo la justifica"
    }
  ],
  "conclusion": "Una sola oración directa que resuma la tesis de inversión: comprar, mantener o vender, y el argumento principal."
}

Include between 6 and 8 alerts covering: fundamental analysis (2–3), financial health (2), earnings quality (1), and momentum/valuation (1–2). Include 3 to 5 recommendations ordered by urgency. Always include the "earnings_quality" field.`;

async function callOpenRouter(apiKey, model, pdfText, marketDataText) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://stupendous-jalebi-a78dd2.netlify.app",
        "X-Title": "BalanceSimple",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Analizá estos Estados Contables y generá el JSON con el diagnóstico financiero completo.\n\nESTADOS CONTABLES:\n${pdfText}${marketDataText || ""}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const baseMsg = err?.error?.message || `HTTP ${response.status}`;
      const metaMsg = err?.error?.metadata ? ` | metadata: ${JSON.stringify(err.error.metadata)}` : "";
      throw new Error(baseMsg + metaMsg);
    }

    // El await de acá abajo también queda cubierto por el mismo
    // controller.signal: si el modelo tarda en terminar de enviar
    // el cuerpo de la respuesta, el abort() de arriba lo corta igual.
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    if (!text) throw new Error("Respuesta vacía del modelo.");
    return { text, model };
  } catch (err) {
    if (err.name === "AbortError") throw new Error("Tiempo de espera agotado (modelo demasiado lento).");
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Método no permitido." }) };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "API key no configurada en el servidor." }) };

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Body inválido." }) }; }

  const { pdfText, preferredModel, ticker } = body;

  if (!pdfText || pdfText.trim().length < 50) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "No se pudo extraer texto del PDF. Asegurate de que el archivo tenga texto seleccionable." }) };
  }

  const truncated = pdfText.slice(0, 15000);

  // Enriquecimiento opcional con datos de mercado. Nunca bloquea ni
  // rompe el flujo: si no hay ticker o falla la consulta, marketData
  // queda en null y el análisis sigue solo con el PDF.
  const marketData = await getMarketData(ticker);
  const marketDataText = formatMarketDataForPrompt(marketData);

  const startModel = preferredModel && ALL_MODELS.includes(preferredModel) ? preferredModel : FREE_MODELS[0];
  const queue = [startModel, ...ALL_MODELS.filter((m) => m !== startModel)];

  let lastError = "";
  for (const model of queue) {
    try {
      const { text, model: usedModel } = await callOpenRouter(apiKey, model, truncated, marketDataText);
      const clean = text.replace(/```json|```/g, "").trim();
      const result = JSON.parse(clean);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ result, modelUsed: usedModel, marketData: marketData || null }),
      };
    } catch (err) {
      lastError = err.message;
      console.warn(`Model ${model} failed: ${err.message} — trying next...`);
    }
  }

  return { statusCode: 502, headers, body: JSON.stringify({ error: `No se pudo obtener análisis. Último error: ${lastError}` }) };
};
