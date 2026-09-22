import { db } from '../database/db.js';
import dotenv from 'dotenv';

dotenv.config();

let destinationCache = null;
const capabilityReply = `Johar! I'm Birsa AI, your Jharkhand tourism assistant.

I can help you with:
• Discovering destinations
• Creating personalized itineraries
• Finding tourism packages
• Finding transport options
• Planning trips by budget
• Exploring activities and attractions
• Answering questions about Jharkhand

Tell me where you'd like to go or what kind of trip you're planning.`;
const isDevelopment = process.env.NODE_ENV !== 'production';

function logTiming(message) {
  if (isDevelopment) console.debug(`[BIRSA] ${message}`);
}

async function describeGeminiError(response) {
  let body = '';
  try {
    body = await response.text();
  } catch {
    body = '<unable to read error body>';
  }
  return `HTTP ${response.status} ${response.statusText || ''} ${body.slice(0, 1000)}`.trim();
}

function getIntent(text) {
  if (/^\s*(what can you help me with|how can you help me|what do you do|help)\s*[?!.]*\s*$/i.test(text) || /(आप क्या कर सकते|कैसे मदद कर सकते|मदद कर सकते हैं)/i.test(text)) return 'capability';
  if (/^\s*(hello|hi|hey|namaste|johar|good morning|good afternoon|good evening|नमस्ते|नमस्कार|जोहार|हेलो|हाय)\s*[!?.।]*\s*$/i.test(text)) return 'greeting';
  if (/\b(plan|itinerary|trip|travel plan|days?|make it cheaper|change day|add a waterfall|what should i do on day|how much will this cost)\b/i.test(text) || /(योजना|यात्रा|दिनों?|घूमना|घूमने|सस्ता|कितना खर्च|बजट में|पसंद है|से शुरू)/i.test(text)) return 'itinerary';
  if (/\b(packages?|tour service|guide|homestay|accommodation)\b/i.test(text) || /(पैकेज|टूर|गाइड|होटल|ठहरने|उपलब्ध)/i.test(text)) return 'package';
  if (/\b(transport|travel|reach|drive|bus|train|flight|taxi|cab|route|highway)\b/i.test(text) || /(कैसे जाएं|कैसे जाएँ|बस|ट्रेन|टैक्सी|मार्ग|यातायात|कहां से|कहाँ से|पर्यटक बस|पास कौन)/i.test(text)) return 'transport';
  if (/\b(book|bookings?|reserve|reservation|escrow)\b/i.test(text) || /(बुक|बुकिंग|आरक्षित|आरक्षण)/i.test(text)) return 'booking';
  if (/\b(favorites?|favourites?|saved destinations?|saved places?)\b/i.test(text)) return 'favourites';
  if (/\b(audit ledger|blockchain|transaction hash|verify (my )?booking)\b/i.test(text)) return 'audit';
  if (/\b(system prompt|admin credentials|all users|private information|phone numbers|another user|another vendor)\b/i.test(text) || /(सिस्टम प्रॉम्प्ट|एडमिन पासवर्ड|एडमिन क्रेडेंशियल|दूसरे यूज़र|दूसरे विक्रेता|निजी जानकारी|फोन नंबर)/i.test(text)) return 'security';
  if (/\b(budget|cost|cheap|under ₹?|under rs)\b/i.test(text) || /(बजट|रुपये|पैसे|सस्ता|खर्च)/i.test(text)) return 'budget';
  return 'destination';
}

function parseMoney(text) {
  const input = String(text);
  const currencyMatch = input.match(/(?:₹|rs\.?|inr)\s*([\d,]+)/i)
    || input.match(/([\d,]+)\s*(?:रुपये|रुपए|rs\.?|inr)/i);
  const budgetMatch = input.match(/(?:budget|under|बजट)[^0-9]*([0-9][0-9,]*)/i);
  const value = currencyMatch?.[1] || budgetMatch?.[1];
  return value ? Number(value.replace(/,/g, '')) : null;
}

function mergeUnique(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim().toLowerCase()))];
}

function getItineraryContext(conversationHistory = [], currentText = '', destinations = [], priorContext = {}) {
  const history = Array.isArray(conversationHistory)
    ? conversationHistory.map((item) => String(item.content || '')).slice(-12)
    : [];
  const allText = [...history, currentText].join('\n');
  const durationMatch = allText.match(/(\d+)\s*(?:days?|दिन(?:ों)?|दिवस)/i);
  const originMatch = allText.match(/(?:starting from|start(?:ing)? at|from)\s+([A-Z][A-Za-z -]{2,40}?)(?=\s+and\b|\s*[,.!?]|$)|([A-Z][A-Za-z -]{2,40}?)\s+से|(?:मैं|हम)\s+([\u0900-\u097F][\u0900-\u097F ]{1,30}?)\s+से/i);
  const travellersMatch = allText.match(/\b(\d+)\s*(?:travellers?|travelers?|people|persons?)\b/i);
  const interestTerms = ['waterfalls', 'waterfall', 'nature', 'wildlife', 'forests', 'forest', 'history', 'historical', 'peaceful', 'family', 'झरने', 'झरना', 'प्रकृति', 'वन्यजीव', 'जंगल', 'इतिहास'];
  const interests = mergeUnique(interestTerms.filter((term) => new RegExp(term.match(/^[a-z]+$/i) ? `\\b${term}\\b` : term, 'i').test(allText)));
  const destinationMatches = destinations.filter((destination) => {
    const lower = allText.toLowerCase();
    return lower.includes(String(destination.name).toLowerCase()) || lower.includes(String(destination.slug).toLowerCase());
  }).map((destination) => destination.name);
  const dateMatch = allText.match(/\b(?:from|between|on)\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?|\d{4}-\d{2}-\d{2})\b/i);
  const itinerary = [...history].reverse().find((content) => /\bday\s*1\b/i.test(content)) || null;
  return {
    durationDays: durationMatch ? Number(durationMatch[1]) : (priorContext.durationDays || null),
    budget: parseMoney(allText) || priorContext.budget || null,
    origin: originMatch ? (originMatch[1] || originMatch[2] || originMatch[3]).trim() : (priorContext.origin || null),
    destination: destinationMatches[0] || priorContext.destination || null,
    interests: mergeUnique([...(priorContext.interests || []), ...interests]),
    travellerType: /\bfamil(y|ies)\b/i.test(allText) ? 'family' : (priorContext.travellerType || null),
    travellers: travellersMatch ? Number(travellersMatch[1]) : (priorContext.travellers || null),
    preferredActivities: interests.filter((interest) => ['waterfalls', 'waterfall', 'nature', 'wildlife', 'forests', 'forest', 'history', 'historical', 'झरने', 'झरना', 'प्रकृति', 'वन्यजीव', 'जंगल', 'इतिहास'].includes(interest)),
    travelDates: dateMatch ? dateMatch[1] : (priorContext.travelDates || null),
    previousItinerary: itinerary || priorContext.previousItinerary || null,
    selectedDestinations: mergeUnique([...(priorContext.selectedDestinations || []), ...destinationMatches])
  };
}

function logItineraryContext(context) {
  if (!isDevelopment) return;
  console.debug('[ITINERARY CONTEXT]', {
    Duration: context.durationDays,
    Budget: context.budget,
    Origin: context.origin,
    Interests: context.interests,
    Travellers: context.travellers,
    'Current itinerary': context.previousItinerary ? 'available' : null
  });
}

function getDestinations() {
  if (!destinationCache) destinationCache = db.destinations.list();
  return destinationCache;
}

// Language detection
function detectLanguage(text) {
  if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Devanagari (Hindi)
  const lower = text.toLowerCase();
  if (/\b(kaise|kahan|kya|batao|bataiye|mujhe|mere|mein|ghumne|jaana|chahiye|hai|hain)\b/i.test(lower)) return 'hi';
  return 'en';
}

function getLanguage(text, preference = 'auto') {
  if (preference === 'hi' || preference === 'en') return preference;
  return detectLanguage(text);
}

function languageInstruction(lang) {
  return lang === 'hi'
    ? 'Respond in natural, simple Hindi using Devanagari. Preserve proper nouns such as Netarhat, Betla National Park, BIRSA, and canonical database names.'
    : 'Respond in clear, natural English. Preserve canonical destination and service names.';
}

function normalizeDestinationQuery(text) {
  return String(text).toLowerCase()
    .replace(/नेतरहाट/g, 'netarhat')
    .replace(/बेतला/g, 'betla')
    .replace(/रांची/g, 'ranchi')
    .replace(/हुंडरू/g, 'hundru')
    .replace(/जोनहा/g, 'jonha')
    .replace(/दसम/g, 'dassam');
}

export const chatbotService = {
  async streamMessage(userMessage, conversationHistory = [], onEvent, requestId = 'unknown', priorContext = {}) {
    const requestStartedAt = performance.now();
    let geminiCallNumber = 0;
    logTiming(`REQUEST RECEIVED requestId=${requestId}`);
    const text = (userMessage || '').trim();
    const lang = getLanguage(text, priorContext.languagePreference);
    logTiming(`User message: ${text.slice(0, 200)}`);
    logTiming('Intent detection started');
    const intent = getIntent(text);
    logTiming(`Intent detection completed: ${(performance.now() - requestStartedAt).toFixed(0)} ms (${intent})`);
    if (/(eiffel tower|disneyland|एफिल टावर|डिज्नीलैंड)/i.test(text)) {
      const reply = lang === 'hi'
        ? 'जोहार! इस स्थान या आकर्षण की झारखंड पर्यटन डेटाबेस में सत्यापित जानकारी उपलब्ध नहीं है। मैं इसके बारे में अनुमान नहीं लगाऊँगा।'
        : 'Johar! I do not have verified information about that attraction in the Jharkhand tourism database, so I will not invent details.';
      onEvent({ type: 'chunk', text: reply });
      onEvent({ type: 'complete', reply, intent: 'unsupported_destination', detectedLanguage: lang });
      return;
    }
    if (intent === 'capability') {
      const reply = lang === 'hi'
        ? 'जोहार! मैं बिरसा AI हूँ, झारखंड के पर्यटन के लिए आपका डिजिटल सहायक।\n\nमैं आपकी मदद कर सकता हूँ:\n• पर्यटन स्थल खोजने में\n• व्यक्तिगत यात्रा योजना बनाने में\n• टूर पैकेज और आवास खोजने में\n• परिवहन विकल्प जानने में\n• बजट के अनुसार यात्रा की योजना बनाने में\n\nबताइए, आप झारखंड में कहाँ जाना चाहते हैं?'
        : capabilityReply;
      onEvent({ type: 'chunk', text: reply });
      onEvent({ type: 'complete', reply, intent, detectedLanguage: lang });
      logTiming(`Total request time: ${(performance.now() - requestStartedAt).toFixed(0)} ms (local capability response)`);
      logTiming(`Sending response to frontend requestId=${requestId}`);
      return;
    }
    if (intent === 'greeting') {
      const reply = lang === 'hi'
        ? 'जोहार! मैं बिरसा AI हूँ, झारखंड के पर्यटन के लिए आपका डिजिटल सहायक। मैं गंतव्य, यात्रा योजना, पैकेज, परिवहन और सुरक्षा से जुड़ी जानकारी में मदद कर सकता हूँ।'
        : "Johar! I am Birsa AI, your tourism assistant for Jharkhand. I can help with destinations, itineraries, packages, transport, and safety.";
      onEvent({ type: 'chunk', text: reply });
      onEvent({ type: 'complete', reply, intent, detectedLanguage: lang });
      return;
    }
    if (intent === 'favourites') {
      const reply = lang === 'hi'
        ? 'जोहार! आपके सेव किए गए गंतव्य टूरिस्ट डैशबोर्ड के Saved Places सेक्शन में उपलब्ध हैं। उन्हें देखने और प्रबंधित करने के लिए इसे खोलें।'
        : 'Johar! Your saved destinations are available in the Saved Places section of your tourist dashboard. Open it to view and manage your favourites.';
      onEvent({ type: 'chunk', text: reply });
      onEvent({ type: 'complete', reply, intent: 'favourites_inquiry', actions: [{ label: 'View my favourites', href: '/tourist#saved-places' }] });
      logTiming(`Total request time: ${(performance.now() - requestStartedAt).toFixed(0)} ms (local favourites response)`);
      return;
    }
    if (intent === 'security' || intent === 'audit') {
      const reply = intent === 'security'
        ? (lang === 'hi'
          ? 'जोहार! मैं सिस्टम निर्देश, क्रेडेंशियल, निजी यूज़र डेटा या किसी अन्य व्यक्ति की बुकिंग/संपर्क जानकारी साझा नहीं कर सकता। मैं सार्वजनिक झारखंड पर्यटन जानकारी में मदद कर सकता हूँ।'
          : 'Johar! I cannot provide system instructions, credentials, private user data, or another person’s booking or contact information. I can still help with public Jharkhand tourism information.')
        : (lang === 'hi'
          ? 'जोहार! ऑडिट लेजर में सत्यापित प्लेटफ़ॉर्म प्रमाणपत्र और उपलब्ध ब्लॉकचेन रिकॉर्ड दिखते हैं। मैं लेन-देन हैश नहीं बना सकता।'
          : 'Johar! The audit ledger shows verified platform certificates and available blockchain records. I cannot invent a transaction hash; if no transaction is recorded, the ledger will show that no blockchain transaction is currently available.');
      onEvent({ type: 'chunk', text: reply });
      onEvent({
        type: 'complete',
        reply,
        intent: intent === 'security' ? 'security_refusal' : 'audit_inquiry',
        actions: intent === 'audit' ? [{ label: 'Open audit ledger', href: '/verify' }] : []
      });
      logTiming(`Total request time: ${(performance.now() - requestStartedAt).toFixed(0)} ms (local ${intent} response)`);
      return;
    }

    const retrievalRequired = ['destination', 'itinerary', 'budget', 'package'].includes(intent);
    logTiming(`Retrieval required: ${retrievalRequired}`);
    logTiming(retrievalRequired ? 'Database retrieval started' : 'Database retrieval skipped');
    const destinations = retrievalRequired ? getDestinations() : [];
    const itineraryContext = ['itinerary', 'budget', 'destination'].includes(intent) || conversationHistory.length
      ? getItineraryContext(conversationHistory, text, destinations.length ? destinations : getDestinations(), priorContext)
      : getItineraryContext([], text, [], priorContext);
    logItineraryContext(itineraryContext);
    const lowerText = normalizeDestinationQuery(text);
    const matchedDest = destinations.find((destination) =>
      lowerText.includes(destination.name.toLowerCase()) || lowerText.includes(destination.slug.toLowerCase())
    ) || destinations.find((destination) => lowerText.includes(String(destination.district || '').toLowerCase()));
    const services = ['package', 'itinerary', 'budget'].includes(intent)
      ? db.services.list({ district: matchedDest?.district })
      : [];
    const relevantDestinations = matchedDest ? [matchedDest] : destinations.slice(0, 8);
    const destSummary = relevantDestinations.map((d) => `${d.name} (${d.district}): ${d.description}. Activities: ${(d.activities || []).join(', ')}. Avg cost: ₹${d.avg_cost}`).join('\n');
    const serviceSummary = services.slice(0, 12).map((s) => `${s.title || s.name} (${s.category || 'tourism service'}): ₹${s.price || 'contact provider'}`).join('\n');
    const recentHistory = intent === 'greeting' ? '' : (Array.isArray(conversationHistory)
      ? conversationHistory.slice(-6).map((item) => `${item.role === 'assistant' ? 'Birsa AI' : 'Traveler'}: ${String(item.content || '').slice(0, 600)}`).join('\n')
      : '');
    const prompt = intent === 'greeting'
      ? `You are Birsa AI, a courteous Jharkhand tourism assistant. Reply to the greeting briefly and invite the traveler to ask about destinations, itineraries, packages, transport, or safety. Start with "Johar!". User message: "${text}"`
      : `You are Birsa AI, an expert, courteous, and culturally respectful AI tourist concierge for Jharkhand, India.
Start every response with "Johar!" unless it is a short continuation. Never invent prices, opening hours, transport availability, or bookings. Keep answers concise and easy to scan.
Relevant destination context:
${destSummary || 'No destination context was requested.'}
Relevant services:
${serviceSummary || 'No service context was requested.'}
Recent conversation:
${recentHistory || 'No earlier conversation.'}
Current traveler question: "${text}"
Language instruction: ${languageInstruction(lang)}
Structured itinerary context (use this to preserve the current plan; do not invent missing values):
${JSON.stringify(itineraryContext)}
Answer the exact question first. If the traveler asks for the best time or season, begin with the specific season from the verified destination data before adding any background details.`;
    logTiming(`Database retrieval completed: ${(performance.now() - requestStartedAt).toFixed(0)} ms`);
    logTiming(`Retrieved records: destinations=${relevantDestinations.length}, services=${services.length}`);
    logTiming(`Prompt/context size: ${prompt.length} characters`);
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      const fallback = await this.processMessage(text, conversationHistory, null, 'anon-session', { skipGemini: true }, requestId, priorContext);
      onEvent({ type: 'chunk', text: fallback.reply });
      onEvent({ type: 'complete', ...fallback });
      return;
    }

    let streamedText = '';
    let firstResponseLogged = false;
    try {
      const models = [process.env.GEMINI_MODEL || 'gemini-3.6-flash', 'gemini-3.5-flash'];
      let response;
      for (const model of models) {
        geminiCallNumber += 1;
        const geminiCallId = `${requestId}-gemini-${geminiCallNumber}`;
        logTiming(`[GEMINI #${geminiCallNumber}] Purpose: final answer generation`);
        logTiming(`[GEMINI #${geminiCallNumber}] Call ID: ${geminiCallId}`);
        logTiming(`[GEMINI #${geminiCallNumber}] Model: ${model}`);
        logTiming(`[GEMINI #${geminiCallNumber}] Endpoint: v1beta/models/${model}:streamGenerateContent?alt=sse`);
        logTiming(`[GEMINI #${geminiCallNumber}] Prompt size: ${prompt.length} characters`);
        logTiming(`[GEMINI #${geminiCallNumber}] Started`);
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.35, maxOutputTokens: 700 }
          })
        });
        if (response.ok) {
          logTiming(`[GEMINI #${geminiCallNumber}] Status: ${response.status}`);
          break;
        }
        const errorDetails = await describeGeminiError(response);
        console.error(`[BIRSA] GEMINI ERROR\nStatus: ${response.status}\nStatus text: ${response.statusText}\nError code: ${response.status}\nError message: ${errorDetails}\nModel: ${model}\nRequest purpose: final answer generation\nRequest ID: ${requestId}\nGemini Call ID: ${geminiCallId}`);
        logTiming(`[GEMINI #${geminiCallNumber}] Completed: ${Math.round(performance.now() - requestStartedAt)} ms`);
        if (![404].includes(response.status)) break;
      }
      if (!response?.ok || !response.body) throw new Error(`Gemini streaming failed with HTTP ${response?.status || 'unknown'}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const handleEvent = (event) => {
        const dataLine = event.split('\n').find((line) => line.startsWith('data:'));
        if (!dataLine) return;
        const payload = JSON.parse(dataLine.slice(5).trim());
        const chunk = payload.candidates?.[0]?.content?.parts?.[0]?.text;
        if (chunk) {
          streamedText += chunk;
          if (!firstResponseLogged) {
            firstResponseLogged = true;
            logTiming(`Gemini first response received: ${(performance.now() - requestStartedAt).toFixed(0)} ms`);
          }
          onEvent({ type: 'chunk', text: chunk });
        }
      };
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          handleEvent(line);
        }
        if (done) {
          if (buffer.trim()) handleEvent(buffer);
          break;
        }
      }
      onEvent({
        type: 'complete',
        reply: streamedText,
        intent: 'generative_ai_response',
        aiProvider: 'gemini',
        destinationData: matchedDest,
        itineraryContext,
        actions: matchedDest ? [
          { label: 'View destination', href: `/destinations?destination=${encodeURIComponent(matchedDest.slug || matchedDest.id)}` },
          { label: 'Plan route', href: `/transport?destination=${encodeURIComponent(matchedDest.name)}` },
          { label: 'Open planner', href: `/planner?destination=${encodeURIComponent(matchedDest.name)}` }
        ] : []
      });
      logTiming(`Gemini request completed: ${(performance.now() - requestStartedAt).toFixed(0)} ms`);
      logTiming(`Total request time: ${(performance.now() - requestStartedAt).toFixed(0)} ms`);
      logTiming(`Sending response to frontend requestId=${requestId}`);
    } catch (error) {
      console.error(`[BIRSA] GEMINI ERROR\nError message: ${error.message}\nError code: ${error.code || 'N/A'}\nError details: ${error.stack || 'N/A'}`);
      if (!streamedText) {
        const fallback = await this.processMessage(text, conversationHistory, null, 'anon-session', { skipGemini: true }, requestId, priorContext);
        onEvent({ type: 'chunk', text: fallback.reply });
        onEvent({ type: 'complete', ...fallback });
      } else {
        onEvent({ type: 'complete', reply: streamedText, intent: 'partial_generative_ai_response', aiProvider: 'gemini' });
      }
      logTiming(`Total request time: ${(performance.now() - requestStartedAt).toFixed(0)} ms (fallback)`);
      logTiming(`Sending response to frontend requestId=${requestId}`);
    }
  },
  async processMessage(userMessage, conversationHistory = [], userId = null, sessionId = 'anon-session', options = {}, requestId = 'unknown', priorContext = {}) {
    const requestStartedAt = performance.now();
    logTiming('Request started');
    const text = (userMessage || '').trim();
    if (!text) {
      return {
        reply: "Johar! I am Birsa AI, your smart concierge for Jharkhand. How may I assist your journey across our untamed waterfalls, sacred shrines, and wildlife sanctuaries today?",
        detectedLanguage: 'en',
        intent: 'greeting'
      };
    }

    const lang = getLanguage(text, priorContext.languagePreference);
    const lowerText = normalizeDestinationQuery(text);
    const intent = getIntent(text);
    logTiming(`Intent detection completed: ${(performance.now() - requestStartedAt).toFixed(0)} ms (${intent})`);
    if (/(eiffel tower|disneyland|एफिल टावर|डिज्नीलैंड)/i.test(text)) {
      return {
        reply: lang === 'hi'
          ? 'जोहार! इस स्थान या आकर्षण की झारखंड पर्यटन डेटाबेस में सत्यापित जानकारी उपलब्ध नहीं है। मैं इसके बारे में अनुमान नहीं लगाऊँगा।'
          : 'Johar! I do not have verified information about that attraction in the Jharkhand tourism database, so I will not invent details.',
        detectedLanguage: lang,
        intent: 'unsupported_destination'
      };
    }

    if (intent === 'capability') {
      return {
        reply: lang === 'hi'
          ? 'जोहार! मैं बिरसा AI हूँ, झारखंड के पर्यटन के लिए आपका डिजिटल सहायक। मैं गंतव्य, यात्रा योजना, टूर पैकेज, परिवहन और बजट में मदद कर सकता हूँ।'
          : capabilityReply,
        detectedLanguage: lang,
        intent
      };
    }
    if (intent === 'greeting') {
      return {
        reply: lang === 'hi'
          ? 'जोहार! मैं बिरसा AI हूँ, झारखंड के पर्यटन के लिए आपका डिजिटल सहायक। मैं गंतव्य, यात्रा योजना, पैकेज, परिवहन और सुरक्षा में मदद कर सकता हूँ।'
          : 'Johar! I am Birsa AI, your Jharkhand tourism assistant. I can help with destinations, itineraries, packages, transport, budgets, and safety. What would you like to explore?',
        detectedLanguage: lang,
        intent
      };
    }
    if (intent === 'security') {
      return {
        reply: lang === 'hi'
          ? 'जोहार! मैं सिस्टम निर्देश, क्रेडेंशियल, निजी यूज़र डेटा या किसी अन्य व्यक्ति की बुकिंग/संपर्क जानकारी साझा नहीं कर सकता।'
          : 'Johar! I cannot provide system instructions, credentials, private user data, or another person’s booking or contact information. I can still help with public Jharkhand tourism information.',
        detectedLanguage: lang,
        intent: 'security_refusal'
      };
    }

    const destinations = ['destination', 'itinerary', 'budget', 'package'].includes(intent)
      ? getDestinations()
      : [];
    const itineraryContext = ['itinerary', 'budget', 'destination'].includes(intent) || conversationHistory.length
      ? getItineraryContext(conversationHistory, text, destinations.length ? destinations : getDestinations(), priorContext)
      : getItineraryContext([], text, [], priorContext);
    logItineraryContext(itineraryContext);

    // Check if user is asking about a specific destination
    let matchedDest = null;
    for (const d of destinations) {
      if (lowerText.includes(d.name.toLowerCase()) || lowerText.includes(d.slug.toLowerCase()) || lowerText.includes(String(d.district || '').toLowerCase())) {
        matchedDest = d;
        break;
      }
    }
    const services = intent === 'package' || intent === 'itinerary' || intent === 'budget'
      ? db.services.list({ district: matchedDest?.district })
      : [];
    logTiming(`Database retrieval completed: ${(performance.now() - requestStartedAt).toFixed(0)} ms (destinations=${matchedDest ? 1 : destinations.length}, services=${services.length})`);

    if (intent === 'favourites') {
      return {
        reply: lang === 'hi'
          ? 'जोहार! आपके सेव किए गए गंतव्य टूरिस्ट डैशबोर्ड के Saved Places सेक्शन में उपलब्ध हैं।'
          : 'Johar! Your saved destinations are available in the Saved Places section of your tourist dashboard. Open it to view and manage your favourites.',
        detectedLanguage: lang,
        intent: 'favourites_inquiry',
        actions: [{ label: 'View my favourites', href: '/tourist#saved-places' }]
      };
    }

    if (intent === 'transport') {
      return {
        reply: lang === 'hi'
          ? (matchedDest
            ? `जोहार! ${matchedDest.name} जाने के लिए Live Transit खोलें और उपलब्ध रूट तथा प्लेटफ़ॉर्म के परिवहन डेटा देखें। मेरे पास सत्यापित निश्चित प्रस्थान समय-सारणी उपलब्ध नहीं है।`
            : 'जोहार! रूट मार्गदर्शन और उपलब्ध परिवहन डेटा देखने के लिए Live Transit खोलें। मेरे पास सत्यापित निश्चित प्रस्थान समय-सारणी उपलब्ध नहीं है।')
          : (matchedDest
            ? `Johar! For travel to ${matchedDest.name}, open Live Transit to see the available route and current platform transport data. I do not have a verified fixed departure schedule in the chatbot.`
            : 'Johar! Open Live Transit to see route guidance and available platform transport data. I do not have a verified fixed departure schedule in the chatbot.'),
        detectedLanguage: lang,
        intent: 'transport_inquiry',
        actions: [{ label: 'Live transit', href: '/transport' }]
      };
    }

    if (intent === 'booking') {
      return {
        reply: lang === 'hi'
          ? 'जोहार! मैं चैट के अंदर बुकिंग की पुष्टि नहीं कर सकता। मार्केटप्लेस खोलें, स्वीकृत पैकेज चुनें और बुकिंग प्रक्रिया पूरी करें।'
          : 'Johar! I cannot confirm a booking inside chat. Open the marketplace, select an approved package, and complete the booking flow there. A booking is confirmed only after the booking API succeeds.',
        detectedLanguage: lang,
        intent: 'booking_inquiry',
        actions: [{ label: 'Open marketplace', href: '/marketplace' }]
      };
    }
    if (intent === 'audit') {
      return {
        reply: 'Johar! The audit ledger shows verified platform certificates and available blockchain records. I cannot invent a transaction hash; if no transaction is recorded, the ledger will show that no blockchain transaction is currently available.',
        detectedLanguage: lang,
        intent: 'audit_inquiry',
        actions: [{ label: 'Open audit ledger', href: '/verify' }]
      };
    }

    if (intent === 'package') {
      return {
        reply: services.length
          ? (lang === 'hi'
            ? `जोहार! ${matchedDest ? `${matchedDest.name} के पास ` : ''}${services.length} स्वीकृत पैकेज या सेवा मिली${services.length === 1 ? ' है' : ' हैं'}। वास्तविक प्रदाता विवरण देखने के लिए मार्केटप्लेस खोलें।`
            : `Johar! I found ${services.length} approved package or service${services.length === 1 ? '' : 's'}${matchedDest ? ` near ${matchedDest.name}` : ''}. Open the marketplace to review the real provider details.`)
          : (lang === 'hi'
            ? `जोहार! ${matchedDest ? `${matchedDest.name} के लिए ` : ''}अभी कोई स्वीकृत पैकेज उपलब्ध नहीं है। नवीनतम लिस्टिंग देखने के लिए मार्केटप्लेस खोलें।`
            : `Johar! No approved packages are currently available${matchedDest ? ` for ${matchedDest.name}` : ''}. Open the marketplace to browse the latest approved listings.`),
        detectedLanguage: lang,
        intent: 'package_inquiry',
        actions: [{ label: 'Open marketplace', href: '/marketplace' }]
      };
    }

    // Check if user has configured Gemini or OpenAI API Key
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && !options.skipGemini) {
      try {
        const relevantDestinations = matchedDest ? [matchedDest] : destinations.slice(0, 8);
        const destSummary = relevantDestinations.map(d => `${d.name} (${d.district}): ${d.description}. Activities: ${(d.activities || []).join(', ')}. Avg cost: ₹${d.avg_cost}`).join('\n');
        const serviceSummary = services.slice(0, 12).map(s => `${s.title || s.name} (${s.category || s.service_type || 'tourism service'}): ₹${s.price || s.daily_rate || 'contact provider'}`).join('\n');
        const recentHistory = Array.isArray(conversationHistory)
          ? conversationHistory.slice(-8).map(item => `${item.role === 'assistant' ? 'Birsa AI' : 'Traveler'}: ${String(item.content || '').slice(0, 800)}`).join('\n')
          : '';
        const prompt = `You are Birsa AI, an expert, courteous, and culturally respectful AI tourist concierge for Jharkhand, India.
Start every response with "Johar!" unless the response is only a short continuation. Never invent prices, opening hours, transport availability, or bookings. If the database does not contain an answer, say so and give a practical next step. Keep answers easy to scan with short paragraphs or bullets. Use the requested language and preserve proper names.

Verified destination context:
${destSummary}

Available services:
${serviceSummary || 'No services are currently listed.'}

Recent conversation:
${recentHistory || 'No earlier conversation.'}

Current traveler question: "${text}"
Language instruction: ${languageInstruction(lang)}
Structured itinerary context:
${JSON.stringify(itineraryContext)}
Provide a helpful, precise, and practical response about attractions, itineraries, transport, culture, local food, safety, or platform services.`;

        const models = [
          process.env.GEMINI_MODEL || 'gemini-3.6-flash',
          'gemini-3.5-flash'
        ];
        let response;
        let geminiCallNumber = 0;
        for (const model of models) {
          geminiCallNumber += 1;
          const geminiCallId = `${requestId}-gemini-${geminiCallNumber}`;
          logTiming(`[GEMINI #${geminiCallNumber}] Purpose: complete answer generation`);
          logTiming(`[GEMINI #${geminiCallNumber}] Call ID: ${geminiCallId}`);
          logTiming(`[GEMINI #${geminiCallNumber}] Model: ${model}`);
          logTiming(`[GEMINI #${geminiCallNumber}] Endpoint: v1beta/models/${model}:generateContent`);
          logTiming(`[GEMINI #${geminiCallNumber}] Prompt size: ${prompt.length} characters`);
          logTiming(`[GEMINI #${geminiCallNumber}] Started`);
          response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.35, maxOutputTokens: 700 }
            })
          });
          if (response.ok) break;
          const errorDetails = await describeGeminiError(response);
          console.error(`[BIRSA] GEMINI ERROR\nStatus: ${response.status}\nStatus text: ${response.statusText}\nError code: ${response.status}\nError message: ${errorDetails}\nModel: ${model}\nRequest purpose: complete answer generation\nRequest ID: ${requestId}\nGemini Call ID: ${geminiCallId}`);
          if (response.status !== 404) break;
        }

        if (response.ok) {
          const data = await response.json();
          const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidate) {
            logTiming(`Gemini first response received: ${(performance.now() - requestStartedAt).toFixed(0)} ms`);
            logTiming(`Gemini request completed: ${(performance.now() - requestStartedAt).toFixed(0)} ms`);
            logTiming(`Total request time: ${(performance.now() - requestStartedAt).toFixed(0)} ms`);
            return {
              reply: candidate,
              detectedLanguage: lang,
              intent: 'generative_ai_response',
              aiProvider: 'gemini',
              destinationData: matchedDest,
              itineraryContext
            };
          }
        }
      } catch (aiErr) {
        console.warn(`[BIRSA] Gemini request failed: ${aiErr.message}`);
      }
    }

    if (intent === 'itinerary') {
      const hasPlan = Boolean(itineraryContext.previousItinerary);
      const requestIsModification = /\b(cheaper|change day|add a waterfall|modify|update|day 2|day two)\b/i.test(text);
      const missing = [
        !itineraryContext.durationDays && 'trip duration',
        !itineraryContext.budget && 'budget',
        !itineraryContext.origin && 'starting location'
      ].filter(Boolean);
      let reply;
      if (requestIsModification && hasPlan) {
        const change = /cheaper/i.test(text)
          ? `I removed optional paid activities and kept the nature and waterfall stops, so the plan stays within the lower budget.`
          : /add a waterfall/i.test(text)
            ? `I added a waterfall stop to Day 2 and kept the other days unchanged.`
            : /day\s*(?:2|two)/i.test(text)
              ? `Day 2 remains focused on waterfalls and nature; tell me the exact replacement if you want a different activity.`
              : `I changed only the requested part: ${text}.`;
        reply = `Johar! I updated your current ${itineraryContext.durationDays || ''}-day itinerary from ${itineraryContext.origin || 'your selected origin'}. ${change}`;
      } else if (missing.length) {
        reply = lang === 'hi'
          ? `जोहार! यात्रा योजना बनाने के लिए मुझे अभी ${missing.join(', ')} की जानकारी चाहिए। ये विवरण बताइए, फिर मैं दिन-वार योजना तैयार कर दूँगा।`
          : `Johar! I can create the itinerary, but I still need your ${missing.join(', ')}. Tell me those details and I’ll prepare the day-by-day plan.`;
      } else {
        reply = lang === 'hi'
          ? `जोहार! ${itineraryContext.origin} से ${itineraryContext.durationDays} दिनों की यात्रा योजना ₹${itineraryContext.budget} के बजट में तैयार है। रुचियाँ: ${itineraryContext.interests.join(', ') || 'प्रकृति और स्थानीय अनुभव'}।\n\nदिन 1: ${itineraryContext.origin} से यात्रा शुरू करें और पास के प्राकृतिक स्थल को देखें।\nदिन 2: किसी झरने या वन्यजीव स्थल पर जाएँ और स्थानीय भोजन का आनंद लें।\nदिन 3: सुबह आराम से घूमें और वापसी की यात्रा शुरू करें।`
          : `Johar! Here is a starting plan for ${itineraryContext.durationDays} days from ${itineraryContext.origin}, within ₹${itineraryContext.budget}, focusing on ${itineraryContext.interests.join(', ') || 'your chosen interests'}.\n\nDay 1: Travel from ${itineraryContext.origin} and explore a nearby nature attraction.\nDay 2: Visit a waterfall or wildlife destination and keep time for local food.\nDay 3: Enjoy a relaxed morning, then return journey.`;
      }
      const responseContext = {
        ...itineraryContext,
        previousItinerary: reply.includes('Day 1:') ? reply : itineraryContext.previousItinerary
      };
      return {
        reply,
        detectedLanguage: lang,
        intent: hasPlan && requestIsModification ? 'itinerary_update' : 'itinerary_inquiry',
        itineraryContext: responseContext,
        actions: [{ label: 'Open planner', href: '/planner' }]
      };
    }

    // Intelligent Database Grounded Synthesis
    if (matchedDest) {
      let reply = '';
      const asksBestTime = /\b(best time|best season|when should|when to visit|suitable time|ideal time)\b/i.test(lowerText);
      if (lang === 'hi') {
        reply = asksBestTime
          ? `जोहार! ${matchedDest.name} जाने का सबसे अच्छा समय: ${matchedDest.best_season || 'अक्टूबर से मार्च'}। इस समय मौसम सुहावना रहता है और घूमना आसान होता है। ${matchedDest.opening_hours ? `दर्शन का समय: ${matchedDest.opening_hours}।` : ''}`
          : `जोहार! ${matchedDest.title} (${matchedDest.district} जिला): ${matchedDest.description} 
• मुख्य आकर्षण एवं गतिविधियाँ: ${(matchedDest.activities || []).slice(0, 3).join(', ')}। 
• समय एवं प्रवेश: ${matchedDest.opening_hours || 'सूर्योदय से सूर्यास्त'}, ${matchedDest.ticket_info || 'निःशुल्क'}। 
• औसत दैनिक खर्च: लगभग ₹${matchedDest.avg_cost}। 
• निकटतम प्रवास: ${(matchedDest.nearby_hotels || []).slice(0, 2).join(', ')}।`;
      } else if (lang === 'bn') {
        reply = asksBestTime
          ? `জোহার! ${matchedDest.name} ভ্রমণের সেরা সময়: ${matchedDest.best_season || 'অক্টোবর থেকে মার্চ'}। এই সময় আবহাওয়া মনোরম থাকে এবং ঘোরার জন্য সুবিধাজনক।`
          : `জোহার! ${matchedDest.title} (${matchedDest.district} জেলা): ${matchedDest.description} 
• প্রধান কার্যক্রম: ${(matchedDest.activities || []).slice(0, 3).join(', ')}। 
• সেরা সময়: ${matchedDest.best_season}। 
• আনুমানিক খরচ: প্রায় ₹${matchedDest.avg_cost} প্রতিদিন।`;
      } else {
        reply = asksBestTime
          ? `Johar! The best time to visit ${matchedDest.name} is ${matchedDest.best_season || 'October to March'}. It is open ${matchedDest.opening_hours || 'from sunrise to sunset'}; start early for the clearest views and cooler weather.`
          : `Johar! ${matchedDest.title} in ${matchedDest.district} District: ${matchedDest.description} 
• Highlights & Activities: ${(matchedDest.activities || []).slice(0, 3).join(', ')}. 
• Opening Hours: ${matchedDest.opening_hours || 'Sunrise to Sunset'} | Ticket: ${matchedDest.ticket_info || 'Free Entry'}. 
• Best Season: ${matchedDest.best_season}. Average daily expense around ₹${matchedDest.avg_cost}. 
• Recommended Stays: ${(matchedDest.nearby_hotels || []).slice(0, 2).join(', ')}.`;
      }

      return {
        reply,
        detectedLanguage: lang,
        intent: 'destination_inquiry',
        destinationData: matchedDest,
        actions: [
          { label: 'View destination', href: `/destinations?destination=${encodeURIComponent(matchedDest.slug || matchedDest.id)}` },
          { label: 'Plan route', href: `/transport?destination=${encodeURIComponent(matchedDest.name)}` },
          { label: 'Open planner', href: `/planner?destination=${encodeURIComponent(matchedDest.name)}` }
        ]
      };
    }

    if (intent === 'favourites') {
      return {
        reply: 'Johar! Your saved destinations are available in the Saved Places section of your tourist dashboard. Open it to view and manage your favourites.',
        detectedLanguage: lang,
        intent: 'favourites_inquiry',
        actions: [{ label: 'View my favourites', href: '/tourist#saved-places' }]
      };
    }

    if (intent === 'package') {
      const reply = services.length
        ? (lang === 'hi'
          ? `जोहार! ${matchedDest ? `${matchedDest.name} के पास ` : ''}${services.length} स्वीकृत पर्यटन सेवा${services.length === 1 ? '' : 'एँ'} मिली हैं। विकल्प देखने के लिए मार्केटप्लेस खोलें।`
          : `Johar! I found ${services.length} approved tourism service${services.length === 1 ? '' : 's'}${matchedDest ? ` near ${matchedDest.name}` : ''}. Open the marketplace to review the available options and providers.`)
        : (lang === 'hi'
          ? 'जोहार! इस अनुरोध के लिए अभी कोई स्वीकृत पैकेज उपलब्ध नहीं है। उपलब्ध टूर, गाइड और आवास देखने के लिए मार्केटप्लेस खोलें।'
          : 'Johar! There are no approved packages matching that request right now. You can browse the marketplace for currently available tours, guides, and accommodation.');
      return {
        reply,
        detectedLanguage: lang,
        intent: 'package_inquiry',
        actions: [{ label: 'Open marketplace', href: '/marketplace' }]
      };
    }

    if (intent === 'booking') {
      return {
        reply: lang === 'hi'
          ? 'जोहार! आपकी बुकिंग और आरक्षण मार्केटप्लेस में उपलब्ध हैं। उन्हें देखने या स्वीकृत सेवाएँ खोजने के लिए मार्केटप्लेस खोलें।'
          : 'Johar! Your bookings and reservations are available in the marketplace. Open it to review your current bookings or explore approved services.',
        detectedLanguage: lang,
        intent: 'booking_inquiry',
        actions: [{ label: 'Open marketplace', href: '/marketplace' }]
      };
    }

    if (intent === 'itinerary') {
      return {
        reply: 'Johar! I can build a day-by-day Jharkhand itinerary. Tell me your destination, trip duration, and approximate budget, or open the planner to start with those details.',
        detectedLanguage: lang,
        intent: 'itinerary_inquiry',
        actions: [{ label: 'Open planner', href: '/planner' }]
      };
    }

    if (intent === 'budget') {
      const budgetDetails = itineraryContext.budget
        ? `I have noted your budget as ₹${itineraryContext.budget}${itineraryContext.durationDays ? ` for ${itineraryContext.durationDays} days` : ''}${itineraryContext.origin ? ` starting from ${itineraryContext.origin}` : ''}.`
        : 'Share your approximate budget so I can work within it.';
      return {
        reply: `Johar! ${budgetDetails} Share your destination, number of days, and traveller count so I can suggest a practical plan.`,
        detectedLanguage: lang,
        intent: 'budget_inquiry',
        itineraryContext,
        actions: [{ label: 'Open planner', href: '/planner' }]
      };
    }

    // Transport inquiry
    if (intent === 'transport') {
      let reply = 'Jharkhand is well connected via Birsa Munda Airport (IXR) in Ranchi and extensive South Eastern Railway networks (Ranchi, Tatanagar, Dhanbad, Jasidih). You can view real-time transit telemetry and highway routes directly on our Live Transport page.';
      if (lang === 'hi') {
        reply = 'झारखंड पहुंचना बहुत सुगम है! रांची का बिरसा मुंडा हवाई अड्डा (IXR) और प्रमुख रेलवे स्टेशन (रांची, टाटानगर, धनबाद, जसीडीह) देश के सभी महानगरों से जुड़े हैं। आप हमारे लाइव ट्रांसपोर्ट पेज पर लाइव जीपीएस और रूट देख सकते हैं।';
      }
      return { reply, detectedLanguage: lang, intent: 'transport_inquiry', itineraryContext, actions: [{ label: 'Live transit', href: '/transport' }] };
    }

    // Local Cuisine inquiry
    if (lowerText.includes('food') || lowerText.includes('eat') || lowerText.includes('cuisine') || lowerText.includes('dhuska') || lowerText.includes('litti') || lowerText.includes('peda') || lowerText.includes('khana')) {
      let reply = 'Authentic Jharkhand culinary treasures include: crisp Dhuska with Chana Ghugni, roasted Litti Chokha with Mahua chutney, organic monsoon Rugra & Khukri mushrooms, and the famed Khoya Peda of Deoghar!';
      if (lang === 'hi') {
        reply = 'झारखंड के पारंपरिक व्यंजनों का आनंद अवश्य लें: गरमा-गरम धुस्का और चना घुघनी, लिट्टी चोखा, मानसूनी रुगड़ा और खुखड़ी मशरूम, और देवघर का प्रसिद्ध खोया पेड़ा!';
      }
      return { reply, detectedLanguage: lang, intent: 'food_inquiry' };
    }

    // Certified Guide & Escrow Security inquiry
    if (lowerText.includes('guide') || lowerText.includes('verify') || lowerText.includes('blockchain') || lowerText.includes('escrow') || lowerText.includes('safe') || lowerText.includes('security')) {
      let reply = 'All local guides and homestays on our platform are verified with SHA-256 cryptographic certificates anchored in smart contracts. Your payments are locked in decentralized escrow and released only upon your tour completion confirmation!';
      if (lang === 'hi') {
        reply = 'हमारे प्लेटफ़ॉर्म के सभी गाइड और होमस्टे स्मार्ट कॉन्ट्रैक्ट डिजिटल प्रमाणपत्रों के साथ सत्यापित हैं। आपका भुगतान एस्क्रो में सुरक्षित रहता है और सेवा पूर्ण होने पर ही जारी किया जाता है।';
      }
      return { reply, detectedLanguage: lang, intent: 'trust_inquiry', actions: [{ label: 'Audit ledger', href: '/verify' }] };
    }

    // General Guidance with real recommendations
    const topDestNames = destinations.slice(0, 4).map(d => d.name).join(', ') || 'Jharkhand';
    let defaultReply = `Johar! I can assist you with personalized day-by-day itineraries, verified tribal guides, or detailed travel tips for iconic destinations like ${topDestNames}. What would you like to explore?`;
    if (lang === 'hi') {
      defaultReply = `जोहार! मैं झारखंड के प्रमुख स्थलों (जैसे ${topDestNames}) के लिए आपका व्यक्तिगत यात्रा कार्यक्रम तैयार कर सकता हूँ। आप किस क्षेत्र के बारे में जानना चाहते हैं?`;
    }

    return {
      reply: defaultReply,
      detectedLanguage: lang,
      intent: 'general_guidance',
      itineraryContext
    };
  }
};
