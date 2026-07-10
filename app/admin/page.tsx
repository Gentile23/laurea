"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { event } from "../../src/lib/event";
import { supabase } from "../../src/lib/supabase";

type LoadStatus = "idle" | "loading" | "success" | "error";
type MutationResult = { error: { message: string } | null };
type DeleteResult = MutationResult & { data: { id: string }[] | null };

type Rsvp = {
  id: string;
  guest_name: string;
  attending: boolean;
  allergies: string | null;
  plus_one_name: string | null;
  plus_one_allergies: string | null;
  message: string | null;
  created_at: string;
};

type WallPost = {
  id: string;
  author_name: string;
  message: string | null;
  image_url: string;
  created_at: string;
};

type QuizScore = {
  id: string;
  player_name: string;
  score: number;
  total: number;
  created_at: string;
};

const adminSessionKey = "annachiara-admin-auth";
const localPostsKey = "annachiara-wall-posts";
const localScoresKey = "annachiara-quiz-scores";
const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "annachiara2026";

export default function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(adminSessionKey) === "true"
  );
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [actionMessage, setActionMessage] = useState("");
  const [rsvps, setRsvps] = useState<Rsvp[]>([]);
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [scores, setScores] = useState<QuizScore[]>([]);

  const attendingCount = useMemo(() => rsvps.filter((rsvp) => rsvp.attending).length, [rsvps]);
  const notAttendingCount = rsvps.length - attendingCount;
  const plusOnesCount = useMemo(
    () => rsvps.filter((rsvp) => Boolean(rsvp.plus_one_name?.trim())).length,
    [rsvps]
  );

  useEffect(() => {
    if (isAuthed) {
      void loadAdminData();
    }
  }, [isAuthed]);

  function submitLogin(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (password !== adminPassword) {
      setAuthError("Password non corretta.");
      return;
    }

    sessionStorage.setItem(adminSessionKey, "true");
    setAuthError("");
    setIsAuthed(true);
  }

  async function loadAdminData() {
    setStatus("loading");
    setActionMessage("");

    if (!supabase) {
      setRsvps([]);
      setPosts(JSON.parse(localStorage.getItem(localPostsKey) || "[]"));
      setScores(JSON.parse(localStorage.getItem(localScoresKey) || "[]"));
      setStatus("success");
      return;
    }

    const [rsvpsResult, postsResult, scoresResult] = await Promise.all([
      supabase.from("rsvps").select("*").order("created_at", { ascending: false }),
      supabase.from("wall_posts").select("*").order("created_at", { ascending: false }),
      supabase
        .from("quiz_scores")
        .select("*")
        .order("score", { ascending: false })
        .order("created_at", { ascending: true })
    ]);

    if (rsvpsResult.error || postsResult.error || scoresResult.error) {
      setStatus("error");
      setActionMessage("Non riesco a caricare i dati admin. Controlla le policy Supabase.");
      return;
    }

    setRsvps(rsvpsResult.data || []);
    setPosts(postsResult.data || []);
    setScores(scoresResult.data || []);
    setStatus("success");
  }

  async function deleteRsvp(id: string) {
    if (!(await confirmDelete("Eliminare questa conferma?"))) {
      return;
    }

    if (!supabase) {
      return;
    }

    const client = supabase;
    await runDelete(
      () => client.from("rsvps").delete().eq("id", id).select("id"),
      "Conferma eliminata."
    );
  }

  async function deleteScore(id: string) {
    if (!(await confirmDelete("Eliminare questo punteggio?"))) {
      return;
    }

    if (!supabase) {
      const nextScores = scores.filter((score) => score.id !== id);
      setScores(nextScores);
      localStorage.setItem(localScoresKey, JSON.stringify(nextScores));
      setActionMessage("Punteggio locale eliminato.");
      return;
    }

    const client = supabase;
    await runDelete(
      () => client.from("quiz_scores").delete().eq("id", id).select("id"),
      "Punteggio eliminato."
    );
  }

  async function deletePost(post: WallPost) {
    if (!(await confirmDelete("Eliminare questa foto dalla bacheca?"))) {
      return;
    }

    if (!supabase) {
      const nextPosts = posts.filter((item) => item.id !== post.id);
      setPosts(nextPosts);
      localStorage.setItem(localPostsKey, JSON.stringify(nextPosts));
      setActionMessage("Foto locale eliminata.");
      return;
    }

    const client = supabase;
    const storagePath = getStoragePath(post.image_url);
    if (storagePath) {
      const { error } = await client.storage.from("wall-images").remove([storagePath]);
      if (error) {
        setStatus("error");
        setActionMessage(`Eliminazione immagine non riuscita: ${error.message}`);
        return;
      }
    }

    await runDelete(
      () => client.from("wall_posts").delete().eq("id", post.id).select("id"),
      "Foto eliminata."
    );
  }

  async function clearLocalData() {
    if (!(await confirmDelete("Svuotare dati locali di foto e classifica su questo browser?"))) {
      return;
    }

    localStorage.removeItem(localPostsKey);
    localStorage.removeItem(localScoresKey);
    setPosts([]);
    setScores([]);
    setActionMessage("Dati locali svuotati.");
  }

  async function updateRsvp(id: string, eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    const form = new FormData(eventSubmit.currentTarget);
    const payload = {
      guest_name: String(form.get("guest_name") || "").trim(),
      attending: form.get("attending") === "yes",
      allergies: String(form.get("allergies") || "").trim() || null,
      plus_one_name: String(form.get("plus_one_name") || "").trim() || null,
      plus_one_allergies: String(form.get("plus_one_allergies") || "").trim() || null,
      message: String(form.get("message") || "").trim() || null
    };

    if (!payload.guest_name) {
      setStatus("error");
      setActionMessage("Il nome della conferma non puo essere vuoto.");
      return;
    }

    if (!supabase) {
      return;
    }

    const client = supabase;
    await runMutation(
      () => client.from("rsvps").update(payload).eq("id", id),
      "Conferma aggiornata."
    );
  }

  async function updatePost(id: string, eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    const form = new FormData(eventSubmit.currentTarget);
    const payload = {
      author_name: String(form.get("author_name") || "").trim(),
      message: String(form.get("message") || "").trim() || null
    };

    if (!payload.author_name) {
      setStatus("error");
      setActionMessage("Il nome della foto non puo essere vuoto.");
      return;
    }

    if (!supabase) {
      const nextPosts = posts.map((post) => (post.id === id ? { ...post, ...payload } : post));
      setPosts(nextPosts);
      localStorage.setItem(localPostsKey, JSON.stringify(nextPosts));
      setActionMessage("Foto locale aggiornata.");
      setStatus("success");
      return;
    }

    const client = supabase;
    await runMutation(
      () => client.from("wall_posts").update(payload).eq("id", id),
      "Foto aggiornata."
    );
  }

  async function updateScore(id: string, eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    const form = new FormData(eventSubmit.currentTarget);
    const payload = {
      player_name: String(form.get("player_name") || "").trim(),
      score: Number(form.get("score")),
      total: Number(form.get("total"))
    };

    if (!payload.player_name || !Number.isInteger(payload.score) || !Number.isInteger(payload.total)) {
      setStatus("error");
      setActionMessage("Nome e punteggio devono essere validi.");
      return;
    }

    if (!supabase) {
      const nextScores = scores
        .map((score) => (score.id === id ? { ...score, ...payload } : score))
        .sort((a, b) => b.score - a.score);
      setScores(nextScores);
      localStorage.setItem(localScoresKey, JSON.stringify(nextScores));
      setActionMessage("Punteggio locale aggiornato.");
      setStatus("success");
      return;
    }

    const client = supabase;
    await runMutation(
      () => client.from("quiz_scores").update(payload).eq("id", id),
      "Punteggio aggiornato."
    );
  }

  async function runDelete(
    action: () => PromiseLike<DeleteResult>,
    successMessage: string
  ) {
    setStatus("loading");
    const { data, error } = await action();
    if (error) {
      setStatus("error");
      setActionMessage(`Eliminazione non riuscita: ${error.message}`);
      return;
    }

    if (!data || data.length === 0) {
      setStatus("error");
      setActionMessage("Eliminazione non riuscita: nessun elemento trovato o policy Supabase non aggiornata.");
      return;
    }

    setActionMessage(successMessage);
    await loadAdminData();
  }

  async function runMutation(
    action: () => PromiseLike<MutationResult>,
    successMessage: string,
    errorPrefix = "Aggiornamento non riuscito"
  ) {
    setStatus("loading");
    const { error } = await action();
    if (error) {
      setStatus("error");
      setActionMessage(`${errorPrefix}: ${error.message}`);
      return;
    }

    setActionMessage(successMessage);
    await loadAdminData();
  }

  if (!isAuthed) {
    return (
      <main className="adminShell">
        <section className="adminLogin partyPanel">
          <span className="kicker">Admin</span>
          <h1>Gestione invito</h1>
          <p>Accesso rapido per controllare RSVP, bacheca foto e quiz.</p>
          <form className="partyForm" onSubmit={submitLogin}>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(eventChange) => setPassword(eventChange.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button className="partyButton primary">Entra</button>
            {authError && <p className="error">{authError}</p>}
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="adminShell">
      <nav className="adminTopbar">
        <Link href="/">Invito</Link>
        <button className="partyButton light" onClick={loadAdminData} disabled={status === "loading"}>
          {status === "loading" ? "Aggiorno..." : "Aggiorna"}
        </button>
      </nav>

      <section className="adminHeader">
        <span className="kicker">Admin</span>
        <h1>{event.graduateName}</h1>
        <p>Controlla risposte, foto e classifica. Le eliminazioni sono definitive su Supabase.</p>
      </section>

      {actionMessage && (
        <p className={status === "error" ? "error" : "success"} role="status">
          {actionMessage}
        </p>
      )}

      <section className="adminStats" aria-label="Statistiche">
        <article className="quickCard">
          <span>RSVP</span>
          <strong>{rsvps.length}</strong>
          <p>{attendingCount} si, {notAttendingCount} no, {plusOnesCount} +1.</p>
        </article>
        <article className="quickCard green">
          <span>Foto</span>
          <strong>{posts.length}</strong>
          <p>Post pubblicati in bacheca.</p>
        </article>
        <article className="quickCard hot">
          <span>Quiz</span>
          <strong>{scores.length}</strong>
          <p>Punteggi salvati.</p>
        </article>
      </section>

      {!supabase && (
        <section className="partyPanel adminSection">
          <div>
            <h2>Modalita locale</h2>
            <p>Supabase non e configurato: qui vedi solo foto e quiz salvati in questo browser.</p>
          </div>
          <button className="partyButton light" onClick={clearLocalData}>Svuota dati locali</button>
        </section>
      )}

      <section className="partyPanel adminSection">
        <div>
          <h2>Conferme</h2>
          <p>Presenze, allergie, accompagnatori e messaggi.</p>
        </div>
        <div className="adminList">
          {rsvps.length === 0 ? (
            <p className="empty">Nessuna conferma trovata.</p>
          ) : (
            rsvps.map((rsvp) => (
              <article className="adminRow" key={rsvp.id}>
                <form className="adminEditForm" onSubmit={(eventSubmit) => updateRsvp(rsvp.id, eventSubmit)}>
                  <div className="twoCols">
                    <label>
                      Nome
                      <input name="guest_name" defaultValue={rsvp.guest_name} required />
                    </label>
                    <fieldset>
                      <legend>Presenza</legend>
                      <label className="radioLine">
                        <input type="radio" name="attending" value="yes" defaultChecked={rsvp.attending} />
                        Viene
                      </label>
                      <label className="radioLine">
                        <input type="radio" name="attending" value="no" defaultChecked={!rsvp.attending} />
                        Non viene
                      </label>
                    </fieldset>
                  </div>
                  <div className="twoCols">
                    <label>
                      Allergie
                      <input name="allergies" defaultValue={rsvp.allergies || ""} />
                    </label>
                    <label>
                      Nome +1
                      <input name="plus_one_name" defaultValue={rsvp.plus_one_name || ""} />
                    </label>
                  </div>
                  <div className="twoCols">
                    <label>
                      Allergie +1
                      <input name="plus_one_allergies" defaultValue={rsvp.plus_one_allergies || ""} />
                    </label>
                    <label>
                      Messaggio
                      <input name="message" defaultValue={rsvp.message || ""} />
                    </label>
                  </div>
                  <div className="adminActions">
                    <button className="partyButton primary" disabled={status === "loading"}>Salva</button>
                    <button className="dangerButton" type="button" onClick={() => deleteRsvp(rsvp.id)}>Elimina</button>
                  </div>
                </form>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="partyPanel adminSection">
        <div>
          <h2>Bacheca foto</h2>
          <p>Rimuovi foto e dediche pubblicate.</p>
        </div>
        <div className="adminList">
          {posts.length === 0 ? (
            <p className="empty">Nessuna foto trovata.</p>
          ) : (
            posts.map((post) => (
              <article className="adminRow withThumb" key={post.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Supabase public upload URLs are dynamic. */}
                <img src={post.image_url} alt="" />
                <form className="adminEditForm" onSubmit={(eventSubmit) => updatePost(post.id, eventSubmit)}>
                  <div className="twoCols">
                    <label>
                      Nome
                      <input name="author_name" defaultValue={post.author_name} required />
                    </label>
                    <label>
                      Dedica
                      <input name="message" defaultValue={post.message || ""} maxLength={240} />
                    </label>
                  </div>
                  <div className="adminActions">
                    <button className="partyButton primary" disabled={status === "loading"}>Salva</button>
                    <button className="dangerButton" type="button" onClick={() => deletePost(post)}>Elimina</button>
                  </div>
                </form>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="partyPanel adminSection">
        <div>
          <h2>Classifica quiz</h2>
          <p>Elimina punteggi duplicati o test.</p>
        </div>
        <div className="adminList">
          {scores.length === 0 ? (
            <p className="empty">Nessun punteggio trovato.</p>
          ) : (
            scores.map((score) => (
              <article className="adminRow" key={score.id}>
                <form className="adminEditForm" onSubmit={(eventSubmit) => updateScore(score.id, eventSubmit)}>
                  <div className="scoreEditGrid">
                    <label>
                      Nome
                      <input name="player_name" defaultValue={score.player_name} required />
                    </label>
                    <label>
                      Punti
                      <input name="score" type="number" min="0" defaultValue={score.score} required />
                    </label>
                    <label>
                      Totale
                      <input name="total" type="number" min="1" defaultValue={score.total} required />
                    </label>
                  </div>
                  <div className="adminActions">
                    <button className="partyButton primary" disabled={status === "loading"}>Salva</button>
                    <button className="dangerButton" type="button" onClick={() => deleteScore(score.id)}>Elimina</button>
                  </div>
                </form>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function getStoragePath(imageUrl: string) {
  const marker = "/wall-images/";
  const markerIndex = imageUrl.indexOf(marker);
  if (markerIndex === -1) {
    return "";
  }

  return decodeURIComponent(imageUrl.slice(markerIndex + marker.length).split("?")[0]);
}

async function confirmDelete(message: string) {
  return window.confirm(message);
}
