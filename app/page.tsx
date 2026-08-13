"use client";

import {
  ArrowUpRight,
  BookOpen,
  Braces,
  Check,
  ChevronRight,
  Clock3,
  Database,
  FileSearch,
  FileText,
  FolderOpen,
  Layers3,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSessionDocument, extractFile } from "./document-ingestion";
import { addSessionDocument, loadSessionDocuments, subscribeSessionDocuments } from "./session-documents";
import { answerDocument, formatMs, topicLabel } from "./talqs-engine";
import { cases, officialSources, sampleQuestions, type CaseDoc } from "./talqs-data";
import type { ChunkingStrategy } from "./retrieval-lab";
import AccountControl from "./account-control";
import { useAuth } from "./auth-provider";
import {
  deleteStoredDocument,
  loadStoredDocuments,
  persistDocument,
  searchStoredDocument,
  type SemanticSearchResult,
} from "@/lib/supabase/documents";

type UploadPhase = "idle" | "extracting" | "chunking" | "embedding" | "complete" | "error";

function compactDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export default function Home() {
  const auth = useAuth();
  const [sessionDocuments, setSessionDocuments] = useState<CaseDoc[]>([]);
  const [storedDocuments, setStoredDocuments] = useState<CaseDoc[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [selectedDocumentId, setSelectedDocumentId] = useState(cases[0].id);
  const [question, setQuestion] = useState(sampleQuestions[0]);
  const [submittedQuestion, setSubmittedQuestion] = useState(sampleQuestions[0]);
  const [caseSearch, setCaseSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("Waiting for a document");
  const [uploadError, setUploadError] = useState("");
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [completedUpload, setCompletedUpload] = useState<CaseDoc | null>(null);
  const [lastIngestedId, setLastIngestedId] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [chunkingStrategy, setChunkingStrategy] =
    useState<Exclude<ChunkingStrategy, "curated">>("sentence");
  const [chunkSize, setChunkSize] = useState(120);
  const [overlap, setOverlap] = useState(24);
  const [semanticRun, setSemanticRun] = useState<{
    question: string;
    documentId: string;
    status: "running" | "complete" | "error";
    result?: SemanticSearchResult;
    error?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userDocuments = useMemo(
    () => [...(auth.user ? storedDocuments : []), ...sessionDocuments],
    [auth.user, sessionDocuments, storedDocuments],
  );
  const documents = useMemo(() => [...userDocuments, ...cases], [userDocuments]);
  const selectedDocument = useMemo(
    () => documents.find((item) => item.id === selectedDocumentId) ?? cases[0],
    [documents, selectedDocumentId],
  );
  const filteredCases = useMemo(() => {
    const query = caseSearch.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter((item) =>
      [item.title, item.platform, item.category, item.forum].some((value) =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [caseSearch]);
  const answer = useMemo(
    () =>
      answerDocument(selectedDocument, submittedQuestion, {
        retrievalMethod: "hybrid",
        chunkingStrategy: "curated",
        topK: 4,
        threshold: 0.2,
      }),
    [selectedDocument, submittedQuestion],
  );
  const activeSemanticRun =
    semanticRun?.documentId === selectedDocument.id ? semanticRun : null;

  useEffect(() => {
    queueMicrotask(() => setSessionDocuments(loadSessionDocuments()));
    return subscribeSessionDocuments(setSessionDocuments);
  }, []);

  useEffect(() => {
    if (!auth.user) return;
    let active = true;
    void loadStoredDocuments()
      .then((loaded) => {
        if (!active) return;
        setStoredDocuments(loaded);
        setLibraryStatus("ready");
      })
      .catch(() => {
        if (active) setLibraryStatus("error");
      });
    return () => {
      active = false;
    };
  }, [auth.user]);

  async function runQuestion(nextQuestion = question) {
    setQuestion(nextQuestion);
    setSubmittedQuestion(nextQuestion);
    if (selectedDocument.origin !== "stored-upload") {
      setSemanticRun(null);
      return;
    }

    setSemanticRun({
      question: nextQuestion,
      documentId: selectedDocument.id,
      status: "running",
    });
    try {
      const result = await searchStoredDocument(selectedDocument.id, nextQuestion, {
        threshold: 0.55,
        topK: 5,
      });
      setSemanticRun({
        question: nextQuestion,
        documentId: selectedDocument.id,
        status: "complete",
        result,
      });
    } catch (error) {
      setSemanticRun({
        question: nextQuestion,
        documentId: selectedDocument.id,
        status: "error",
        error: error instanceof Error ? error.message : "Semantic retrieval failed.",
      });
    }
  }

  function openUpload() {
    setUploadStatus("Waiting for a document");
    setUploadError("");
    setUploadPhase("idle");
    setCompletedUpload(null);
    setUploadOpen(true);
  }

  function openCompletedUpload() {
    if (!completedUpload) return;
    setSelectedDocumentId(completedUpload.id);
    setLastIngestedId(completedUpload.id);
    setToastMessage(`${completedUpload.shortTitle} added to My documents`);
    setUploadOpen(false);
    requestAnimationFrame(() => {
      document.getElementById("research")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function processFile(file?: File) {
    if (!file) return;
    setUploadError("");
    setCompletedUpload(null);
    setUploadPhase("extracting");
    setUploadStatus("Extracting searchable text");

    try {
      const extracted = await extractFile(file);
      setUploadPhase("chunking");
      setUploadStatus("Cleaning and chunking the document");
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const document = createSessionDocument(
        extracted,
        chunkingStrategy,
        chunkSize,
        overlap,
      );
      let completedDocument = document;
      if (auth.user) {
        setUploadPhase("embedding");
        setUploadStatus(`Embedding ${document.chunks.length} chunks with gte-small`);
        const stored = await persistDocument(document, file, {
          chunkingStrategy,
          chunkSize,
          overlap,
        });
        setUploadStatus(`Stored ${stored.chunkCount} vectors in the private library`);
        const loaded = await loadStoredDocuments();
        setStoredDocuments(loaded);
        setLibraryStatus("ready");
        completedDocument = loaded.find((item) => item.id === stored.documentId) ?? document;
      } else {
        addSessionDocument(document);
      }
      setSelectedDocumentId(completedDocument.id);
      setQuestion(sampleQuestions[0]);
      setSubmittedQuestion(sampleQuestions[0]);
      setCompletedUpload(completedDocument);
      setUploadPhase("complete");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The document could not be processed.");
      setUploadStatus("Document rejected");
      setUploadPhase("error");
    }
  }

  return (
    <main className="app-shell">
      <header className="product-bar" aria-label="TALQS header">
        <a className="brand" href="#research" aria-label="TALQS research home">
          <span className="brand-mark">T</span>
          <span>
            <strong>TALQS</strong>
            <small>Consumer judgment research</small>
          </span>
        </a>
        <nav className="route-tabs" aria-label="Primary navigation">
          <a className="active" href="#research">
            <BookOpen size={16} aria-hidden="true" /> Research
          </a>
          <a href="/console">
            <Braces size={16} aria-hidden="true" /> Engineering
          </a>
        </nav>
        <div className="header-actions">
          <AccountControl />
          <button className="primary-action" type="button" onClick={openUpload}>
            <Upload size={17} aria-hidden="true" /> Add document
          </button>
        </div>
      </header>

      <section className="research-heading" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Bounded legal research prototype</p>
          <h1 id="page-title">Consumer disputes, traced to source.</h1>
        </div>
        <div className="runtime-signal" aria-label="Current system mode">
          <span className="signal-dot" />
          <span>
            <strong>Deterministic core</strong>
            <small>No model call required</small>
          </span>
        </div>
        <div className="floating-readout readout-one" aria-hidden="true">
          <span>{cases.length}</span> curated records
        </div>
        <div className="floating-readout readout-two" aria-hidden="true">
          <span>4</span> retrieval modes
        </div>
      </section>

      <section className="notice" aria-label="Educational notice">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          <strong>Educational demo only.</strong> TALQS is not a legal advisor. It answers four
          narrow question types from the selected record and shows the passages used.
        </p>
      </section>

      <section id="research" className="workspace" aria-label="TALQS research workspace">
        <aside className="case-rail" aria-label="Case browser">
          <div className="rail-heading">
            <div>
              <p className="eyebrow">Document library</p>
              <h2>{documents.length} records</h2>
            </div>
            <Database size={18} aria-hidden="true" />
          </div>
          <label className="case-search" htmlFor="case-search">
            <Search size={16} aria-hidden="true" />
            <input
              id="case-search"
              value={caseSearch}
              onChange={(event) => setCaseSearch(event.target.value)}
              placeholder="Search cases"
            />
          </label>
          <section className="session-shelf" aria-label="Personal documents">
            <header>
              <span>
                <FolderOpen size={15} aria-hidden="true" /> My documents
              </span>
              <strong>{userDocuments.length}</strong>
            </header>
            {libraryStatus === "loading" ? <p className="library-message">Loading private library</p> : null}
            {libraryStatus === "error" ? <p className="library-message error">Private library unavailable</p> : null}
            {userDocuments.length ? (
              <div className="session-document-list">
                {userDocuments.map((item) => (
                  <div className="personal-document-row" key={item.id}>
                    <button
                      className={`session-document-button ${item.id === selectedDocument.id ? "active" : ""} ${item.id === lastIngestedId ? "new" : ""}`}
                      onClick={() => {
                        setSelectedDocumentId(item.id);
                        setLastIngestedId("");
                      }}
                      type="button"
                    >
                      <span className="session-file-icon"><FileText size={15} aria-hidden="true" /></span>
                      <span>
                        <strong>{item.shortTitle}</strong>
                        <small>{item.chunks.length} chunks · {item.origin === "stored-upload" ? "saved" : "this session"}</small>
                      </span>
                      {item.id === lastIngestedId ? <em>New</em> : <ChevronRight size={15} aria-hidden="true" />}
                    </button>
                    {item.origin === "stored-upload" ? (
                      <button
                        className="delete-document"
                        type="button"
                        title="Delete stored document"
                        onClick={async () => {
                          await deleteStoredDocument(item.id);
                          setStoredDocuments((current) => current.filter((document) => document.id !== item.id));
                          if (selectedDocumentId === item.id) setSelectedDocumentId(cases[0].id);
                        }}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <button className="empty-session" type="button" onClick={openUpload}>
                <Plus size={15} aria-hidden="true" />
                <span><strong>No personal documents</strong><small>{auth.user ? "Add a searchable judgment" : "Sign in to keep uploads"}</small></span>
              </button>
            )}
          </section>

          <div className="corpus-divider">
            <span>Curated corpus</span>
            <strong>{cases.length}</strong>
          </div>

          <div className="case-list">
            {filteredCases.map((item) => (
              <button
                className={`case-button ${item.id === selectedDocument.id ? "active" : ""}`}
                key={item.id}
                onClick={() => setSelectedDocumentId(item.id)}
                type="button"
              >
                <span className="case-title">{item.shortTitle}</span>
                <span className="case-meta">
                  {item.platform} · {compactDate(item.decisionDate)}
                </span>
                <span className="case-category">{item.category}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            ))}
            {!filteredCases.length ? (
              <p className="empty">No record matches that search.</p>
            ) : null}
          </div>
          <button className="rail-upload" type="button" onClick={openUpload}>
            <Upload size={16} aria-hidden="true" />
            Index a session document
          </button>
        </aside>

        <section className="case-panel" aria-label="Selected case summary">
          <div className="case-header">
            <div>
              <div className="case-kicker">
                <span>{selectedDocument.level} commission</span>
              <span>{selectedDocument.origin === "curated" || !selectedDocument.origin ? "Curated" : "Unverified upload"}</span>
              </div>
              <h2>{selectedDocument.title}</h2>
              <p>{selectedDocument.forum}</p>
            </div>
            {selectedDocument.sourceUrl ? (
              <a
                className="source-link"
                href={selectedDocument.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Source <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            ) : (
              <span className="session-badge">
                <Clock3 size={15} aria-hidden="true" /> {selectedDocument.origin === "stored-upload" ? "Private library" : "This session"}
              </span>
            )}
          </div>

          <div className="facts-grid" aria-label="Case metadata">
            <div>
              <span>{selectedDocument.origin && selectedDocument.origin !== "curated" ? "Uploaded" : "Decision date"}</span>
              <strong>{compactDate(selectedDocument.decisionDate)}</strong>
            </div>
            <div>
              <span>Posture</span>
              <strong>{selectedDocument.posture}</strong>
            </div>
            <div>
              <span>{selectedDocument.origin && selectedDocument.origin !== "curated" ? "Index" : "Disposition"}</span>
              <strong>
                {selectedDocument.origin && selectedDocument.origin !== "curated"
                  ? `${selectedDocument.chunks.length} chunks · ${selectedDocument.pageCount ?? 1} page(s)`
                  : selectedDocument.disposition}
              </strong>
            </div>
          </div>

          <article className="summary-block">
            <div className="section-title">
              <FileText size={18} aria-hidden="true" />
              <h3>
                {selectedDocument.origin && selectedDocument.origin !== "curated"
                  ? "Extractive document preview"
                  : "Plain-language summary"}
              </h3>
            </div>
            {selectedDocument.summary.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <p className="source-note">{selectedDocument.sourceNote}</p>
          </article>

          <section className="ask-block" aria-label="Ask TALQS">
            <div className="ask-heading">
              <div>
                <p className="eyebrow">Four supported intents</p>
                <h3>Grounded Q&amp;A</h3>
              </div>
              <span className={`status-pill ${activeSemanticRun?.status === "complete" ? (activeSemanticRun.result?.fallback ? "no-answer" : "answered") : answer.status}`}>
                {activeSemanticRun?.status === "running" ? null : answer.status === "answered" ? <Check size={14} aria-hidden="true" /> : null}
                {activeSemanticRun?.status === "running" ? "Vector search" : activeSemanticRun?.result?.fallback ? "No answer" : "Support passed"}
              </span>
            </div>

            <div className="question-presets" aria-label="Question presets">
              {sampleQuestions.slice(0, 4).map((preset) => (
                <button key={preset} type="button" onClick={() => runQuestion(preset)}>
                  {preset}
                </button>
              ))}
            </div>

            <form
              className="question-form"
              onSubmit={(event) => {
                event.preventDefault();
                void runQuestion();
              }}
            >
              <label htmlFor="question">Question</label>
              <div>
                <input
                  id="question"
                  value={question}
                  maxLength={500}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask about facts, outcome, remedy, or law"
                />
                <button type="submit">
                  <FileSearch size={17} aria-hidden="true" /> Retrieve
                </button>
              </div>
            </form>

            <div className="answer-box" aria-live="polite">
              <div className="answer-topline">
                  <span>{selectedDocument.origin === "stored-upload" ? "semantic vector retrieval" : topicLabel(answer.classifiedTopic)}</span>
                  <span suppressHydrationWarning>
                  {activeSemanticRun?.result
                    ? `score ${(activeSemanticRun.result.hits[0]?.similarity ?? 0).toFixed(2)} · ${formatMs(activeSemanticRun.result.timings.totalMs)}`
                    : `score ${answer.supportScore.toFixed(2)} · ${formatMs(answer.timings.totalMs)}`}
                  </span>
              </div>
              <p>
                {activeSemanticRun?.status === "running"
                  ? "Generating the query embedding and searching the stored vector index."
                  : activeSemanticRun?.status === "error"
                    ? activeSemanticRun.error
                    : activeSemanticRun?.result?.hits.length
                      ? `The strongest stored passages state: ${activeSemanticRun.result.hits.slice(0, 2).map((hit) => `[VEC-${hit.id}] ${hit.content.slice(0, 360)}`).join(" ")}`
                      : activeSemanticRun?.result?.fallback
                        ? "The stored vector index does not contain a passage above the support threshold."
                        : answer.answer}
              </p>
              {answer.fallbackReason ? (
                <p className="fallback">Decision: {answer.fallbackReason}</p>
              ) : null}
            </div>

            <div className="citations">
              <div className="section-title">
                <BookOpen size={18} aria-hidden="true" />
                <h4>Retrieved passages</h4>
              </div>
              {activeSemanticRun?.result?.hits.length ? (
                activeSemanticRun.result.hits.map((hit) => (
                  <article key={hit.id} className="citation">
                    <div>
                      <strong>Stored chunk {hit.chunk_index + 1}</strong>
                      <span>VEC-{hit.id} · {hit.similarity.toFixed(2)}</span>
                    </div>
                    <p>{hit.content}</p>
                    <span className="local-source">Supabase pgvector · gte-small</span>
                  </article>
                ))
              ) : answer.hits.length ? (
                answer.hits.map((hit) => (
                  <article key={hit.id} className="citation">
                    <div>
                      <strong>{hit.title}</strong>
                      <span>
                        {hit.id} · {hit.score.toFixed(2)}
                      </span>
                    </div>
                    <p>{hit.text}</p>
                    {hit.sourceUrl ? (
                      <a href={hit.sourceUrl} target="_blank" rel="noreferrer">
                        {hit.sourceLabel} <ArrowUpRight size={13} aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="local-source">{hit.sourceLabel}</span>
                    )}
                  </article>
                ))
              ) : (
                <p className="empty">No corpus passage was retrieved.</p>
              )}
            </div>
          </section>
        </section>

        <aside className="source-panel" aria-label="Sources and run details">
          <section className="run-trace">
            <p className="eyebrow">Current run</p>
            <h2>Retrieval trace</h2>
            <dl>
              <div>
                <dt>Method</dt>
                <dd>{selectedDocument.origin === "stored-upload" ? "pgvector cosine" : "Hybrid"}</dd>
              </div>
              <div>
                <dt>Candidates</dt>
                <dd>{answer.candidateCount}</dd>
              </div>
              <div>
                <dt>Returned</dt>
                <dd>{activeSemanticRun?.result?.hits.length ?? answer.hits.length}</dd>
              </div>
              <div>
                <dt>Threshold</dt>
                <dd>{selectedDocument.origin === "stored-upload" ? "0.55" : answer.options.threshold.toFixed(2)}</dd>
              </div>
            </dl>
            <a className="console-link" href="/console">
              Inspect full run <ChevronRight size={15} aria-hidden="true" />
            </a>
          </section>

          <section>
            <p className="eyebrow">Official anchors</p>
            <h2>Source trail</h2>
            <div className="source-stack">
              {officialSources.map((source) => (
                <a href={source.url} target="_blank" rel="noreferrer" key={source.label}>
                  <span>{source.label}</span>
                  <small>{source.publisher}</small>
                </a>
              ))}
            </div>
          </section>

          <section>
            <p className="eyebrow">Boundary</p>
            <h2>Refusal rules</h2>
            <ul>
              <li>Personal legal advice or filing strategy</li>
              <li>Answers outside the selected record</li>
              <li>Claims without a retrieved passage</li>
              <li>Automatic OCR for scanned documents</li>
            </ul>
          </section>
        </aside>
      </section>

      {uploadOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setUploadOpen(false);
          }}
        >
          <section
            className="upload-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
          >
            <header>
              <div>
                <p className="eyebrow">Session ingestion</p>
                <h2 id="upload-title">Index a judgment</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setUploadOpen(false)} title="Close">
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {uploadPhase === "complete" && completedUpload ? (
              <div className="upload-complete">
                <span className="complete-icon"><Sparkles size={22} aria-hidden="true" /></span>
                <p className="eyebrow">Ready for research</p>
                <h3>{completedUpload.shortTitle}</h3>
                <div>
                  <span><strong>{completedUpload.chunks.length}</strong> chunks</span>
                  <span><strong>{completedUpload.pageCount ?? 1}</strong> pages</span>
                  <span><strong>{chunkingStrategy}</strong> chunking</span>
                </div>
                <button className="open-upload-button" type="button" onClick={openCompletedUpload}>
                  <FolderOpen size={16} aria-hidden="true" /> Open in research workspace
                </button>
              </div>
            ) : (
              <>
                <button
                  className="drop-zone"
                  type="button"
                  disabled={auth.configured && !auth.user}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void processFile(event.dataTransfer.files[0]);
                  }}
                >
                  <Upload size={24} aria-hidden="true" />
                  <strong>{auth.configured && !auth.user ? "Sign in before adding a document" : "Choose or drop a searchable document"}</strong>
                  <span>PDF, TXT, or Markdown · 12 MB maximum</span>
                </button>
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  onChange={(event) => void processFile(event.target.files?.[0])}
                />

                <div className="upload-settings">
                  <label>
                    Chunking
                    <select
                      value={chunkingStrategy}
                      onChange={(event) =>
                        setChunkingStrategy(
                          event.target.value as Exclude<ChunkingStrategy, "curated">,
                        )
                      }
                    >
                      <option value="sentence">Sentence windows</option>
                      <option value="paragraph">Paragraphs</option>
                      <option value="fixed">Fixed word windows</option>
                    </select>
                  </label>
                  <label>
                    Chunk size <output>{chunkSize} words</output>
                    <input
                      type="range"
                      min="60"
                      max="240"
                      step="20"
                      value={chunkSize}
                      onChange={(event) => setChunkSize(Number(event.target.value))}
                    />
                  </label>
                  <label>
                    Overlap <output>{overlap} words</output>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="6"
                      value={overlap}
                      onChange={(event) => setOverlap(Number(event.target.value))}
                    />
                  </label>
                </div>
              </>
            )}

            <div className="ingestion-steps" aria-label="Ingestion stages">
              {[
                ["Receive", uploadPhase !== "idle"],
                ["Extract", uploadPhase === "chunking" || uploadPhase === "embedding" || uploadPhase === "complete"],
                ["Chunk", uploadPhase === "embedding" || uploadPhase === "complete"],
                [auth.user ? "Embed + store" : "Add to session", uploadPhase === "complete"],
              ].map(([label, complete], index) => (
                <div className={complete ? "complete" : uploadPhase === "error" ? "error" : ""} key={String(label)}>
                  <span>{complete ? <Check size={12} aria-hidden="true" /> : index + 1}</span>
                  <small>{label}</small>
                </div>
              ))}
            </div>

            <div className={`upload-status ${uploadError ? "error" : ""}`}>
              <span className="signal-dot" />
              <span>
                <strong>{uploadStatus}</strong>
                <small>
                  {auth.user
                    ? "The document is private to this account and stored with user-scoped row-level security."
                    : auth.configured
                      ? "Sign in to store documents and vector embeddings."
                      : "Supabase is not configured; this upload remains in browser memory."}
                </small>
              </span>
            </div>
            {uploadError ? <p className="upload-error">{uploadError}</p> : null}
          </section>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="research-toast" role="status">
          <span><Layers3 size={17} aria-hidden="true" /></span>
          <p><strong>Document ready</strong><small>{toastMessage}</small></p>
          <button type="button" onClick={() => setToastMessage("")} title="Dismiss notification">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </main>
  );
}
