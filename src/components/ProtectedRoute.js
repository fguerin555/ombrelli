import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext"; // Assure-toi que le chemin est correct

const ProtectedRoute = () => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    // Tu peux afficher un spinner ou un message de chargement global ici
    // Ou, comme AuthProvider ne rend pas ses enfants pendant le chargement,
    // cette condition pourrait ne pas être strictement nécessaire si ProtectedRoute
    // est toujours un enfant de AuthProvider qui attend déjà.
    return <div>Caricamento autenticazione...</div>;
  }

  return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;
