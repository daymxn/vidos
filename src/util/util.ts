import AdmZip from "adm-zip";
import axios from "axios";
import { InvalidArgumentError } from "commander";
import { mkdtemp, move, readdir, remove, writeFile } from "fs-extra";
import { find } from "lodash";
import { endsWith, isEqual, omit } from "lodash-es";
import { tmpdir } from "node:os";
import path from "path";
import * as tar from "tar";

/**
 * Interface representing changes with added and removed items.
 *
 * @template T - The type of the items.
 * @property {T[]} removed - The array of removed items.
 * @property {T[]} added - The array of added items.
 */
interface Changes<T> {
  removed: T[];
  added: T[];
}

// TODO: document
function Lie<T>(value: any): T {
  return value as unknown as T;
}

// TODO: document
class Lazy<T> {
  private _value?: T;
  private _isInitialized: boolean = false;
  private readonly initializer: () => T;

  constructor(initializer: () => T) {
    this.initializer = initializer;
    // @ts-ignore
    return new Proxy(
      {},
      {
        get: (target, prop, receiver) => {
          if (!this._isInitialized) {
            this._value = this.initializer();
            this._isInitialized = true;
          }
          const value = this._value as T;
          // @ts-ignore
          const property = Reflect.get(value, prop, receiver);
          if (typeof property === "function") {
            return property.bind(value);
          }
          return property;
        },
      }
    );
  }
}

// TODO: document
class LateInit<T> {
  private _value?: T;

  get value(): T {
    if (!this._value) throw new Error("Value not initialized");

    return this._value;
  }

  set value(val: T) {
    this._value = val;
  }
}

// TODO: document
function lateInit<T>(): T {
  const value = new LateInit<T>();

  return Lie<T>(value);
}

// TODO: document
function lazy<T>(initializer: () => T): T {
  const value = new Lazy(initializer);

  return Lie<T>(value);
}
/**
 * Encodes an instance of a class to a JSON string, excluding specified properties.
 *
 * @template T - The type of the instance.
 * @param {T} instance - The class instance to encode.
 * @param {string[]} [ignoreProperties=[]] - Properties to ignore during encoding.
 * @returns {string} - The JSON string representation of the instance.
 */
function encodeClassToJSON<T>(instance: T, ignoreProperties: string[] = []): string {
  return JSON.stringify(
    instance,
    (key, value) => {
      if (typeof value === "function") {
        return undefined;
      }
      if (ignoreProperties.includes(key)) return undefined;
      return value;
    },
    2
  );
}

/**
 * Checks if an array contains an object, ignoring specified properties.
 *
 * @template T - The type of the objects in the array.
 * @param {T[]} arr - The array to search.
 * @param {T} target - The object to find in the array.
 * @param {Array<keyof T>} [propsToIgnore=[]] - Properties to ignore during comparison.
 * @returns {boolean} - True if the array contains the target object, false otherwise.
 */
function arrayContains<T extends { [key: string]: any }>(
  arr: T[],
  target: T,
  propsToIgnore: Array<keyof T> = []
): boolean {
  const fixedTarget = omit(target, propsToIgnore);

  return arr.some((item) => isEqual(omit(item, propsToIgnore), fixedTarget));
}

/**
 * Downloads a zipped folder from a URL and unzips it to a specified output path.
 *
 * @param {string} fileUrl - The URL of the zipped folder to download.
 * @param {string} outputPath - The path to output the unzipped contents of the folder.
 * @returns {Promise<void>}
 */
async function downloadAndUnzipFolder(fileUrl: string, outputPath: string): Promise<void> {
  const temp_directory = await mkdtemp(path.join(tmpdir(), "vidos-"));
  try {
    const response = await axios({
      method: "GET",
      url: fileUrl,
      responseType: "arraybuffer",
    });

    const extension = path.extname(fileUrl).toLowerCase();
    const tempFilePath = path.join(temp_directory, "archive" + extension);

    await writeFile(tempFilePath, response.data);

    switch (extension) {
      case ".zip": {
        const zip = new AdmZip(tempFilePath);
        zip.extractAllTo(temp_directory, true);
        break;
      }
      case ".gz":
      case ".tgz":
      case ".tar": {
        await tar.extract({ file: tempFilePath, cwd: temp_directory });
        break;
      }
      default:
        throw new InvalidArgumentError(`Unsupported extension: ${extension}`);
    }

    const extracted_contents = await readdir(temp_directory);
    const folder = find(extracted_contents, (file) => !endsWith(file, ".zip"));
    const folder_path = path.join(temp_directory, folder!!);
    await move(folder_path, outputPath, { overwrite: true });
  } finally {
    await remove(temp_directory);
  }
}

/**
 * Removes the port number from an IP address string.
 *
 * @param {string} ip - The IP address string.
 * @returns {string} - The IP address without the port number.
 */
function removePortFromIp(ip: string): string {
  const portIndex = ip.indexOf(":");
  if (portIndex == -1) return ip;

  return ip.substring(0, portIndex);
}

export {
  Changes,
  Lie,
  arrayContains,
  downloadAndUnzipFolder,
  encodeClassToJSON,
  lateInit,
  lazy,
  removePortFromIp,
};
