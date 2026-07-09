# Invito laurea Annachiara

Sito statico per la festa di laurea di Annachiara Soldivieri, pronto per Dokploy.

## Sezioni

- Invito con data, luogo e mappa.
- RSVP con presenza, allergie, nome +1 e allergie +1.
- Bacheca pubblica con foto e dedica.
- Quiz personalizzato con classifica completa.

## Setup locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

Senza variabili Supabase l'app resta navigabile e usa fallback locali per bacheca/quiz, ma RSVP e upload reali richiedono Supabase.

## Supabase

1. Crea un progetto Supabase.
2. Apri SQL Editor e lancia `supabase/schema.sql`.
3. Copia Project URL e anon public key in `.env.local` e in Dokploy.
4. Per aggiornare il quiz modifica `src/lib/event.ts`.

Le policy permettono inserimento pubblico di RSVP, foto e punteggi perche il sito e un invito condiviso via link. Il sito imposta `noindex` per non essere indicizzato.

## Deploy Dokploy

Tipo app: Static Site.

- Build command: `npm run build`
- Publish directory: `out`
- Node version: 20
- Environment variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Contenuti da completare

In `src/lib/event.ts` sostituisci `DA COMPLETARE` con le risposte corrette per:

- Come si chiamava il coniglietto?
- Come si chiama il gatto?
