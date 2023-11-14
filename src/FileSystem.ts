import {access, constants, mkdir, readdir, readFile, unlink, writeFile} from "fs/promises";
import _ from "lodash";
import paths from 'path'
import {fileExists} from "./util.js";
import {fp} from "./fp.js";

export class FileSystem {
    async readLines(path: string): Promise<string[]> {
        return _.chain(await this.readData(path))
            .split("\n")
            .value()
    }

    async delete(path: string) {
        return await unlink(path)
    }

    async directory(path: string, overwrite: boolean = true): Promise<string | undefined> {
        return await mkdir(path, { recursive: overwrite })
    }

    async readData(path: string): Promise<string> {
        return await readFile(path, 'utf8')
    }

    async writeLines(path: string, lines: string[], createPath: boolean = true) {
        await this.write(path, lines.join('\n'), createPath)
    }

    async write(path: string, data: string | string[], createPath: boolean = true) {
        if(createPath) {
            await this.directory(paths.dirname(path))
        }

        await writeFile(path, data, 'utf8')
    }

    async exists(path: string): Promise<boolean> {
        try {
            await access(path, constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    async listFiles(path: string, excluding: string[] = []): Promise<string[]> {
        const files = await readdir(path)

        return fp.difference(files)(excluding)
    }
}
