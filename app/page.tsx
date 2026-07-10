"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { event, quizQuestions } from "../src/lib/event";
import { supabase } from "../src/lib/supabase";

type RsvpStatus = "idle" | "loading" | "success" | "error";

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

const localPostsKey = "annachiara-wall-posts";
const localScoresKey = "annachiara-quiz-scores";

export default function Home() {
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus>("idle");
  const [rsvpError, setRsvpError] = useState("");
  const [posts, setPosts] = useState<WallPost[]>([]);
  const [scores, setScores] = useState<QuizScore[]>([]);
  const [wallStatus, setWallStatus] = useState<RsvpStatus>("idle");
  const [hasPlusOne, setHasPlusOne] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizName, setQuizName] = useState("");
  const [quizError, setQuizError] = useState("");
  const [quizResult, setQuizResult] = useState<{ score: number; total: number } | null>(null);

  const isAfterDeadline = useMemo(() => {
    const today = new Date();
    const deadline = new Date(`${event.rsvpDeadline}T23:59:59+02:00`);
    return today > deadline;
  }, []);

  const previewPosts = useMemo(() => shufflePosts(posts).slice(0, 5), [posts]);

  useEffect(() => {
    void loadWallPosts();
    void loadScores();
  }, []);

  async function loadWallPosts() {
    if (!supabase) {
      setPosts(JSON.parse(localStorage.getItem(localPostsKey) || "[]"));
      return;
    }

    const { data } = await supabase
      .from("wall_posts")
      .select("id, author_name, message, image_url, created_at")
      .order("created_at", { ascending: false })
      .limit(30);

    if (data) {
      setPosts(data);
    }
  }

  async function loadScores() {
    if (!supabase) {
      setScores(JSON.parse(localStorage.getItem(localScoresKey) || "[]"));
      return;
    }

    const { data } = await supabase
      .from("quiz_scores")
      .select("id, player_name, score, total, created_at")
      .order("score", { ascending: false })
      .order("created_at", { ascending: true });

    if (data) {
      setScores(data);
    }
  }

  async function submitRsvp(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    const formElement = eventSubmit.currentTarget;
    setRsvpStatus("loading");
    setRsvpError("");

    const form = new FormData(formElement);
    const payload = {
      guest_name: String(form.get("guest_name") || "").trim(),
      attending: form.get("attending") === "yes",
      allergies: String(form.get("allergies") || "").trim(),
      plus_one_name: hasPlusOne ? String(form.get("plus_one_name") || "").trim() : "",
      plus_one_allergies: hasPlusOne ? String(form.get("plus_one_allergies") || "").trim() : "",
      message: String(form.get("message") || "").trim()
    };

    if (!payload.guest_name) {
      setRsvpError("Inserisci il tuo nome.");
      setRsvpStatus("error");
      return;
    }

    if (!supabase) {
      setRsvpStatus("success");
      formElement.reset();
      setHasPlusOne(false);
      return;
    }

    const { error } = await supabase.from("rsvps").insert(payload);
    if (error) {
      setRsvpError("Non sono riuscito a salvare la conferma. Riprova o scrivi al numero indicato.");
      setRsvpStatus("error");
      return;
    }

    setRsvpStatus("success");
    formElement.reset();
    setHasPlusOne(false);
  }

  async function submitWallPost(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setWallStatus("loading");

    const formElement = eventSubmit.currentTarget;
    const form = new FormData(formElement);
    const authorName = String(form.get("author_name") || "").trim();
    const message = String(form.get("message") || "").trim();
    const image = form.get("image") as File | null;

    if (!authorName || !image || image.size === 0) {
      setWallStatus("error");
      return;
    }

    if (image.size > 5 * 1024 * 1024) {
      setWallStatus("error");
      return;
    }

    if (!supabase) {
      const imageUrl = URL.createObjectURL(image);
      const localPost: WallPost = {
        id: crypto.randomUUID(),
        author_name: authorName,
        message,
        image_url: imageUrl,
        created_at: new Date().toISOString()
      };
      const nextPosts = [localPost, ...posts];
      setPosts(nextPosts);
      localStorage.setItem(localPostsKey, JSON.stringify(nextPosts));
      setWallStatus("success");
      formElement.reset();
      setSelectedFileName("");
      return;
    }

    const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("wall-images")
      .upload(path, image, { cacheControl: "3600", upsert: false });

    if (uploadError) {
      setWallStatus("error");
      return;
    }

    const { data: publicUrl } = supabase.storage.from("wall-images").getPublicUrl(path);
    const { error } = await supabase.from("wall_posts").insert({
      author_name: authorName,
      message,
      image_url: publicUrl.publicUrl
    });

    if (error) {
      setWallStatus("error");
      return;
    }

    setWallStatus("success");
    formElement.reset();
    setSelectedFileName("");
    await loadWallPosts();
  }

  async function submitQuiz(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    setQuizError("");

    if (!quizName.trim()) {
      setQuizResult(null);
      setQuizError("Inserisci il nome prima di fare il quiz.");
      return;
    }

    const total = quizQuestions.length;
    const score = quizQuestions.reduce((sum, question) => {
      const answer = normalizeAnswer(quizAnswers[question.id] || "");
      if (question.type === "choice") {
        return sum + (answer === normalizeAnswer(question.correctAnswer) ? 1 : 0);
      }
      return sum + (question.acceptedAnswers.map(normalizeAnswer).includes(answer) ? 1 : 0);
    }, 0);

    const result = { score, total };
    setQuizResult(result);

    const payload = {
      player_name: quizName.trim(),
      score,
      total
    };

    if (!supabase) {
      const localScore: QuizScore = {
        id: crypto.randomUUID(),
        ...payload,
        created_at: new Date().toISOString()
      };
      const nextScores = [...scores, localScore].sort((a, b) => b.score - a.score);
      setScores(nextScores);
      localStorage.setItem(localScoresKey, JSON.stringify(nextScores));
      return;
    }

    await supabase.from("quiz_scores").insert(payload);
    await loadScores();
  }

  return (
    <main className="partyShell">
      <div className="partyBg" aria-hidden="true" />
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 28 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>

      <nav className="partyNav" aria-label="Navigazione principale">
        <a href="#invito">Party</a>
        <a href="#rsvp">RSVP</a>
        <a href="#bacheca">Foto</a>
        <a href="#quiz">Game</a>
      </nav>

      <section className="partyHero" id="invito">
        <div className="heroCopy">
          <p className="kicker">Graduation party</p>
          <h1>Annachiara si laurea!</h1>
          <p className="heroText">
            Una mattinata da ricordare, un brindisi nel centro storico e una bacheca piena di foto degli amici.
          </p>
          <div className="heroButtons">
            <a className="partyButton primary" href="#rsvp">Ci sono</a>
            <a className="partyButton light" href="#quiz">Faccio il quiz</a>
          </div>
        </div>

        <article className="partyPass" aria-label="Dettagli festa">
          <div className="passDate">
            <span>Luglio</span>
            <strong>27</strong>
          </div>
          <div className="passInfo">
            <p>{event.timeLabel}</p>
            <h2>{event.venueName}</h2>
            <address>{event.venueAddress}</address>
          </div>
          <div className="passActions">
            <a className="partyButton primary" href="#rsvp">Conferma</a>
            <a className="partyButton outline" href={event.mapsUrl} target="_blank" rel="noreferrer">Mappa</a>
          </div>
        </article>
      </section>

      <section className="partySection quickGrid" aria-label="Info rapide">
        <article className="quickCard hot">
          <span>Quando</span>
          <strong>{event.dateLabel}</strong>
          <p>Subito dopo la proclamazione.</p>
        </article>
        <article className="quickCard">
          <span>Dove</span>
          <strong>Napoli centro</strong>
          <p>{event.venueName}</p>
        </article>
        <article className="quickCard green">
          <span>Rispondi</span>
          <strong>Entro {event.rsvpDeadlineLabel}</strong>
          <p>Allergie e +1 inclusi.</p>
        </article>
      </section>

      <section className="partySection rsvpParty" id="rsvp">
        <div className="sectionTitle">
          <span>RSVP</span>
          <h2>Dimmi se vieni alla festa</h2>
          <p>Serve solo un minuto: presenza, allergie e accompagnatore.</p>
          {isAfterDeadline && (
            <p className="notice" role="status">
              La data consigliata per confermare e passata: invia comunque la risposta e scrivi al
              numero {event.contactPhone}.
            </p>
          )}
        </div>

        <form className="partyPanel partyForm" onSubmit={submitRsvp}>
          <label>
            Nome e cognome *
            <input name="guest_name" autoComplete="name" required />
          </label>
          <fieldset>
            <legend>Ci sarai? *</legend>
            <label className="radioLine">
              <input type="radio" name="attending" value="yes" defaultChecked />
              Si, partecipo
            </label>
            <label className="radioLine">
              <input type="radio" name="attending" value="no" />
              No, non posso
            </label>
          </fieldset>
          <label className="checkLine">
            <input
              type="checkbox"
              checked={hasPlusOne}
              onChange={(eventChange) => setHasPlusOne(eventChange.target.checked)}
            />
            Ho il +1
          </label>
          {hasPlusOne && (
            <div className="twoCols">
              <label>
                Nome +1
                <input name="plus_one_name" autoComplete="name" required={hasPlusOne} />
              </label>
              <label>
                Allergie +1
                <input name="plus_one_allergies" />
              </label>
            </div>
          )}
          <label>
            Allergie o intolleranze
            <textarea name="allergies" rows={3} placeholder="Scrivi eventuali esigenze alimentari" />
          </label>
          <label>
            Messaggio per Annachiara
            <textarea name="message" rows={3} />
          </label>
          <button className="partyButton primary" disabled={rsvpStatus === "loading"}>
            {rsvpStatus === "loading" ? "Invio..." : "Invia conferma"}
          </button>
          {rsvpStatus === "success" && <p className="success">Conferma salvata, grazie.</p>}
          {rsvpStatus === "error" && <p className="error">{rsvpError || "Controlla i campi e riprova."}</p>}
        </form>
      </section>

      <section className="partySection memoryParty" id="bacheca">
        <div className="sectionTitle">
          <span>Photo wall</span>
          <h2>Carica una foto per Annachiara</h2>
          <p>Una dedica breve, una foto bella, e la bacheca prende vita.</p>
        </div>

        <form className="partyPanel partyForm compact" onSubmit={submitWallPost}>
          <div className="twoCols">
            <label>
              Il tuo nome *
              <input name="author_name" required />
            </label>
            <label className="filePicker">
              Foto *
              <input
                name="image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
                onChange={(eventChange) => setSelectedFileName(eventChange.target.files?.[0]?.name || "")}
              />
              <span>{selectedFileName || "Scegli una foto"}</span>
            </label>
          </div>
          <label>
            Dedica
            <textarea name="message" rows={3} maxLength={240} />
          </label>
          <button className="partyButton primary" disabled={wallStatus === "loading"}>
            {wallStatus === "loading" ? "Carico..." : "Pubblica in bacheca"}
          </button>
          {wallStatus === "success" && <p className="success">Post pubblicato.</p>}
          {wallStatus === "error" && <p className="error">Non sono riuscito a pubblicare. Controlla nome, foto e dimensione file.</p>}
        </form>

        <div className="gallery" aria-live="polite">
          {posts.length === 0 ? (
            <p className="empty">La bacheca e pronta: la prima foto puo essere la tua.</p>
          ) : (
            previewPosts.map((post) => (
              <article className="postCard" key={post.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- User uploads are dynamic Supabase URLs in a static export. */}
                <img src={post.image_url} alt={`Foto pubblicata da ${post.author_name}`} loading="lazy" />
                <div>
                  <strong>{post.author_name}</strong>
                  {post.message && <p>{post.message}</p>}
                </div>
              </article>
            ))
          )}
        </div>
        {posts.length > 5 && (
          <div className="galleryActions">
            <Link className="partyButton light" href="/gallery">Vedi tutte le foto</Link>
          </div>
        )}
      </section>

      <section className="partySection quizParty" id="quiz">
        <div className="sectionTitle">
          <span>Quiz time</span>
          <h2>Quanto la conosci davvero?</h2>
          <p>Gioca, salva il punteggio e sfida gli altri invitati.</p>
        </div>

        <form className="partyPanel partyForm quizForm" onSubmit={submitQuiz}>
          <label>
            Nome per la classifica *
            <input
              value={quizName}
              onChange={(eventChange) => setQuizName(eventChange.target.value)}
              required
            />
          </label>
          {quizQuestions.map((question, index) => (
            <fieldset key={question.id} className="questionBlock">
              <legend>
                {index + 1}. {question.question}
              </legend>
              {question.type === "choice" ? (
                question.options.map((option) => (
                  <label className="radioLine" key={option}>
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      onChange={(eventChange) =>
                        setQuizAnswers((current) => ({ ...current, [question.id]: eventChange.target.value }))
                      }
                    />
                    {option}
                  </label>
                ))
              ) : (
                <input
                  placeholder={question.placeholder}
                  value={quizAnswers[question.id] || ""}
                  onChange={(eventChange) =>
                    setQuizAnswers((current) => ({ ...current, [question.id]: eventChange.target.value }))
                  }
                />
              )}
            </fieldset>
          ))}
          <button className="partyButton primary">Scopri il punteggio</button>
          {quizError && <p className="error">{quizError}</p>}
          {quizResult && (
            <p className="result" role="status">
              Hai fatto <strong>{quizResult.score}/{quizResult.total}</strong>.
            </p>
          )}
        </form>

        <div className="leaderboard">
          <h3>Classifica</h3>
          {scores.length === 0 ? (
            <p className="empty">Ancora nessun punteggio salvato.</p>
          ) : (
            <ol>
              {scores.map((score) => (
                <li key={score.id}>
                  <span>{score.player_name}</span>
                  <strong>{score.score}/{score.total}</strong>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </main>
  );
}

function shufflePosts(posts: WallPost[]) {
  return [...posts]
    .map((post) => ({ post, order: Math.random() }))
    .sort((a, b) => a.order - b.order)
    .map(({ post }) => post);
}

function normalizeAnswer(answer: string) {
  return answer
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
