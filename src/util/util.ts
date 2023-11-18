import axios from "axios";
import { isEqual, omit } from "lodash-es";
import * as unzip from "unzipper";

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
 * Downloads a file from a URL and unzips it to a specified output path.
 *
 * @param {string} fileUrl - The URL of the file to download.
 * @param {string} outputPath - The path to output the unzipped contents.
 * @returns {Promise<void>}
 */
async function downloadAndUnzip(fileUrl: string, outputPath: string): Promise<void> {
  try {
    const response = await axios({
      method: "GET",
      url: fileUrl,
      responseType: "stream",
    });

    const extractStream = unzip.Extract({ path: outputPath });
    response.data.pipe(extractStream);

    await new Promise((resolve, reject) => {
      extractStream.on("close", resolve);
      extractStream.on("error", reject);
    });
  } catch (error) {
    throw error;
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

export { Changes, arrayContains, downloadAndUnzip, encodeClassToJSON, removePortFromIp };
