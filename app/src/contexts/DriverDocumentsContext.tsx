import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { initialDriverDocuments, type DriverDocument, type DocStatus } from "@/lib/mockDriverDocuments";

interface DriverDocumentsContextType {
  documents: DriverDocument[];
  setDocumentStatus: (label: string, status: DocStatus) => void;
  hasExpiringDocs: boolean;
  hasPendingDocs: boolean;
}

const DriverDocumentsContext = createContext<DriverDocumentsContextType | undefined>(undefined);

export function DriverDocumentsProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<DriverDocument[]>(initialDriverDocuments);

  const setDocumentStatus = (label: string, status: DocStatus) => {
    setDocuments((prev) => prev.map((d) => (d.label === label ? { ...d, status } : d)));
  };

  const hasExpiringDocs = useMemo(() => documents.some((d) => d.status === "expiring"), [documents]);
  const hasPendingDocs = useMemo(() => documents.some((d) => d.status === "pending"), [documents]);

  return (
    <DriverDocumentsContext.Provider value={{ documents, setDocumentStatus, hasExpiringDocs, hasPendingDocs }}>
      {children}
    </DriverDocumentsContext.Provider>
  );
}

export function useDriverDocuments() {
  const context = useContext(DriverDocumentsContext);
  if (context === undefined) {
    throw new Error("useDriverDocuments must be used within a DriverDocumentsProvider");
  }
  return context;
}
