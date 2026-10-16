"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PERMISSION_CATALOG, SECTION_DEFINITIONS, STANDARD_OFFICE_PERMISSIONS, type PermissionCode, type PermissionDefinition } from "@fuel/shared";
import { ActionButton } from "./controls";
import { Modal, SubmitButton, ErrorState, LoadingState, Badge } from "./ui";
import { api } from "../lib/api";
import { notifyError, notifySuccess } from "../lib/toast";
import { Shield, Eye, CheckSquare, Square, RefreshCw } from "lucide-react";

interface UserPermissionsModalProps {
  userId: string | null;
  userName: string;
  userRole: "OWNER" | "OFFICE_EMPLOYEE";
  isOpen: boolean;
  onClose: () => void;
}

export function UserPermissionsModal({ userId, userName, userRole, isOpen, onClose }: UserPermissionsModalProps) {
  const client = useQueryClient();
  const [selected, setSelected] = useState<Set<PermissionCode>>(new Set());

  const permissionsQuery = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: () => api<{ userId: string; role: string; permissions: PermissionCode[] }>(`/users/${userId}/permissions`),
    enabled: Boolean(userId) && isOpen
  });

  useEffect(() => {
    if (permissionsQuery.data?.permissions) {
      setSelected(new Set(permissionsQuery.data.permissions));
    }
  }, [permissionsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (perms: PermissionCode[]) =>
      api(`/users/${userId}/permissions`, {
        method: "PUT",
        body: JSON.stringify({ permissions: perms })
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["user-permissions", userId] }),
        client.invalidateQueries({ queryKey: ["my-permissions"] })
      ]);
      notifySuccess(`Ogolaanshaha ${userName} si guul leh ayaa loo kaydiyay`);
      onClose();
    },
    onError: (error) => notifyError(error, "Ogolaanshaha lama kaydin karin")
  });

  const togglePermission = (code: PermissionCode) => {
    const next = new Set(selected);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setSelected(next);
  };

  const handleSelectViewOnly = () => {
    const viewOnly = PERMISSION_CATALOG.filter((p: PermissionDefinition) => p.code.endsWith(".view")).map((p: PermissionDefinition) => p.code);
    setSelected(new Set(viewOnly));
  };

  const handleSelectAll = () => {
    const all = PERMISSION_CATALOG.map((p: PermissionDefinition) => p.code);
    setSelected(new Set(all));
  };

  const handleClearAll = () => {
    setSelected(new Set());
  };

  const handleSelectStandard = () => {
    setSelected(new Set(STANDARD_OFFICE_PERMISSIONS));
  };

  const isOwner = userRole === "OWNER";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ogolaanshaha Shaqaalaha: ${userName}`}>
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-card border rounded-lg">
          <div>
            <div className="font-semibold text-sm flex items-center gap-2">
              <Shield size={16} className="text-primary" />
              <span>{userName}</span>
              <Badge tone={isOwner ? "ok" : "info"}>{isOwner ? "Milkiile (Owner)" : "Shaqaale Xafiis"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isOwner
                ? "Milkiiluhu wuxuu leeyahay dhammaan awoodaha nidaamka si buuxda (Superuser)."
                : "Xulo qaybaha iyo hawlaha uu shaqaalahani geli karo ama fulin karo."}
            </p>
          </div>

          {!isOwner && (
            <div className="flex flex-wrap gap-1.5 text-xs">
              <button
                type="button"
                onClick={handleSelectStandard}
                className="btn small secondary inline-flex items-center gap-1"
                title="Heerka Caadiga ah ee Shaqaalaha Xafiiska"
              >
                <RefreshCw size={12} /> Heerka Shaqaalaha
              </button>
              <button
                type="button"
                onClick={handleSelectViewOnly}
                className="btn small secondary inline-flex items-center gap-1"
                title="Eeg Keliya (View Only)"
              >
                <Eye size={12} /> Eeg Keliya
              </button>
              <button
                type="button"
                onClick={handleSelectAll}
                className="btn small secondary inline-flex items-center gap-1"
                title="Dooro Dhammaan"
              >
                <CheckSquare size={12} /> Dhammaan
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="btn small secondary inline-flex items-center gap-1"
                title="Kansal Garee Dhammaan"
              >
                <Square size={12} /> Kansal
              </button>
            </div>
          )}
        </div>

        {permissionsQuery.isLoading ? (
          <LoadingState />
        ) : permissionsQuery.isError ? (
          <ErrorState message={permissionsQuery.error.message} />
        ) : (
          <div className="space-y-4">
            {SECTION_DEFINITIONS.map((section: (typeof SECTION_DEFINITIONS)[number]) => {
              const perms = PERMISSION_CATALOG.filter((p: PermissionDefinition) => p.section === section.id);
              if (perms.length === 0) return null;

              const sectionCodes = perms.map((p: PermissionDefinition) => p.code);
              const allSectionSelected = sectionCodes.every((c: PermissionCode) => selected.has(c));
              const someSectionSelected = sectionCodes.some((c: PermissionCode) => selected.has(c));

              const toggleSection = () => {
                const next = new Set(selected);
                if (allSectionSelected) {
                  sectionCodes.forEach((c: PermissionCode) => next.delete(c));
                } else {
                  sectionCodes.forEach((c: PermissionCode) => next.add(c));
                }
                setSelected(next);
              };

              return (
                <div key={section.id} className="border rounded-lg overflow-hidden bg-card/50">
                  <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
                    <span className="font-semibold text-sm">{section.label}</span>
                    {!isOwner && (
                      <button
                        type="button"
                        onClick={toggleSection}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        {allSectionSelected ? "Ka saar qaybta" : "Dooro qaybta"}
                      </button>
                    )}
                  </div>

                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {perms.map((perm: PermissionDefinition) => {
                      const isChecked = isOwner || selected.has(perm.code);

                      return (
                        <label
                          key={perm.code}
                          className={`flex items-start gap-2.5 p-2 rounded border transition-colors cursor-pointer text-xs ${
                            isChecked
                              ? "bg-primary/5 border-primary/30"
                              : "bg-background border-border hover:bg-muted/30"
                          } ${isOwner ? "opacity-75 cursor-not-allowed" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isOwner}
                            onChange={() => togglePermission(perm.code)}
                            className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <div className="flex-1">
                            <span className="font-medium text-foreground block">{perm.label}</span>
                            <span className="text-muted-foreground text-[11px] block mt-0.5 leading-tight">
                              {perm.description}
                            </span>
                            {perm.isOwnerOnlyByDefault && (
                              <span className="inline-block mt-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                🔒 Milkiile keliya (Default)
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {saveMutation.isError && <ErrorState message={saveMutation.error.message} />}

        <div className="flex justify-end gap-2 pt-3 border-t">
          <ActionButton className="btn" type="button" onClick={onClose}>
            Xir
          </ActionButton>
          {!isOwner && (
            <SubmitButton
              busy={saveMutation.isPending}
              className="btn primary"
              onClick={() => saveMutation.mutate(Array.from(selected))}
            >
              Kaydi Ogolaanshaha
            </SubmitButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
