import axios from "axios";
import { access, constants } from "fs/promises";
import { isEqual, omit, sortBy } from "lodash-es";
import * as unzipper from "unzipper";

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

interface Changes<T> {
  removed: T[];
  added: T[];
}

function arrayContains<T extends { [key: string]: any }>(
  arr: T[],
  target: T,
  propsToIgnore: Array<keyof T> = []
): boolean {
  const fixedTarget = omit(target, propsToIgnore);

  return arr.some((item) => isEqual(omit(item, propsToIgnore), fixedTarget));
}

async function downloadAndUnzip(fileUrl: string, outputPath: string): Promise<void> {
  try {
    const response = await axios({
      method: "GET",
      url: fileUrl,
      responseType: "stream",
    });

    const extractStream = unzipper.Extract({ path: outputPath });
    response.data.pipe(extractStream);

    await new Promise((resolve, reject) => {
      extractStream.on("close", resolve);
      extractStream.on("error", reject);
    });
  } catch (error) {
    throw error;
  }
}

interface Comparable {
  equals(other: Comparable): Boolean;
}

function includesInstance<T>(array: T[], instance: T): boolean {
  return array.some((element) => isEqual(element, instance));
}

function areEqual(thisArray: Comparable[], thatArray: Comparable[]): boolean {
  if (thisArray.length != thatArray.length) return false;

  for (const item of thisArray) {
    if (!includesInstance(thatArray, item)) return false;
  }

  for (const item of thatArray) {
    if (!includesInstance(thisArray, item)) return false;
  }

  return true;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function zipToMap<K, V>(keys: K[], values: V[]): Map<K, V> {
  const map = new Map<K, V>();

  // Ensure we only iterate over the length of the shortest array
  const length = Math.min(keys.length, values.length);
  for (let i = 0; i < length; i++) {
    map.set(keys[i], values[i]);
  }

  return map;
}

function splitArray<T>(array: T[], predicate: (element: T) => boolean): [T[], T[]] {
  return array.reduce<[T[], T[]]>(
    (result, element) => {
      predicate(element) ? result[0].push(element) : result[1].push(element);
      return result;
    },
    [[], []]
  );
}

function removePortFromIp(ip: string): string {
  const portIndex = ip.indexOf(":");
  if (portIndex == -1) return ip;

  return ip.substring(0, portIndex);
}

function createMapFromArray<X, Y>(array: X[], mapFunction: (element: X) => Y): Map<X, Y> {
  const map = new Map<X, Y>();

  array.forEach((element) => {
    const value = mapFunction(element); // Convert X to Y
    map.set(element, value);
  });

  return map;
}

function arraysContainSameElements<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) {
    return false;
  }
  const sortedArr1 = sortBy(arr1);
  const sortedArr2 = sortBy(arr2);
  return isEqual(sortedArr1, sortedArr2);
}

function hasCommonElements<T>(arr1: T[], arr2: T[]): boolean {
  return arr1.some((item) => arr2.includes(item));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findIndexOrNull<T>(array: T[], condition: (element: T) => Boolean): number | undefined {
  const index = array.findIndex(condition);
  return index !== -1 ? index : undefined;
}

export {
  Changes,
  Comparable,
  areEqual,
  arrayContains,
  arraysContainSameElements,
  createMapFromArray,
  downloadAndUnzip,
  encodeClassToJSON,
  fileExists,
  findIndexOrNull,
  hasCommonElements,
  includesInstance,
  removePortFromIp,
  splitArray,
  wait,
  zipToMap,
};
