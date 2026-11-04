/**
 * FastLogPage
 * PWA shortcut route (/fast-log): opens the Add Expense sheet over Home.
 */

import { useEffect } from "react";
import { Navigate } from "react-router-dom";

export interface FastLogPageProps {
  onOpenQuickAdd?: () => void;
}

export function FastLogPage({ onOpenQuickAdd }: FastLogPageProps) {
  useEffect(() => {
    onOpenQuickAdd?.();
  }, [onOpenQuickAdd]);

  return <Navigate to="/" replace />;
}

export default FastLogPage;
