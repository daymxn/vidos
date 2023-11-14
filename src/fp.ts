import { createRequire } from "module";
import _ from "lodash";
const require = createRequire(import.meta.url)

export const fp = require("lodash/fp")

export const commentedOut = fp.startsWith('#')
export const commentOut = (str: string): string => `#${str}`

export const removeFirst = fp.flow(fp.tail, fp.join(''))

export function includedIn<T>(arr: T[]) {
    return _.curry(_.includes)(arr)
}
