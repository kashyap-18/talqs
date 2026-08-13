"use client";

import {
  ArrowLeft,
  BookOpen,
  Braces,
  Check,
  ChevronRight,
  CircleX,
  Clock3,
  Code2,
  Gauge,
  KeyRound,
  Layers3,
  Play,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  answerDocument,
  formatMs,
  topicLabel,
  validateModelOutput,
} from "../talqs-engine";
import { cases, sampleQuestions, type CaseDoc } from "../talqs-data";
import {
  defaultEngineOptions,
  type ChunkingStrategy,
  type EngineOptions,
  type RetrievalMethod,
} from "../retrieval-lab";
import AccountControl from "../account-control";
import { useAuth } from "../auth-provider";
import {
  clearSessionApiKey,
  loadSessionApiKey,
  saveSessionApiKey,
} from "../session-credentials";
import { loadSessionDocuments, subscribeSessionDocuments } from "../session-documents";
import { loadStoredDocuments } from "@/lib/supabase/documents";
import {
  loadCredentials,
  modelAuthorizationHeader,
  removeCredential,
  saveCredential,
  type Provider,
  type SavedCredential,
} from "@/lib/supabase/credentials";

type PayloadTab = "prompt" | "request" | "response";
type ModelRun = {
  status: "idle" | "running" | "accepted" | "rejected" | "error";
  runPrompt?: string;
  output?: string;
  reason?: string;
  latencyMs?: number;
  usage?: { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
};

const retrievalMethods: Array<{ id: RetrievalMethod; label: string }> = [
  { id: "keyword", label: "Keyword" },
  { id: "bm25", label: "BM25" },
  { id: "tfidf", label: "TF-IDF" },
  { id: "hybrid", label: "Hybrid" },
];

function JsonBlock({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

export default function EngineeringConsole() {
  const auth = useAuth();
  const [caseId, setCaseId] = useState(cases[0].id);
  const [question, setQuestion] = useState(sampleQuestions[1]);
  const [options, setOptions] = useState<EngineOptions>(defaultEngineOptions);
  const [payloadTab, setPayloadTab] = useState<PayloadTab>("prompt");
  const [comparisonVisible, setComparisonVisible] = useState(true);
  const [sessionDocuments, setSessionDocuments] = useState<CaseDoc[]>([]);
  const [storedDocuments, setStoredDocuments] = useState<CaseDoc[]>([]);
  const [libraryStatus, setLibraryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [sessionKeyAvailable, setSessionKeyAvailable] = useState(false);
  const [saveApiKey, setSaveApiKey] = useState(true);
  const [credentials, setCredentials] = useState<SavedCredential[]>([]);
  const [credentialId, setCredentialId] = useState("");
  const [credentialMessage, setCredentialMessage] = useState("");
  const [modelRun, setModelRun] = useState<ModelRun>({ status: "idle" });

  const userDocuments = useMemo(
    () => [...(auth.user ? storedDocuments : []), ...sessionDocuments],
    [auth.user, sessionDocuments, storedDocuments],
  );
  const documents = useMemo(() => [...userDocuments, ...cases], [userDocuments]);
  const activeCaseId = documents.some((document) => document.id === caseId)
    ? caseId
    : documents[0]?.id ?? cases[0].id;
  const selectedDocument = documents.find((item) => item.id === activeCaseId) ?? documents[0] ?? cases[0];
  const answer = useMemo(
    () => answerDocument(selectedDocument, question, options),
    [options, question, selectedDocument],
  );
  const comparisons = useMemo(
    () =>
      retrievalMethods.map((method) => {
        const run = answerDocument(selectedDocument, question, {
          ...options,
          retrievalMethod: method.id,
        });
        return {
          ...method,
          score: run.supportScore,
          firstHit: run.hits[0]?.id ?? "None",
          returned: run.hits.length,
          status: run.status,
          latency: run.timings.totalMs,
        };
      }),
    [options, question, selectedDocument],
  );
  const displayedModelRun: ModelRun =
    modelRun.runPrompt && modelRun.runPrompt !== answer.promptPreview
      ? { status: "idle" }
      : modelRun;
  useEffect(() => {
    queueMicrotask(() => setSessionDocuments(loadSessionDocuments()));
    return subscribeSessionDocuments(setSessionDocuments);
  }, []);

  useEffect(() => {
    queueMicrotask(() => setSessionKeyAvailable(Boolean(loadSessionApiKey(provider, model))));
  }, [model, provider]);

  useEffect(() => {
    if (!auth.user) {
      return;
    }
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

  useEffect(() => {
    if (!auth.user) return;
    let active = true;
    void loadCredentials()
      .then((loaded) => {
        if (active) setCredentials(loaded);
      })
      .catch((error) => {
        if (active) setCredentialMessage(error instanceof Error ? error.message : "Credential vault unavailable.");
      });
    return () => {
      active = false;
    };
  }, [auth.user]);

  function updateOption<Key extends keyof EngineOptions>(key: Key, value: EngineOptions[Key]) {
    setOptions((current) => ({ ...current, [key]: value }));
  }

  async function runSessionModel() {
    const cachedSessionKey = loadSessionApiKey(provider, model);
    if (
      !model.trim() ||
      (!apiKey.trim() && !credentialId && !cachedSessionKey) ||
      answer.status !== "answered"
    ) {
      return;
    }
    setModelRun({ status: "running", runPrompt: answer.promptPreview });
    setCredentialMessage("");

    try {
      let savedCredentialId = credentialId;
      let oneTimeApiKey = apiKey.trim() || cachedSessionKey;
      if (oneTimeApiKey && saveApiKey && auth.user) {
        const saved = await saveCredential(provider, model.trim(), oneTimeApiKey);
        savedCredentialId = saved.id;
        oneTimeApiKey = "";
        setCredentialId(saved.id);
        setCredentials((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      } else if (oneTimeApiKey) {
        saveSessionApiKey(provider, model.trim(), oneTimeApiKey);
        setSessionKeyAvailable(true);
      }
      setApiKey("");
      const authorization = await modelAuthorizationHeader();
      const response = await fetch("/api/model", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authorization },
        body: JSON.stringify({
          provider,
          model: model.trim(),
          apiKey: oneTimeApiKey || undefined,
          credentialId: savedCredentialId || undefined,
          prompt: answer.promptPreview,
        }),
      });
      const payload = (await response.json()) as {
        output?: string;
        error?: string;
        latencyMs?: number;
        usage?: ModelRun["usage"];
      };

      if (!response.ok || !payload.output) {
        setModelRun({
          status: "error",
          runPrompt: answer.promptPreview,
          reason: payload.error ?? "The provider request failed.",
          latencyMs: payload.latencyMs,
        });
        return;
      }

      const validation = validateModelOutput(payload.output, answer.hits);
      setModelRun({
        status: validation.valid ? "accepted" : "rejected",
        runPrompt: answer.promptPreview,
        output: validation.valid ? payload.output : answer.answer,
        reason: validation.valid
          ? validation.reason
          : `${validation.reason} Deterministic answer retained.`,
        latencyMs: payload.latencyMs,
        usage: payload.usage,
      });
    } catch (error) {
      setModelRun({
        status: "error",
        runPrompt: answer.promptPreview,
        reason:
          error instanceof Error
            ? error.message
            : "The same-origin model request did not complete. Deterministic mode is unchanged.",
      });
    }
  }

  return (
    <main className="console-shell">
      <header className="product-bar console-product-bar">
        <Link className="brand" href="/">
          <span className="brand-mark">T</span>
          <span>
            <strong>TALQS</strong>
            <small>Engineering console</small>
          </span>
        </Link>
        <div className="console-title">
          <span className="signal-dot" />
          <span>Pipeline online</span>
        </div>
        <div className="header-actions">
          <AccountControl />
          <Link className="back-link" href="/">
            <ArrowLeft size={16} aria-hidden="true" /> Research app
          </Link>
        </div>
      </header>

      <section className="console-heading">
        <div>
          <p className="eyebrow">Retrieval experiment bench</p>
          <h1>Inspect every grounding decision.</h1>
        </div>
        <p>
          The active run is local and deterministic. A user-supplied model can be called manually
          after retrieval; the console labels that response separately and validates its citations.
        </p>
      </section>

      <section className="console-banner">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          <strong>Default execution: no external inference.</strong> Classification, chunking,
          scoring, thresholding, and fallback run in application code against the local corpus.
        </p>
      </section>

      <section className="console-layout" aria-label="Engineering console">
        <aside className="lab-controls">
          <div className="control-title">
            <SlidersHorizontal size={18} aria-hidden="true" />
            <div>
              <p className="eyebrow">Run configuration</p>
              <h2>Experiment controls</h2>
            </div>
          </div>

          <label htmlFor="case">Record</label>
          <select id="case" value={activeCaseId} onChange={(event) => setCaseId(event.target.value)}>
            {userDocuments.length ? (
              <optgroup label="My uploaded documents">
                {userDocuments.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.shortTitle}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="Seed corpus">
              {cases.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.shortTitle}
                </option>
              ))}
            </optgroup>
          </select>
          {libraryStatus === "loading" ? (
            <p className="control-note">Loading private documents</p>
          ) : null}
          {libraryStatus === "error" ? (
            <p className="control-note error">Private documents could not be loaded.</p>
          ) : null}

          <label htmlFor="console-question">Question</label>
          <textarea
            id="console-question"
            value={question}
            maxLength={500}
            onChange={(event) => setQuestion(event.target.value)}
            rows={4}
          />

          <div className="mini-presets">
            {sampleQuestions.slice(0, 4).map((preset) => (
              <button key={preset} type="button" onClick={() => setQuestion(preset)} title={preset}>
                {preset.replace("What ", "").replace("?", "")}
              </button>
            ))}
          </div>

          <fieldset>
            <legend>Retriever</legend>
            <div className="segmented four">
              {retrievalMethods.map((method) => (
                <button
                  className={options.retrievalMethod === method.id ? "active" : ""}
                  key={method.id}
                  type="button"
                  onClick={() => updateOption("retrievalMethod", method.id)}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </fieldset>

          <label htmlFor="chunking">Chunking</label>
          <select
            id="chunking"
            value={options.chunkingStrategy}
            onChange={(event) =>
              updateOption("chunkingStrategy", event.target.value as ChunkingStrategy)
            }
          >
            <option value="curated">Curated source chunks</option>
            <option value="paragraph">Paragraph chunks</option>
            <option value="sentence">Sentence windows</option>
            <option value="fixed">Fixed word windows</option>
          </select>

          <label className="range-control">
            <span>
              Chunk size <output>{options.chunkSize} words</output>
            </span>
            <input
              type="range"
              min="60"
              max="240"
              step="20"
              value={options.chunkSize}
              disabled={options.chunkingStrategy === "curated"}
              onChange={(event) => updateOption("chunkSize", Number(event.target.value))}
            />
          </label>

          <label className="range-control">
            <span>
              Overlap <output>{options.overlap} words</output>
            </span>
            <input
              type="range"
              min="0"
              max="60"
              step="6"
              value={options.overlap}
              disabled={options.chunkingStrategy === "curated"}
              onChange={(event) => updateOption("overlap", Number(event.target.value))}
            />
          </label>

          <label className="range-control">
            <span>
              Support threshold <output>{options.threshold.toFixed(2)}</output>
            </span>
            <input
              type="range"
              min="0.05"
              max="0.9"
              step="0.05"
              value={options.threshold}
              onChange={(event) => updateOption("threshold", Number(event.target.value))}
            />
          </label>

          <div className="control-row">
            <label htmlFor="top-k">Top K</label>
            <select
              id="top-k"
              value={options.topK}
              onChange={(event) => updateOption("topK", Number(event.target.value))}
            >
              {[2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>

          <div className="toggle-row">
            <span>
              <strong>Statutory context</strong>
              <small>For remedy and law questions</small>
            </span>
            <input
              id="statutory-context"
              aria-label="Include statutory context"
              type="checkbox"
              checked={options.includeStatutes}
              onChange={(event) => updateOption("includeStatutes", event.target.checked)}
            />
          </div>

          <button
            className="reset-button"
            type="button"
            onClick={() => setOptions(defaultEngineOptions)}
          >
            <RotateCcw size={15} aria-hidden="true" /> Reset controls
          </button>
        </aside>

        <div className="lab-output">
          <section className="pipeline-strip" aria-label="Pipeline stages">
            {[
              ["01", "Classify", topicLabel(answer.classifiedTopic), answer.timings.classifyMs],
              ["02", "Chunk", `${answer.candidateCount} candidates`, answer.timings.chunkMs],
              ["03", "Retrieve", `${answer.hits.length} hits`, answer.timings.retrievalMs],
              ["04", "Decide", answer.status, answer.timings.composeMs],
            ].map(([step, label, value, latency], index) => (
              <div className="pipeline-stage" key={String(step)}>
                <span>{step}</span>
                <div>
                  <strong>{label}</strong>
                  <small>{value}</small>
                </div>
                <time suppressHydrationWarning>{formatMs(Number(latency))}</time>
                {index < 3 ? <ChevronRight size={15} aria-hidden="true" /> : null}
              </div>
            ))}
          </section>

          <section className="decision-panel">
            <div className="decision-main">
              <p className="eyebrow">Fallback decision</p>
              <h2>{answer.status === "answered" ? "Support threshold passed" : "No-answer path triggered"}</h2>
              <p>{answer.fallbackReason ?? answer.answer}</p>
            </div>
            <div className={`decision-gauge ${answer.status}`}>
              <Gauge size={19} aria-hidden="true" />
              <span>{answer.supportScore.toFixed(2)}</span>
              <small>threshold {answer.options.threshold.toFixed(2)}</small>
            </div>
          </section>

          <section className="metric-band" aria-label="Run metrics">
            <div>
              <Layers3 size={17} aria-hidden="true" />
              <span>Chunks</span>
              <strong>{answer.candidateCount}</strong>
            </div>
            <div>
              <Timer size={17} aria-hidden="true" />
              <span>Total latency</span>
              <strong suppressHydrationWarning>{formatMs(answer.timings.totalMs)}</strong>
            </div>
            <div>
              <Code2 size={17} aria-hidden="true" />
              <span>Estimated input</span>
              <strong>{answer.tokenEstimate.inputTokens} tokens</strong>
            </div>
            <div>
              {answer.status === "answered" ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <CircleX size={17} aria-hidden="true" />
              )}
              <span>Decision</span>
              <strong>{answer.status}</strong>
            </div>
          </section>

          <section className="lab-section retrieval-section">
            <header>
              <div>
                <p className="eyebrow">Ranked context</p>
                <h2>Retrieval hits</h2>
              </div>
              <span>{options.retrievalMethod.toUpperCase()}</span>
            </header>
            <div className="retrieval-table">
              {answer.hits.map((hit, index) => (
                <article key={hit.id}>
                  <div className="hit-rank">{String(index + 1).padStart(2, "0")}</div>
                  <div className="hit-content">
                    <div>
                      <strong>{hit.id}</strong>
                      <span>{hit.title}</span>
                    </div>
                    <p>{hit.text}</p>
                    <small>{hit.reason}</small>
                  </div>
                  <div className="hit-score">
                    <strong>{hit.score.toFixed(2)}</strong>
                    <span className="score-track">
                      <span style={{ width: `${Math.max(3, hit.score * 100)}%` }} />
                    </span>
                  </div>
                </article>
              ))}
              {!answer.hits.length ? <p className="empty">No chunks were scored.</p> : null}
            </div>
          </section>

          <section className="lab-section comparison-section">
            <header>
              <div>
                <p className="eyebrow">Same query, same chunks</p>
                <h2>Retriever comparison</h2>
              </div>
              <button type="button" onClick={() => setComparisonVisible((current) => !current)}>
                {comparisonVisible ? "Hide" : "Show"}
              </button>
            </header>
            {comparisonVisible ? (
              <div className="comparison-table">
                <div className="comparison-head">
                  <span>Method</span><span>Top chunk</span><span>Score</span><span>Latency</span><span>Decision</span>
                </div>
                {comparisons.map((run) => (
                  <div className={run.id === options.retrievalMethod ? "active" : ""} key={run.id}>
                    <strong>{run.label}</strong>
                    <span>{run.firstHit}</span>
                    <span>{run.score.toFixed(2)}</span>
                    <span suppressHydrationWarning>{formatMs(run.latency)}</span>
                    <span>{run.status}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="lab-section payload-section">
            <header>
              <div>
                <p className="eyebrow">Sanitized inspection</p>
                <h2>Prompt and payloads</h2>
              </div>
              <Braces size={19} aria-hidden="true" />
            </header>
            <div className="payload-tabs" role="tablist" aria-label="Payload view">
              {(["prompt", "request", "response"] as PayloadTab[]).map((tab) => (
                <button
                  className={payloadTab === tab ? "active" : ""}
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={payloadTab === tab}
                  onClick={() => setPayloadTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            {payloadTab === "prompt" ? <pre>{answer.promptPreview}</pre> : null}
            {payloadTab === "request" ? <JsonBlock value={answer.sanitizedRequest} /> : null}
            {payloadTab === "response" ? <JsonBlock value={answer.sanitizedResponse} /> : null}
          </section>

          <section className="lab-section model-section">
            <header>
              <div>
                <p className="eyebrow">Optional execution layer</p>
                <h2>Run with a provider credential</h2>
              </div>
              <KeyRound size={19} aria-hidden="true" />
            </header>
            <div className="model-grid">
              <div className="model-form">
                <label htmlFor="provider">Provider</label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(event) => {
                    setProvider(event.target.value as Provider);
                    setCredentialId("");
                  }}
                >
                  <option value="openai">OpenAI</option>
                  <option value="groq">Groq</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="anthropic">Anthropic Claude</option>
                </select>
                <label htmlFor="model">Model id</label>
                <input
                  id="model"
                  value={model}
                  onChange={(event) => {
                    setModel(event.target.value);
                    setCredentialId("");
                  }}
                  placeholder="Enter the provider model id"
                  autoComplete="off"
                />
                {auth.user && credentials.length ? (
                  <>
                    <label htmlFor="saved-credential">Saved credential</label>
                    <div className="credential-select-row">
                      <select
                        id="saved-credential"
                        value={credentialId}
                        onChange={(event) => {
                          const id = event.target.value;
                          setCredentialId(id);
                          const selected = credentials.find((item) => item.id === id);
                          if (selected) {
                            setProvider(selected.provider);
                            setModel(selected.model);
                            setApiKey("");
                          }
                        }}
                      >
                        <option value="">Enter a different key</option>
                        {credentials.map((credential) => (
                          <option key={credential.id} value={credential.id}>
                            {credential.provider} · {credential.model} · ...{credential.key_hint}
                          </option>
                        ))}
                      </select>
                      <button
                        className="delete-credential"
                        type="button"
                        title="Delete saved credential"
                        disabled={!credentialId}
                        onClick={async () => {
                          await removeCredential(credentialId);
                          setCredentials((current) => current.filter((item) => item.id !== credentialId));
                          setCredentialId("");
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </>
                ) : null}
                <label htmlFor="api-key">{credentialId ? "Replacement API key" : "API key"}</label>
                <input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={credentialId ? "Leave blank to use saved key" : "Enter provider key"}
                  autoComplete="off"
                  spellCheck={false}
                />
                {sessionKeyAvailable && !credentialId && !apiKey.trim() ? (
                  <div className="session-key-row">
                    <span>Session key cached for this provider/model</span>
                    <button
                      type="button"
                      onClick={() => {
                        clearSessionApiKey(provider, model);
                        setSessionKeyAvailable(false);
                      }}
                    >
                      Forget
                    </button>
                  </div>
                ) : null}
                <label className="credential-save-option" htmlFor="save-api-key">
                  <input
                    id="save-api-key"
                    aria-label="Save API key encrypted"
                    type="checkbox"
                    checked={saveApiKey}
                    disabled={!auth.user}
                    onChange={(event) => setSaveApiKey(event.target.checked)}
                  />
                  <span>
                    <strong>Save encrypted</strong>
                    <small>{auth.user ? "Reuse on this account" : "Signed-out runs use session cache"}</small>
                  </span>
                </label>
                {credentialMessage ? <p className="credential-message">{credentialMessage}</p> : null}
                <button
                  className="run-model-button"
                  type="button"
                  disabled={
                    !model.trim() ||
                    (!apiKey.trim() && !credentialId && !sessionKeyAvailable) ||
                    answer.status !== "answered" ||
                    displayedModelRun.status === "running"
                  }
                  onClick={() => void runSessionModel()}
                >
                  <Play size={16} aria-hidden="true" />
                  {displayedModelRun.status === "running" ? "Calling provider" : "Run grounded generation"}
                </button>
              </div>
              <div className={`model-result ${displayedModelRun.status}`}>
                <div className="model-result-heading">
                  <span>
                    {displayedModelRun.status === "accepted" ? <Check size={16} aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />}
                    {displayedModelRun.status === "idle" ? "No external call made" : displayedModelRun.status}
                  </span>
                  {displayedModelRun.latencyMs ? <time>{displayedModelRun.latencyMs} ms</time> : null}
                </div>
                <p>{displayedModelRun.output ?? displayedModelRun.reason ?? "The deterministic result remains the active answer."}</p>
                {displayedModelRun.reason && displayedModelRun.output ? <small>{displayedModelRun.reason}</small> : null}
                {displayedModelRun.usage ? (
                  <small>
                    Provider tokens: {displayedModelRun.usage.inputTokens ?? "n/a"} in · {displayedModelRun.usage.outputTokens ?? "n/a"} out
                  </small>
                ) : null}
              </div>
            </div>
            <p className="key-disclosure">
              Saved keys are encrypted with AES-GCM before database insertion. The encryption key
              stays in the server environment; the browser receives only provider, model, and the
              last four characters. Selecting one-time use leaves the key out of persistent storage.
            </p>
          </section>

          <footer className="console-footer">
            <BookOpen size={16} aria-hidden="true" />
            <span>{selectedDocument.title}</span>
            <span>Template talqs-grounded-v0.8</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
