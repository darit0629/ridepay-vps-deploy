import { useRef, useState } from "react";
import { Check, Upload, RotateCcw, FileText } from "lucide-react";
import { resizeImageToDataUrl } from "@/lib/imageCompression";
import { trpc } from "@/providers/trpc";
import { DOCUMENT_LABELS, requiredDocumentsFor, type DocumentKey, type OnboardingData } from "./onboardingTypes";

interface Props {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

function DocumentCard({
  docKey, url, onUploaded,
}: { docKey: DocumentKey; url: string | undefined; onUploaded: (url: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const uploadDocumentMutation = trpc.driver.uploadDocument.useMutation();

  const isSelfie = docKey === "selfie";

  const handlePick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const dataUrl = await resizeImageToDataUrl(file, 1400);
      await uploadDocumentMutation.mutateAsync({ type: docKey, url: dataUrl });
      onUploaded(dataUrl);
    } catch {
      setError("Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${url ? "bg-[#138808]/15" : "bg-white/5"}`}>
          {url ? <Check className="w-5 h-5 text-[#138808]" /> : <FileText className="w-5 h-5 text-white/40" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{DOCUMENT_LABELS[docKey]}</p>
          <p className="text-xs text-white/50">{uploading ? "Uploading…" : url ? "Uploaded" : "Not uploaded yet"}</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-shrink-0 disabled:opacity-50 ${
            url ? "bg-white/10 text-white" : "bg-[#FF6B00] text-white"
          }`}
        >
          {url ? <RotateCcw className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
          {url ? "Replace" : "Upload"}
        </button>
      </div>
      {url && (
        <img src={url} alt={DOCUMENT_LABELS[docKey]} className="w-full h-28 object-cover rounded-xl mt-3" />
      )}
      {error && <p className="text-xs text-[#FF6B6B] mt-2">{error}</p>}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture={isSelfie ? "user" : "environment"}
        className="hidden"
        onChange={(e) => handlePick(e.target.files?.[0])}
      />
    </div>
  );
}

export default function StepDocuments({ data, update }: Props) {
  const required = requiredDocumentsFor(data.vehicleType);
  const uploadedCount = required.filter((k) => !!data.documents[k]).length;

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-1">Upload Documents</h2>
      <p className="text-white/50 text-sm mb-1">Clear photos of each document help you get verified faster</p>
      <p className="text-xs font-semibold text-[#FF6B00] mb-4">{uploadedCount} of {required.length} uploaded</p>

      {required.map((docKey) => (
        <DocumentCard
          key={docKey}
          docKey={docKey}
          url={data.documents[docKey]}
          onUploaded={(url) => update("documents", { ...data.documents, [docKey]: url })}
        />
      ))}
    </div>
  );
}
