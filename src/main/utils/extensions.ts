import { webContents } from 'electron';
import {
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { format } from 'url';
import { resolve } from 'path';

import { Manifest } from '~/interfaces';
import { Global } from '../interfaces';
import { getPath } from '.';
import { defaultPaths } from '~/defaults';
import Nedb from 'nedb';
import { StorageArea } from '~/main/models/storage-area';

declare const global: Global;

export const startBackgroundPage = (manifest: Manifest) => {
  if (manifest.background) {
    const { background, extensionId } = manifest;
    const { page, scripts } = background;
    const { srcDirectory } = manifest;

    let html = Buffer.from('');
    let name;

    if (page) {
      name = page;
      html = readFileSync(resolve(srcDirectory, page));
    } else if (scripts) {
      name = 'generated.html';
      html = Buffer.from(
        `<html>
          <body>${scripts
            .map(script => `<script src="${script}"></script>`)
            .join('')}
          </body>
        </html>`,
        'utf8',
      );
    }

    // The create method doesn't exist in the WebContents type.
    const contents = (webContents as any).create({
      partition: 'persist:wexond_extension',
      isBackgroundPage: true,
      commandLineSwitches: ['--background-page'],
      preload: resolve(__dirname, 'build/background-page-preload.js'),
    });

    global.backgroundPages[extensionId] = {
      html,
      name,
      webContentsId: contents.id,
    };

    contents.openDevTools({ mode: 'detach' });

    contents.loadURL(
      format({
        protocol: 'wexond-extension',
        slashes: true,
        hostname: extensionId,
        pathname: name,
      }),
    );
  }
};

export const loadExtensions = () => {
  const extensionsPath = getPath('extensions');
  const files = readdirSync(extensionsPath);

  for (const dir of files) {
    const extensionPath = resolve(extensionsPath, dir);
    const stats = statSync(extensionPath);

    if (stats.isDirectory()) {
      const manifestPath = resolve(extensionPath, 'manifest.json');
      if (existsSync(manifestPath)) {
        const manifest: Manifest = JSON.parse(
          readFileSync(manifestPath, 'utf8'),
        );

        manifest.extensionId = dir;
        manifest.srcDirectory = extensionPath;

        global.extensions[manifest.extensionId] = manifest;

        const extensionStoragePath = getPath(
          defaultPaths.extensionsStorage,
          manifest.extensionId,
        );

        const local = new StorageArea(resolve(extensionStoragePath, 'local'));
        const sync = new StorageArea(resolve(extensionStoragePath, 'sync'));
        const managed = new StorageArea(
          resolve(extensionStoragePath, 'managed'),
        );

        global.databases[manifest.extensionId] = { local, sync, managed };

        startBackgroundPage(manifest);
      }
    }
  }
};
