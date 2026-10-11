import { Composition } from "remotion";
import { PraylyPitchAd, praylyPitchSchema, PRAYLY_PITCH_DURATION } from "./PraylyPitchAd";
import { MetaDailyVerseAd, metaDailyVerseSchema, META_DAILY_VERSE_DURATION } from "./MetaDailyVerseAd";
import { MetaDailyPrayerAd, metaDailyPrayerSchema, META_DAILY_PRAYER_DURATION } from "./MetaDailyPrayerAd";
import { MetaAppFeaturesAd, metaAppFeaturesSchema, META_APP_FEATURES_DURATION } from "./MetaAppFeaturesAd";
import { MetaConvertAd, metaConvertSchema, META_CONVERT_DURATION } from "./MetaConvertAd";
import { MetaBeatDropAd, metaBeatDropSchema, META_BEAT_DROP_DURATION } from "./MetaBeatDropAd";
import { MetaWowAd, metaWowSchema, META_WOW_DURATION } from "./MetaWowAd";
import { PrayScreenFeatureFilm, PRAYSCREEN_FEATURE_DURATION } from "./PrayScreenFeatureFilm";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="prayly-pitch"
        component={PraylyPitchAd}
        durationInFrames={PRAYLY_PITCH_DURATION}
        fps={30}
        width={1080}
        height={1920}
        schema={praylyPitchSchema}
        defaultProps={{}}
      />
      <Composition
        id="meta-daily-verse"
        component={MetaDailyVerseAd}
        durationInFrames={META_DAILY_VERSE_DURATION}
        fps={30}
        width={1080}
        height={1920}
        schema={metaDailyVerseSchema}
        defaultProps={{}}
      />
      <Composition
        id="meta-daily-prayer"
        component={MetaDailyPrayerAd}
        durationInFrames={META_DAILY_PRAYER_DURATION}
        fps={30}
        width={1080}
        height={1920}
        schema={metaDailyPrayerSchema}
        defaultProps={{}}
      />
      <Composition
        id="meta-app-features"
        component={MetaAppFeaturesAd}
        durationInFrames={META_APP_FEATURES_DURATION}
        fps={30}
        width={1080}
        height={1920}
        schema={metaAppFeaturesSchema}
        defaultProps={{}}
      />
      <Composition
        id="meta-convert"
        component={MetaConvertAd}
        durationInFrames={META_CONVERT_DURATION}
        fps={30}
        width={1080}
        height={1920}
        schema={metaConvertSchema}
        defaultProps={{}}
      />
      <Composition
        id="meta-beat-drop"
        component={MetaBeatDropAd}
        durationInFrames={META_BEAT_DROP_DURATION}
        fps={30}
        width={1080}
        height={1920}
        schema={metaBeatDropSchema}
        defaultProps={{ audioTrack: "ReelAudio-10281.mp3" }}
      />
      <Composition
        id="meta-wow"
        component={MetaWowAd}
        durationInFrames={META_WOW_DURATION}
        fps={30}
        width={1080}
        height={1920}
        schema={metaWowSchema}
        defaultProps={{ audioTrack: "ReelAudio-10281.mp3" }}
      />
      <Composition
        id="prayscreen-feature"
        component={PrayScreenFeatureFilm}
        durationInFrames={PRAYSCREEN_FEATURE_DURATION}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
