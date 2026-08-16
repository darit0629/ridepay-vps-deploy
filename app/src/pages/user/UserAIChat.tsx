import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Send, Sparkles, Phone } from "lucide-react";
import { trpc } from "@/providers/trpc";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

const GREETING: ChatMessage = {
  role: "model",
  text: "Hi, I'm Wingman! Ask me about bookings, cancellations, refunds, fares, or anything else - I'm here to help.",
};

export default function UserAIChat() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "model", text: data.reply }]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        { role: "model", text: "Sorry, something went wrong. Please try again or call our helpline at 100." },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, chatMutation.isPending]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;

    const history = messages.slice(-10);
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    chatMutation.mutate({ message: text, history });
  };

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0F172A]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm z-10">
        <button onClick={() => navigate("/user/support")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <div className="w-9 h-9 rounded-full bg-[#F3E8FF] dark:bg-[#2D1B4E] flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-[#7C3AED]" />
        </div>
        <div>
          <h1 className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Wingman</h1>
          <p className="text-xs text-[#138808]">Online · Your Ridepay AI</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
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
      <div className="px-4 pb-2">
        <a href="tel:100" className="flex items-center gap-1.5 text-xs text-[#DC2626] font-medium">
          <Phone className="w-3.5 h-3.5" /> For emergencies, call 100 directly
        </a>
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-[#1E293B] border-t border-gray-100 dark:border-gray-700 p-3 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type your question..."
          className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB] rounded-full px-4 py-2.5 text-sm outline-none border border-transparent focus:border-[#FF6B00]"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || chatMutation.isPending}
          className="w-10 h-10 rounded-full bg-[#FF6B00] flex items-center justify-center flex-shrink-0 disabled:opacity-50 hover:bg-[#E65A00] transition-colors"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}
