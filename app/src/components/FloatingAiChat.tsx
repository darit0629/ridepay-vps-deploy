import { useEffect, useRef, useState } from "react";
import { X, Send, Sparkles, Phone, Mic } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { isVoiceBookingSupported, listenOnce, VOICE_LANGUAGES, type VoiceLanguage } from "@/lib/voiceBooking";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

const GREETING: ChatMessage = {
  role: "model",
  text: "Hi, I'm Wingman! Tell me where you want to go — by typing or by voice, in English, हिंदी, or বাংলা — and I'll book it, or ask me anything about your rides.",
};

// The model is instructed to end a reply with a line like "BOOK_RIDE: City
// Hospital" whenever the user asked to be booked a ride — this pulls that
// line out so it can drive the actual booking instead of being shown as text.
const BOOK_RIDE_PATTERN = /\n?BOOK_RIDE:\s*(.+)\s*$/i;

function extractBookingIntent(reply: string): { text: string; destination: string | null } {
  const match = reply.match(BOOK_RIDE_PATTERN);
  if (!match) return { text: reply, destination: null };
  return { text: reply.slice(0, match.index).trim(), destination: match[1].trim() };
}

interface FloatingAiChatProps {
  open: boolean;
  onClose: () => void;
  onBookRide?: (destination: string) => void;
}

export default function FloatingAiChat({ open, onClose, onBookRide }: FloatingAiChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [voiceLang, setVoiceLang] = useState<VoiceLanguage>("en-IN");
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      const { text, destination } = extractBookingIntent(data.reply);
      setMessages((prev) => [...prev, { role: "model", text }]);
      if (destination) onBookRide?.(destination);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "Sorry, something went wrong. Please try again or call our helpline at 100." },
      ]);
    },
  });

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatMutation.isPending, open]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || chatMutation.isPending) return;

    const history = messages.slice(-10);
    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    chatMutation.mutate({ message: trimmed, history });
  };

  const handleSend = () => sendMessage(input);

  const handleVoiceInput = async () => {
    setVoiceError("");
    setIsListening(true);
    try {
      const transcript = await listenOnce(voiceLang);
      sendMessage(transcript);
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : "Voice input failed");
    } finally {
      setIsListening(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative bg-white dark:bg-[#1E293B] w-full sm:max-w-sm sm:mx-4 sm:my-8 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-white/60 dark:border-white/10 flex flex-col overflow-hidden"
        style={{ height: "min(80vh, 640px)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-[#F3E8FF] dark:bg-[#2D1B4E] flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Wingman</h2>
            <p className="text-xs text-[#138808] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#138808]" /> Online · Your Ridepay AI
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full flex-shrink-0" aria-label="Close chat">
            <X className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#F8F9FA] dark:bg-[#0F172A]">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[#FF6B00] text-white rounded-br-sm"
                    : "bg-white dark:bg-[#1E293B] text-[#1A1A2E] dark:text-[#E5E7EB] shadow-sm rounded-bl-sm"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-[#1E293B] shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>

        {/* Emergency hint */}
        <div className="px-4 pt-2 flex-shrink-0">
          <a href="tel:100" className="flex items-center gap-1.5 text-xs text-[#DC2626] font-medium">
            <Phone className="w-3.5 h-3.5" /> For emergencies, call 100 directly
          </a>
        </div>

        {/* Voice language picker — only shown when speech input is available */}
        {isVoiceBookingSupported && (
          <div className="px-4 pt-2 flex items-center gap-1.5 flex-shrink-0">
            {VOICE_LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setVoiceLang(l.code)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  voiceLang === l.code
                    ? "bg-[#7C3AED] text-white"
                    : "bg-gray-100 dark:bg-white/5 text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                {l.label}
              </button>
            ))}
            {(isListening || voiceError) && (
              <span className={`text-[11px] ${voiceError ? "text-[#DC2626]" : "text-[#7C3AED]"}`}>
                {isListening ? "Listening..." : voiceError}
              </span>
            )}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-100 dark:border-gray-700 p-3 flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type or speak your question..."
            className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-full px-4 py-2.5 text-sm outline-none border border-transparent focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
          />
          {isVoiceBookingSupported && (
            <button
              onClick={handleVoiceInput}
              disabled={isListening || chatMutation.isPending}
              aria-label="Speak your message"
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 ${
                isListening ? "bg-[#DC2626] text-white animate-pulse" : "bg-gray-100 dark:bg-white/5 text-[#6B7280] dark:text-[#9CA3AF] hover:bg-gray-200 dark:hover:bg-white/10"
              }`}
            >
              <Mic className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="w-10 h-10 rounded-full bg-[#FF6B00] flex items-center justify-center flex-shrink-0 disabled:opacity-50 hover:bg-[#E65A00] transition-colors"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
