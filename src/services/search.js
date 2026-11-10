import { getLabsWithWorkstations } from './labService.js';

const FALLBACK_MESSAGE = "Could not understand the request, please choose the day and time yourself";

async function defaultAskModel(prompt, { signal } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.MODEL_NAME || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    }),
    signal
  });

  if (!res.ok) {
    throw new Error(`Model API error: ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No text returned from model');
  }
  return text;
}

export function createSearch({
  askModel = defaultAskModel,
  now = () => new Date(),
  timeoutMs = 5000
} = {}) {
  return async function search(sentence) {
    if (!sentence || typeof sentence !== 'string' || !sentence.trim()) {
      return { message: FALLBACK_MESSAGE };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { message: FALLBACK_MESSAGE };
    }

    const labs = getLabsWithWorkstations();
    const todayDateObj = now();
    const y = todayDateObj.getFullYear();
    const m = String(todayDateObj.getMonth() + 1).padStart(2, '0');
    const d = String(todayDateObj.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const labListStr = labs.map(l => `ID: ${l.id}, Name: ${l.name}`).join('\n');

    const prompt = `You are a scheduling assistant for TU Sofia Lab Booking.
Today's date is ${todayStr}.
Available labs:
${labListStr}

User request: "${sentence}"

Extract the requested lab ID, date (in YYYY-MM-DD format), and slot (integer 0 to 5, where 0 is 08:00-10:00, 1 is 10:00-12:00, 2 is 12:00-14:00, 3 is 14:00-16:00, 4 is 16:00-18:00, 5 is 18:00-20:00).
Reply with valid JSON only, exactly in this format:
{"labId": <number>, "date": "YYYY-MM-DD", "slot": <number>}
If you cannot determine the lab, date, or slot, reply with {"error": "cannot understand"}.`;

    try {
      const controller = new AbortController();
      const controllerTimer = setTimeout(() => controller.abort(), timeoutMs);

      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Model timeout')), timeoutMs);
      });

      const askPromise = Promise.resolve().then(() => askModel(prompt, { signal: controller.signal }));

      const rawResponse = await Promise.race([askPromise, timeoutPromise]);
      clearTimeout(controllerTimer);
      clearTimeout(timeoutId);

      if (typeof rawResponse !== 'string') {
        return { message: FALLBACK_MESSAGE };
      }

      // Extract JSON from response if wrapped in markdown code blocks
      let jsonStr = rawResponse.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(json)?/, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== 'object' || !parsed.labId || !parsed.date || parsed.slot === undefined) {
        return { message: FALLBACK_MESSAGE };
      }

      const labId = Number(parsed.labId);
      const dateStr = String(parsed.date);
      const slot = Number(parsed.slot);

      // Validate lab exists
      const validLab = labs.some(l => l.id === labId);
      if (!validLab) {
        return { message: FALLBACK_MESSAGE };
      }

      // Validate slot (0-5)
      if (!Number.isInteger(slot) || slot < 0 || slot > 5) {
        return { message: FALLBACK_MESSAGE };
      }

      // Validate date format and constraints (not in past, not weekend)
      const dateParts = dateStr.split('-').map(Number);
      if (dateParts.length !== 3 || isNaN(dateParts[0]) || isNaN(dateParts[1]) || isNaN(dateParts[2])) {
        return { message: FALLBACK_MESSAGE };
      }

      const targetDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
      if (isNaN(targetDate.getTime())) {
        return { message: FALLBACK_MESSAGE };
      }

      const todayMidnight = new Date(todayDateObj.getFullYear(), todayDateObj.getMonth(), todayDateObj.getDate());
      const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

      // Past date check
      if (targetMidnight < todayMidnight) {
        return { message: FALLBACK_MESSAGE };
      }

      // Weekend check (0 = Sunday, 6 = Saturday)
      const dayOfWeek = targetDate.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { message: FALLBACK_MESSAGE };
      }

      return {
        labId,
        date: dateStr,
        slot
      };
    } catch (err) {
      return { message: FALLBACK_MESSAGE };
    }
  };
}
