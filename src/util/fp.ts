import _ from "lodash";

import { startsWith, flow, tail, join } from "lodash/fp"

export const commentedOut = startsWith('#')
export const commentOut = (str: string): string => `#${str}`

export const removeFirst = flow(tail, join(''))

export function includedIn<T>(arr: T[]) {
    return _.curry(_.includes)(arr)
}
