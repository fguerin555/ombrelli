// /Users/fredericguerin/Desktop/ombrelli/src/pages/LoginPageFile/LoginPage.js
import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext"; // Ajuste le chemin si nécessaire
import { useNavigate } from "react-router-dom"; // Si tu utilises react-router-dom v6+
import styles from "./LoginPage.module.css";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false); // Nouvel état pour la visibilité du mot de passe
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate("/"); // Redirige vers la page d'accueil (ou une autre page protégée) après connexion
    } catch (err) {
      console.error("Erreur de connexion:", err);
      // Gérer les erreurs spécifiques de Firebase Auth
      if (
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Email o password sbagliata.");
      } else if (err.code === "auth/invalid-email") {
        setError("Formato Email invalido.");
      } else {
        setError("Impossibile connecter. Veuillez réessayer.");
      }
    }
    setLoading(false);
  };

  return (
    <div className={styles.loginContainer}>
      <form onSubmit={handleSubmit} className={styles.loginForm}>
        <h2>Connexion</h2>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.formGroup}>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="password">Mot de passe</label>
          {/* Conteneur pour l'input et l'icône */}
          <div className={styles.passwordInputContainer}>
            <input
              // Change le type en 'text' si showPassword est true, sinon 'password'
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={styles.passwordInput} // Ajout d'une classe pour le style
            />
            {/* Bouton/Icône pour basculer la visibilité */}
            <button
              type="button" // Important: type="button" pour ne pas soumettre le formulaire
              onClick={() => setShowPassword(!showPassword)}
              className={styles.togglePasswordVisibility} // Ajout d'une classe pour le style
            >
              {/* Utilise un texte simple ou remplace par une icône (ex: 👁️ / ⚫️) */}
              {showPassword ? "⚫️" : "👁️"}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className={styles.loginButton}>
          {loading ? "Connexion en cours..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
