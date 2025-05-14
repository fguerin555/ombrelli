import React, { useState, useEffect, useCallback } from "react";
import { db } from "../../firebase"; // Ajuste le chemin si nécessaire
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp, // On garde Timestamp pour le formatage
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp, // Importer serverTimestamp
} from "firebase/firestore";
import styles from "./FeedBackPage.module.css"; // Assure-toi que le nom du fichier CSS est correct
import { useAuth } from "../../contexts/AuthContext"; // Importer useAuth

const FeedbackPage = () => {
  const [feedbackList, setFeedbackList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [newComment, setNewComment] = useState("");
  const { currentUser, loading: authLoading } = useAuth(); // Récupérer currentUser et l'état de chargement de l'auth

  // Pour stocker le texte des réponses en cours d'écriture
  const [replyTexts, setReplyTexts] = useState({});

  // // Simuler l'identification du développeur.
  // const DEVELOPER_NAME = "Frédéric (Dev)"; // Tu peux changer ça

  const fetchFeedback = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const feedbackCollectionRef = collection(db, "feedback");
      const q = query(feedbackCollectionRef, orderBy("lastActivityAt", "desc"));
      const querySnapshot = await getDocs(q);
      const feedbacks = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setFeedbackList(feedbacks);
    } catch (err) {
      console.error("Erreur lors de la récupération des feedbacks:", err);
      setError("Impossibile caricare i commenti. Riprova.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleNewCommentSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Devi essere connesso per lasciare un commento.");
      return;
    }
    if (!newComment.trim()) {
      alert("Entra un commento.");
      return;
    }
    setIsLoading(true);
    try {
      await addDoc(collection(db, "feedback"), {
        authorName: currentUser.email, // Utiliser l'email de l'utilisateur connecté
        comment: newComment.trim(),
        createdAt: serverTimestamp(),
        replies: [],
        lastActivityAt: serverTimestamp(),
      });
      setNewComment("");
      fetchFeedback();
    } catch (err) {
      console.error("Erreur lors de l'ajout du feedback:", err);
      setError("Errore durante l'invio del commento.");
      setIsLoading(false);
    }
  };

  const handleReplySubmit = async (feedbackId) => {
    const replyText = replyTexts[feedbackId];
    if (!replyText || !replyText.trim()) {
      alert("Entra una risposta.");
      return;
    }

    setIsLoading(true);
    try {
      const feedbackDocRef = doc(db, "feedback", feedbackId);
      await updateDoc(feedbackDocRef, {
        replies: arrayUnion({
          replierName: currentUser.email,
          replyText: replyText.trim(),
          repliedAt: Timestamp.now(),
        }),
        lastActivityAt: serverTimestamp(),
      });

      setReplyTexts((prev) => ({ ...prev, [feedbackId]: "" }));
      fetchFeedback();
    } catch (err) {
      console.error("Errore durante l'aggiunta della risposta:", err);
      setError("Errore durante l'invio della risposta.");
      setIsLoading(false);
    }
  };

  const handleReplyTextChange = (feedbackId, text) => {
    setReplyTexts((prev) => ({ ...prev, [feedbackId]: text }));
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "Data sconosciuta";
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate().toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    console.warn("Format de date inattendu:", timestamp);
    return String(timestamp);
  };

  return (
    <div className={styles.feedbackPageContainer}>
      <h1>Pagina di commenti </h1>
      <p className={styles.pageDescription}>
        lascia i tuoi commenti, i tuoi suggerimenti,le tue domande qui. Ti
        rispondero a pena possibile! !
      </p>

      {authLoading ? (
        <p>Verifica autenticazione...</p>
      ) : currentUser ? (
        <form onSubmit={handleNewCommentSubmit} className={styles.feedbackForm}>
          <h2>Lascia un nuovo commento</h2>
          <div className={styles.formGroup}>
            <p>
              Stai commentando come: <strong>{currentUser.email}</strong>
            </p>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="newComment">Commento :</label>
            <textarea
              id="newComment"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="scrivi il tuo commento qui..."
              rows="4"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={styles.submitButton}
          >
            {isLoading ? "Invio in corso..." : "Manda il commento"}
          </button>
        </form>
      ) : (
        <p className={styles.loginPrompt}>
          Per favore, <a href="/ombrelli/login">accedi</a> per lasciare un
          commento.
        </p>
      )}

      {error && <p className={styles.errorText}>{error}</p>}
      <div className={styles.feedbackList}>
        <h2>Commenti esistanti</h2>
        {isLoading && feedbackList.length === 0 && (
          <p>Caricamento dei commenti...</p>
        )}
        {!isLoading && feedbackList.length === 0 && (
          <p>Nessun commento per ora.</p>
        )}
        {feedbackList.map((fb) => (
          <div key={fb.id} className={styles.feedbackItem}>
            <div className={styles.commentBlock}>
              <p className={styles.commentText}>
                <strong>{fb.authorName}</strong> ha detto:{" "}
                {/* Traduit en italien */}
              </p>
              <p>{fb.comment}</p>
              <small className={styles.timestamp}>
                Il {formatDate(fb.createdAt)} {/* "Le" devient "Il" */}
              </small>
            </div>

            {fb.replies && fb.replies.length > 0 && (
              <div className={styles.repliesSection}>
                <h4>Risposte :</h4>
                {fb.replies
                  .sort((a, b) => {
                    const dateA =
                      a.repliedAt instanceof Timestamp
                        ? a.repliedAt.seconds
                        : 0;
                    const dateB =
                      b.repliedAt instanceof Timestamp
                        ? b.repliedAt.seconds
                        : 0;
                    return dateA - dateB;
                  })
                  .map((reply, index) => (
                    <div key={index} className={styles.replyItem}>
                      <p className={styles.commentText}>
                        <strong>{reply.replierName}</strong> ha risposto:{" "}
                        {/* Traduit en italien */}
                      </p>
                      <p>{reply.replyText}</p>
                      <small className={styles.timestamp}>
                        Il {formatDate(reply.repliedAt)}
                      </small>
                    </div>
                  ))}
              </div>
            )}

            <div className={styles.replyForm}>
              <textarea
                value={replyTexts[fb.id] || ""}
                onChange={(e) => handleReplyTextChange(fb.id, e.target.value)}
                placeholder="Scrivi una risposta qui..."
                rows="2"
              />
              <button
                onClick={() => handleReplySubmit(fb.id)}
                disabled={isLoading}
                className={styles.replyButton}
              >
                Rispondi
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeedbackPage;
