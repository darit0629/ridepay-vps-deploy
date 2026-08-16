import { useState } from "react";
import { Check, X, FileText } from "lucide-react";
import type { OnboardingData } from "./onboardingTypes";
import { DRIVER_TERMS_CONTENT, type TermsBlock } from "./driverTermsContent";

interface Props {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

const toBlocks = (paragraphs: string[]): TermsBlock[] => paragraphs.map((text) => ({ type: "paragraph", text }));

const DOCS: { key: "acceptedTerms" | "acceptedPrivacy" | "acceptedGuidelines"; title: string; body: TermsBlock[] }[] = [
  {
    key: "acceptedTerms",
    title: "Terms & Conditions",
    body: DRIVER_TERMS_CONTENT,
  },
  {
    key: "acceptedPrivacy",
    title: "Privacy Policy",
    body: toBlocks([
      "RidePay collects your location, trip, and document data to operate the platform, verify your identity, and process payouts.",
      "Your data is shared with riders only as needed to complete a trip (name, vehicle, live location during an active ride).",
      "You can request a copy or deletion of your data at any time from Settings.",
    ]),
  },
  {
    key: "acceptedGuidelines",
    title: "Driver Guidelines",
    body: toBlocks([
      "Keep your vehicle clean and roadworthy, and greet every rider courteously.",
      "Never ask riders to cancel and rebook off-platform, and always follow the in-app route unless the rider requests otherwise.",
      "Report safety incidents immediately through the SOS button or Support.",
    ]),
  },
];

export default function StepTerms({ data, update }: Props) {
  const [openDoc, setOpenDoc] = useState<(typeof DOCS)[number] | null>(null);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-1">Terms & Agreement</h2>
      <p className="text-white/50 text-sm mb-4">Please review and accept to continue</p>

      {DOCS.map((doc) => {
        const checked = data[doc.key];
        return (
          <div key={doc.key} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4 flex items-center gap-3">
            <button
              onClick={() => update(doc.key, !checked)}
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                checked ? "bg-[#FF6B00] border-[#FF6B00]" : "border-white/30"
              }`}
              aria-label={`Accept ${doc.title}`}
            >
              {checked && <Check className="w-4 h-4 text-white" />}
            </button>
            <span className="flex-1 text-sm font-medium">I agree to the {doc.title}</span>
            <button
              onClick={() => setOpenDoc(doc)}
              className="flex items-center gap-1 text-xs font-semibold text-[#FF6B00] flex-shrink-0"
            >
              <FileText className="w-3.5 h-3.5" /> View
            </button>
          </div>
        );
      })}

      {openDoc && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end" onClick={() => setOpenDoc(null)}>
          <div
            className="bg-[#12172A] border-t border-white/10 rounded-t-3xl w-full max-h-[75vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{openDoc.title}</h3>
              <button onClick={() => setOpenDoc(null)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {openDoc.body.map((block, i) => {
                if (block.type === "heading") {
                  return (
                    <h4 key={i} className="text-sm font-bold text-white pt-3 first:pt-0">{block.text}</h4>
                  );
                }
                if (block.type === "bullets") {
                  return (
                    <ul key={i} className="list-disc pl-5 space-y-1">
                      {block.items.map((item, j) => (
                        <li key={j} className="text-sm text-white/70 leading-relaxed">{item}</li>
                      ))}
                    </ul>
                  );
                }
                if (block.type === "table") {
                  return (
                    <div key={i} className="overflow-x-auto rounded-xl border border-white/10">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-white/5">
                            {block.headers.map((header, j) => (
                              <th key={j} className="text-left font-semibold text-white/80 px-3 py-2">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row, j) => (
                            <tr key={j} className="border-t border-white/10">
                              {row.map((cell, k) => (
                                <td key={k} className="text-white/70 px-3 py-2">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }
                return <p key={i} className="text-sm text-white/70 leading-relaxed">{block.text}</p>;
              })}
            </div>
            <button
              onClick={() => { update(openDoc.key, true); setOpenDoc(null); }}
              className="w-full bg-[#FF6B00] text-white font-semibold py-3.5 rounded-2xl mt-6"
            >
              I Agree
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
