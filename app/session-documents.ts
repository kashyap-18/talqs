"use client";

import type { CaseDoc } from "./talqs-data";

const storageKey = "talqs.sessionDocuments.v1";
const updateEvent = "talqs-session-documents";
const emptyDocuments: CaseDoc[] = [];
let cachedSerialized = "";
let cachedDocuments: CaseDoc[] = emptyDocuments;

function isBrowser() {
  return typeof window !== "undefined";
}

function compactDocument(document: CaseDoc): CaseDoc {
  return {
    ...document,
    rawText: undefined,
  };
}

export function loadSessionDocuments() {
  if (!isBrowser()) return emptyDocuments;
  try {
    const serialized = window.sessionStorage.getItem(storageKey) ?? "[]";
    if (serialized === cachedSerialized) return cachedDocuments;
    const parsed = JSON.parse(serialized) as CaseDoc[];
    cachedSerialized = serialized;
    cachedDocuments = Array.isArray(parsed) ? parsed : emptyDocuments;
    return cachedDocuments;
  } catch {
    return emptyDocuments;
  }
}

export function saveSessionDocuments(documents: CaseDoc[]) {
  if (!isBrowser()) return;
  const compacted = documents.map(compactDocument).slice(0, 12);
  window.sessionStorage.setItem(storageKey, JSON.stringify(compacted));
  window.dispatchEvent(new Event(updateEvent));
}

export function addSessionDocument(document: CaseDoc) {
  const current = loadSessionDocuments().filter((item) => item.id !== document.id);
  saveSessionDocuments([document, ...current]);
}

export function subscribeSessionDocuments(callback: (documents: CaseDoc[]) => void) {
  if (!isBrowser()) return () => {};
  const handler = () => callback(loadSessionDocuments());
  window.addEventListener(updateEvent, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(updateEvent, handler);
    window.removeEventListener("storage", handler);
  };
}
