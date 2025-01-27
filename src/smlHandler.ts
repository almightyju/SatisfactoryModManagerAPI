import path from 'path';
import fs from 'fs';
import bindings from 'bindings';
import { valid, coerce } from 'semver';
import {
  downloadFile,
} from './utils';
import { ModNotFoundError } from './errors';
import { debug } from './logging';
import { getSMLVersionInfo } from './ficsitApp';
import { smlCacheDir, ensureExists } from './paths';

const smlVersionNative = bindings('smlVersion');

const SMLDLLFileName = 'UE4-SML-Win64-Shipping.dll';
const SMLPakFileName = 'SML.pak';

export const SMLDLLRelativePath = path.join('loaders', SMLDLLFileName);
export const SMLPakRelativePath = path.join('loaders', SMLPakFileName);

export function getSMLVersion(satisfactoryPath: string): string | undefined {
  return smlVersionNative.getSMLVersion(path.join(satisfactoryPath, SMLDLLRelativePath));
}

export function getModsDir(satisfactoryPath: string): string {
  return path.join(satisfactoryPath, 'mods');
}

async function getSMLVersionCache(version: string): Promise<string> {
  const validVersion = valid(coerce(version));
  if (!validVersion) {
    throw new ModNotFoundError(`SML@${version} not found.`, 'SML', version);
  }
  const smlVersionCacheDir = path.join(smlCacheDir, validVersion);
  const smlDLLVerionCacheFile = path.join(smlVersionCacheDir, SMLDLLFileName);
  const smlPakVerionCacheFile = path.join(smlVersionCacheDir, SMLPakFileName);
  if (!fs.existsSync(smlVersionCacheDir)) {
    debug(`SML@${version} is not cached. Downloading`);
    const smlReleaseURL = (await getSMLVersionInfo(version))?.link;
    if (!smlReleaseURL) {
      throw new ModNotFoundError(`SML@${version} not found.`, 'SML', version);
    }
    const smlDLLDownloadLink = `${smlReleaseURL.replace('/tag/', '/download/')}/${SMLDLLFileName}`;
    const smlPakDownloadLink = `${smlReleaseURL.replace('/tag/', '/download/')}/${SMLPakFileName}`;
    let hasPak = true;
    try {
      await downloadFile(smlPakDownloadLink, smlPakVerionCacheFile, 'SML (1/2)', validVersion);
    } catch (e) {
      hasPak = false;
      debug(`Pak of SML version ${version} not found.`);
    }
    await downloadFile(smlDLLDownloadLink, smlDLLVerionCacheFile, `SML ${hasPak ? '(2/2)' : '(1/1)'}`, validVersion);
  }
  return smlVersionCacheDir;
}

export async function installSML(version: string, satisfactoryPath: string): Promise<void> {
  if (!getSMLVersion(satisfactoryPath)) {
    debug('Installing SML');
    const smlVersionCache = await getSMLVersionCache(version);
    ensureExists(path.dirname(path.join(satisfactoryPath, SMLDLLRelativePath)));
    ensureExists(path.dirname(path.join(satisfactoryPath, SMLPakRelativePath)));
    fs.copyFileSync(path.join(smlVersionCache, SMLDLLFileName), path.join(satisfactoryPath, SMLDLLRelativePath));
    if (fs.existsSync(path.join(smlVersionCache, SMLPakFileName))) {
      fs.copyFileSync(path.join(smlVersionCache, SMLPakFileName), path.join(satisfactoryPath, SMLPakRelativePath));
    }
  } else {
    debug('SML is already installed');
  }
}

export async function uninstallSML(satisfactoryPath: string): Promise<void> {
  const smlVersion = getSMLVersion(satisfactoryPath);
  if (!smlVersion) {
    debug('No SML to uninstall');
    return;
  }
  debug('Uninstalling SML');
  if (fs.existsSync(path.join(satisfactoryPath, SMLDLLRelativePath))) {
    fs.unlinkSync(path.join(satisfactoryPath, SMLDLLRelativePath));
  }
  if (fs.existsSync(path.join(satisfactoryPath, SMLPakRelativePath))) {
    fs.unlinkSync(path.join(satisfactoryPath, SMLPakRelativePath));
  }
}
