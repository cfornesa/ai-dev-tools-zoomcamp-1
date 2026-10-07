import { Navigate } from 'react-router-dom';

export default function LegacyArtPieceManagementRedirect() {
  return <Navigate to="/studio?kind=generated" replace />;
}
