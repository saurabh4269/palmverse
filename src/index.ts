// Fonts are bundled (OFL, via @fontsource) so the app makes no third-party requests and works offline.
import '@fontsource/mukta/500.css';
import '@fontsource/mukta/600.css';
import '@fontsource/mukta/700.css';
import '@fontsource/rozha-one/400.css';
import '@fontsource/tiro-devanagari-hindi/400.css';
import { AssetManager, World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { HastRekhaSystem } from './director.js';
import { initPage } from './page.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then((world) => {
  // IWSDK initialises its KTX2 loader with the unpkg transcoder. Our manifest is empty, so
  // re-initialising here (before any model loads) is safe; the transcoder is served locally at
  // ./basis/ by the vite plugin in vite.config.ts. No CDN requests at runtime.
  AssetManager.init(world.renderer, world, { ktx2TranscoderPath: `${import.meta.env.BASE_URL}basis/` });
  world.registerSystem(HastRekhaSystem);
  initPage(() => world.launchXR());
});
