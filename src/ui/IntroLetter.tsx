import { LETTER } from '../core/tutorial';

/** La carta del tío Fausto: lo primero que se lee al empezar una partida con tutorial. */
export function IntroLetter({ onOpen }: { onOpen: () => void }) {
  return (
    <div class="intro-letter" role="dialog" aria-label="Carta de tu tío Fausto">
      <article class="intro-page">
        <span class="intro-head">{LETTER.head}</span>
        {LETTER.body.map((p, i) => (
          <p key={i} style={{ animationDelay: `${0.4 + i * 0.5}s` }}>
            {p}
          </p>
        ))}
        <span class="intro-sign" style={{ animationDelay: `${0.4 + LETTER.body.length * 0.5}s` }}>
          {LETTER.sign}
        </span>
        <button class="btn btn-gold intro-go" onClick={onOpen}>
          Entrar en la taberna
        </button>
      </article>
    </div>
  );
}
