import { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdminPasswordModal } from './AdminPasswordModal';

interface ProtectedRouteProps {
  pageName: string;
  children: ReactNode;
  fallbackRoute?: string;
}

export const ProtectedRoute = ({ pageName, children, fallbackRoute = '/dashboard' }: ProtectedRouteProps) => {
  const { isAdminAuthenticated, checkPageProtection, authenticateAdmin, hasPasswordConfigured } = useAdminAuth();
  const [showModal, setShowModal] = useState(false);
  const [canAccess, setCanAccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!hasPasswordConfigured) {
      setCanAccess(true);
      return;
    }

    const isProtected = checkPageProtection(pageName);
    
    if (!isProtected) {
      setCanAccess(true);
    } else if (isAdminAuthenticated) {
      setCanAccess(true);
    } else {
      setShowModal(true);
    }
  }, [isAdminAuthenticated, pageName, checkPageProtection, hasPasswordConfigured]);

  const handleAuthSuccess = () => {
    setCanAccess(true);
    setShowModal(false);
  };

  const handleCancel = () => {
    navigate(fallbackRoute);
  };

  if (!canAccess) {
    return (
      <AdminPasswordModal
        open={showModal}
        onClose={handleCancel}
        onSuccess={handleAuthSuccess}
        onAuthenticate={authenticateAdmin}
        title="Acesso Restrito"
        description={`Esta página requer autenticação administrativa: ${pageName}`}
      />
    );
  }

  return <>{children}</>;
};
