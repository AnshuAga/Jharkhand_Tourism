import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Bot, User, Trash2, Minus, Compass, MapPin, Hotel, Bus, Wallet, Shield, Heart, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const welcomeMessage = {
  sender: 'bot',
  text: "Johar! 👋 I'm BIRSA AI.\n\nI can help you explore Jharkhand, plan trips, discover destinations, find tourist transport, understand bookings, and answer questions about your journey.\n\nWhat would you like to explore?"
};
const quickActions = [
  ['Plan My Trip', 'Plan a Jharkhand trip for me', Compass],
  ['Explore Destinations', 'Show me destinations in Jharkhand', MapPin],
  ['Find Accommodation', 'Find accommodation options in Jharkhand', Hotel],
  ['Live Transit', 'Show me live transport and route guidance', Bus],
  ['Budget Planner', 'Help me plan a Jharkhand trip on a budget', Wallet],
  ['Tourist Safety', 'Give me the latest tourist safety guidance', Shield],
  ['My Favorites', 'Show my saved destinations', Heart],
  ['My Bookings', 'Show me my bookings', CalendarDays]
];

export default function AIChatbot() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([{ ...welcomeMessage, timestamp: Date.now() }]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [itineraryContext, setItineraryContext] = useState({});
  const [languagePreference, setLanguagePreference] = useState('auto');
  const requestGeneration = useRef(0);
  const abortController = useRef(null);
  const timedOut = useRef(false);
  const [retryText, setRetryText] = useState('');
  const messagesEndRef = useRef(null);
  const accountKey = token ? (user?.id || user?.email || 'authenticated') : 'anonymous';

  useEffect(() => {
    requestGeneration.current += 1;
    setMessages([{ ...welcomeMessage, timestamp: Date.now() }]);
    setInputValue('');
    setLoading(false);
    setItineraryContext({});
    setLanguagePreference('auto');
  }, [accountKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const clearChat = () => {
    requestGeneration.current += 1;
    abortController.current?.abort();
    setMessages([{ ...welcomeMessage, timestamp: Date.now() }]);
    setInputValue('');
    setLoading(false);
    setItineraryContext({});
    setLanguagePreference('auto');
  };

  const sendMessage = async (event, messageOverride = '') => {
    event?.preventDefault();
    const userMessage = (messageOverride || inputValue).trim();
    if (!userMessage || loading) return;
    const generation = requestGeneration.current;
    abortController.current?.abort();
    const controller = new AbortController();
    abortController.current = controller;
    timedOut.current = false;
    const timeoutMs = Number(import.meta.env.VITE_BIRSA_TIMEOUT_MS) || 90000;
    const timeoutId = window.setTimeout(() => {
      timedOut.current = true;
      controller.abort();
      if (import.meta.env.DEV) console.error(`[BIRSA] Frontend timeout after ${timeoutMs} ms`);
    }, timeoutMs);
    const startedAt = performance.now();
    if (import.meta.env.DEV) console.debug('[BIRSA] Request started');
    const history = messages.map((message) => ({
      role: message.sender === 'user' ? 'user' : 'assistant',
      content: message.text
    }));
    setMessages((previous) => [...previous, { sender: 'user', text: userMessage, timestamp: Date.now() }]);
    setMessages((previous) => [...previous, { sender: 'bot', text: '', timestamp: Date.now(), streaming: true }]);
    setInputValue('');
    setLoading(true);
    try {
      let firstChunkLogged = false;
      await api.chatbot.streamMessage(userMessage, history, {
        signal: controller.signal,
        itineraryContext: { ...itineraryContext, languagePreference },
        onChunk: (chunk) => {
          if (generation !== requestGeneration.current) return;
          if (!firstChunkLogged && import.meta.env.DEV) {
            firstChunkLogged = true;
            console.debug(`[BIRSA] Gemini first response received: ${Math.round(performance.now() - startedAt)} ms`);
          }
          setMessages((previous) => previous.map((message, index) => index === previous.length - 1
            ? { ...message, text: message.text + chunk, streaming: true }
            : message));
        },
        onComplete: (response) => {
          if (generation !== requestGeneration.current) return;
          if (import.meta.env.DEV) {
            console.debug(`[BIRSA] Gemini request completed: ${Math.round(performance.now() - startedAt)} ms`);
            console.debug(`[BIRSA] Total request time: ${Math.round(performance.now() - startedAt)} ms`);
          }
          setMessages((previous) => previous.map((message, index) => index === previous.length - 1
            ? { ...message, text: response.reply || message.text || 'Johar! Please tell me more about your Jharkhand travel plans.', actions: response.actions || [], itineraryContext: response.itineraryContext, streaming: false }
            : message));
          if (response.itineraryContext) setItineraryContext(response.itineraryContext);
        }
      });
    } catch (error) {
      if (error.name === 'AbortError') {
        if (timedOut.current && generation === requestGeneration.current) {
          setRetryText(userMessage);
          setMessages((previous) => [...previous, {
            sender: 'bot',
            text: import.meta.env.DEV
              ? `BIRSA request timed out after ${timeoutMs} ms. Check the backend [BIRSA] logs for the Gemini/API timing and error.`
              : 'Birsa AI is taking longer than expected. Please try again.',
            timestamp: Date.now()
          }]);
        }
        return;
      }
      if (generation === requestGeneration.current) {
        if (import.meta.env.DEV) console.error('[BIRSA] Frontend request error:', error);
        setMessages((previous) => [...previous, {
          sender: 'bot',
          text: import.meta.env.DEV
            ? `BIRSA request failed: ${error.message || 'Unknown error'}`
            : 'I could not reach the tourism assistant right now. Please try again in a moment.',
          timestamp: Date.now()
        }]);
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (generation === requestGeneration.current) setLoading(false);
    }
  };

  const stopResponse = () => {
    requestGeneration.current += 1;
    abortController.current?.abort();
    setLoading(false);
    setMessages((previous) => previous.map((message, index) => index === previous.length - 1
      ? { ...message, streaming: false, text: message.text || 'Response stopped.' }
      : message));
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setIsOpen((open) => !open)} className="flex items-center gap-3 rounded-full border border-amber-300/40 bg-gradient-to-r from-amber-400 to-amber-600 px-5 py-4 font-bold text-slate-950 shadow-2xl shadow-amber-500/20">
          <Sparkles className="h-5 w-5 animate-pulse" />
          <span className="text-xs uppercase tracking-wider">BIRSA AI</span>
        </motion.button>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className={`fixed bottom-24 right-4 z-50 flex w-[calc(100%-2rem)] max-w-md flex-col overflow-hidden rounded-3xl border border-slate-700/80 bg-[#0b1326] shadow-2xl backdrop-blur-2xl ${isMinimized ? 'h-auto' : 'h-[560px]'}`}>
            <div className="flex items-center justify-between border-b border-slate-800 bg-[#070b14]/80 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-400"><Bot className="h-5 w-5" /></div>
                <div><h3 className="font-serif text-sm font-semibold text-white">BIRSA AI</h3><span className="text-[10px] text-amber-400">Your intelligent Jharkhand travel companion</span></div>
              </div>
              <div className="flex items-center gap-1">
                <label className="sr-only" htmlFor="birsa-language">Language</label>
                <select id="birsa-language" value={languagePreference} onChange={(event) => setLanguagePreference(event.target.value)} className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 focus:border-amber-400 focus:outline-none">
                  <option value="auto">Auto</option>
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                </select>
                <button type="button" onClick={clearChat} aria-label="Clear conversation" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800/50 hover:text-white"><Trash2 className="h-4 w-4" /></button>
                <button type="button" onClick={() => setIsMinimized((value) => !value)} aria-label="Minimize chatbot" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800/50 hover:text-white"><Minus className="h-4 w-4" /></button>
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Close chatbot" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800/50 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
            </div>
            {!isMinimized && <>
              <div className="flex-1 space-y-4 overflow-y-auto bg-[#070b14]/40 p-4">
                <div className="space-y-2"><p className="px-1 text-[10px] uppercase tracking-widest text-slate-500">Quick actions</p><div className="flex flex-wrap gap-2">{quickActions.map(([label, prompt, Icon]) => <button key={label} type="button" disabled={loading} onClick={() => sendMessage(null, prompt)} className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-300 hover:border-amber-400/60 hover:text-amber-300 disabled:opacity-50"><Icon className="h-3 w-3 text-amber-400" />{label}</button>)}</div></div>
                {messages.map((message, index) => <div key={`${message.timestamp}-${index}`} className={`flex items-start gap-2.5 ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${message.sender === 'user' ? 'bg-amber-400 text-slate-950' : 'border border-slate-700 bg-slate-800 text-amber-400'}`}>{message.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}</div>
                  <div className="max-w-[78%]"><div className={`rounded-2xl p-3.5 text-xs leading-relaxed ${message.sender === 'user' ? 'rounded-tr-none bg-amber-400 font-medium text-slate-950' : 'rounded-tl-none border border-slate-800 bg-[#0b1326] text-slate-200'}`}>{message.text ? message.text.split('\n').map((line, lineIndex) => <React.Fragment key={lineIndex}>{line}{lineIndex < message.text.split('\n').length - 1 && <br />}</React.Fragment>) : message.streaming ? <span className="text-slate-500">Birsa AI is thinking...</span> : null}<div className={`mt-2 text-[9px] ${message.sender === 'user' ? 'text-slate-700' : 'text-slate-500'}`}>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div></div>{message.actions?.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{message.actions.map((action) => <button key={action.label} type="button" onClick={() => navigate(action.href)} className="rounded-lg border border-amber-400/30 px-2 py-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-400/10">{action.label}</button>)}</div>}</div>
                </div>)}
                {loading && <div className="flex items-center gap-2 pl-9 text-xs text-slate-400"><span className="h-2 w-2 animate-bounce rounded-full bg-amber-400" /><span className="h-2 w-2 animate-bounce rounded-full bg-amber-400 delay-100" /><span className="h-2 w-2 animate-bounce rounded-full bg-amber-400 delay-200" /><span>Birsa AI is thinking...</span><button type="button" onClick={stopResponse} className="ml-2 rounded-md border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:border-amber-400">Stop</button></div>}
                {retryText && !loading && <button type="button" onClick={() => { setInputValue(retryText); setRetryText(''); }} className="ml-9 text-xs font-semibold text-amber-400 hover:text-amber-300">Retry</button>}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-slate-800 bg-[#070b14] p-4">
                <input value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder="Ask BIRSA AI..." className="flex-1 rounded-xl border border-slate-700 bg-[#0b1326] px-4 py-3 text-xs text-slate-100 focus:border-amber-400 focus:outline-none" />
                <button type="submit" disabled={loading} className="shrink-0 rounded-xl bg-amber-400 p-3 text-slate-950 hover:bg-amber-300 disabled:opacity-60"><Send className="h-4 w-4" /></button>
              </form>
            </>}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
