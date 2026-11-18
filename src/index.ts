import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { HastRekhaSystem } from './director.js';
import { initPage } from './page.js';

World.create(document.getElementById('scene-container') as HTMLDivElement, projectOptions).then((world) => {
  world.registerSystem(HastRekhaSystem);
  initPage(() => world.launchXR());
});
