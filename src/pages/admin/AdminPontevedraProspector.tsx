import React, { useState, useEffect } from "react";
import {
  HardHat,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Phone,
  Mail,
  Globe,
  MapPin,
  Star,
  Award,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Clock,
  Send,
  MessageSquare,
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  UserCheck,
  Building2,
  Layers,
  FileCheck2,
  SlidersHorizontal,
  Info,
  Calendar,
  Zap,
  Database,
  UploadCloud,
  DownloadCloud,
  Trash2,
  UserX,
  Bot,
  FileText,
  Download,
  Copy,
  Smartphone,
  CheckSquare,
} from "lucide-react";
import { adminFetch } from "../../lib/apiAuth";
import {
  LeadRanking,
  DigitalAudit,
  BusinessSignal,
  PainPoint,
  Score,
  ScoreHistory,
  Outreach,
  LeadStatus,
  OutreachChannel,
  OutreachOutcome,
} from "../../types/prospector";
import { TestCaseResult } from "../../lib/prospector/testCases";

export interface TelegramProposalData {
  leadId: string;
  businessName: string;
  municipality: string;
  primaryCategory: string;
  appInitials: string;
  appName: string;
  appTagline: string;
  assistantTitle: string;
  assistantSubtitle: string;
  assistantDescription: string;
  sampleInputPlaceholder: string;
  catalogItemsCount: number;
  quickExamples: Array<{ title: string; description: string }>;
  tabs: string[];
  keyBenefits: string[];
  emailSubject: string;
  emailBody: string;
  generatedAt: string;
}

export default function AdminPontevedraProspector() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "discovery" | "top100" | "all" | "tests">("dashboard");
  const [stats, setStats] = useState<any>(null);
  const [leads, setLeads] = useState<LeadRanking[]>([]);
  const [top100, setTop100] = useState<LeadRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<{
    business: LeadRanking;
    audit: DigitalAudit | null;
    signals: BusinessSignal[];
    painPoints: PainPoint[];
    score: Score | null;
    scoreHistory: ScoreHistory[];
    leadStatus: { status: LeadStatus; priority: string; notes?: string; next_action?: string; next_action_date?: string };
    outreachLogs: Outreach[];
    rgpdCompliance?: { legalBasis: string; source: string; isOptOut: boolean; optOutDate: string | null };
  } | null>(null);

  // Propuesta Comercial & Maqueta MiniApp Telegram
  const [proposal, setProposal] = useState<TelegramProposalData | null>(null);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalEmailTarget, setProposalEmailTarget] = useState("");
  const [proposalSendingEmail, setProposalSendingEmail] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [proposalActiveSubtab, setProposalActiveSubtab] = useState<"mockup" | "email" | "pdf">("mockup");
  const [mockupInputText, setMockupInputText] = useState("");

  // Filtros de listado
  const [filterMun, setFilterMun] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSize, setFilterSize] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Discovery Form State (100% Datos Reales)
  const [discoveryMun, setDiscoveryMun] = useState("Vigo");
  const [discoveryCat, setDiscoveryCat] = useState("Reformas Integrales");
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [discoveryProvider, setDiscoveryProvider] = useState<"SERPAPI_MAPS" | "GOOGLE_PLACES" | "SUPABASE_DB">("SERPAPI_MAPS");
  const [autoSyncToSupabase, setAutoSyncToSupabase] = useState(true);
  const [discoveryResult, setDiscoveryResult] = useState<any>(null);

  // CRM Outreach Modal Form State
  const [outreachChannel, setOutreachChannel] = useState<OutreachChannel>("PHONE");
  const [outreachAction, setOutreachAction] = useState("Llamada de prospección");
  const [outreachOutcome, setOutreachOutcome] = useState<OutreachOutcome>("ANSWERED");
  const [outreachNotes, setOutreachNotes] = useState("");

  // Test suite state
  const [testSuite, setTestSuite] = useState<{ total: number; passed: number; failed: number; results: TestCaseResult[] } | null>(null);

  // Notificaciones feedback
  const [toast, setToast] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  const showToast = (msg: string, type: "success" | "error" | "info" = "success") => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, leadsRes, topRes] = await Promise.all([
        adminFetch("/api/pontevedra-prospector/stats"),
        adminFetch(`/api/pontevedra-prospector/leads?search=${encodeURIComponent(searchQuery)}&municipality=${encodeURIComponent(filterMun)}&category=${encodeURIComponent(filterCat)}&tier=${encodeURIComponent(filterTier)}&status=${encodeURIComponent(filterStatus)}&size=${encodeURIComponent(filterSize)}`),
        adminFetch("/api/pontevedra-prospector/top-100"),
      ]);

      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats(d.data);
      }
      if (leadsRes.ok) {
        const d = await leadsRes.json();
        setLeads(d.data || []);
      }
      if (topRes.ok) {
        const d = await topRes.json();
        setTop100(d.data || []);
      }
    } catch (err: any) {
      console.error("Error cargando prospector:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterMun, filterCat, filterTier, filterStatus, filterSize, searchQuery]);

  const loadLeadDetail = async (id: string) => {
    setSelectedLeadId(id);
    setSelectedLeadDetail(null);
    setProposal(null);
    setMockupInputText("");
    try {
      const res = await adminFetch(`/api/pontevedra-prospector/leads/${id}`);
      if (res.ok) {
        const d = await res.json();
        setSelectedLeadDetail(d.data);
        if (d.data?.business?.email) {
          setProposalEmailTarget(d.data.business.email);
        }
      }

      // Intentar cargar propuesta ya generada anteriormente
      try {
        const propRes = await adminFetch(`/api/pontevedra-prospector/leads/${id}/proposal`);
        if (propRes.ok) {
          const propData = await propRes.json();
          if (propData?.data) {
            setProposal(propData.data);
            setMockupInputText(propData.data.sampleInputPlaceholder || "");
          }
        }
      } catch {
        // Es normal si aún no se ha generado
      }
    } catch (err: any) {
      showToast("Error cargando detalle del lead", "error");
    }
  };

  const handleGenerateProposal = async (leadId: string) => {
    setProposalLoading(true);
    try {
      const res = await adminFetch(`/api/pontevedra-prospector/leads/${leadId}/generate-proposal`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.data) {
        setProposal(data.data);
        setMockupInputText(data.data.sampleInputPlaceholder || "");
        if (selectedLeadDetail?.business?.email) {
          setProposalEmailTarget(selectedLeadDetail.business.email);
        }
        showToast("¡Propuesta y maqueta de MiniApp generadas con éxito!");
      } else {
        showToast(data.error || "Error al generar la propuesta", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Error al comunicarse con el generador", "error");
    } finally {
      setProposalLoading(false);
    }
  };

  const handleDownloadProposalPdf = (leadId: string) => {
    window.open(`/api/pontevedra-prospector/leads/${leadId}/proposal-pdf`, "_blank");
  };

  const handleSendProposalEmail = async (leadId: string) => {
    if (!proposalEmailTarget || !proposalEmailTarget.includes("@")) {
      showToast("Por favor, introduce una dirección de correo válida.", "error");
      return;
    }
    setProposalSendingEmail(true);
    try {
      const res = await adminFetch(`/api/pontevedra-prospector/leads/${leadId}/send-proposal-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: proposalEmailTarget,
          customSubject: proposal?.emailSubject,
          customBody: proposal?.emailBody,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Correo oficial con dossier PDF enviado a ${proposalEmailTarget}.`);
        loadLeadDetail(leadId); // Actualiza historial de CRM
      } else {
        showToast(data.error || "Error enviando correo de propuesta", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Error al enviar correo", "error");
    } finally {
      setProposalSendingEmail(false);
    }
  };

  const handleCopySubject = () => {
    if (proposal?.emailSubject) {
      navigator.clipboard.writeText(proposal.emailSubject);
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
      showToast("Asunto copiado al portapapeles");
    }
  };

  const handleCopyBody = () => {
    if (proposal?.emailBody) {
      navigator.clipboard.writeText(proposal.emailBody);
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
      showToast("Cuerpo del correo copiado al portapapeles");
    }
  };

  const handleRunDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setDiscoveryResult(null);
    try {
      const res = await adminFetch("/api/pontevedra-prospector/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          municipality: discoveryMun,
          category: discoveryCat,
          query: discoveryQuery,
          provider: discoveryProvider,
          autoSyncToSupabase,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDiscoveryResult(data.data);
        showToast(
          `Discovery finalizado: ${data.data.newBusinesses} nuevos leads verificados.${
            data.data.syncedToSupabase > 0 ? ` (${data.data.syncedToSupabase} volcados a Supabase)` : ""
          }`
        );
        loadData();
      } else {
        showToast(data.error || "Error en discovery", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Error al ejecutar discovery", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncToSupabase = async (leadIds?: string[]) => {
    setActionLoading(true);
    try {
      const res = await adminFetch("/api/pontevedra-prospector/sync-supabase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadIds }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          `Sincronización con Supabase completada: ${data.insertedCount} creados, ${data.linkedCount} vinculados.`
        );
        loadData();
        if (selectedLeadId) await loadLeadDetail(selectedLeadId);
      } else {
        showToast(data.error || "Error sincronizando con Supabase", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Error al conectar con Supabase", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportFromSupabase = async () => {
    setActionLoading(true);
    try {
      const res = await adminFetch("/api/pontevedra-prospector/import-from-supabase", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Importación exitosa: ${data.importedCount} comercios evaluados y puntuados.`);
        loadData();
      } else {
        showToast(data.error || "Error importando de Supabase", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePurgeFictitious = async () => {
    if (!confirm("¿Deseas purgar de la memoria cualquier dato sintético o ficticio residual? Solo se conservarán datos 100% reales.")) return;
    setActionLoading(true);
    try {
      const res = await adminFetch("/api/pontevedra-prospector/purge-fictitious", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Datos ficticios purgados (${data.purgedCount} eliminados). Base de datos 100% limpia y real.`);
        loadData();
      } else {
        showToast(data.error || "Error purgando datos", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRgpdOptOut = async (leadId: string) => {
    if (!confirm("¿Deseas registrar formalmente la OPOSICIÓN RGPD de este negocio? Se añadirá a la Lista Robinson interna y no volverá a ser prospectado ni contactado.")) return;
    setActionLoading(true);
    try {
      const res = await adminFetch(`/api/pontevedra-prospector/leads/${leadId}/rgpd-optout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Oposición comercial formal según Art. 19 LOPDGDD" }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Oposición RGPD registrada. Lead excluido de cualquier prospección comercial.");
        await loadLeadDetail(leadId);
        loadData();
      } else {
        showToast(data.error || "Error registrando oposición", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAiEnrich = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await adminFetch(`/api/pontevedra-prospector/leads/${id}/ai-enrich`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Lead enriquecido con IA y puntuación recalculada con éxito.");
        await loadLeadDetail(id);
        loadData();
      } else {
        showToast(data.error || "Error en auditoría IA", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: LeadStatus) => {
    try {
      const res = await adminFetch(`/api/pontevedra-prospector/leads/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(`Estado actualizado a ${newStatus}`);
        if (selectedLeadDetail) {
          setSelectedLeadDetail({
            ...selectedLeadDetail,
            leadStatus: { ...selectedLeadDetail.leadStatus, status: newStatus },
          });
        }
        loadData();
      }
    } catch (err: any) {
      showToast("Error actualizando estado", "error");
    }
  };

  const handleLogOutreach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeadId) return;
    setActionLoading(true);
    try {
      const res = await adminFetch(`/api/pontevedra-prospector/leads/${selectedLeadId}/outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: outreachChannel,
          action: outreachAction,
          outcome: outreachOutcome,
          notes: outreachNotes,
        }),
      });
      if (res.ok) {
        showToast("Contacto registrado correctamente en el CRM.");
        setOutreachNotes("");
        await loadLeadDetail(selectedLeadId);
        loadData();
      }
    } catch (err: any) {
      showToast("Error registrando contacto", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecalculateAll = async () => {
    setActionLoading(true);
    try {
      const res = await adminFetch("/api/pontevedra-prospector/recalculate-all", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        showToast(`Puntuaciones recalculadas con éxito (${data.recalculated} leads).`);
        loadData();
      }
    } catch (err: any) {
      showToast("Error al recalcular", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSeedDemo = async () => {
    if (!confirm("¿Deseas restaurar la base de datos de demostración sintética de Pontevedra (22 empresas calibradas)?")) return;
    setActionLoading(true);
    try {
      const res = await adminFetch("/api/pontevedra-prospector/seed-demo", { method: "POST" });
      if (res.ok) {
        showToast("Base de datos de demostración restaurada con éxito.");
        loadData();
      }
    } catch (err: any) {
      showToast("Error restaurando demo", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const runTests = async () => {
    setActionLoading(true);
    try {
      const res = await adminFetch("/api/pontevedra-prospector/test-suite");
      if (res.ok) {
        const d = await res.json();
        setTestSuite(d.data);
      }
    } catch (err: any) {
      showToast("Error ejecutando tests", "error");
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "tests" && !testSuite) {
      runTests();
    }
  }, [activeTab]);

  const getTierBadge = (tier?: string | null) => {
    switch (tier) {
      case "A":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">Tier A (Prioridad Máxima)</span>;
      case "B":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">Tier B (Alta Prioridad)</span>;
      case "C":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">Tier C (Media)</span>;
      case "D":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-800 border border-orange-300">Tier D (Baja)</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">Tier E (Mínima)</span>;
    }
  };

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case "NEW":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Nuevo</span>;
      case "QUALIFIED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">Cualificado</span>;
      case "CONTACTED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Contactado</span>;
      case "INTERESTED":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Interesado</span>;
      case "DEMO":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">Demo</span>;
      case "PROPOSAL":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Propuesta</span>;
      case "CUSTOMER":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-extrabold bg-green-100 text-green-900 border border-green-400">Cliente</span>;
      case "DO_NOT_CONTACT":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">No Contactar</span>;
      case "OPT_OUT_RGPD":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">Oposición RGPD</span>;
      case "BAD_LEAD":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Mal Lead</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{status || "Nuevo"}</span>;
    }
  };

  const pontevedraMunicipalities = [
    "Vigo", "Pontevedra", "Redondela", "Mos", "O Porriño", "Nigrán", "Gondomar",
    "Baiona", "Cangas", "Moaña", "Vilagarcía de Arousa", "Marín", "Sanxenxo",
    "Cambados", "Lalín", "A Estrada", "Tui", "Ponteareas", "Salvaterra de Miño", "Poio", "Bueu"
  ];

  const targetCategories = [
    "Reformas Integrales", "Fontanería", "Electricidad", "Climatización",
    "Albañilería", "Pintura", "Pladur y Escayola", "Carpintería y Ventanas",
    "Tejados y Cubiertas", "Fachadas y Aislamiento", "Cocinas y Baños",
    "Rehabilitación y Piedra", "Cerrajería", "Excavaciones y Hormigón", "Parquet y Tarima"
  ];

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 transition-all ${
          toast.type === "success" ? "bg-emerald-900 text-white border-emerald-700" :
          toast.type === "error" ? "bg-red-900 text-white border-red-700" :
          "bg-slate-900 text-white border-slate-700"
        }`}>
          {toast.type === "success" ? <CheckCircle2 size={20} className="text-emerald-400" /> : <AlertCircle size={20} className="text-rose-400" />}
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}

      {/* Header Principal */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <HardHat size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Pontevedra Construction Prospector</h1>
                <span className="px-2 py-0.5 text-xs font-semibold bg-blue-50 text-blue-700 rounded-md border border-blue-200">
                  Algoritmo v1.0
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Motor determinista B2B para autónomos y microempresas de reformas e instalaciones en la provincia de Pontevedra.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSyncToSupabase()}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300 transition-colors shadow-2xs"
              title="Vuelca y sincroniza todos los leads no asociados a la tabla 'businesses' de Supabase"
            >
              <UploadCloud size={14} className={actionLoading ? "animate-spin" : ""} />
              Volcar a Supabase
            </button>

            <button
              onClick={handleImportFromSupabase}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition-colors"
              title="Importa negocios registrados en Supabase para auditarlos con el algoritmo de scoring"
            >
              <DownloadCloud size={14} />
              Importar de Supabase
            </button>

            <button
              onClick={handlePurgeFictitious}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-lg border border-rose-200 transition-colors"
              title="Elimina cualquier dato sintético de demostración residual garantizando datos 100% reales"
            >
              <Trash2 size={14} />
              Purgar Ficticios
            </button>

            <button
              onClick={handleRecalculateAll}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              title="Recalcula las fórmulas deterministas sobre toda la base sin alterar la lógica"
            >
              <RefreshCw size={14} className={actionLoading ? "animate-spin" : ""} />
              Recalcular Scores
            </button>

            <button
              onClick={() => setActiveTab("discovery")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs"
            >
              <Search size={14} />
              Nueva Búsqueda Discovery
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación del Módulo */}
        <div className="flex border-b border-slate-200 mt-6 -mb-2 space-x-6 overflow-x-auto text-sm font-medium">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "dashboard"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <TrendingUp size={16} />
            Dashboard y Métricas
          </button>

          <button
            onClick={() => setActiveTab("top100")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "top100"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Award size={16} />
            TOP 100 Leads
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-xs rounded-full font-bold">
              {top100.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "all"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Layers size={16} />
            Todos los Leads ({leads.length})
          </button>

          <button
            onClick={() => setActiveTab("discovery")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "discovery"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Search size={16} />
            Discovery & Deduplicación
          </button>

          <button
            onClick={() => setActiveTab("tests")}
            className={`pb-3 border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === "tests"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldCheck size={16} />
            Test Suite (18 Pruebas)
          </button>
        </div>
      </div>

      {/* CONTENIDO DE PESTAÑA: DASHBOARD */}
      {activeTab === "dashboard" && stats && (
        <div className="space-y-6">
          {/* Tarjetas KPI Superiores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Total Negocios</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">{stats.total}</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Pontevedra B2B</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Nuevos Leads</span>
              <span className="text-2xl font-bold text-blue-600 mt-1 block">{stats.newLeads}</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Por calificar</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Tier A (Prioridad)</span>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">{stats.tierA}</span>
              <span className="text-[11px] text-emerald-700 mt-0.5 block">Score ≥ 85</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Tier B (Alta)</span>
              <span className="text-2xl font-bold text-blue-700 mt-1 block">{stats.tierB}</span>
              <span className="text-[11px] text-blue-600 mt-0.5 block">Score 70–84</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Contactados</span>
              <span className="text-2xl font-bold text-indigo-600 mt-1 block">{stats.contacted}</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Llamadas/WA</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Interesados</span>
              <span className="text-2xl font-bold text-amber-600 mt-1 block">{stats.interested}</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Warm leads</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs text-slate-500 block">Demos / Propuestas</span>
              <span className="text-2xl font-bold text-purple-600 mt-1 block">{stats.demos}</span>
              <span className="text-[11px] text-slate-400 mt-0.5 block">En negociación</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs bg-emerald-50/40 border-emerald-200">
              <span className="text-xs text-emerald-800 font-semibold block">Clientes</span>
              <span className="text-2xl font-bold text-emerald-800 mt-1 block">{stats.customers}</span>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">Conversiones</span>
            </div>
          </div>

          {/* Promedios de Scoring Determinista */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Priority Score Medio</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-extrabold text-slate-900">{stats.avgPriorityScore}</span>
                    <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <TrendingUp size={22} />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 border-t border-slate-100 pt-3">
                Fórmula: (Debilidad Digital × 0.45) + (Potencial Comercial × 0.55) + Ajustes ICP.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Digital Weakness Medio (DWS)</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-extrabold text-amber-600">{stats.avgDigitalWeakness}</span>
                    <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                  <Globe size={22} />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 border-t border-slate-100 pt-3">
                Mide la oportunidad de mejora digital (ausencia de web, sin WhatsApp, sin formulario, etc.).
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Commercial Potential Medio (CPS)</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-extrabold text-emerald-600">{stats.avgCommercialPotential}</span>
                    <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Star size={22} />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-3 border-t border-slate-100 pt-3">
                Mide viabilidad económica (reseñas de clientes, rating público, microempresa, sector reformas).
              </p>
            </div>
          </div>

          {/* Distribución por Municipios y Categorías */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <MapPin size={16} className="text-blue-600" />
                Distribución por Municipios de Pontevedra
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {Object.entries(stats.municipalities || {}).map(([mun, count]: any) => (
                  <div key={mun} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-slate-700 font-medium">{mun}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">{count} leads</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <HardHat size={16} className="text-amber-600" />
                Distribución por Oficios y Categorías
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                {Object.entries(stats.categories || {}).map(([cat, count]: any) => (
                  <div key={cat} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-100 last:border-0">
                    <span className="text-slate-700 font-medium">{cat}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">{count} leads</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA: DISCOVERY */}
      {activeTab === "discovery" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Search size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Módulo de Descubrimiento (Discovery Pipeline)</h2>
                <p className="text-xs text-slate-500">
                  Explora nuevos negocios en Pontevedra aplicando filtros normalizadores y deduplicación en 4 niveles.
                </p>
              </div>
            </div>

            <form onSubmit={handleRunDiscovery} className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Municipio de Pontevedra</label>
                <select
                  value={discoveryMun}
                  onChange={e => setDiscoveryMun(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                >
                  {pontevedraMunicipalities.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Categoría / Oficio</label>
                <select
                  value={discoveryCat}
                  onChange={e => setDiscoveryCat(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                >
                  {targetCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fuente / Proveedor de Datos</label>
                <select
                  value={discoveryProvider}
                  onChange={e => setDiscoveryProvider(e.target.value as any)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 font-medium"
                >
                  <option value="SERPAPI_MAPS">Google Maps en Vivo (100% Real - SerpAPI)</option>
                  <option value="GOOGLE_PLACES">Google Places API (Google Cloud + Fallback)</option>
                  <option value="SUPABASE_DB">Base de Datos Supabase (Comercios Registrados)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Consulta personalizada (opcional)</label>
                <input
                  type="text"
                  placeholder="ej. reformas de baños vigo"
                  value={discoveryQuery}
                  onChange={e => setDiscoveryQuery(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 text-slate-900"
                />
              </div>

              <div className="md:col-span-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span>Deduplicación activa: Level 1 (Place ID), Level 2 (Teléfono), Level 3 (Nombre+Municipio), Level 4 (Similitud).</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-emerald-800 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoSyncToSupabase}
                      onChange={e => setAutoSyncToSupabase(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Volcar automáticamente los nuevos leads a la tabla 'businesses' de Supabase</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-xs disabled:opacity-50"
                >
                  {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                  Ejecutar Discovery Real
                </button>
              </div>
            </form>

            {/* Aviso de Cumplimiento RGPD / LOPDGDD */}
            <div className="mt-4 p-3 rounded-xl bg-blue-50/60 border border-blue-200 flex items-start gap-2.5 text-xs text-blue-900">
              <ShieldCheck size={16} className="text-blue-700 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Cumplimiento Legal RGPD & LOPDGDD (Datos 100% Públicos y Reales):</p>
                <p className="text-blue-800 mt-0.5">
                  Prospección comercial B2B amparada en el <span className="font-semibold">Art. 19 de la Ley Orgánica 3/2018 (LOPDGDD)</span> y <span className="font-semibold">Art. 6.1.f RGPD</span> (Interés Legítimo en el ámbito empresarial). Todos los datos se obtienen exclusivamente de perfiles comerciales y fichas públicas de Google Maps. No se incorporan datos de contacto particulares ni datos sintéticos o inventados.
                </p>
              </div>
            </div>

            {/* Resultado de la ejecución de Discovery */}
            {discoveryResult && (
              <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    Resultados de prospección ({discoveryResult.searchRun?.municipality} - {discoveryResult.searchRun?.category})
                  </h4>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                    Proveedor: {discoveryResult.provider}
                  </span>
                </div>

                {discoveryResult.note && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mt-2">
                    {discoveryResult.note}
                  </p>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mt-3">
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="text-xs text-slate-500">Total Encontrados</span>
                    <span className="text-xl font-bold text-slate-800 block">{discoveryResult.totalFound}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-200 bg-emerald-50/30">
                    <span className="text-xs text-emerald-700">Nuevos Leads Reales</span>
                    <span className="text-xl font-bold text-emerald-800 block">+{discoveryResult.newBusinesses}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-200 bg-amber-50/30">
                    <span className="text-xs text-amber-700">Duplicados Filtrados</span>
                    <span className="text-xl font-bold text-amber-800 block">{discoveryResult.duplicates}</span>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-200 bg-blue-50/30">
                    <span className="text-xs text-blue-700">Volcados a Supabase</span>
                    <span className="text-xl font-bold text-blue-800 block">{discoveryResult.syncedToSupabase || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA: TOP 100 LEADS */}
      {activeTab === "top100" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Award className="text-amber-500" size={20} />
                <h2 className="text-base font-bold text-slate-900">TOP 100 Leads Prioritarios</h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Filtrado estricto por <span className="font-semibold text-slate-700">Priority Score DESC</span> con <span className="font-semibold text-slate-700">Confidence Score ≥ 60</span> (excluye malos leads y do-not-contact).
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
              {top100.length} de 100 plazas
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Negocio</th>
                  <th className="px-4 py-3">Municipio</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Reputación</th>
                  <th className="px-4 py-3 text-center">DWS</th>
                  <th className="px-4 py-3 text-center">CPS</th>
                  <th className="px-4 py-3 text-center">Priority</th>
                  <th className="px-4 py-3 text-center">Confianza</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {top100.map((lead, idx) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs font-bold text-slate-400">#{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{lead.name}</div>
                      <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                        {lead.phone ? <span>{lead.phone}</span> : <span className="text-amber-600">Sin teléfono</span>}
                        {lead.synced_to_supabase ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                            <Database size={10} /> Supabase
                          </span>
                        ) : (
                          <button
                            onClick={() => handleSyncToSupabase([lead.id])}
                            title="Volcar individualmente a Supabase"
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                          >
                            <UploadCloud size={10} /> Sync
                          </button>
                        )}
                        {lead.rgpd_opt_out && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-purple-100 text-purple-800 rounded">
                            <UserX size={10} /> Opt-Out
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{lead.municipality}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{lead.primary_category}</td>
                    <td className="px-4 py-3">
                      {lead.rating ? (
                        <div className="flex items-center gap-1 text-xs font-semibold text-slate-800">
                          <Star size={12} className="text-amber-500 fill-amber-500" />
                          <span>{lead.rating}</span>
                          <span className="text-slate-400 font-normal">({lead.review_count})</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Sin reseñas</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-amber-600">
                      {lead.digital_weakness_score}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-bold text-emerald-600">
                      {lead.commercial_potential_score}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-extrabold text-blue-700">
                        {lead.priority_score}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-500">
                      {lead.confidence_score}%
                    </td>
                    <td className="px-4 py-3">{getTierBadge(lead.tier)}</td>
                    <td className="px-4 py-3">{getStatusBadge(lead.lead_status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => loadLeadDetail(lead.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        Ver Detalle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA: TODOS LOS LEADS (CRM) */}
      {activeTab === "all" && (
        <div className="space-y-4">
          {/* Barra de Filtros */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, teléfono o categoría..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full text-sm pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <select
              value={filterMun}
              onChange={e => setFilterMun(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg p-2 bg-white text-slate-700"
            >
              <option value="">Todos los municipios</option>
              {pontevedraMunicipalities.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={filterTier}
              onChange={e => setFilterTier(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg p-2 bg-white text-slate-700"
            >
              <option value="">Todos los Tiers</option>
              <option value="A">Tier A (Prioridad Máxima)</option>
              <option value="B">Tier B (Alta Prioridad)</option>
              <option value="C">Tier C (Media)</option>
              <option value="D">Tier D (Baja)</option>
              <option value="E">Tier E (Mínima)</option>
            </select>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg p-2 bg-white text-slate-700"
            >
              <option value="">Todos los Estados</option>
              <option value="NEW">Nuevo</option>
              <option value="QUALIFIED">Cualificado</option>
              <option value="CONTACTED">Contactado</option>
              <option value="INTERESTED">Interesado</option>
              <option value="DEMO">Demo</option>
              <option value="PROPOSAL">Propuesta</option>
              <option value="CUSTOMER">Cliente</option>
              <option value="DO_NOT_CONTACT">No Contactar</option>
              <option value="OPT_OUT_RGPD">Oposición RGPD</option>
            </select>

            {(filterMun || filterTier || filterStatus || searchQuery) && (
              <button
                onClick={() => {
                  setFilterMun("");
                  setFilterTier("");
                  setFilterStatus("");
                  setSearchQuery("");
                }}
                className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1"
              >
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Tabla de Leads */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Municipio</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Tamaño</th>
                    <th className="px-4 py-3 text-center">DWS</th>
                    <th className="px-4 py-3 text-center">CPS</th>
                    <th className="px-4 py-3 text-center">Priority</th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads.map(lead => (
                    <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{lead.name}</div>
                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-0.5">
                          {lead.phone ? <span>{lead.phone}</span> : <span className="text-amber-600">Sin teléfono</span>}
                          {lead.synced_to_supabase ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                              <Database size={10} /> Supabase
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSyncToSupabase([lead.id])}
                              title="Volcar individualmente a Supabase"
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-600 rounded"
                            >
                              <UploadCloud size={10} /> Sync
                            </button>
                          )}
                          {lead.rgpd_opt_out && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 text-[10px] font-bold bg-purple-100 text-purple-800 rounded">
                              <UserX size={10} /> Opt-Out
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{lead.municipality}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{lead.primary_category}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700">
                        {lead.estimated_size === "SOLO" ? "Autónomo" :
                         lead.estimated_size === "MICRO_2_3" ? "Micro (2-3)" :
                         lead.estimated_size === "SMALL_4_10" ? "Pequeña (4-10)" : "Mediana"}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-xs text-amber-600">
                        {lead.digital_weakness_score}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-xs text-emerald-600">
                        {lead.commercial_potential_score}
                      </td>
                      <td className="px-4 py-3 text-center font-extrabold text-blue-700">
                        {lead.priority_score}
                      </td>
                      <td className="px-4 py-3">{getTierBadge(lead.tier)}</td>
                      <td className="px-4 py-3">{getStatusBadge(lead.lead_status)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => loadLeadDetail(lead.id)}
                          className="px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          Ficha CRM
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO DE PESTAÑA: TEST SUITE & REGLAS */}
      {activeTab === "tests" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="text-emerald-600" size={22} />
                  Suite de Pruebas Unitarias del Motor Determinista (v1.0)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Valida el cumplimiento exacto de las reglas matemáticas exigidas en la especificación (Punto 35).
                </p>
              </div>

              <button
                onClick={runTests}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                <RefreshCw size={14} className={actionLoading ? "animate-spin" : ""} />
                Reejecutar Tests Unitarios
              </button>
            </div>

            {testSuite && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-lg">
                    {testSuite.passed}/{testSuite.total}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-emerald-950">
                      {testSuite.failed === 0 ? "¡Todas las pruebas pasaron satisfactoriamente!" : "Se detectaron fallos en la suite"}
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Normalización de nombres y teléfonos, deduplicación Nivel 1 y los 15 casos clave de scoring determinista.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {testSuite.results.map(test => (
                    <div
                      key={test.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-start justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white ${
                          test.passed ? "bg-emerald-500" : "bg-red-500"
                        }`}>
                          {test.passed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">#{test.id}</span>
                            <span className="text-sm font-bold text-slate-900">{test.name}</span>
                            <span className="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-medium">
                              {test.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{test.description}</p>
                          <div className="flex items-center gap-4 text-xs mt-2 font-mono">
                            <span className="text-slate-500">Esperado: <span className="text-slate-800">{test.expected}</span></span>
                            <span className="text-slate-500">Obtenido: <span className={test.passed ? "text-emerald-700 font-bold" : "text-red-700 font-bold"}>{test.actual}</span></span>
                          </div>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                        test.passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}>
                        {test.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL / DRAWER DE FICHA DETALLE DEL LEAD */}
      {selectedLeadId && selectedLeadDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            {/* Header Modal */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-md p-6 border-b border-slate-200 flex items-start justify-between z-10">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">{selectedLeadDetail.business.name}</h2>
                  {getTierBadge(selectedLeadDetail.score?.tier)}
                  {selectedLeadDetail.business.synced_to_supabase ? (
                    <span className="px-2 py-0.5 text-xs font-bold bg-emerald-100 text-emerald-800 rounded border border-emerald-300 flex items-center gap-1">
                      <Database size={12} /> Sincronizado en Supabase
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSyncToSupabase([selectedLeadDetail.business.id])}
                      disabled={actionLoading}
                      className="px-2.5 py-0.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded border border-blue-200 flex items-center gap-1 transition-colors"
                    >
                      <UploadCloud size={12} /> Volcar a Supabase
                    </button>
                  )}
                  {selectedLeadDetail.business.rgpd_opt_out && (
                    <span className="px-2 py-0.5 text-xs font-bold bg-purple-100 text-purple-900 rounded border border-purple-300 flex items-center gap-1">
                      <UserX size={12} /> Oposición RGPD Activa
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedLeadDetail.business.primary_category} • {selectedLeadDetail.business.municipality} (Pontevedra)
                </p>
              </div>

              <button
                onClick={() => setSelectedLeadId(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Bloque Legal RGPD y Protección de Datos */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                selectedLeadDetail.business.rgpd_opt_out
                  ? "bg-purple-50/80 border-purple-200 text-purple-950"
                  : "bg-slate-50 border-slate-200 text-slate-800"
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <ShieldCheck size={16} className={selectedLeadDetail.business.rgpd_opt_out ? "text-purple-700" : "text-emerald-600"} />
                    <span>Cumplimiento RGPD & Art. 19 LOPDGDD (Datos Comerciales de Acceso Público)</span>
                  </div>
                  <p className="text-slate-600">
                    <span className="font-semibold">Base Legal:</span> {selectedLeadDetail.business.rgpd_legal_basis || "Interés Legítimo B2B (Art. 19 LOPDGDD / Art. 6.1.f RGPD)"} •{" "}
                    <span className="font-semibold">Fuente:</span> Perfil de empresa público en Google Maps
                  </p>
                  {selectedLeadDetail.business.rgpd_opt_out && (
                    <p className="text-purple-800 font-semibold">
                      ⚠️ Este negocio ha ejercido su derecho de oposición. No se debe realizar ninguna acción comercial.
                    </p>
                  )}
                </div>

                {!selectedLeadDetail.business.rgpd_opt_out && (
                  <button
                    onClick={() => handleRgpdOptOut(selectedLeadDetail.business.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-purple-50 text-purple-800 font-semibold border border-purple-300 rounded-lg transition-colors whitespace-nowrap shadow-2xs"
                  >
                    <UserX size={14} />
                    Registrar Oposición (Lista Robinson)
                  </button>
                )}
              </div>
              {/* Resumen Puntuaciones Clave */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl text-center">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block">Priority Score</span>
                  <span className="text-3xl font-extrabold text-blue-900 mt-1 block">
                    {selectedLeadDetail.score?.priority_score}
                  </span>
                  <span className="text-[11px] text-blue-600 mt-0.5 block">0 a 100</span>
                </div>

                <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl text-center">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Digital Weakness</span>
                  <span className="text-3xl font-extrabold text-amber-900 mt-1 block">
                    {selectedLeadDetail.score?.digital_weakness_score}
                  </span>
                  <span className="text-[11px] text-amber-600 mt-0.5 block">Oportunidad Digital</span>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl text-center">
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">Commercial Pot.</span>
                  <span className="text-3xl font-extrabold text-emerald-900 mt-1 block">
                    {selectedLeadDetail.score?.commercial_potential_score}
                  </span>
                  <span className="text-[11px] text-emerald-600 mt-0.5 block">Viabilidad Comercial</span>
                </div>

                <div className="bg-slate-100 border border-slate-200 p-4 rounded-xl text-center">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">Confianza</span>
                  <span className="text-3xl font-extrabold text-slate-800 mt-1 block">
                    {selectedLeadDetail.score?.confidence_score}%
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Fiabilidad de Datos</span>
                </div>
              </div>

              {/* SECCIÓN CRÍTICA: "POR QUÉ ESTÁ AQUÍ" (Explicabilidad total del algoritmo) */}
              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Award size={18} className="text-blue-600" />
                  ¿Por qué ha obtenido esta puntuación? (Explicabilidad Algoritmo v1.0)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Contribuciones Digitales */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
                      Desglose Debilidad Digital (+puntos = oportunidad)
                    </span>
                    {selectedLeadDetail.score?.score_explanation?.digital?.contributions?.length ? (
                      selectedLeadDetail.score.score_explanation.digital.contributions.map((c, i) => (
                        <div key={i} className="flex items-start justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                          <span className="text-slate-700 pr-2">• {c.reason}</span>
                          <span className="font-bold text-amber-600 whitespace-nowrap">+{c.points}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">Sin debilidades digitales destacadas.</p>
                    )}
                  </div>

                  {/* Contribuciones Comerciales y Ajustes */}
                  <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                      Desglose Potencial Comercial & Bonificaciones
                    </span>
                    {selectedLeadDetail.score?.score_explanation?.commercial?.contributions?.map((c, i) => (
                      <div key={i} className="flex items-start justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                        <span className="text-slate-700 pr-2">• {c.reason}</span>
                        <span className="font-bold text-emerald-600 whitespace-nowrap">+{c.points}</span>
                      </div>
                    ))}
                    {selectedLeadDetail.score?.score_explanation?.adjustments?.map((a, i) => (
                      <div key={"adj-" + i} className="flex items-start justify-between text-xs py-1 border-b border-slate-50 last:border-0 font-medium">
                        <span className="text-blue-800 pr-2">★ {a.reason}</span>
                        <span className={`font-bold whitespace-nowrap ${a.points >= 0 ? "text-blue-600" : "text-rose-600"}`}>
                          {a.points > 0 ? `+${a.points}` : a.points}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AUDIT CARD (Presencia Digital) */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Globe size={18} className="text-blue-600" />
                  Auditoría Digital de Presencia Pública
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <span className="font-medium text-slate-700">Sitio Web</span>
                    {selectedLeadDetail.audit?.website_exists ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1"><Check size={14} /> Detectado</span>
                    ) : (
                      <span className="text-red-600 font-bold flex items-center gap-1"><X size={14} /> No existe</span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <span className="font-medium text-slate-700">WhatsApp</span>
                    {selectedLeadDetail.audit?.whatsapp_visible ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1"><Check size={14} /> Visible</span>
                    ) : (
                      <span className="text-amber-600 font-bold flex items-center gap-1"><X size={14} /> No hallado</span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <span className="font-medium text-slate-700">Formulario Presupuesto</span>
                    {selectedLeadDetail.audit?.quote_form ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1"><Check size={14} /> Disponible</span>
                    ) : (
                      <span className="text-rose-600 font-bold flex items-center gap-1"><X size={14} /> Ausente</span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <span className="font-medium text-slate-700">Portfolio Trabajos</span>
                    {selectedLeadDetail.audit?.portfolio_present ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1"><Check size={14} /> Sí</span>
                    ) : (
                      <span className="text-slate-500 font-bold flex items-center gap-1"><HelpCircle size={14} /> Sin portfolio</span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <span className="font-medium text-slate-700">Móvil Optimizado</span>
                    {selectedLeadDetail.audit?.mobile_friendly ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1"><Check size={14} /> Adaptado</span>
                    ) : (
                      <span className="text-slate-500 font-bold flex items-center gap-1"><X size={14} /> No detectado</span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <span className="font-medium text-slate-700">Llamada a la Acción (CTA)</span>
                    {selectedLeadDetail.audit?.cta_present ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1"><Check size={14} /> Presente</span>
                    ) : (
                      <span className="text-slate-500 font-bold flex items-center gap-1"><X size={14} /> Sin CTA clara</span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <span className="font-medium text-slate-700">HTTPS / SSL</span>
                    {selectedLeadDetail.audit?.https_enabled ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-1"><Check size={14} /> Seguro</span>
                    ) : (
                      <span className="text-slate-500 font-bold flex items-center gap-1"><X size={14} /> No / Sin web</span>
                    )}
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <span className="font-medium text-slate-700">Redes Sociales</span>
                    <span className="text-slate-600 font-medium">{selectedLeadDetail.audit?.social_presence_score ?? 0} pts</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-xs">
                    {selectedLeadDetail.business.phone && (
                      <a href={`tel:${selectedLeadDetail.business.phone}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <Phone size={14} /> {selectedLeadDetail.business.phone}
                      </a>
                    )}
                    {selectedLeadDetail.business.website_url && (
                      <a href={selectedLeadDetail.business.website_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <ExternalLink size={14} /> Visitar Web
                      </a>
                    )}
                    {selectedLeadDetail.business.google_maps_url && (
                      <a href={selectedLeadDetail.business.google_maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                        <MapPin size={14} /> Ver en Maps
                      </a>
                    )}
                  </div>

                  <button
                    onClick={() => handleAiEnrich(selectedLeadDetail.business.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold text-xs rounded-lg transition-colors border border-purple-200"
                  >
                    <Sparkles size={14} className={actionLoading ? "animate-spin" : ""} />
                    Reanalizar con Gemini IA
                  </button>
                </div>
              </div>

              {/* SEÑALES DE NEGOCIO (FACT vs INFERENCE) */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-blue-600" />
                  Señales de Negocio Verificadas (Separación Hecho vs Inferencia)
                </h3>

                <div className="space-y-2">
                  {selectedLeadDetail.signals?.length ? (
                    selectedLeadDetail.signals.map(sig => (
                      <div key={sig.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-start justify-between gap-3 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">{sig.signal_code}</span>
                            {sig.signal_kind === "FACT" ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded">
                                HECHO VERIFICADO
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-800 rounded">
                                ESTIMACIÓN / INFERENCIA
                              </span>
                            )}
                            <span className="text-slate-400 font-mono">Confianza: {sig.confidence}%</span>
                          </div>
                          <p className="text-slate-600 mt-1">{sig.evidence}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">Sin señales registradas todavía.</p>
                  )}
                </div>
              </div>

              {/* PUNTOS DE DOLOR / OPORTUNIDADES */}
              {selectedLeadDetail.painPoints?.length > 0 && (
                <div className="bg-amber-50/50 rounded-xl p-5 border border-amber-200">
                  <h3 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                    <Info size={18} className="text-amber-700" />
                    Oportunidades Comerciales Detectadas (Pain Points)
                  </h3>
                  <div className="space-y-2 text-xs">
                    {selectedLeadDetail.painPoints.map(p => (
                      <div key={p.id} className="bg-white p-3 rounded-lg border border-amber-200/70">
                        <div className="font-bold text-amber-800">{p.pain_type}</div>
                        <p className="text-slate-600 mt-0.5">{p.evidence?.description as string || "Oportunidad detectada."}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GENERADOR DE PROPUESTA B2B & MAQUETA MINIAPP TELEGRAM (MODELO OBRACLIMA) */}
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-indigo-500/30 shadow-xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-indigo-500/20">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/30">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-white">
                          Generador de Propuesta & Maqueta MiniApp Telegram
                        </h3>
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full">
                          Arquitectura ObraClima AI
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5 max-w-2xl">
                        Diseña al instante un correo B2B persuasivo y un dossier PDF con la simulación gráfica exacta de su propia MiniApp en Telegram (con catálogo de precios, cotizador por IA y cumplimiento RGPD), adaptado al oficio y dolores detectados en {selectedLeadDetail.business.name}.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleGenerateProposal(selectedLeadDetail.business.id)}
                    disabled={proposalLoading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50 shrink-0"
                  >
                    <Sparkles size={16} className={proposalLoading ? "animate-spin" : ""} />
                    {proposalLoading ? "Generando con Gemini IA..." : proposal ? "Regenerar Propuesta" : "Generar Propuesta y Maqueta"}
                  </button>
                </div>

                {proposalLoading && (
                  <div className="py-12 text-center space-y-3 bg-slate-950/60 rounded-xl border border-indigo-500/20">
                    <Sparkles size={32} className="mx-auto text-blue-400 animate-spin" />
                    <p className="text-sm font-semibold text-white">Analizando debilidades de prospección y estructurando MiniApp...</p>
                    <p className="text-xs text-slate-400">Gemini IA está redactando el correo B2B y configurando el catálogo de {selectedLeadDetail.business.primary_category}...</p>
                  </div>
                )}

                {proposal && !proposalLoading && (
                  <div className="space-y-4">
                    {/* SUB-TABS: MAQUETA / EMAIL / PDF */}
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                      <button
                        onClick={() => setProposalActiveSubtab("mockup")}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          proposalActiveSubtab === "mockup"
                            ? "bg-blue-600 text-white shadow-md"
                            : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <Smartphone size={14} />
                        1. Maqueta Gráfica MiniApp
                      </button>

                      <button
                        onClick={() => setProposalActiveSubtab("email")}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          proposalActiveSubtab === "email"
                            ? "bg-blue-600 text-white shadow-md"
                            : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <Mail size={14} />
                        2. Correo B2B Redactado
                      </button>

                      <button
                        onClick={() => setProposalActiveSubtab("pdf")}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          proposalActiveSubtab === "pdf"
                            ? "bg-blue-600 text-white shadow-md"
                            : "bg-slate-800/80 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <FileText size={14} />
                        3. Dossier PDF para Adjuntar
                      </button>

                      <div className="ml-auto">
                        <button
                          onClick={() => handleDownloadProposalPdf(selectedLeadDetail.business.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md transition-colors"
                        >
                          <Download size={14} />
                          Descargar PDF
                        </button>
                      </div>
                    </div>

                    {/* VISTA 1: MAQUETA VISUAL INTERACTIVA (SIMULADOR TELEGRAM MINIAPP) */}
                    {proposalActiveSubtab === "mockup" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Simulación fiel de la experiencia en Telegram (idéntica a ObraClima AI, personalizada para este cliente):</span>
                          <span className="text-emerald-400 font-medium">100% Funcional sin instalar aplicaciones</span>
                        </div>

                        {/* MARCO DE LA MINIAPP (ESTILO TELEGRAM WEB) */}
                        <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden max-w-2xl mx-auto">
                          {/* BARRA SUPERIOR DE VENTANA TELEGRAM */}
                          <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {/* Avatar con iniciales del cliente */}
                              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                {proposal.appInitials}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-sm text-white">{proposal.appName}</span>
                                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-400/30 rounded">
                                    MiniApp Telegram
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400">{proposal.appTagline}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center gap-1">
                                Telegram Web <ExternalLink size={10} />
                              </span>
                              <button className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
                                <RefreshCw size={14} />
                              </button>
                            </div>
                          </div>

                          {/* CONTENEDOR PRINCIPAL: ASISTENTE INTELIGENTE */}
                          <div className="p-5 space-y-4 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
                            {/* TARJETA DEL ASISTENTE */}
                            <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-xl">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-500/30">
                                  <Sparkles size={20} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-base leading-tight">
                                    {proposal.assistantTitle}
                                  </h4>
                                  <p className="text-xs text-blue-400 font-semibold mt-0.5">
                                    {proposal.assistantSubtitle}
                                  </p>
                                </div>
                              </div>

                              <p className="text-xs text-slate-300 leading-relaxed">
                                {proposal.assistantDescription}
                              </p>

                              {/* SELECTOR ASIGNAR CLIENTE */}
                              <div className="space-y-1.5 pt-1">
                                <div className="flex items-center justify-between text-xs">
                                  <label className="font-bold text-slate-200">Asignar Cliente al Presupuesto:</label>
                                  <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                                    <ShieldCheck size={12} /> RGPD: Datos no viajan a la IA
                                  </span>
                                </div>
                                <div className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-2.5 text-xs text-slate-200 flex items-center justify-between">
                                  <span>Particular / Obra en {selectedLeadDetail.business.municipality} (Cliente Demo)</span>
                                  <span className="text-slate-500 text-[10px]">▼</span>
                                </div>
                              </div>

                              {/* TEXTAREA INTERACTIVA DE PRESUPUESTO */}
                              <div className="space-y-1.5">
                                <textarea
                                  value={mockupInputText}
                                  onChange={e => setMockupInputText(e.target.value)}
                                  rows={3}
                                  className="w-full bg-slate-950/90 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                  placeholder="Describe aquí lo que necesitas presupuestar en lenguaje natural..."
                                />
                              </div>

                              {/* FILA DE CATÁLOGO Y BOTÓN GENERAR */}
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
                                <div className="text-xs text-slate-400">
                                  <span className="font-bold text-slate-200">{proposal.catalogItemsCount}</span> artículos y partidas en catálogo
                                </div>

                                <button
                                  type="button"
                                  onClick={() => showToast("Simulación: Presupuesto generado con IVA y partidas cruzadas")}
                                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                                >
                                  <Send size={14} />
                                  Generar Presupuesto
                                </button>
                              </div>

                              {/* EJEMPLOS RÁPIDOS */}
                              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                                <label className="text-[11px] font-bold text-slate-300">Ejemplos rápidos adaptados:</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {proposal.quickExamples.map((ex, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => setMockupInputText(`${ex.title}: ${ex.description}`)}
                                      className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800/80 border border-slate-800 text-left transition-colors cursor-pointer group"
                                    >
                                      <div className="text-xs font-bold text-amber-300 group-hover:text-amber-200">
                                        {ex.title}
                                      </div>
                                      <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                        {ex.description}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* BARRA DE NAVEGACIÓN INFERIOR (TABS OBRACLIMA) */}
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-1.5 flex items-center justify-around">
                              <button className="flex flex-col items-center py-1 px-2 text-slate-400 hover:text-slate-200 text-[10px]">
                                <FileText size={16} />
                                <span>Presupuestos</span>
                              </button>

                              <button className="flex flex-col items-center py-1 px-2 text-slate-400 hover:text-slate-200 text-[10px]">
                                <FileCheck2 size={16} />
                                <span>Facturas</span>
                              </button>

                              <button className="flex flex-col items-center py-1 px-3 bg-blue-600 text-white rounded-lg text-[10px] font-bold shadow-md shadow-blue-500/20">
                                <Sparkles size={16} />
                                <span>Asistente IA</span>
                              </button>

                              <button className="flex flex-col items-center py-1 px-2 text-slate-400 hover:text-slate-200 text-[10px]">
                                <UserCheck size={16} />
                                <span>Clientes</span>
                              </button>

                              <button className="flex flex-col items-center py-1 px-2 text-slate-400 hover:text-slate-200 text-[10px]">
                                <Layers size={16} />
                                <span>Catálogo</span>
                              </button>

                              <button className="flex flex-col items-center py-1 px-2 text-slate-400 hover:text-slate-200 text-[10px]">
                                <Building2 size={16} />
                                <span>Empresa</span>
                              </button>
                            </div>

                            <p className="text-[10px] text-center text-slate-500 pt-1">
                              @ahorraaivigoasistant_bot • Ecosistema Inteligente de Vigo
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* VISTA 2: CORREO B2B PERSONALIZADO */}
                    {proposalActiveSubtab === "email" && (
                      <div className="space-y-4 bg-slate-950/70 p-5 rounded-xl border border-slate-800">
                        {/* ASUNTO DEL CORREO */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-300">Asunto del Correo Electrónico:</label>
                            <button
                              onClick={handleCopySubject}
                              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                              <Copy size={12} />
                              {copiedSubject ? "¡Copiado!" : "Copiar Asunto"}
                            </button>
                          </div>
                          <input
                            type="text"
                            value={proposal.emailSubject}
                            onChange={e => setProposal({ ...proposal, emailSubject: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* CUERPO DEL CORREO */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-300">Cuerpo del Mensaje (Hiper-personalizado):</label>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={handleCopyBody}
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                              >
                                <Copy size={12} />
                                {copiedBody ? "¡Copiado!" : "Copiar Mensaje"}
                              </button>
                              <a
                                href={`mailto:${encodeURIComponent(proposalEmailTarget)}?subject=${encodeURIComponent(proposal.emailSubject)}&body=${encodeURIComponent(proposal.emailBody)}`}
                                className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                              >
                                <ExternalLink size={12} />
                                Abrir en Cliente de Correo
                              </a>
                            </div>
                          </div>
                          <textarea
                            value={proposal.emailBody}
                            onChange={e => setProposal({ ...proposal, emailBody: e.target.value })}
                            rows={10}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* ENVIAR DIRECTAMENTE POR EMAIL */}
                        <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="w-full sm:w-80">
                            <label className="block text-[11px] text-slate-400 mb-1">Destinatario:</label>
                            <input
                              type="email"
                              value={proposalEmailTarget}
                              onChange={e => setProposalEmailTarget(e.target.value)}
                              placeholder="correo@empresa.com"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white"
                            />
                          </div>

                          <button
                            onClick={() => handleSendProposalEmail(selectedLeadDetail.business.id)}
                            disabled={proposalSendingEmail}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all disabled:opacity-50"
                          >
                            <Send size={14} className={proposalSendingEmail ? "animate-spin" : ""} />
                            {proposalSendingEmail ? "Enviando con PDF adjunto..." : "Enviar Correo con PDF Adjunto"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* VISTA 3: DOSSIER PDF OFICIAL */}
                    {proposalActiveSubtab === "pdf" && (
                      <div className="space-y-4 bg-slate-950/70 p-5 rounded-xl border border-slate-800 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              <FileText size={16} className="text-blue-400" />
                              Página 1: Propuesta Ejecutiva & Diagnóstico
                            </div>
                            <ul className="text-slate-300 space-y-1.5 list-disc list-inside">
                              <li>Membrete oficial de AhorraAI Vigo y datos del lead.</li>
                              <li>Diagnóstico de presencia digital (debilidades y oportunidades).</li>
                              <li>Propuesta de valor de la MiniApp Telegram.</li>
                              <li>4 módulos operativos incluidos en la solución.</li>
                            </ul>
                          </div>

                          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-2">
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              <Smartphone size={16} className="text-cyan-400" />
                              Página 2: Maqueta Gráfica de la MiniApp
                            </div>
                            <ul className="text-slate-300 space-y-1.5 list-disc list-inside">
                              <li>Simulación visual en alta definición del entorno Telegram.</li>
                              <li>Asistente IA adaptado al catálogo y oficio del cliente.</li>
                              <li>Ejemplos reales de su sector y pestañas operativas.</li>
                              <li>Argumentario de por qué Telegram no requiere instalación.</li>
                            </ul>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
                          <p className="text-slate-400 text-xs">
                            Generado en formato nativo A4 vectorial de 2 páginas con codificación segura.
                          </p>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDownloadProposalPdf(selectedLeadDetail.business.id)}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                            >
                              <Download size={14} />
                              Descargar Dossier PDF
                            </button>
                            <button
                              onClick={() => window.open(`/api/pontevedra-prospector/leads/${selectedLeadDetail.business.id}/proposal-pdf`, "_blank")}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl transition-all"
                            >
                              <ExternalLink size={14} />
                              Previsualizar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* CRM & GESTIÓN DE CONTACTO (OUTREACH) */}
              <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Phone size={18} className="text-indigo-600" />
                      Gestión Comercial CRM y Registro de Contactos
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Estado actual: <span className="font-bold">{getStatusBadge(selectedLeadDetail.leadStatus?.status)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-500">Cambiar Estado:</label>
                    <select
                      value={selectedLeadDetail.leadStatus?.status || "NEW"}
                      onChange={e => handleUpdateStatus(selectedLeadDetail.business.id, e.target.value as LeadStatus)}
                      className="text-xs border border-slate-300 rounded-lg p-1.5 font-semibold text-slate-800 bg-white"
                    >
                      <option value="NEW">Nuevo</option>
                      <option value="QUALIFIED">Cualificado</option>
                      <option value="CONTACTED">Contactado</option>
                      <option value="RESPONDED">Respondió</option>
                      <option value="INTERESTED">Interesado</option>
                      <option value="DEMO">Demo Agendada</option>
                      <option value="PROPOSAL">Propuesta Enviada</option>
                      <option value="CUSTOMER">Cliente Ganado</option>
                      <option value="NOT_INTERESTED">No Interesado</option>
                      <option value="BAD_LEAD">Mal Lead</option>
                      <option value="DO_NOT_CONTACT">No Contactar (Opt-out)</option>
                      <option value="OPT_OUT_RGPD">Oposición RGPD</option>
                    </select>
                  </div>
                </div>

                {/* Formulario de registro de interacción */}
                <form onSubmit={handleLogOutreach} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Registrar Nuevo Contacto</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Canal</label>
                      <select
                        value={outreachChannel}
                        onChange={e => setOutreachChannel(e.target.value as any)}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                      >
                        <option value="PHONE">Teléfono Directo</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="EMAIL">Correo Electrónico</option>
                        <option value="IN_PERSON">Visita en Persona</option>
                        <option value="OTHER">Otro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Acción</label>
                      <input
                        type="text"
                        value={outreachAction}
                        onChange={e => setOutreachAction(e.target.value)}
                        placeholder="ej. Llamada comercial presentación"
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Resultado</label>
                      <select
                        value={outreachOutcome}
                        onChange={e => setOutreachOutcome(e.target.value as any)}
                        className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                      >
                        <option value="ANSWERED">Contestó llamada</option>
                        <option value="INTERESTED">Interesado</option>
                        <option value="DEMO_BOOKED">Demo agendada</option>
                        <option value="PROPOSAL_REQUESTED">Pide presupuesto/demo</option>
                        <option value="CUSTOMER">Se convirtió en cliente</option>
                        <option value="NO_ANSWER">No contesta</option>
                        <option value="CALL_BACK">Llamar más tarde</option>
                        <option value="NOT_INTERESTED">No interesado</option>
                        <option value="DO_NOT_CONTACT">Pidió no ser llamado</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Notas de la conversación</label>
                    <textarea
                      rows={2}
                      value={outreachNotes}
                      onChange={e => setOutreachNotes(e.target.value)}
                      placeholder="Observaciones de la conversación, objeciones o fecha para volver a llamar..."
                      className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-800"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
                    >
                      <Send size={14} />
                      Guardar Interacción
                    </button>
                  </div>
                </form>

                {/* Histórico de contactos */}
                {selectedLeadDetail.outreachLogs?.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-bold text-slate-700">Historial de Interacciones</h4>
                    {selectedLeadDetail.outreachLogs.map(log => (
                      <div key={log.id} className="p-3 bg-white border border-slate-200 rounded-lg text-xs flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{log.action}</span>
                            <span className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-700 rounded font-semibold">{log.channel}</span>
                            <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-800 rounded font-semibold">{log.outcome}</span>
                          </div>
                          {log.notes && <p className="text-slate-600 mt-1">{log.notes}</p>}
                        </div>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(log.contacted_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* TIMELINE HISTÓRICO DE PUNTUACIONES */}
              {selectedLeadDetail.scoreHistory?.length > 0 && (
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Clock size={18} className="text-slate-500" />
                    Historial de Recálculos de Puntuación (Trazabilidad)
                  </h3>

                  <div className="space-y-2">
                    {selectedLeadDetail.scoreHistory.map((h, i) => (
                      <div key={h.id || i} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-blue-700 text-sm">{h.priority_score} pts</span>
                          {getTierBadge(h.tier)}
                          <span className="text-slate-500">v{h.algorithm_version || "1.0"}</span>
                        </div>
                        <span className="text-slate-400 text-[11px]">
                          {new Date(h.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
