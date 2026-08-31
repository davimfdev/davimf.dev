/**
 * A Home compõe seções; ela não desenha nada por conta própria.
 *
 * Cada seção mora em `src/features/home/` e é responsável pelo próprio
 * comportamento em mobile — mobile não é um passe de correção no fim.
 */

import { Hero } from '../features/home/Hero';
import { EvidenceBand } from '../features/home/EvidenceBand';

const Home = () => (
  <div className="max-w-content mx-auto">
    <Hero />
    <EvidenceBand />
  </div>
);

export default Home;
