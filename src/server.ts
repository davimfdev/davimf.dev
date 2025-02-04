import express, { Request, Response } from "express";
import cors from "cors";
import axios from "axios";
import "dotenv/config";

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" })); // Permitir requisições de qualquer lugar (ou restrinja para seu site)

const DISCORD_BOT_TOKEN = "***REMOVED_DISCORD_BOT_TOKEN***";
const USER_ID = "344214477069221888";

interface MessageRequest {
    message: string;
}

app.post("/send-message", async (req: Request<object, object, MessageRequest>, res: Response) => {
    try {
        const { message } = req.body;

        // Criar um canal de DM entre o bot e você
        const dmChannelResponse = await axios.post(
            "https://discord.com/api/v10/users/@me/channels",
            { recipient_id: USER_ID },
            { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
        );

        const channelId = dmChannelResponse.data.id;

        // Enviar mensagem no canal de DM
        await axios.post(
            `https://discord.com/api/v10/channels/${channelId}/messages`,
            { content: message },
            { headers: { Authorization: `Bot ${DISCORD_BOT_TOKEN}` } }
        );

        res.json({ success: true, message: "Mensagem enviada com sucesso!" });
    } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        res.status(500).json({ success: false, message: "Erro ao enviar mensagem" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
