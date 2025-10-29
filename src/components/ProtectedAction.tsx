import { useState, ReactNode } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdminPasswordModal } from './AdminPasswordModal';

interface ProtectedActionProps {
  action: string;
  children: (execute: () => void) => ReactNode;
  onSuccess?: () => void;
}

export const ProtectedAction = ({ action, children, onSuccess }: ProtectedActionProps) => {
  const { isAdminAuthenticated, authenticateAdmin, hasPasswordConfigured, logAdminAction } = useAdminAuth();
  const [showModal, setShowModal] = useState(false);

  const execute = async () => {
    if (!hasPasswordConfigured) {
      if (onSuccess) onSuccess();
      return;
    }

    if (isAdminAuthenticated) {
      await logAdminAction(action);
      if (onSuccess) onSuccess();
    } else {
      setShowModal(true);
    }
  };

  const handleAuthenticated = async () => {
    await logAdminAction(action);
    if (onSuccess) onSuccess();
  };

  return (
    <>
      {children(execute)}
      <AdminPasswordModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleAuthenticated}
        onAuthenticate={authenticateAdmin}
        title="Autenticação Necessária"
        description={`Esta ação requer PIN administrativo: ${action}`}
      />
    </>
  );
};
