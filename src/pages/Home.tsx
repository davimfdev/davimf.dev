/**
 * A Home compõe seções; ela não desenha nada por conta própria.
 *
 * Cada seção mora em `src/features/home/` e é responsável pelo próprio
 * comportamento em mobile — mobile não é um passe de correção no fim.
 */

import { useLanguage } from '../context/LanguageContext';
import { WORK_IMAGES } from '../features/home/homeData';
import { EvidenceBand } from '../features/home/EvidenceBand';
import { Hero } from '../features/home/Hero';
import { SectionHeading } from '../features/home/SectionHeading';
import { WorkBlock } from '../features/home/WorkBlock';

const Home = () => {
  const { translations } = useLanguage();
  const t = translations.home;

  return (
    <div className="max-w-content mx-auto">
      <Hero />
      <EvidenceBand />

      <SectionHeading label={t.work.heading} id="work" />

      <WorkBlock
        kicker={t.work.fmm.kicker}
        title={t.work.fmm.title}
        description={t.work.fmm.description}
        tags={t.work.fmm.tags}
        link={t.work.fmm.link}
        href="/products"
        shots={[
          { ...WORK_IMAGES.fmmPrimary, label: t.work.fmm.shots.primary.label, alt: t.work.fmm.shots.primary.alt },
          { ...WORK_IMAGES.fmmSecondary, label: t.work.fmm.shots.secondary.label, alt: t.work.fmm.shots.secondary.alt },
        ]}
      />
    </div>
  );
};

export default Home;
