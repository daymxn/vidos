import axios from "axios";
import { isEqual, omit } from "lodash-es";
import * as unzip from "unzipper";

interface Changes<T> {
  removed: T[];
  added: T[];
}

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

function removePortFromIp(ip: string): string {
  const portIndex = ip.indexOf(":");
  if (portIndex == -1) return ip;

  return ip.substring(0, portIndex);
}

export { Changes, arrayContains, downloadAndUnzip, encodeClassToJSON, removePortFromIp };
