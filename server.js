const express = require('express');
const multer = require('multer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// --- CHAVES ---
const GOOGLE_KEY = 'AIzaSyAoc7NduDkdJgdpZZCK-QxqEgQbBSeDolI'; 
const GROQ_KEY = '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';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ storage: multer.memoryStorage() });

console.log("🤖 Servidor 'Brute Force' Iniciado...");

// Lista de TODOS os modelos de visão possíveis do Google (ele vai testar um por um)
const GOOGLE_MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-001",
    "gemini-1.5-pro",
    "gemini-1.5-pro-latest",
    "gemini-1.5-pro-001",
    "gemini-pro-vision"
];

// Função que tenta conectar no Google insistente
async function forceGoogleVision(file, body) {
    const base64Image = file.buffer.toString('base64');
    
    // Define a instrução de tamanho
    let tamanhoInstrucao = "Tamanho médio (um parágrafo)";
    if (body.tamanho === "curta") tamanhoInstrucao = "MUITO CURTA (máximo 2 frases impactantes)";
    if (body.tamanho === "longa") tamanhoInstrucao = "LONGA (Storytelling, conte uma história detalhada, use parágrafos)";

    const prompt = `Aja como especialista em Instagram.
    Analise a imagem visualmente (cores, objetos, sentimento).
    Crie uma legenda para o Nicho: ${body.nicho}.
    Objetivo: ${body.objetivo}.
    Tom de voz: ${body.tom}.
    Comprimento: ${tamanhoInstrucao}.
    
    Regras: Use emojis, quebra de linha e 5 hashtags.`;

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: file.mimetype, data: base64Image } }
            ]
        }]
    };

    // LOOP DA FORÇA BRUTA
    for (const modelName of GOOGLE_MODELS) {
        console.log(`👉 Tentando modelo: ${modelName}...`);
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GOOGLE_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                // Se der erro, joga para o catch e tenta o próximo
                throw new Error(data.error?.message || "Erro desconhecido");
            }

            console.log(`✅ SUCESSO! Conectado com ${modelName}`);
            return data.candidates[0].content.parts[0].text; // Retorna a legenda e sai do loop

        } catch (error) {
            console.log(`❌ Falha no ${modelName}. Tentando próximo...`);
        }
    }
    
    throw new Error("NENHUM modelo do Google aceitou a chave.");
}

// Função Backup (Groq Texto)
async function tryGroqText(body) {
    console.log("⚠️ Ativando Groq Llama 3.3 (Modo Texto)...");
    
    let tamanhoInstrucao = "média";
    if (body.tamanho === "curta") tamanhoInstrucao = "curta (2 frases)";
    if (body.tamanho === "longa") tamanhoInstrucao = "longa e detalhada";

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${GROQ_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "Expert em Instagram." },
                { role: "user", content: `Crie uma legenda ${tamanhoInstrucao} para Instagram. Nicho: ${body.nicho}, Objetivo: ${body.objetivo}, Tom: ${body.tom}. Use emojis e hashtags.` }
            ]
        })
    });
    const data = await response.json();
    return data.choices[0].message.content;
}


app.post('/api/gerar-legenda', upload.single('image'), async (req, res) => {
    console.log("\n1️⃣ PEDIDO RECEBIDO.");

    if (!req.file) return res.status(400).json({ error: 'Sem imagem.' });

    try {
        // Tenta forçar a visão do Google com a lista de modelos
        const legenda = await forceGoogleVision(req.file, req.body);
        return res.json({ success: true, legenda: legenda });

    } catch (e) {
        console.log(`🔥 Google falhou totalmente. Motivo: ${e.message}`);
        
        // Se falhar todos, usa o Backup de Texto da Groq
        try {
            const legendaBackup = await tryGroqText(req.body);
            return res.json({ success: true, legenda: legendaBackup });
        } catch (errBackup) {
            // Se até a Groq falhar, usa local
            res.json({ success: true, legenda: `🚀 Post incrível para ${req.body.nicho}!\n\nConfira essa novidade.\n\n#${req.body.nicho}` });
        }
    }
});

app.listen(port, () => {
    console.log(`✅ Servidor 'Força Bruta' rodando na porta ${port}`);
});