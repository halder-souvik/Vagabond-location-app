import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const isESM = typeof import.meta !== "undefined" && !!import.meta.url;
const myFilename = isESM ? fileURLToPath(import.meta.url) : __filename;
const myDirname = isESM ? path.dirname(myFilename) : __dirname;

const app = express();
const PORT = 3000;

// Increase request size limit to handle base64 images and audio notes
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Google GenAI Client safely on the server side
// The User-Agent header is set to 'aistudio-build' as required by instructions.
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper: Extract mimeType and raw base64 data from a Data URI
function parseBase64DataURI(dataURI: string): { data: string; mimeType: string } {
  const matches = dataURI.match(/^data:([^;]+);base64,(.+)$/);
  if (matches && matches.length === 3) {
    return {
      mimeType: matches[1],
      data: matches[2],
    };
  }
  return {
    mimeType: "application/octet-stream",
    data: dataURI,
  };
}

// API Route: Transcribe voice recording via Gemini
app.post("/api/gemini/transcribe", async (req, res) => {
  try {
    const { audioBase64 } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: "Missing audioBase64 data" });
    }

    const { data, mimeType } = parseBase64DataURI(audioBase64);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: data,
          },
        },
        "You are an expert audio transcription assistant. Transcribe this speech recording precisely and return only the transcript. Do not add metadata, explanations, introductions, or pleasantries. If there is no speech, return an empty string.",
      ],
    });

    res.json({ text: response.text || "" });
  } catch (error: any) {
    console.error("Transcription error on server:", error);
    res.status(500).json({ error: error.message || "Failed to transcribe audio" });
  }
});

// API Route: OCR and extract structural fields from receipts or ticket images
app.post("/api/gemini/parse-receipt", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Missing imageBase64 data" });
    }

    const { data, mimeType } = parseBase64DataURI(imageBase64);

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: data,
          },
        },
        `Analyze this receipt, bill, invoice, or ticket booking image. Extract structural expense details and return a valid JSON object matching the schema below. 
        Ensure you only return raw JSON, and no other markdown formatting like \`\`\`json.
        
        Schema:
        {
          "merchant": "Name of the merchant, restaurant, store, hotel or airline. Keep it short and readable.",
          "amount": 12.34, // float representing total price, or 0 if not found
          "currency": "3-letter currency code, e.g. USD, EUR, INR, GBP, JPY. Default to USD if unsure.",
          "date": "YYYY-MM-DD format (or empty string if not found)",
          "category": "One of: food, transport, accommodation, activities, shopping, other",
          "notes": "Brief bulleted summary of items purchased, booking ref, or booking dates"
        }`,
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const resultText = response.text || "{}";
    const parsed = JSON.parse(resultText.trim());
    res.json(parsed);
  } catch (error: any) {
    console.error("Receipt parsing error on server:", error);
    res.status(500).json({ error: error.message || "Failed to parse receipt" });
  }
});

// API Route: Plan optimized day-by-day itineraries using selected locations
app.post("/api/gemini/generate-itinerary", async (req, res) => {
  try {
    const { locations, tripDetails } = req.body;
    if (!locations || !Array.isArray(locations)) {
      return res.status(400).json({ error: "Missing locations array" });
    }

    const locList = locations
      .map((l, index) => {
        return `${index + 1}. "${l.name}" at address: ${l.address || "No address log"}. Coordinates: [${l.latitude}, ${l.longitude}]. Notes: ${l.notes || "None"}. Tags: ${l.tags.join(", ") || "None"}`;
      })
      .join("\n");

    const durationDays = tripDetails
      ? Math.max(1, Math.ceil((new Date(tripDetails.endDate).getTime() - new Date(tripDetails.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)
      : 3;

    const prompt = `You are an expert local guide and travel router. Your goal is to design a highly practical and inspiring day-by-day travel itinerary for a ${durationDays}-day trip titled "${tripDetails?.name || "My Explorer Journey"}" (${tripDetails?.description || "No description provided"}).

Here are the pinned locations we want to visit:
${locList}

Analyze these locations. Optimize their order of visits logically to minimize travel time (e.g., cluster geographically proximate locations on the same day).
For each day of the itinerary, provide:
1. An inspiring daily title or theme.
2. A chronologically sequenced list of places to visit with suggested timing (e.g., 09:00 AM - 11:30 AM).
3. A brief, descriptive activity paragraph highlighting what to see or do there, optionally referencing the user's notes or tags.
4. Estimated transit suggestions between the locations (e.g., walking, metro, taxi duration).
5. A concluding section with 'Pro-Explorer Tips' specific to these pins.

Format your response in beautiful, highly readable markdown with crisp headers, bullets, and bold markers. Make it look like a professional, bespoke travel catalog.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ itinerary: response.text || "" });
  } catch (error: any) {
    console.error("Itinerary generation error on server:", error);
    res.status(500).json({ error: error.message || "Failed to generate itinerary" });
  }
});

// Integration of Vite middleware for full-stack capability
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Vagabond Server] running on http://localhost:${PORT}`);
  });
}

startServer();
