"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../src/lib/supabase";

type WallPost = {
  id: string;
  author_name: string;
  message: string | null;
  image_url: string;
  created_at: string;
};

const localPostsKey = "annachiara-wall-posts";

export default function GalleryPage() {
  const [posts, setPosts] = useState<WallPost[]>([]);

  useEffect(() => {
    async function loadWallPosts() {
      if (!supabase) {
        setPosts(JSON.parse(localStorage.getItem(localPostsKey) || "[]"));
        return;
      }

      const { data } = await supabase
        .from("wall_posts")
        .select("id, author_name, message, image_url, created_at")
        .order("created_at", { ascending: false });

      if (data) {
        setPosts(data);
      }
    }

    void loadWallPosts();
  }, []);

  return (
    <main className="galleryPage">
      <nav className="adminTopbar">
        <Link href="/#bacheca">Torna all&apos;invito</Link>
        <Link className="partyButton light" href="/admin">Admin</Link>
      </nav>

      <section className="adminHeader">
        <span className="kicker">Photo wall</span>
        <h1>Tutte le foto</h1>
        <p>Foto e dediche caricate dagli invitati.</p>
      </section>

      <div className="gallery fullGallery" aria-live="polite">
        {posts.length === 0 ? (
          <p className="empty">Nessuna foto caricata.</p>
        ) : (
          posts.map((post) => (
            <article className="postCard" key={post.id}>
              {/* eslint-disable-next-line @next/next/no-img-element -- User uploads are dynamic Supabase URLs. */}
              <img src={post.image_url} alt={`Foto pubblicata da ${post.author_name}`} loading="lazy" />
              <div>
                <strong>{post.author_name}</strong>
                {post.message && <p>{post.message}</p>}
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
