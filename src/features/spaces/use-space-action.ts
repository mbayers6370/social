"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSpaceClient } from "./client";
export function useSpaceAction() {
  const router = useRouter();
  const client = useSpaceClient();
  const [working, setWorking] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [checkedSavedChanges, setCheckedSavedChanges] = useState(false);
  function checkSavedChanges() {
    if (!uncertain || working || refreshing) return;
    startRefresh(() => {
      router.refresh();
      setCheckedSavedChanges(true);
    });
  }
  function resumeDraft() {
    if (!checkedSavedChanges || working || refreshing) return;
    setUncertain(false);
    setCheckedSavedChanges(false);
    setError("");
  }
  async function run(
    url: string,
    method: string,
    body?: object | File | FormData,
    create = false,
    options?: { headers?: Record<string, string>; refresh?: boolean },
  ) {
    if (working || refreshing || (create && uncertain)) return null;
    setWorking(true);
    setError("");
    setCheckedSavedChanges(false);
    try {
      let response: Response;
      try {
        response = await client.request(url, {
          method,
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
          ...(body instanceof FormData
            ? { body }
            : body instanceof File
              ? {
                  body,
                  headers: { "Content-Type": body.type, ...options?.headers },
                }
              : body
                ? {
                    body: JSON.stringify(body),
                    headers: { "Content-Type": "application/json" },
                  }
                : {}),
        });
      } catch {
        if (create) setUncertain(true);
        throw Error(
          create
            ? "The result is uncertain. Check saved changes before trying again."
            : "Couldn’t complete the change. Please try again.",
        );
      }
      if (!response.ok) {
        if (create && response.status >= 500) setUncertain(true);
        const data = await response.json().catch(() => null);
        throw Error(
          create && response.status >= 500
            ? "The result is uncertain. Check saved changes before trying again."
            : data?.error || "Couldn’t complete the change.",
        );
      }
      let value;
      try {
        value = response.status === 204 ? {} : await response.json();
      } catch {
        if (create) setUncertain(true);
        throw Error(
          "Couldn’t confirm the result. Check saved changes before trying again.",
        );
      }
      if (!client.preview && options?.refresh !== false)
        startRefresh(() => router.refresh());
      return value;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn’t complete the change.",
      );
      return null;
    } finally {
      setWorking(false);
    }
  }
  return {
    run,
    busy: working || refreshing,
    error,
    uncertain,
    checkedSavedChanges,
    checkSavedChanges,
    resumeDraft,
  };
}
