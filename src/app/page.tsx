import ChatShell from "@/components/Chat/ChatShell";
import { links } from "@/constants/links";

export default function Home() {
  return (
    <main>
      <div className="page-shell">
        <header className="brand-header">
          <div className="brand-identity">
            <img className="brand-logo brand-logo-hero" src="/CamaralLogo.png" alt="Camaral" />
            <p className="brand-subtitle">
              Asistente de ventas y soporte para responder dudas, calificar leads y guiar
              onboarding 24/7.
            </p>
          </div>
          <span className="brand-badge">Beta · Respuestas en español</span>
        </header>
        <ChatShell />
      </div>
      <a className="fixed-demo" href={links.bookDemo} target="_blank" rel="noreferrer">
        Agendar demo
      </a>
    </main>
  );
}
