'use client';

import { MAIN_APP_URL } from '../constants';

export function ManifestoCard() {
  return (
    <section className="support-card manifesto-card animate-in">
      <div className="support-card-title">Manifesto</div>
      <p className="support-card-copy">
        365 Days of Light and Dark is a commitment to ship one piece every day,
        no matter the mood, and archive the full journey onchain.
      </p>
      <ul className="manifesto-points">
        <li>Daily output over perfection.</li>
        <li>Light and dark are both part of the story.</li>
        <li>Collectors support the experiment staying alive.</li>
      </ul>
      <a
        className="manifesto-link"
        href={MAIN_APP_URL}
        target="_blank"
        rel="noreferrer"
      >
        Read full experience →
      </a>
    </section>
  );
}
