import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * BrowserRouter troca os componentes na navegação mas não toca o scroll —
 * sem isto, ir de uma página comprida para outra pousa no meio da página
 * nova, na posição onde a antiga tinha ficado.
 *
 * Mora dentro do <Router> e fora das <Routes> em App.tsx para ver toda troca
 * de rota. Não renderiza nada.
 */
export function ScrollToTop() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // POP é voltar/avançar: o navegador já restaura a posição anterior, e
    // forçar o topo aí desfaria justamente o que o usuário espera.
    if (navigationType === 'POP') return;

    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ block: 'start', behavior: 'auto' });
        return;
      }
      // Âncora sem elemento correspondente: cair para o topo em vez de não
      // fazer nada, que deixaria a página exatamente onde a rota antiga tinha
      // parado.
    }

    // Sem `behavior: 'smooth'` de propósito — isto é um reset de posição,
    // não uma transição. Animar a rolagem da página inteira a cada navegação
    // é lento e desorientador, ainda mais numa página comprida.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.hash, navigationType]);

  return null;
}

export default ScrollToTop;
