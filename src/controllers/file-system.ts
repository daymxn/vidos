import {
  access,
  appendFile,
  constants,
  mkdir,
  readdir,
  readFile,
  unlink,
  writeFile,
} from "fs/promises";
import { chain, difference } from "lodash";
import paths from "path";
import process from "process";
import { fileURLToPath } from "url";

/**
 * Provides file system related operations.
 *
 * Abstracted away to make
 */
export class FileSystem {
  /**
   * The root directory for the file system operations.
   *
   * @static
   */
  static root = paths.dirname(fileURLToPath(import.meta.url));

  static isWindows = process.platform == "win32";

  /**
   * Reads a file and returns its contents as an array of lines.
   *
   * @param {string} path - The path to the file.
   * @returns {Promise<string[]>} - A promise that resolves to an array of lines in the file.
   */
  async readLines(path: string): Promise<string[]> {
    return chain(await this.readData(path))
      .split("\n")
      .value();
  }

  /**
   * Deletes a file at the specified path.
   *
   * @param {string} path - The path to the file to delete.
   */
  async delete(path: string) {
    return await unlink(path);
  }

  /**
   * Creates a directory at the specified path.
   *
   * @param {string} path - The directory path to create.
   * @param {boolean} [overwrite=true] - Whether to overwrite if the directory exists.
   * @returns {Promise<string | undefined>} - A promise that resolves to the path of the created directory.
   */
  async directory(path: string, overwrite: boolean = true): Promise<string | undefined> {
    return await mkdir(path, { recursive: overwrite });
  }

  /**
   * Reads data from a file.
   *
   * @param {string} path - The path to the file.
   * @returns {Promise<string>} - A promise that resolves to the content of the file.
   */
  async readData(path: string): Promise<string> {
    return await readFile(path, "utf8");
  }

  /**
   * Writes an array of lines to a file.
   *
   * @param {string} path - The path to the file.
   * @param {string[]} lines - The lines to write to the file.
   * @param {boolean} [createPath=true] - Whether to create the file path if it doesn't exist.
   */
  async writeLines(path: string, lines: string[], createPath: boolean = true) {
    await this.write(path, lines.join("\n"), createPath);
  }

  /**
   * Writes data to a file.
   *
   * @param {string} path - The path to the file.
   * @param {string|string[]} data - The data to write to the file.
   * @param {boolean} [createPath=true] - Whether to create the file path if it doesn't exist.
   */
  async write(path: string, data: string | string[], createPath: boolean = true) {
    if (createPath) {
      await this.directory(paths.dirname(path));
    }

    await writeFile(path, data, "utf8");
  }

  /**
   * Appends data to a file.
   *
   * @param {string} path - The path to the file.
   * @param {string} data - The data to append to the file.
   */
  async append(path: string, data: string) {
    await appendFile(path, data);
  }

  /**
   * Checks if a file exists at the specified path.
   *
   * @param {string} path - The path to the file.
   * @returns {Promise<boolean>} - A promise that resolves to true if the file exists, otherwise false.
   */
  async exists(path: string): Promise<boolean> {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lists files in a directory, optionally excluding specified files.
   *
   * @param {string} path - The directory path to list files from.
   * @param {string[]} [excluding=[]] - An array of file names to exclude.
   * @returns {Promise<string[]>} - An array of file names in the directory.
   */
  async listFiles(path: string, excluding: string[] = []): Promise<string[]> {
    const files = await readdir(path);

    return difference(files, excluding); // TODO: might need to swap
  }
}
