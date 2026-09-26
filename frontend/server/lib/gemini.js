const MODEL = "gemini-3.8-flash";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini's flash tier returns transient 503 "high demand" errors fairly
// often — retry with backoff before surfacing a failure to the user.
export async function askGemini({ systemInstruction, message }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured on the server.");
  }

  const body = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: "user", parts: [{ text: message }] }],
  };

  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
      if (!text) throw new Error("Gemini returned an empty response.");
      return text;
    }

    const errorBody = await response.json().catch(() => null);

    if (response.status === 429) {
      // Free-tier quota is a per-minute cap — retrying within the same
      // request is pointless, surface a clear message instead.
      throw new Error("The assistant is answering questions quickly right now — try again in about a minute.");
    }

    lastError = new Error(errorBody?.error?.message || `Gemini request failed (${response.status})`);

    if (response.status === 503 && attempt < MAX_ATTEMPTS) {
      await sleep(attempt * 1500);
      continue;
    }
    throw lastError;
  }
  throw lastError;
}
