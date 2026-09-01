/**
 * A Home compõe seções; ela não desenha nada por conta própria.
 *
 * Cada seção mora em `src/features/home/` e é responsável pelo próprio
 * comportamento em mobile — mobile não é um passe de correção no fim.
 */

import { useLanguage } from '../context/LanguageContext';
import { HAS_BASEBOT_SHOTS, WORK_IMAGES } from '../features/home/homeData';
import { AboutTeaser } from '../features/home/AboutTeaser';
import { ContactClose } from '../features/home/ContactClose';
import { EvidenceBand } from '../features/home/EvidenceBand';
import { Hero } from '../features/home/Hero';
import { SectionHeading } from '../features/home/SectionHeading';
import { ToolsList } from '../features/home/ToolsList';
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
        href="/fmm"
        shots={[
          { ...WORK_IMAGES.fmmPrimary, label: t.work.fmm.shots.primary.label, alt: t.work.fmm.shots.primary.alt },
          { ...WORK_IMAGES.fmmSecondary, label: t.work.fmm.shots.secondary.label, alt: t.work.fmm.shots.secondary.alt },
        ]}
      />

      {HAS_BASEBOT_SHOTS && (
        <WorkBlock
          mirrored
          kicker={t.work.basebot.kicker}
          title={t.work.basebot.title}
          description={t.work.basebot.description}
          tags={t.work.basebot.tags}
          link={t.work.basebot.link}
          href="/products"
          shots={[
            { ...WORK_IMAGES.basebotPrimary, label: t.work.basebot.shots.primary.label, alt: t.work.basebot.shots.primary.alt },
            { ...WORK_IMAGES.basebotSecondary, label: t.work.basebot.shots.secondary.label, alt: t.work.basebot.shots.secondary.alt },
          ]}
        />
      )}

      <ToolsList />
      <AboutTeaser />
      <ContactClose />
    </div>
  );
};

export default Home;
