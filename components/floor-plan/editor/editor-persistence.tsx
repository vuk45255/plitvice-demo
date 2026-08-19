"use client";

import { useRef, useState } from "react";
import type { EditorDoc } from "@/components/floor-plan/editor/editor-doc";
import {
  countOf,
  stamp,
  type Envelope,
  type Snapshot,
} from "@/components/floor-plan/editor/editor-storage";

/* The safety controls, kept together and kept away from the drawing tools.
 *
 * Everything that could cost work asks first, and the two that cannot be
 * undone — loading the code version over a draft, and clearing the draft —
 * ask twice: once as a click, once as a confirmation naming what is about to
 * be lost. Nothing here fires on a reload, a remount or a code change. */

function Small({
  children,
  onClick,
  tone = "plain",
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "plain" | "primary" | "danger";
  title?: string;
  disabled?: boolean;
}) {
  const tones = {
    plain: "border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-neutral-100",
    primary: "border-emerald-500 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
    danger: "border-red-900/70 text-red-300 hover:border-red-500 hover:text-red-200",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`border px-2 py-1.5 text-[0.5625rem] uppercase tracking-[0.1em] disabled:opacity-30 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

/* ── the banner shown when a draft is waiting ───────────────────────────── */

export function RestorePrompt({
  draft,
  onContinue,
  onLoadCode,
}: {
  draft: Envelope;
  onContinue: () => void;
  onLoadCode: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-emerald-600/50 bg-emerald-500/10 px-4 py-2.5">
      <div>
        <p className="text-[0.625rem] uppercase tracking-[0.2em] text-emerald-300">
          Saved floor plan found
        </p>
        <p className="mt-0.5 text-[0.6875rem] text-emerald-100/70">
          Last saved {stamp(draft.savedAt)} · {countOf(draft.floorPlan)}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Small onClick={onContinue} tone="primary">Continue saved work</Small>
        {confirming ? (
          <>
            <span className="text-[0.625rem] text-red-300">Discard the saved draft?</span>
            <Small onClick={onLoadCode} tone="danger">Yes, load code version</Small>
            <Small onClick={() => setConfirming(false)}>Cancel</Small>
          </>
        ) : (
          <Small onClick={() => setConfirming(true)}>Load code version</Small>
        )}
      </div>
    </div>
  );
}

/* ── the toolbar cluster ────────────────────────────────────────────────── */

export type SaveState = "idle" | "saving" | "saved" | "failed";

export function PersistenceBar({
  saveState,
  savedAt,
  dirty,
  snapshots,
  onSaveDraft,
  onSnapshot,
  onRestoreSnapshot,
  onDeleteSnapshot,
  onDownload,
  onImport,
  onClearDraft,
  doc,
}: {
  saveState: SaveState;
  savedAt: string | null;
  dirty: boolean;
  snapshots: Snapshot[];
  onSaveDraft: () => void;
  onSnapshot: (label: string) => void;
  onRestoreSnapshot: (s: Snapshot) => void;
  onDeleteSnapshot: (id: string) => void;
  onDownload: () => void;
  onImport: (file: File) => void;
  onClearDraft: () => void;
  doc: EditorDoc;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [pending, setPending] = useState<Snapshot | null>(null);

  const status =
    saveState === "saving"
      ? "Saving…"
      : saveState === "failed"
        ? "Save failed"
        : savedAt
          ? `Saved ✓ ${stamp(savedAt).split(" ").slice(2).join(" ")}`
          : "Not saved yet";

  return (
    <div className="relative flex items-center gap-1.5">
      <span
        className={`text-[0.5625rem] uppercase tracking-[0.1em] ${
          saveState === "failed"
            ? "text-red-400"
            : dirty
              ? "text-amber-400"
              : "text-emerald-400/80"
        }`}
      >
        {status}
        {dirty && saveState !== "saving" ? " ·" : ""}
      </span>

      <Small onClick={onSaveDraft} tone="primary" title="Save the whole editor state now">
        Save draft
      </Small>

      <Small onClick={() => setPanelOpen((v) => !v)} title="Backups and snapshots">
        Backups {snapshots.length > 0 ? `(${snapshots.length})` : ""}
      </Small>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImport(file);
          e.target.value = "";
        }}
      />

      {panelOpen ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 border border-neutral-700 bg-neutral-950 p-3 shadow-xl">
          <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">
            Backup file
          </p>
          <div className="mt-2 flex gap-1.5">
            <Small onClick={onDownload}>Download backup</Small>
            <Small onClick={() => fileRef.current?.click()}>Import backup</Small>
          </div>

          <div className="mt-4 border-t border-neutral-800 pt-3">
            <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">
              Snapshots · {snapshots.length}/20
            </p>
            <div className="mt-2 flex gap-1.5">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="optional name"
                className="min-w-0 flex-1 border border-neutral-700 bg-neutral-900 px-2 py-1 text-[0.6875rem] text-neutral-200 outline-none focus:border-emerald-500/70"
              />
              <Small
                onClick={() => {
                  onSnapshot(label);
                  setLabel("");
                }}
              >
                Create snapshot
              </Small>
            </div>

            <ul className="mt-2 max-h-56 overflow-y-auto">
              {snapshots.length === 0 ? (
                <li className="py-2 text-[0.6875rem] text-neutral-600">
                  No snapshots yet.
                </li>
              ) : null}
              {snapshots.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 border-b border-neutral-800/70 py-1.5 text-[0.6875rem]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-neutral-200">{s.label}</span>
                    <span className="block text-[0.625rem] text-neutral-600">
                      {countOf(s.floorPlan)}
                    </span>
                  </span>
                  {pending?.id === s.id ? (
                    <>
                      <Small
                        onClick={() => {
                          onRestoreSnapshot(s);
                          setPending(null);
                          setPanelOpen(false);
                        }}
                        tone="primary"
                      >
                        Replace
                      </Small>
                      <Small onClick={() => setPending(null)}>No</Small>
                    </>
                  ) : (
                    <>
                      <Small onClick={() => setPending(s)}>Restore</Small>
                      <Small onClick={() => onDeleteSnapshot(s.id)} tone="danger">
                        ✕
                      </Small>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {pending ? (
              <p className="mt-2 text-[0.625rem] leading-relaxed text-amber-300">
                Restoring replaces everything on the canvas. Your current work stays in
                the draft and in undo.
              </p>
            ) : null}
          </div>

          <div className="mt-4 border-t border-neutral-800 pt-3">
            <p className="text-[0.5625rem] uppercase tracking-[0.16em] text-neutral-500">
              Danger
            </p>
            <div className="mt-2">
              {confirmClear ? (
                <div className="space-y-2">
                  <p className="text-[0.625rem] leading-relaxed text-red-300">
                    This deletes the saved draft from this browser. Snapshots and
                    downloaded backups are not touched. There is no undo.
                  </p>
                  <div className="flex gap-1.5">
                    <Small
                      onClick={() => {
                        onClearDraft();
                        setConfirmClear(false);
                      }}
                      tone="danger"
                    >
                      Yes, clear the draft
                    </Small>
                    <Small onClick={() => setConfirmClear(false)}>Cancel</Small>
                  </div>
                </div>
              ) : (
                <Small onClick={() => setConfirmClear(true)} tone="danger">
                  Clear saved draft…
                </Small>
              )}
            </div>
          </div>

          <p className="mt-3 border-t border-neutral-800 pt-2 text-[0.625rem] leading-relaxed text-neutral-600">
            {countOf(doc)} on the canvas now. COPY FLOOR PLAN DATA is still how this
            becomes lib/floor-plan.ts.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/* A failed import says so and changes nothing. */
export function ImportError({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-red-800 bg-red-950/60 px-4 py-2 text-[0.6875rem] text-red-200">
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-auto border border-red-800 px-2 py-1 text-[0.5625rem] uppercase tracking-[0.1em] hover:border-red-500"
      >
        Dismiss
      </button>
    </div>
  );
}
