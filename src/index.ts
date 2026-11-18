// Fonts are bundled (OFL, via @fontsource) so the app makes no third-party requests and works offline.
import '@fontsource/mukta/500.css';
import '@fontsource/mukta/600.css';
import '@fontsource/mukta/700.css';
import '@fontsource/rozha-one/400.css';
import '@fontsource/tiro-devanagari-hindi/400.css';
import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { HastRekhaSystem } from './director.js';
import { initPage } from './page.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then((world) => {
  world.registerSystem(HastRekhaSystem);
  initPage(() => world.launchXR());
});
