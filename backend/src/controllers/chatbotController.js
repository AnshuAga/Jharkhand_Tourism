import { chatbotService } from '../services/chatbotService.js';
import { randomUUID } from 'crypto';

export const chatbotController = {
  async sendMessage(req, res) {
    const requestId = req.get('x-birsa-request-id') || randomUUID();
    const requestStartedAt = performance.now();
    console.debug(`[BIRSA] REQUEST RECEIVED requestId=${requestId} method=${req.method} path=${req.path}`);
    try {
      const { message, conversationHistory, itineraryContext } = req.body;
      console.debug(`[BIRSA] User message requestId=${requestId}: ${String(message || '').slice(0, 200)}`);
      if (req.body.stream || req.headers.accept?.includes('text/event-stream')) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        let closed = false;
        res.on('close', () => { closed = true; });
        await chatbotService.streamMessage(message, conversationHistory, (event) => {
          if (!closed && !res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
        }, requestId, itineraryContext);
        if (!closed && !res.writableEnded) res.end();
        console.debug(`[BIRSA] Total time requestId=${requestId}: ${Math.round(performance.now() - requestStartedAt)} ms`);
        return;
      }
      const result = await chatbotService.processMessage(message, conversationHistory, req.user?.id || null, 'anon-session', {}, requestId, itineraryContext);
      res.json({
        success: true,
        ...result,
        aiProvider: result.aiProvider || 'database_fallback'
      });
      console.debug(`[BIRSA] Sending response to frontend requestId=${requestId}`);
    } catch (error) {
      console.error(`[BIRSA] REQUEST ERROR requestId=${requestId}`, error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
