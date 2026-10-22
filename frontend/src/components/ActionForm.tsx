"use client";

import { useState, type FormEvent } from "react";
import { isAxiosError } from "axios";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/services/apiClient";

export interface FormField {
  name: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  optional?: boolean;
  value?: string;
}

export function errorText(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data;
    return data?.message || "BOMA is unavailable. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

export default function ActionForm({ path, fields = [], label, method = "post", fixed = {}, onSuccess, variant = "" }: {
  path: string; fields?: FormField[]; label: string; method?: "post" | "patch" | "delete";
  fixed?: Record<string, unknown>; onSuccess?: () => void;
  /** Extra button classes, e.g. "secondary" or "danger" */
  variant?: string;
}) {
  const cache = useQueryClient();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values: Record<string, unknown> = { ...fixed };
    const data = new FormData(form);
    for (const field of fields) {
      const value = String(data.get(field.name) || "");
      if (value || !field.optional) values[field.name] = field.type === "number" ? Number(value) : value;
    }
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      await api.request({ url: path, method, data: values });
      setMessage("Saved successfully.");
      form.reset();
      await cache.invalidateQueries();
      onSuccess?.();
    } catch (error) { setMessage(errorText(error)); setFailed(true); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="action-form">
    {fields.map((field) => <label key={field.name} className="field-label">{field.label}
      {field.options ? <select name={field.name} required={!field.optional} defaultValue={field.value || ""}>
        <option value="">Select…</option>
        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : field.type === "textarea" ? <textarea name={field.name} required={!field.optional} maxLength={4000} rows={3} defaultValue={field.value} /> :
        <input name={field.name} type={field.type || "text"} required={!field.optional} defaultValue={field.value} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? "any" : undefined} />}
    </label>)}
    <button disabled={busy} className={`button ${variant}`}>{busy ? "Saving…" : label}</button>
    {message && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${failed ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{message}</p>}
  </form>;
}
