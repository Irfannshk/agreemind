import express from "express";
import cors from "cors";
import multer from "multer";
import mammoth from "mammoth";
import { createClient } from "@supabase/supabase-js";
import PDFParser from "pdf2json";

// Supabase Connection
const supabaseUrl = "https://sdxhibfeynyciihaezqu.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkeGhpYmZleW55Y2lpaGFlenF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNzE1ODMsImV4cCI6MjA5ODY0NzU4M30.tslj2N-T1_rkTP75FWbiGMQBapz5uPt9-19vIODcamc";
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
const upload = multer({ storage: multer.memoryStorage() });

// --- GET ALL DOCS ---
app.get("/api/documents", async (req, res) => {
    try {
        const { data, error } = await supabase.from("documents").select("*").order("id", { ascending: false }); 
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- UPLOAD & ANALYZE ---
// --- UPLOAD & ANALYZE ---
app.post("/api/analyze", upload.single("file"), async (req, res) => {
    try {
        let title = req.body.title;
        let contractText = req.body.text || "";

        if (req.file) {
            if (req.file.mimetype === "application/pdf") {
                const pdfParser = new PDFParser();
                contractText = await new Promise((resolve, reject) => {
                    pdfParser.on("pdfParser_dataError", err => reject(err));
                    pdfParser.on("pdfParser_dataReady", pdfData => {
                        resolve(pdfParser.getRawTextContent());
                    });
                    pdfParser.parseBuffer(req.file.buffer);
                });
            } else if (req.file.mimetype.includes("wordprocessingml")) {
                const docData = await mammoth.extractRawText({ buffer: req.file.buffer });
                contractText = docData.value;
            } else {
                contractText = req.file.buffer.toString('utf-8');
            }
        }

        if (!contractText || contractText.length < 50) {
            throw new Error("Document text is too short or unreadable. Try pasting text manually.");
        }

        // --- THE FIXED PROMPT ---
        const prompt = `
You are an expert legal AI. Analyze the provided contract text and extract the requested information.
CRITICAL: Do NOT output my placeholder text like '3-sentence summary' or 'Clause 1'. You must write the ACTUAL summary and extract ACTUAL clauses based on the text below.

STRICT RULES FOR DATES:
1. ONLY extract 'Renewal Date', 'Expiration Date', 'Payment Due', or 'Expiry'.
2. DO NOT extract random signatures, kickoff dates, or review meetings.
3. If no critical dates are found, return an empty array [].

Return ONLY valid JSON in this exact structure:
{
    "title": "Title of the document",
    "category": "Pick one: Service Agreement, SLA, NDA, Employment, Procurement, Lease",
    "summary": "Write a real, highly professional 3-sentence summary of the business deal here.",
    "keyClauses": ["Actual Clause Name 1", "Actual Clause Name 2", "Actual Clause Name 3"],
    "dueDates": [{"date": "YYYY-MM-DD", "task": "Payment Due"}],
    "riskLevel": "Low",
    "riskReason": "Write a real 1-sentence reason for this risk level."
}

Contract Text to Analyze:
${contractText.substring(0, 6000)}
`;

        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama3.2", prompt, stream: false, format: "json" }),
        });

        const aiData = await response.json();
        
        // Robust cleanup to ensure pure JSON
        const cleanJson = aiData.response.replace(/.*?\{/s, "{").replace(/\}[^}]*$/s, "}");
        const parsedResult = JSON.parse(cleanJson);

        const finalTitle = title || parsedResult.title || "Untitled Document";

        const { data, error } = await supabase.from("documents")
            .insert([{ title: finalTitle, raw_text: contractText, ai_data: parsedResult }])
            .select();

        if (error) throw error;
        res.json(data[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// --- DOC-SPECIFIC CHAT ---
app.post("/api/chat", async (req, res) => {
    try {
        const { contractText, contractText2, userMessage } = req.body;
        let contextText = `Contract 1:\n${contractText.substring(0, 4000)}\n`;
        if (contractText2) contextText += `\nContract 2:\n${contractText2.substring(0, 4000)}\n`;

        const prompt = `
You are an expert AI contract lawyer. Answer the user's question based on the contract text.
CRITICAL INSTRUCTION: If the user asks a conceptual question (e.g. "Is this an employment agreement?", "What are the risks?", "Is this good for my business?"), USE YOUR LEGAL EXPERTISE to analyze the text and answer logically. DO NOT say "I cannot find this in the contract." Explain your reasoning based on the clauses present.

Context:
${contextText}

User Question: ${userMessage}
Answer:`;

        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama3.2", prompt, stream: false }),
        });

        const aiData = await response.json();
        res.json({ reply: aiData.response });
    } catch (error) {
        res.status(500).json({ error: "Chat failed" });
    }
});

// --- GLOBAL AI MANAGER CHAT ---
app.post("/api/global-chat", async (req, res) => {
    try {
        const { userMessage, docsSummary } = req.body;
        
        const prompt = `
You are AgreeMind AI, managing a contract database.
Current Documents in Database:
${JSON.stringify(docsSummary)}

User Message: "${userMessage}"

INSTRUCTIONS:
If the user asks to change a document's category or title, output ONLY a JSON object in this exact format:
{ "action": "UPDATE", "id": [matching doc ID], "newTitle": "[new title or old title]", "newCategory": "[new category]" }

If the user is just asking a general question, answer normally as text. Do NOT use JSON if you are answering normally.
`;

        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: "llama3.2", prompt, stream: false }),
        });

        const aiData = await response.json();
        let replyText = aiData.response.trim();

        if (replyText.includes('"action":') && replyText.includes('UPDATE')) {
            try {
                // FIX 2: Markdown-safe regex replacement here as well
                const cleanJson = replyText.replace(/[\`]{3}json/g, "").replace(/[\`]{3}/g, "").trim();
                const cmd = JSON.parse(cleanJson);
                
                if (cmd.action === "UPDATE" && cmd.id) {
                    const { data: existingDoc } = await supabase.from('documents').select('ai_data, title').eq('id', cmd.id).single();
                    
                    if (existingDoc) {
                        const updatedAiData = { ...existingDoc.ai_data, category: cmd.newCategory || existingDoc.ai_data.category };
                        const updatedTitle = cmd.newTitle || existingDoc.title;

                        await supabase.from('documents').update({ title: updatedTitle, ai_data: updatedAiData }).eq('id', cmd.id);
                        return res.json({ reply: `Success! I have updated document #${cmd.id}.`, updated: true });
                    }
                }
            } catch (e) {
                console.error("Failed to parse AI command:", e);
            }
        }

        res.json({ reply: replyText, updated: false });
    } catch (error) {
        res.status(500).json({ error: "Global Chat failed" });
    }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`AgreeMind Server Running on port ${PORT}`));