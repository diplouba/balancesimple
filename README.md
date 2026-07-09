# BalanceSimple

**Herramienta de análisis de estados financieros para inversores, potenciada con IA generativa.**

Trabajo Final Integrador — Diplomatura en IA Aplicada a Entornos Digitales de Gestión (FCE-UBA, Cohorte 2026)

🔗 **App en vivo:** https://balancesimple.netlify.app/
📄 **Informe completo (PDF):** ver informe adjunto en la entrega / `informe/TP_BalanceSimple.pdf`

---

## ¿Qué hace?

BalanceSimple permite a cualquier inversor —sin formación contable— subir el estado financiero en PDF de una empresa que cotiza en bolsa y obtener, en segundos, un diagnóstico de inversión completo: análisis fundamental, valuación relativa, salud financiera, calidad de resultados, alertas de riesgo y una recomendación concreta de comprar, mantener o vender.

Leer un balance o un estado de resultados requiere formación técnica que la mayoría de los inversores minoristas no tiene. BalanceSimple traduce ese documento complejo en un diagnóstico claro, con indicadores cuantificados y alertas priorizadas, funcionando como un primer nivel de análisis fundamental antes reservado a quienes tienen formación específica o acceso a plataformas pagas.

Funciona con estados financieros de empresas de cualquier mercado bursátil del mundo (NYSE, NASDAQ, LSE, Euronext, TSX, ASX, BYMA, B3, entre otros), bajo US GAAP, IFRS o normativa contable local.

## ¿Cómo se usa?

1. Entrá a la app: https://balancesimple.netlify.app/
2. Arrastrá o seleccioná el PDF del estado financiero (10-K, 20-F, reporte anual, earnings release, idealmente con dos períodos comparables).
3. Opcional: indicá el ticker de la empresa (ej. `AAPL`, `GGAL`) para enriquecer el análisis con precio y capitalización de mercado en tiempo real.
4. Hacé clic en **"Analizar Reporte Financiero"** y esperá unos segundos.
5. Recibís un diagnóstico completo: alertas con semáforo (verde/amarillo/rojo), evolución interanual, calidad de resultados, fortalezas y riesgos, alertas críticas, plan de acción por plazos, y una conclusión de inversión.

No requiere instalación, registro ni costo para el usuario final.

## Resultados generados

Entre 6 y 8 indicadores con semáforo de estado, cubriendo análisis fundamental, salud financiera, calidad de resultados y momentum/valuación; comparación automática entre el período actual y el anterior; alertas críticas cuando se detectan señales de riesgo grave (13 condiciones cuantitativas monitoreadas); un plan de acción para el inversor ordenado por urgencia (Inmediato / 30 días / 90 días / 6 meses); y una conclusión directa de comprar, mantener o vender, con el argumento principal.

## Arquitectura

El proyecto se construyó mediante **Vibe Coding** con Claude.ai: se describió el problema y el resultado esperado en lenguaje natural, y la IA generó el código de la aplicación de forma iterativa.

- **`index.html`** — Frontend estático (HTML/CSS/JS en un solo archivo). Extrae el texto del PDF directamente en el navegador con [PDF.js](https://mozilla.github.io/pdf.js/) (Mozilla), sin subir el archivo original a ningún servidor.
- **`netlify/functions/analyze.js`** — Backend serverless (Netlify Function). Contiene el prompt de sistema con la metodología de análisis financiero, ubica automáticamente la sección del balance dentro del texto extraído (sin importar si aparece cerca del comienzo o del final del documento), gestiona la API key de Google AI Studio de forma segura (nunca expuesta en el navegador), llama directamente al modelo Gemini 2.5 Flash, y consulta opcionalmente la API de [Finnhub](https://finnhub.io/) para enriquecer el análisis con datos de mercado en tiempo real.

```
┌─────────────┐      texto extraído      ┌──────────────────────┐      prompt      ┌──────────────┐
│  index.html │ ───────────────────────▶ │ netlify/functions/    │ ────────────────▶ │ Google AI     │
│  (PDF.js)   │                          │ analyze.js             │                    │ Studio        │
└─────────────┘ ◀─────────────────────── └──────────────────────┘ ◀──────────────── │ (Gemini 2.5   │
                     diagnóstico JSON            │                                    │  Flash)       │
                                                  ▼                                    └──────────────┘
                                         Finnhub (opcional,
                                         datos de mercado)
```

### Modelo de IA utilizado

| Modelo | Proveedor |
|---|---|
| Gemini 2.5 Flash | Google AI Studio (llamada directa a `generateContent`) |

> **Nota sobre una decisión de arquitectura:** la primera versión de este proyecto usaba [OpenRouter](https://openrouter.ai) como enrutador hacia ocho modelos distintos (cuatro gratuitos y cuatro de pago) en su cadena de fallback automático — de los cuales la interfaz solo dejaba elegir 4 (Gemini 2.0 Flash, Llama 3.3 70B, Claude Sonnet 4.5 y GPT-4o); los otros 4 eran respaldos silenciosos que el backend probaba automáticamente si el elegido fallaba, sin mostrarse nunca en pantalla. En producción, esa arquitectura resultó inestable: los IDs de los modelos gratuitos cambian con frecuencia, y la cuota gratuita compartida entre todos los usuarios de OpenRouter generaba errores de "rate-limited upstream" recurrentes. Se simplificó la arquitectura para llamar directamente a Gemini con una API key propia (cuota individual, no compartida), lo que volvió el comportamiento de la app predecible.
>
> **Nota sobre la ubicación del balance dentro del PDF:** el texto extraído del PDF no se envía completo al modelo (documentos de 150-175 páginas pueden superar los 700.000 caracteres). En vez de recortar a un número fijo de caracteres —que funciona para un tipo de documento y falla para otro, según en qué parte del archivo aparezca el balance con cifras reales—, el backend busca frases que solo aparecen en la tabla del balance ("Total assets", "TOTAL DEL ACTIVO", "PATRIMONIO NETO", entre otras) y extrae una ventana de 300.000 caracteres a partir de la primera coincidencia. Esto se validó con dos documentos reales de estructura opuesta: un balance argentino donde el balance aparece al 17% del documento, y un annual report en inglés donde aparece al 80%.
>
> El detalle completo de ambos procesos de depuración está documentado en la sección **Metodología** del informe, subsección "Despliegue y resolución de problemas".

## Herramientas de IA generativa utilizadas

- **Claude.ai (Anthropic)** — Ideación del proyecto, diseño del prompt de sistema, generación del código mediante Vibe Coding, y asistencia iterativa en el despliegue y la depuración de errores en producción.
- **Google AI Studio (Gemini 2.5 Flash)** — Modelo que genera el diagnóstico financiero a partir del prompt de sistema y el texto extraído del PDF.
- **Netlify** — Hosting del frontend y ejecución del backend como función serverless.
- **Finnhub** — Datos de mercado en tiempo real (precio, variación diaria, capitalización) para enriquecer la valuación relativa cuando el usuario indica un ticker.
- **PDF.js (Mozilla)** — Extracción de texto de los PDF directamente en el navegador del usuario.

El detalle completo del proceso, el prompt de sistema y las decisiones de diseño está desarrollado en la sección **Metodología** del informe.

## Deploy propio (opcional)

1. Cloná este repositorio.
2. Desplegalo en [Netlify](https://www.netlify.com/) conectando el repo.
3. Configurá las variables de entorno en Netlify:
   - `GOOGLE_API_KEY` (obligatoria — key gratuita de [Google AI Studio](https://aistudio.google.com/apikey))
   - `FINNHUB_API_KEY` (opcional — sin ella, el análisis funciona igual solo con los datos del PDF)
4. Netlify detecta automáticamente la función en `netlify/functions/analyze.js`.

## Limitaciones conocidas

- La calidad del análisis depende directamente de la calidad del PDF de entrada. Si el documento está escaneado como imagen, mal estructurado o con formato irregular, PDF.js puede extraer el texto de forma incompleta o desordenada, y ese error se traslada al diagnóstico sin que el usuario tenga forma sencilla de detectarlo.
- Al depender de un único proveedor (Google Gemini), la app no tiene un mecanismo de respaldo si el servicio de Google AI Studio sufre una caída o un cambio de API — un trade-off deliberado frente a la inestabilidad que presentaba el enrutamiento entre ocho modelos de la versión anterior, pero que elimina la redundancia entre proveedores.
- El sistema no incorpora ninguna instancia de validación humana en el circuito. El disclaimer advierte sobre el carácter orientativo del análisis, pero el diseño actual no fuerza ni sugiere una revisión por parte de un profesional matriculado antes de que el usuario tome una decisión.
- El enriquecimiento con datos de mercado depende de la cobertura de Finnhub, que es limitada para empresas de mercados emergentes o de menor capitalización bursátil. Esto deja incompleta la sección de valuación relativa justamente en los casos donde el análisis fundamental aportaría más valor, dado que son empresas con menor cobertura de analistas tradicionales.

Un desarrollo más extenso de limitaciones y oportunidades de mejora está disponible en la sección **Análisis crítico** del informe.

## Autores

Exequiel Modarelli · Elisa Loza · Carolina Bacinello

Diplomatura en IA Aplicada a Entornos Digitales de Gestión — FCE-UBA, Cohorte 2026

## Disclaimer

Este análisis es generado por inteligencia artificial y tiene carácter orientativo. No constituye asesoramiento financiero ni recomendación de inversión. Las decisiones de inversión implican riesgos; consultá siempre a un asesor financiero matriculado antes de comprar o vender activos.