import { useNavigate } from "react-router";
import { Home } from "lucide-react";
import Vehicle3DPreview from "@/components/Vehicle3DPreview";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex flex-col items-center justify-center px-6">
      <Vehicle3DPreview vehicleType="e-riksha" className="w-24 h-24 mb-6 opacity-50" />
      <h1 className="text-4xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-2">404</h1>
      <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-8">Page not found</p>
      <button
        onClick={() => navigate("/app")}
        className="btn-saffron px-8 py-3 flex items-center gap-2"
      >
        <Home className="w-5 h-5" />
        Go Home
      </button>
    </div>
  );
}
